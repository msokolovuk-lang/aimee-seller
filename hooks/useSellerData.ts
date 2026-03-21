'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export interface SellerStats {
  // Заказы
  ordersTotal: number
  ordersNew: number
  ordersShipped: number
  ordersDelivered: number
  ordersReturned: number
  // Финансы
  revenueTotal: number
  revenueToday: number
  avgCheck: number
  // Активность
  viewsTotal: number
  cartsTotal: number
  ordersFromActivity: number
  conversionRate: number
  // AI покупатели
  aiOrdersCount: number
  aiRevenue: number
  // Каталог
  productsTotal: number
  productsActive: number
}

export interface SellerOrder {
  id: string
  seller_id: string
  buyer_name: string
  buyer_phone: string
  buyer_address: string
  items: any[]
  total_price: number
  status: string
  is_ai_buyer: boolean
  created_at: string
}

export interface ActivityEvent {
  id: string
  seller_id: string
  buyer_phone: string
  type: string
  data: any
  created_at: string
}

export function useSellerData() {
  const [sellerId, setSellerId] = useState<string>('')
  const [orders, setOrders] = useState<SellerOrder[]>([])
  const [activity, setActivity] = useState<ActivityEvent[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [stats, setStats] = useState<SellerStats>({
    ordersTotal: 0, ordersNew: 0, ordersShipped: 0, ordersDelivered: 0, ordersReturned: 0,
    revenueTotal: 0, revenueToday: 0, avgCheck: 0,
    viewsTotal: 0, cartsTotal: 0, ordersFromActivity: 0, conversionRate: 0,
    aiOrdersCount: 0, aiRevenue: 0,
    productsTotal: 0, productsActive: 0,
  })
  const [loading, setLoading] = useState(true)

  const getSellerId = useCallback(() => {
    return localStorage.getItem('seller_id') || ''
  }, [])

  const loadAll = useCallback(async (id: string) => {
    if (!id) return
    setLoading(true)
    try {
      const sellerFilter = [id, 'demo'].filter(Boolean)

      // Заказы
      const { data: ordersData } = await supabase
        .from('orders')
        .select('*')
        .in('seller_id', sellerFilter)
        .order('created_at', { ascending: false })

      // Активность
      const { data: activityData } = await supabase
        .from('buyer_activity')
        .select('*')
        .in('seller_id', sellerFilter)
        .order('created_at', { ascending: false })
        .limit(200)

      // Продукты
      const { data: productsData } = await supabase
        .from('products')
        .select('*')
        .eq('seller_id', id)

      const o = ordersData || []
      const a = activityData || []
      const p = productsData || []

      setOrders(o)
      setActivity(a)
      setProducts(p)

      // Считаем статистику
      const today = new Date().toISOString().slice(0, 10)
      const activeOrders = o.filter(x => !['returned'].includes(x.status))
      const todayOrders = activeOrders.filter(x => x.created_at.startsWith(today))

      const newStats: SellerStats = {
        ordersTotal: o.length,
        ordersNew: o.filter(x => ['new','pending'].includes(x.status)).length,
        ordersShipped: o.filter(x => x.status === 'shipped').length,
        ordersDelivered: o.filter(x => x.status === 'delivered').length,
        ordersReturned: o.filter(x => ['returned','return_requested'].includes(x.status)).length,
        revenueTotal: activeOrders.reduce((s, x) => s + (x.total_price || 0), 0),
        revenueToday: todayOrders.reduce((s, x) => s + (x.total_price || 0), 0),
        avgCheck: activeOrders.length ? Math.round(activeOrders.reduce((s, x) => s + (x.total_price || 0), 0) / activeOrders.length) : 0,
        viewsTotal: a.filter(x => x.type === 'view').length,
        cartsTotal: a.filter(x => x.type === 'add_to_cart').length,
        ordersFromActivity: a.filter(x => ['order_placed','order'].includes(x.type)).length,
        conversionRate: a.filter(x => x.type === 'view').length
          ? Math.round((a.filter(x => ['order_placed','order'].includes(x.type)).length / a.filter(x => x.type === 'view').length) * 1000) / 10
          : 0,
        aiOrdersCount: o.filter(x => x.is_ai_buyer).length,
        aiRevenue: o.filter(x => x.is_ai_buyer).reduce((s, x) => s + (x.total_price || 0), 0),
        productsTotal: p.length,
        productsActive: p.filter(x => x.is_active).length,
      }
      setStats(newStats)
    } catch (e) {
      console.error('useSellerData error:', e)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    const id = getSellerId()
    setSellerId(id)
    loadAll(id)

    // Realtime — новые заказы
    const ordersChannel = supabase
      .channel('seller-orders-' + id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        loadAll(id)
      })
      .subscribe()

    // Realtime — новая активность
    const activityChannel = supabase
      .channel('seller-activity-' + id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'buyer_activity' }, (payload) => {
        const ev = payload.new as ActivityEvent
        const allowed = [id, 'demo', '']
        if (!allowed.includes(ev.seller_id)) return
        setActivity(prev => [ev, ...prev].slice(0, 200))
        // пересчитываем статистику при новом событии
        loadAll(id)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(ordersChannel)
      supabase.removeChannel(activityChannel)
    }
  }, [])

  return { sellerId, orders, activity, products, stats, loading, refresh: () => loadAll(sellerId) }
}
