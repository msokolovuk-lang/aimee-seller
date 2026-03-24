/**
 * POST /api/customers/triggers
 * Триггерные сообщения: брошенная корзина, реактивация, ДР
 * Запускается через pg_cron или Railway cron
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function sendTelegram(botToken: string, chatId: string, text: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    })
    const data = await res.json()
    return data.ok === true
  } catch {
    return false
  }
}

async function getTelegramCreds(sellerId: string): Promise<{ bot_token: string; chat_id: string } | null> {
  const { data } = await supabase
    .from('brand_connectors')
    .select('credentials')
    .eq('seller_id', sellerId)
    .eq('type', 'telegram')
    .eq('status', 'active')
    .single()

  if (!data?.credentials) return null
  return data.credentials as any
}

async function logTrigger(params: {
  seller_id: string
  customer_id?: string
  channel: string
  trigger_type: string
  status: string
  error?: string
}) {
  await supabase.from('sales_agent_log').insert({
    seller_id:    params.seller_id,
    customer_id:  params.customer_id || null,
    channel:      params.channel,
    trigger_type: params.trigger_type,
    status:       params.status,
    error_message: params.error || null,
    triggered_at: new Date().toISOString(),
  })
}

// ─── Trigger handlers ───────────────────────────────────────────────────────

// Брошенная корзина — через 2 часа после add_to_cart без покупки
async function runAbandonedCartTrigger(sellerId: string): Promise<number> {
  const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000).toISOString()
  const oneDayAgo   = new Date(Date.now() - 24 * 3600 * 1000).toISOString()

  // Находим сессии с add_to_cart но без purchase за последние 2-24 часа
  const { data: cartEvents } = await supabase
    .from('buyer_activity')
    .select('session_id, seller_id, created_at')
    .eq('seller_id', sellerId)
    .eq('type', 'add_to_cart')
    .gte('created_at', oneDayAgo)
    .lte('created_at', twoHoursAgo)

  if (!cartEvents?.length) return 0

  const tg = await getTelegramCreds(sellerId)
  if (!tg) return 0

  let sent = 0
  const processedSessions = new Set<string>()

  for (const event of cartEvents) {
    if (!event.session_id || processedSessions.has(event.session_id)) continue
    processedSessions.add(event.session_id)

    // Проверяем что после этого не было purchase
    const { data: purchases } = await supabase
      .from('buyer_activity')
      .select('id')
      .eq('seller_id', sellerId)
      .eq('session_id', event.session_id)
      .eq('type', 'purchase')
      .gte('created_at', event.created_at)

    if (purchases?.length) continue // уже купил

    // Уже отправляли этой сессии?
    const { data: existing } = await supabase
      .from('sales_agent_log')
      .select('id')
      .eq('seller_id', sellerId)
      .eq('trigger_type', 'abandoned_cart')
      .contains('meta', { session_id: event.session_id })
      .limit(1)

    if (existing?.length) continue

    const text = `🛒 <b>Брошенная корзина</b>

Покупатель добавил товар в корзину, но не завершил заказ.

<b>Сессия:</b> ${event.session_id?.slice(0, 8)}...
<b>Время:</b> ${new Date(event.created_at).toLocaleString('ru')}

<a href="https://seller.getaimee.ru/orders">Посмотреть в AIMEE →</a>`

    const ok = await sendTelegram(tg.bot_token, tg.chat_id, text)

    await supabase.from('sales_agent_log').insert({
      seller_id:    sellerId,
      channel:      'telegram',
      trigger_type: 'abandoned_cart',
      status:       ok ? 'sent' : 'failed',
      meta:         { session_id: event.session_id },
      triggered_at: new Date().toISOString(),
    })

    if (ok) sent++
  }

  return sent
}

// Реактивация — покупатели не покупавшие 30 дней
async function runReactivationTrigger(sellerId: string): Promise<number> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()
  const sixtyDaysAgo  = new Date(Date.now() - 60 * 86400000).toISOString()

  const { data: customers } = await supabase
    .from('brand_customers')
    .select('id, name, email, phone, orders_count')
    .eq('seller_id', sellerId)
    .gte('last_order_at', sixtyDaysAgo)
    .lte('last_order_at', thirtyDaysAgo)
    .gt('orders_count', 0)
    .limit(20) // не флудим

  if (!customers?.length) return 0

  const tg = await getTelegramCreds(sellerId)
  if (!tg) return 0

  let sent = 0
  for (const customer of customers) {
    // Проверяем что не отправляли за последние 30 дней
    const { data: existing } = await supabase
      .from('sales_agent_log')
      .select('id')
      .eq('seller_id', sellerId)
      .eq('customer_id', customer.id)
      .eq('trigger_type', 'reactivation')
      .gte('triggered_at', thirtyDaysAgo)
      .limit(1)

    if (existing?.length) continue

    const text = `💤 <b>Реактивация покупателя</b>

Покупатель не возвращался 30+ дней.

<b>Имя:</b> ${customer.name || 'Аноним'}
${customer.email ? `<b>Email:</b> ${customer.email}` : ''}
${customer.phone ? `<b>Телефон:</b> ${customer.phone}` : ''}
<b>Заказов всего:</b> ${customer.orders_count}

Рекомендуем отправить персональное предложение.`

    const ok = await sendTelegram(tg.bot_token, tg.chat_id, text)

    await logTrigger({
      seller_id:    sellerId,
      customer_id:  customer.id,
      channel:      'telegram',
      trigger_type: 'reactivation',
      status:       ok ? 'sent' : 'failed',
    })

    if (ok) sent++
  }

  return sent
}

// ─── Main handler ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { seller_id, trigger_type } = await req.json()
    if (!seller_id) return NextResponse.json({ error: 'seller_id required' }, { status: 400 })

    const results: Record<string, number> = {}

    if (!trigger_type || trigger_type === 'abandoned_cart') {
      results.abandoned_cart = await runAbandonedCartTrigger(seller_id)
    }

    if (!trigger_type || trigger_type === 'reactivation') {
      results.reactivation = await runReactivationTrigger(seller_id)
    }

    return NextResponse.json({ ok: true, seller_id, results })

  } catch (e: any) {
    console.error('[Triggers]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
