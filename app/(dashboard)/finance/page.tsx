'use client'

import { useSellerData } from '@/hooks/useSellerData'

const AIMEE_FEE = 0.065 // 6.5%

export default function FinancePage() {
  const { orders, stats, products, loading } = useSellerData()

  // группируем заказы по товарам
  const skuMap: Record<string, { name: string; revenue: number; units: number; returns: number }> = {}
  orders.forEach(o => {
    if (['returned'].includes(o.status)) return
    ;(o.items || []).forEach((item: any) => {
      const key = item.name || 'Неизвестно'
      if (!skuMap[key]) skuMap[key] = { name: key, revenue: 0, units: 0, returns: 0 }
      skuMap[key].revenue += item.price || 0
      skuMap[key].units += item.quantity || 1
    })
  })
  orders.filter(o => ['returned','return_requested'].includes(o.status)).forEach(o => {
    ;(o.items || []).forEach((item: any) => {
      const key = item.name || 'Неизвестно'
      if (skuMap[key]) skuMap[key].returns += 1
    })
  })

  const skus = Object.values(skuMap).sort((a, b) => b.revenue - a.revenue)

  const revenue = stats.revenueTotal
  const aimeeFee = Math.round(revenue * AIMEE_FEE)
  const net = revenue - aimeeFee
  const returnsCount = stats.ordersReturned
  const returnsRevenue = orders
    .filter(o => ['returned','return_requested'].includes(o.status))
    .reduce((s, o) => s + (o.total_price || 0), 0)

  const pl = [
    { label: 'Выручка от продаж', value: revenue, positive: true },
    { label: 'Комиссия AIMEE (6.5%)', value: -aimeeFee, positive: false },
    { label: 'Возвраты (исключены)', value: -returnsRevenue, positive: false },
    { label: 'Чистая выручка', value: net, positive: true, bold: true },
  ]

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <div style={{ width: 32, height: 32, border: '2px solid #0FBCCE', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827' }}>Финансы</h1>
        <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 4 }}>Реальные данные · комиссия AIMEE 6.5%</p>
      </div>

      {/* Ключевые метрики */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Выручка всего', value: `₽${(revenue/1000).toFixed(1)}K`, sub: `${stats.ordersTotal} заказов`, color: '#0FBCCE' },
          { label: 'Комиссия AIMEE', value: `₽${(aimeeFee/1000).toFixed(1)}K`, sub: `vs WB/Ozon: ₽${Math.round(revenue*0.35/1000)}K`, color: '#22c55e' },
          { label: 'Чистая выручка', value: `₽${(net/1000).toFixed(1)}K`, sub: 'после комиссии', color: '#111827' },
          { label: 'Возвраты', value: String(returnsCount), sub: `₽${(returnsRevenue/1000).toFixed(1)}K потерь`, color: returnsCount > 0 ? '#ef4444' : '#22c55e' },
        ].map((m, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>{m.label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: m.color }}>{m.value}</div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{m.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* P&L */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 16 }}>P&L · Отчёт</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {pl.map((item, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 0',
                borderBottom: i < pl.length - 1 ? '1px solid #f3f4f6' : 'none',
                borderTop: item.bold ? '2px solid #e5e7eb' : 'none',
                marginTop: item.bold ? 4 : 0,
              }}>
                <span style={{ fontSize: 13, color: item.bold ? '#111827' : '#374151', fontWeight: item.bold ? 700 : 400 }}>{item.label}</span>
                <span style={{ fontSize: 14, fontWeight: item.bold ? 800 : 600, color: item.value >= 0 ? '#111827' : '#ef4444' }}>
                  {item.value >= 0 ? '+' : ''}₽{Math.abs(item.value).toLocaleString('ru')}
                </span>
              </div>
            ))}
          </div>

          {/* Сравнение с WB */}
          <div style={{ marginTop: 16, padding: 12, background: '#f0fdf4', borderRadius: 10, border: '1px solid #bbf7d0' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#15803d', marginBottom: 6 }}>💚 Экономия vs WB/Ozon (35%)</p>
            <p style={{ fontSize: 20, fontWeight: 800, color: '#15803d' }}>+₽{Math.round(revenue * (0.35 - AIMEE_FEE)).toLocaleString('ru')}</p>
            <p style={{ fontSize: 11, color: '#16a34a' }}>сохранено за счёт AIMEE</p>
          </div>
        </div>

        {/* Топ товары */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 16 }}>Топ товары по выручке</h2>
          {skus.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Нет данных о продажах</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {skus.slice(0, 6).map((sku, i) => {
                const pct = revenue ? (sku.revenue / revenue) * 100 : 0
                return (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: '#374151', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{sku.name}</span>
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                        <span style={{ fontSize: 11, color: '#9ca3af' }}>{sku.units} шт.</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>₽{sku.revenue.toLocaleString('ru')}</span>
                      </div>
                    </div>
                    <div style={{ height: 6, background: '#f3f4f6', borderRadius: 3 }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: '#0FBCCE', borderRadius: 3, transition: 'width 0.5s' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Таблица заказов */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 16 }}>Все транзакции</h2>
        {orders.length === 0 ? (
          <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Транзакций пока нет</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #f3f4f6' }}>
                {['Заказ', 'Покупатель', 'Товары', 'Сумма', 'Комиссия', 'Чистая', 'Статус'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((o, i) => {
                const fee = Math.round((o.total_price || 0) * AIMEE_FEE)
                const net = (o.total_price || 0) - fee
                const isReturn = ['returned','return_requested'].includes(o.status)
                return (
                  <tr key={o.id} style={{ borderBottom: '1px solid #f9fafb', opacity: isReturn ? 0.6 : 1 }}>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: '#6b7280', fontFamily: 'monospace' }}>#{String(o.id).slice(-6).toUpperCase()}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: '#374151' }}>
                      {o.buyer_name || 'Покупатель'}
                      {o.is_ai_buyer && <span style={{ marginLeft: 4, fontSize: 10, color: '#0FBCCE' }}>🤖</span>}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 11, color: '#6b7280', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {(o.items || []).map((i: any) => i.name).join(', ')}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 700, color: '#111827' }}>₽{(o.total_price || 0).toLocaleString('ru')}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: '#ef4444' }}>−₽{fee.toLocaleString('ru')}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600, color: '#22c55e' }}>₽{net.toLocaleString('ru')}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 99, fontWeight: 600,
                        background: isReturn ? '#fef2f2' : o.status === 'new' ? '#eff6ff' : '#f0fdf4',
                        color: isReturn ? '#ef4444' : o.status === 'new' ? '#3b82f6' : '#16a34a'
                      }}>{o.status}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
