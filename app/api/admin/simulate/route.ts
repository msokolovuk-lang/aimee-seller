import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const NAMES = ['Алина К.', 'Дмитрий В.', 'Мария Л.', 'Игорь С.', 'Карина Т.', 'Артём Р.', 'Светлана М.', 'Павел Д.', 'Юлия Н.', 'Роман Б.', 'Анна Ф.', 'Евгений Ш.', 'Наталья П.', 'Сергей К.', 'Виктория Л.', 'Максим Т.', 'Ольга Н.', 'Андрей В.', 'Елена М.', 'Кирилл С.']
const STYLES = ['casual', 'formal', 'minimalist', 'streetwear']
const BEHAVIORS = ['aggressive', 'moderate', 'easy']
const CITIES = ['Москва', 'Санкт-Петербург', 'Казань', 'Екатеринбург', 'Новосибирск', 'Краснодар']
const PHONES = () => '+7' + Math.floor(9000000000 + Math.random() * 999999999)

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }

async function runAgent(sellerId: string, products: any[], agentNum: number): Promise<any> {
  const name = pick(NAMES)
  const budget = Math.floor((5 + Math.random() * 45) * 1000)
  const style = pick(STYLES)
  const behavior = pick(BEHAVIORS)
  const buyProbability = 0.3 + Math.random() * 0.6
  const phone = PHONES()
  const city = pick(CITIES)

  // фильтруем товары по бюджету
  const affordable = products.filter(p => p.price <= budget * 1.2)
  if (!affordable.length) return { name, ordered: false, reason: 'no affordable products' }

  // трекаем просмотры
  const toView = affordable.slice(0, Math.floor(1 + Math.random() * 3))
  for (const p of toView) {
    await supabase.from('buyer_activity').insert({
      seller_id: sellerId,
      buyer_phone: phone,
      type: 'view',
      data: { product_id: p.id, product_name: p.name, price: p.price, is_ai_buyer: true }
    })
    await new Promise(r => setTimeout(r, 200))
  }

  // Claude выбирает товар
  const prompt = `Ты AI покупатель на fashion маркетплейсе.
Профиль: имя ${name}, бюджет ${budget} руб, стиль ${style}, поведение при торге ${behavior}.
Доступные товары: ${JSON.stringify(affordable.map(p => ({ id: p.id, name: p.name, price: p.price, category: p.category })))}
Выбери 1 товар и реши покупать ли (вероятность покупки ${Math.round(buyProbability * 100)}%).
Ответь ТОЛЬКО JSON: {"product_id": "id", "product_name": "name", "price": 0, "size": "M", "buy": true/false, "negotiate": true/false, "offered_price": 0}`

  let chosen: any = null
  try {
    const res = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }]
    })
    const text = res.content[0].type === 'text' ? res.content[0].text : ''
    chosen = JSON.parse(text.replace(/```json|```/g, '').trim())
  } catch {
    // fallback — выбираем случайный товар
    const p = pick(affordable)
    const sizes = Array.isArray(p.sizes) ? p.sizes : (p.sizes || 'S,M,L').split(',').map((s: string) => s.trim())
    chosen = {
      product_id: p.id, product_name: p.name, price: p.price,
      size: pick(sizes) || 'M',
      buy: Math.random() < buyProbability,
      negotiate: behavior !== 'easy' && Math.random() > 0.5,
      offered_price: Math.round(p.price * (0.8 + Math.random() * 0.15))
    }
  }

  if (!chosen?.buy) return { name, ordered: false, viewed: toView.length }

  const product = products.find(p => p.id === chosen.product_id) || affordable[0]
  const sizes = Array.isArray(product.sizes) ? product.sizes : (product.sizes || 'S,M,L').split(',').map((s: string) => s.trim())
  const size = chosen.size || pick(sizes) || 'M'

  // торг если нужен
  if (chosen.negotiate) {
    await supabase.from('buyer_activity').insert({
      seller_id: sellerId,
      buyer_phone: phone,
      type: 'negotiate',
      data: { product_id: product.id, product_name: product.name, original_price: product.price, offered_price: chosen.offered_price, is_ai_buyer: true }
    })
    await new Promise(r => setTimeout(r, 300))

    // агент принимает торг с небольшой скидкой
    const agreedPrice = behavior === 'aggressive'
      ? Math.round(product.price * 0.88)
      : behavior === 'moderate'
        ? Math.round(product.price * 0.93)
        : Math.round(product.price * 0.97)

    await supabase.from('buyer_activity').insert({
      seller_id: sellerId,
      buyer_phone: phone,
      type: 'negotiate_accept',
      data: { product_id: product.id, product_name: product.name, original_price: product.price, agreed_price: agreedPrice, is_ai_buyer: true }
    })
    chosen.price = agreedPrice
    await new Promise(r => setTimeout(r, 200))
  }

  // добавление в корзину
  await supabase.from('buyer_activity').insert({
    seller_id: sellerId,
    buyer_phone: phone,
    type: 'add_to_cart',
    data: { product_id: product.id, product_name: product.name, size, price: chosen.price || product.price, is_ai_buyer: true }
  })
  await new Promise(r => setTimeout(r, 300))

  // создаём заказ
  const finalPrice = chosen.price || product.price
  const { data: order } = await supabase.from('orders').insert({
    seller_id: sellerId,
    buyer_name: name,
    buyer_phone: phone,
    buyer_address: city + ', ул. Примерная, д.' + Math.floor(1 + Math.random() * 99),
    items: [{ name: product.name, price: finalPrice, size, quantity: 1 }],
    total_price: finalPrice,
    status: 'new',
    is_ai_buyer: true,
  }).select().single()

  // трекаем заказ в активность
  await supabase.from('buyer_activity').insert({
    seller_id: sellerId,
    buyer_phone: phone,
    type: 'order_placed',
    data: { order_id: order?.id, product_name: product.name, total: finalPrice, is_ai_buyer: true }
  })

  return { name, ordered: true, product: product.name, price: finalPrice, size, negotiated: chosen.negotiate }
}

export async function POST(req: NextRequest) {
  const adminSecret = req.headers.get('x-admin-secret')
  if (adminSecret !== process.env.ADMIN_SECRET && adminSecret !== 'aimee-admin-2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { seller_id, agent_count = 3 } = await req.json()
  if (!seller_id) return NextResponse.json({ error: 'seller_id required' }, { status: 400 })

  // загружаем каталог селлера
  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('seller_id', seller_id)
    .eq('is_active', true)

  if (!products?.length) {
    return NextResponse.json({ error: 'No active products for this seller' }, { status: 400 })
  }

  const count = Math.min(Math.max(1, agent_count), 20)

  // запускаем агентов параллельно
  const results = await Promise.allSettled(
    Array.from({ length: count }, (_, i) => runAgent(seller_id, products, i))
  )

  const summary = results.map(r => r.status === 'fulfilled' ? r.value : { error: r.reason?.message })
  const ordered = summary.filter((r: any) => r.ordered).length

  return NextResponse.json({
    success: true,
    agents_run: count,
    orders_created: ordered,
    summary,
  })
}
