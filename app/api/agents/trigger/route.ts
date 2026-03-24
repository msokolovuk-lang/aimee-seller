/**
 * POST /api/agents/trigger
 * Запуск AI Sales Agent — звонок, email или Telegram
 * Sprint 6
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { createRetellCall, getRetellCallStatus } from '@/lib/retell-client'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// ─── Email via Claude Sonnet + Unisender ─────────────────────────────────────
async function triggerEmail(params: {
  sellerId: string
  customer: any
  triggerType: string
  brandName: string
}): Promise<boolean> {
  if (!params.customer.email) return false

  // Get Unisender credentials
  const { data: conn } = await supabase
    .from('brand_connectors')
    .select('credentials')
    .eq('seller_id', params.sellerId)
    .eq('type', 'unisender')
    .eq('status', 'active')
    .single()

  if (!conn?.credentials?.api_key) return false

  // Generate personalized email via Claude Sonnet
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    system: `Ты копирайтер fashion-бренда ${params.brandName}. 
Пишешь персональные email на русском языке.
Тон: теплый, стильный, не навязчивый.
Ответь ТОЛЬКО JSON: {"subject": "...", "html": "..."}
HTML должен быть простым, с одной кнопкой CTA.`,
    messages: [{
      role: 'user',
      content: `Покупатель: ${params.customer.name || 'Дорогой покупатель'}
Триггер: ${params.triggerType}
LTV: ₽${params.customer.ltv || 0}
Заказов: ${params.customer.orders_count || 0}
Теги: ${(params.customer.tags || []).join(', ')}
Последний заказ: ${params.customer.last_order_at || 'нет'}

Напиши персональное письмо для триггера "${params.triggerType}".`,
    }],
  })

  let subject = 'Специально для вас'
  let html = ''

  try {
    const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)
    subject = parsed.subject || subject
    html = parsed.html || ''
  } catch {
    html = `<h2>Привет, ${params.customer.name || ''}!</h2><p>У нас есть специальное предложение для вас от ${params.brandName}.</p>`
  }

  // Send via Unisender
  const form = new URLSearchParams({
    api_key: conn.credentials.api_key,
    format: 'json',
    email: params.customer.email,
    sender_name: params.brandName,
    sender_email: 'noreply@getaimee.ru',
    subject,
    body: html,
    list_id: '1',
  })

  const res = await fetch('https://api.unisender.com/ru/api/sendEmail', {
    method: 'POST',
    body: form,
  })
  const data = await res.json()
  return !data.error
}

// ─── Telegram notification ────────────────────────────────────────────────────
async function triggerTelegram(params: {
  sellerId: string
  customer: any
  triggerType: string
  brandName: string
}): Promise<boolean> {
  const { data: conn } = await supabase
    .from('brand_connectors')
    .select('credentials')
    .eq('seller_id', params.sellerId)
    .eq('type', 'telegram')
    .eq('status', 'active')
    .single()

  if (!conn?.credentials?.bot_token || !conn?.credentials?.chat_id) return false

  const triggerLabels: Record<string, string> = {
    abandoned_cart: '🛒 Брошенная корзина',
    reactivation:   '💤 Реактивация',
    upsell:         '📈 Допродажа',
    birthday:       '🎂 День рождения',
  }

  const text = `${triggerLabels[params.triggerType] || params.triggerType}

<b>Покупатель:</b> ${params.customer.name || 'Аноним'}
${params.customer.phone  ? `<b>Телефон:</b> ${params.customer.phone}` : ''}
${params.customer.email  ? `<b>Email:</b> ${params.customer.email}` : ''}
<b>Заказов:</b> ${params.customer.orders_count || 0}
<b>LTV:</b> ₽${(params.customer.ltv || 0).toLocaleString('ru')}

<a href="https://admin.getaimee.ru/admin/customers">Открыть в CRM →</a>`

  const res = await fetch(`https://api.telegram.org/bot${conn.credentials.bot_token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: conn.credentials.chat_id, text, parse_mode: 'HTML' }),
  })
  const data = await res.json()
  return data.ok === true
}

// ─── Phone call via Retell AI ─────────────────────────────────────────────────
async function triggerCall(params: {
  sellerId: string
  customer: any
  triggerType: string
  brandName: string
}): Promise<{ callId: string } | null> {
  if (!params.customer.phone) return null

  // Check Retell credentials in seller config
  const retellApiKey = process.env.RETELL_API_KEY
  const retellFromNumber = process.env.RETELL_FROM_NUMBER
  const retellAgentId = process.env.RETELL_AGENT_ID

  if (!retellApiKey || !retellFromNumber || !retellAgentId) {
    console.warn('[Sales Agent] Retell not configured — skipping call')
    return null
  }

  const phone = params.customer.phone.replace(/\D/g, '')
  const formattedPhone = phone.startsWith('7') ? `+${phone}` : `+7${phone}`

  const result = await createRetellCall({
    apiKey:        retellApiKey,
    fromNumber:    retellFromNumber,
    toNumber:      formattedPhone,
    agentId:       retellAgentId,
    retellLlmDynamicVariables: {
      customer_name: params.customer.name || 'покупатель',
      brand_name:    params.brandName,
      trigger_type:  params.triggerType,
    },
  })

  return { callId: result.call_id }
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const {
      seller_id,
      customer_id,
      trigger_type,
      channels = ['telegram'],
      dry_run = false,
    } = await req.json()

    if (!seller_id || !customer_id || !trigger_type) {
      return NextResponse.json({ error: 'seller_id, customer_id, trigger_type обязательны' }, { status: 400 })
    }

    // Get customer
    const { data: customer } = await supabase
      .from('brand_customers')
      .select('*')
      .eq('id', customer_id)
      .eq('seller_id', seller_id)
      .single()

    if (!customer) return NextResponse.json({ error: 'Покупатель не найден' }, { status: 404 })

    // Get brand name
    const { data: seller } = await supabase
      .from('sellers')
      .select('brand_name')
      .eq('seller_id', seller_id)
      .single()

    const brandName = seller?.brand_name || seller_id

    // Check daily call limit
    const today = new Date().toISOString().slice(0, 10)
    const { count: todayCalls } = await supabase
      .from('sales_agent_log')
      .select('*', { count: 'exact', head: true })
      .eq('seller_id', seller_id)
      .eq('channel', 'call')
      .gte('triggered_at', today)

    const dailyCallLimit = 10 // default, configurable
    if ((todayCalls || 0) >= dailyCallLimit && channels.includes('call')) {
      return NextResponse.json({
        warning: `Достигнут лимит звонков на сегодня (${dailyCallLimit})`,
        fallback: 'telegram',
      }, { status: 429 })
    }

    if (dry_run) {
      return NextResponse.json({
        dry_run: true,
        customer: { name: customer.name, phone: customer.phone, email: customer.email },
        channels,
        trigger_type,
        brand_name: brandName,
      })
    }

    const results: Record<string, any> = {}

    // Execute channels
    for (const channel of channels) {
      try {
        const baseParams = { sellerId: seller_id, customer, triggerType: trigger_type, brandName }

        let status = 'failed'
        let meta: any = {}

        if (channel === 'telegram') {
          const ok = await triggerTelegram(baseParams)
          status = ok ? 'sent' : 'failed'
        }

        if (channel === 'email') {
          const ok = await triggerEmail(baseParams)
          status = ok ? 'sent' : 'failed'
        }

        if (channel === 'call') {
          const result = await triggerCall(baseParams)
          if (result) {
            status = 'sent'
            meta = { call_id: result.callId }
          }
        }

        results[channel] = status

        // Log to sales_agent_log
        await supabase.from('sales_agent_log').insert({
          seller_id,
          customer_id,
          channel,
          trigger_type,
          status,
          meta,
          triggered_at: new Date().toISOString(),
        })

      } catch (e: any) {
        results[channel] = 'error: ' + e.message
        await supabase.from('sales_agent_log').insert({
          seller_id,
          customer_id,
          channel,
          trigger_type,
          status: 'failed',
          error_message: e.message,
          triggered_at: new Date().toISOString(),
        })
      }
    }

    const allSent = Object.values(results).every(v => v === 'sent')

    return NextResponse.json({
      ok: true,
      seller_id,
      customer_id,
      trigger_type,
      results,
      converted: false,
    })

  } catch (e: any) {
    console.error('[Agent Trigger]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// ─── GET — agent stats ────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const sellerId = req.nextUrl.searchParams.get('seller_id')
  if (!sellerId) return NextResponse.json({ error: 'seller_id required' }, { status: 400 })

  const { data: logs } = await supabase
    .from('sales_agent_log')
    .select('*')
    .eq('seller_id', sellerId)
    .order('triggered_at', { ascending: false })
    .limit(100)

  const total     = logs?.length || 0
  const converted = logs?.filter(l => l.converted).length || 0
  const byChannel = (logs || []).reduce((acc, l) => {
    acc[l.channel] = (acc[l.channel] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return NextResponse.json({
    logs: logs || [],
    stats: { total, converted, conversion_rate: total ? ((converted / total) * 100).toFixed(1) + '%' : '0%', by_channel: byChannel },
  })
}
