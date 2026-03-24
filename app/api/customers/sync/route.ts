/**
 * POST /api/customers/sync
 * Синхронизация покупателей из заказов и коннекторов
 * Авто-теггинг + LTV расчёт
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { computeTags } from '@/lib/customer-tagging'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { seller_id } = await req.json()
    if (!seller_id) return NextResponse.json({ error: 'seller_id required' }, { status: 400 })

    // 1. Получаем все заказы бренда
    const { data: orders } = await supabase
      .from('orders')
      .select('*')
      .eq('seller_id', seller_id)
      .not('status', 'eq', 'returned')

    if (!orders?.length) {
      return NextResponse.json({ synced: 0, message: 'Нет заказов' })
    }

    // 2. Группируем по покупателю (phone или email)
    const customerMap = new Map<string, {
      phone?: string
      email?: string
      name?: string
      orders: any[]
    }>()

    for (const order of orders) {
      const key = order.customer_phone || order.customer_email || order.buyer_name || `order_${order.id}`
      if (!customerMap.has(key)) {
        customerMap.set(key, {
          phone: order.customer_phone,
          email: order.customer_email,
          name:  order.buyer_name,
          orders: [],
        })
      }
      customerMap.get(key)!.orders.push(order)
    }

    // 3. Upsert каждого покупателя с расчётом LTV и тегов
    let synced = 0

    for (const [key, data] of Array.from(customerMap.entries())) {
      const totalSpent   = data.orders.reduce((s, o) => s + (o.total_price || 0), 0)
      const ordersCount  = data.orders.length
      const lastOrderAt  = data.orders
        .map(o => o.created_at)
        .sort()
        .reverse()[0] || null

      const customerBase = {
        seller_id,
        external_id:  key,
        phone:        data.phone || null,
        email:        data.email || null,
        name:         data.name  || null,
        orders_count: ordersCount,
        total_spent:  totalSpent,
        ltv:          totalSpent, // LTV = суммарные покупки (можно усложнить)
        last_order_at: lastOrderAt,
        source:       'crm_sync' as const,
      }

      // Compute tags
      const tags = computeTags({
        id:           key,
        seller_id,
        orders_count: ordersCount,
        total_spent:  totalSpent,
        ltv:          totalSpent,
        last_order_at: lastOrderAt,
        created_at:   lastOrderAt || new Date().toISOString(),
        tags:         [],
      })

      const { error } = await supabase
        .from('brand_customers')
        .upsert(
          { ...customerBase, tags },
          { onConflict: 'seller_id,external_id' }
        )

      if (!error) synced++
    }

    return NextResponse.json({ synced, total: customerMap.size })

  } catch (e: any) {
    console.error('[Customer Sync]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// GET — список покупателей бренда
export async function GET(req: NextRequest) {
  const sellerId = req.nextUrl.searchParams.get('seller_id')
  const tag      = req.nextUrl.searchParams.get('tag')
  const segment  = req.nextUrl.searchParams.get('segment')
  const search   = req.nextUrl.searchParams.get('search')
  const limit    = parseInt(req.nextUrl.searchParams.get('limit') || '100')
  const offset   = parseInt(req.nextUrl.searchParams.get('offset') || '0')

  if (!sellerId) return NextResponse.json({ error: 'seller_id required' }, { status: 400 })

  let query = supabase
    .from('brand_customers')
    .select('*', { count: 'exact' })
    .eq('seller_id', sellerId)
    .order('ltv', { ascending: false })
    .range(offset, offset + limit - 1)

  if (tag) {
    query = query.contains('tags', [tag])
  }

  if (search) {
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`)
  }

  const { data, count, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ customers: data || [], total: count || 0 })
}
