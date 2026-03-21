'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Zap, Package, Truck, CheckCircle, RotateCcw, Clock, ChevronDown, ChevronUp } from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Order {
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

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  new:              { label: 'Новый',         color: '#3b82f6', bg: '#eff6ff' },
  confirmed:        { label: 'Подтверждён',   color: '#0FBCCE', bg: '#f0fdfe' },
  shipped:          { label: 'В пути',        color: '#f59e0b', bg: '#fffbeb' },
  delivered:        { label: 'Доставлен',     color: '#22c55e', bg: '#f0fdf4' },
  return_requested: { label: 'Возврат',       color: '#ef4444', bg: '#fef2f2' },
  returned:         { label: 'Возвращён',     color: '#6b7280', bg: '#f9fafb' },
  pending:          { label: 'Новый',         color: '#3b82f6', bg: '#eff6ff' },
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [sellerId, setSellerId] = useState<string>('')

  useEffect(() => {
    const id = localStorage.getItem('seller_id') || ''
    setSellerId(id)
    loadOrders(id)

    // Realtime подписка
    const channel = supabase
      .channel('orders-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        loadOrders(id)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const loadOrders = async (id: string) => {
    setLoading(true)
    try {
      let query = supabase.from('orders').select('*').order('created_at', { ascending: false })
      if (id && id !== 'demo') query = query.eq('seller_id', id)
      const { data } = await query
      if (data) setOrders(data)
    } catch {}
    setLoading(false)
  }

  const updateStatus = async (orderId: string, status: string) => {
    await supabase.from('orders').update({ status }).eq('id', orderId)
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o))
  }

  const toggle = (key: string) => setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))

  const needAction = orders.filter(o => ['new', 'pending', 'return_requested'].includes(o.status))
  const inProgress = orders.filter(o => ['confirmed', 'shipped'].includes(o.status))
  const done = orders.filter(o => ['delivered', 'returned'].includes(o.status))

  const totalRevenue = orders.filter(o => !['returned'].includes(o.status)).reduce((s, o) => s + (o.total_price || 0), 0)
  const aiCount = orders.filter(o => o.is_ai_buyer).length

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

  const OrderCard = ({ order }: { order: Order }) => {
    const st = STATUS_META[order.status] || STATUS_META.new
    const items = Array.isArray(order.items) ? order.items : []
    return (
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>
                {items[0]?.name || 'Заказ'}
                {items.length > 1 && <span style={{ color: '#9ca3af', fontWeight: 400 }}> +{items.length - 1}</span>}
              </span>
              {order.is_ai_buyer && (
                <span style={{ fontSize: 11, padding: '2px 8px', background: '#f0fdfe', color: '#0FBCCE', borderRadius: 6, fontWeight: 600 }}>🤖 AI покупатель</span>
              )}
              <span style={{ fontSize: 11, padding: '2px 8px', background: st.bg, color: st.color, borderRadius: 6, fontWeight: 600 }}>{st.label}</span>
            </div>
            <div style={{ fontSize: 12, color: '#9ca3af' }}>
              #{String(order.id).slice(-8).toUpperCase()} · {order.buyer_name || 'Покупатель'} · {fmtDate(order.created_at)}
            </div>
            {order.buyer_address && (
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>📍 {order.buyer_address}</div>
            )}
            {/* Items list */}
            {items.length > 0 && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {items.map((item: any, i: number) => (
                  <div key={i} style={{ fontSize: 12, color: '#374151', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{item.name} · р.{item.size}</span>
                    <span style={{ fontWeight: 600 }}>{(item.price || 0).toLocaleString('ru')} ₽</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>{(order.total_price || 0).toLocaleString('ru')} ₽</div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          {['new', 'pending'].includes(order.status) && (
            <>
              <button onClick={() => updateStatus(order.id, 'confirmed')}
                style={{ padding: '6px 14px', background: '#0FBCCE', color: '#fff', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                ✓ Подтвердить
              </button>
              <button onClick={() => updateStatus(order.id, 'shipped')}
                style={{ padding: '6px 14px', background: '#3b82f6', color: '#fff', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                🚚 Отправлено
              </button>
            </>
          )}
          {order.status === 'confirmed' && (
            <button onClick={() => updateStatus(order.id, 'shipped')}
              style={{ padding: '6px 14px', background: '#f59e0b', color: '#fff', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              🚚 Отправлено
            </button>
          )}
          {order.status === 'shipped' && (
            <button onClick={() => updateStatus(order.id, 'delivered')}
              style={{ padding: '6px 14px', background: '#22c55e', color: '#fff', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              ✓ Доставлено
            </button>
          )}
          {order.status === 'return_requested' && (
            <>
              <button onClick={() => updateStatus(order.id, 'returned')}
                style={{ padding: '6px 14px', background: '#ef4444', color: '#fff', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Одобрить возврат
              </button>
              <button onClick={() => updateStatus(order.id, 'delivered')}
                style={{ padding: '6px 14px', border: '1px solid #fca5a5', color: '#ef4444', borderRadius: 8, background: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Оспорить
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
      <div style={{ width: 32, height: 32, border: '2px solid #0FBCCE', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827' }}>Заказы</h1>
        <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 4 }}>Обновляется в реальном времени</p>
      </div>

      {/* Метрики */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Выручка', value: `₽${(totalRevenue/1000).toFixed(0)}K`, sub: `${orders.length} заказов` },
          { label: 'Требуют действия', value: String(needAction.length), sub: 'новых заказов', alert: needAction.length > 0 },
          { label: 'AI покупатели', value: String(aiCount), sub: 'через симуляцию' },
          { label: 'В пути', value: String(inProgress.length), sub: 'ожидают доставки' },
        ].map((m, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 16, border: `1px solid ${m.alert ? '#fecaca' : '#e5e7eb'}`, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: m.alert ? '#ef4444' : '#111827' }}>{m.value}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginTop: 2 }}>{m.label}</div>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {orders.length === 0 ? (
        <div style={{ textAlign: 'center', paddingTop: 60 }}>
          <p style={{ fontSize: 48, marginBottom: 16 }}>📦</p>
          <p style={{ fontSize: 16, fontWeight: 600, color: '#374151' }}>Заказов пока нет</p>
          <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 8 }}>Как только покупатели оформят заказы — они появятся здесь</p>
        </div>
      ) : (
        <>
          {/* Требуют действия */}
          {needAction.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <button onClick={() => toggle('action')} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 10, padding: 0 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', animation: 'pulse 2s infinite' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#dc2626' }}>Требуют действия · {needAction.length}</span>
                <span style={{ marginLeft: 'auto', fontSize: 12, color: '#9ca3af' }}>{collapsed['action'] ? '▼' : '▲'}</span>
              </button>
              {!collapsed['action'] && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {needAction.map(o => <OrderCard key={o.id} order={o} />)}
                </div>
              )}
            </div>
          )}

          {/* В процессе */}
          {inProgress.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <button onClick={() => toggle('progress')} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 10, padding: 0 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>В процессе · {inProgress.length}</span>
                <span style={{ marginLeft: 'auto', fontSize: 12, color: '#9ca3af' }}>{collapsed['progress'] ? '▼' : '▲'}</span>
              </button>
              {!collapsed['progress'] && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {inProgress.map(o => <OrderCard key={o.id} order={o} />)}
                </div>
              )}
            </div>
          )}

          {/* Завершённые */}
          {done.length > 0 && (
            <div>
              <button onClick={() => toggle('done')} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 10, padding: 0 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>Завершённые · {done.length}</span>
                <span style={{ marginLeft: 'auto', fontSize: 12, color: '#9ca3af' }}>{collapsed['done'] ? '▼' : '▲'}</span>
              </button>
              {!collapsed['done'] && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, opacity: 0.75 }}>
                  {done.map(o => <OrderCard key={o.id} order={o} />)}
                </div>
              )}
            </div>
          )}
        </>
      )}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </div>
  )
}
