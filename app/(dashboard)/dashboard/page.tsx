'use client'

import { useSellerData } from '@/hooks/useSellerData'

function Sparkline({ data, color = '#0FBCCE' }: { data: number[], color?: string }) {
  if (!data.length) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const w = 80, h = 28
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ')
  return (
    <svg width={w} height={h} style={{ opacity: 0.8 }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function RevenueBar({ orders }: { orders: any[] }) {
  const days = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']
  const today = new Date().getDay()
  const todayIdx = today === 0 ? 6 : today - 1

  // группируем заказы по дням недели
  const byDay = Array(7).fill(0)
  orders.forEach(o => {
    const d = new Date(o.created_at).getDay()
    const idx = d === 0 ? 6 : d - 1
    byDay[idx] += o.total_price || 0
  })

  const max = Math.max(...byDay, 1)

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80 }}>
        {byDay.map((v, i) => {
          const pct = (v / max) * 75 + 10
          const isToday = i === todayIdx
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ width: '100%', height: `${pct}%`, background: isToday ? '#0FBCCE' : '#CBD5E1', borderRadius: '3px 3px 0 0', transition: 'height 0.5s' }} />
              <span style={{ fontSize: 10, color: isToday ? '#0FBCCE' : '#9ca3af', fontWeight: isToday ? 700 : 400 }}>{days[i]}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { stats, orders, activity, loading, sellerId } = useSellerData()

  const now = new Date()
  const dateStr = now.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })

  // последние 5 событий для ленты
  const recentActivity = activity.slice(0, 5)

  // активные A2A переговоры
  const negotiations = activity.filter(a => a.type === 'negotiate').slice(0, 4)

  const metrics = [
    { label: 'ВЫРУЧКА СЕГОДНЯ', value: `₽${(stats.revenueToday / 1000).toFixed(1)}K`, sub: `Всего: ₽${(stats.revenueTotal / 1000).toFixed(0)}K`, color: '#0FBCCE' },
    { label: 'ЗАКАЗЫ', value: String(stats.ordersTotal), sub: `${stats.ordersNew} новых · ${stats.ordersShipped} в пути`, color: '#22c55e' },
    { label: 'КОНВЕРСИЯ', value: `${stats.conversionRate}%`, sub: `${stats.viewsTotal} просмотров`, color: '#8b5cf6' },
    { label: 'СРЕДНИЙ ЧЕК', value: stats.avgCheck ? `₽${stats.avgCheck.toLocaleString('ru')}` : '—', sub: `AI заказов: ${stats.aiOrdersCount}`, color: '#f59e0b' },
  ]

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <div style={{ width: 36, height: 36, border: '3px solid #0FBCCE', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      {/* Заголовок */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827' }}>Дашборд</h1>
          <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 4, textTransform: 'capitalize' }}>{dateStr}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 99, padding: '6px 14px' }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', animation: 'pulse 2s infinite' }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#16a34a' }}>Live · данные в реальном времени</span>
        </div>
      </div>

      {/* Метрики */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        {metrics.map((m, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 10 }}>{m.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#111827', marginBottom: 4 }}>{m.value}</div>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>{m.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* График выручки */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Выручка по дням</span>
            <span style={{ fontSize: 12, color: '#9ca3af' }}>₽{(stats.revenueTotal / 1000).toFixed(0)}K итого</span>
          </div>
          {orders.length > 0
            ? <RevenueBar orders={orders} />
            : <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 13 }}>Нет заказов</div>
          }
        </div>

        {/* Воронка */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Воронка продаж</span>
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Просмотры', value: stats.viewsTotal, color: '#e0f2fe', text: '#0369a1', max: stats.viewsTotal },
              { label: 'В корзину', value: stats.cartsTotal, color: '#dcfce7', text: '#15803d', max: stats.viewsTotal },
              { label: 'Заказы', value: stats.ordersFromActivity, color: '#fef9c3', text: '#a16207', max: stats.viewsTotal },
            ].map((f, i) => (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: '#374151' }}>{f.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>{f.value}</span>
                </div>
                <div style={{ height: 8, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${f.max ? (f.value / f.max) * 100 : 0}%`, background: f.text, borderRadius: 4, transition: 'width 0.5s' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Последние заказы */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Последние заказы</span>
            <a href="/orders" style={{ fontSize: 12, color: '#0FBCCE', textDecoration: 'none' }}>Все →</a>
          </div>
          {orders.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Заказов пока нет</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {orders.slice(0, 5).map(o => (
                <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>
                      {o.buyer_name || 'Покупатель'}
                      {o.is_ai_buyer && <span style={{ marginLeft: 6, fontSize: 10, color: '#0FBCCE' }}>🤖</span>}
                    </p>
                    <p style={{ fontSize: 11, color: '#9ca3af' }}>{(o.items || []).map((i: any) => i.name).join(', ').slice(0, 30)}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{(o.total_price || 0).toLocaleString('ru')} ₽</p>
                    <p style={{ fontSize: 10, color: o.status === 'new' ? '#3b82f6' : '#9ca3af' }}>{o.status === 'new' ? '● Новый' : o.status}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Лента активности */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Активность</span>
            <a href="/activity" style={{ fontSize: 12, color: '#0FBCCE', textDecoration: 'none' }}>Все →</a>
          </div>
          {recentActivity.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Активности пока нет</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recentActivity.map((ev, i) => {
                const icons: Record<string, string> = { view: '👀', add_to_cart: '🛒', order_placed: '🎉', order: '🎉', negotiate: '💬' }
                const d = ev.data || {}
                return (
                  <div key={ev.id || i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
                    <span style={{ fontSize: 16 }}>{icons[ev.type] || '•'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {d.is_ai_buyer ? '🤖 AI' : (ev.buyer_phone ? ev.buyer_phone.slice(0,6)+'••' : 'Покупатель')} · {d.product_name || ev.type}
                      </p>
                      <p style={{ fontSize: 10, color: '#9ca3af' }}>{new Date(ev.created_at).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  )
}
