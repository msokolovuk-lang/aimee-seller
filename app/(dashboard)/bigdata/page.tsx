'use client'

import { useSellerData } from '@/hooks/useSellerData'

export default function BigDataPage() {
  const { orders, activity, products, stats, loading } = useSellerData()

  // реальные данные из заказов
  const activeOrders = orders.filter(o => !['returned'].includes(o.status))

  // уникальные покупатели
  const uniqueBuyers = new Set(orders.map(o => o.buyer_phone).filter(Boolean))
  const uniqueBuyersCount = uniqueBuyers.size

  // размеры из заказов
  const sizeMap: Record<string, number> = {}
  activeOrders.forEach(o => {
    ;(o.items || []).forEach((item: any) => {
      if (item.size) sizeMap[item.size] = (sizeMap[item.size] || 0) + 1
    })
  })
  const totalSizes = Object.values(sizeMap).reduce((a, b) => a + b, 0)
  const sizeStats = Object.entries(sizeMap).sort((a, b) => b[1] - a[1]).map(([size, count]) => ({
    size, count, pct: Math.round((count / totalSizes) * 100)
  }))

  // размеры в каталоге (сток)
  const stockSizeMap: Record<string, number> = {}
  products.filter(p => p.is_active).forEach(p => {
    const sizes = Array.isArray(p.sizes) ? p.sizes : (p.sizes || '').split(',').map((s: string) => s.trim()).filter(Boolean)
    sizes.forEach((s: string) => { stockSizeMap[s] = (stockSizeMap[s] || 0) + 1 })
  })
  const totalStock = Object.values(stockSizeMap).reduce((a, b) => a + b, 0)

  // география из адресов
  const cityMap: Record<string, number> = {}
  orders.forEach(o => {
    if (!o.buyer_address) return
    const addr = o.buyer_address.toLowerCase()
    if (addr.includes('москв')) cityMap['Москва'] = (cityMap['Москва'] || 0) + 1
    else if (addr.includes('санкт') || addr.includes('питер') || addr.includes('спб')) cityMap['Санкт-Петербург'] = (cityMap['Санкт-Петербург'] || 0) + 1
    else if (addr.includes('екатер')) cityMap['Екатеринбург'] = (cityMap['Екатеринбург'] || 0) + 1
    else if (addr.includes('казань')) cityMap['Казань'] = (cityMap['Казань'] || 0) + 1
    else if (addr.includes('новосиб')) cityMap['Новосибирск'] = (cityMap['Новосибирск'] || 0) + 1
    else cityMap['Другие'] = (cityMap['Другие'] || 0) + 1
  })
  const totalCities = Object.values(cityMap).reduce((a, b) => a + b, 0)
  const cityStats = Object.entries(cityMap).sort((a, b) => b[1] - a[1])

  // топ товары по просмотрам
  const viewMap: Record<string, number> = {}
  activity.filter(a => a.type === 'view').forEach(a => {
    const name = a.data?.product_name || ''
    if (name) viewMap[name] = (viewMap[name] || 0) + 1
  })
  const topViewed = Object.entries(viewMap).sort((a, b) => b[1] - a[1]).slice(0, 5)

  // возврат %
  const returnRate = stats.ordersTotal ? Math.round((stats.ordersReturned / stats.ordersTotal) * 100) : 0

  const hasEnoughData = orders.length >= 3

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <div style={{ width: 32, height: 32, border: '2px solid #0FBCCE', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827' }}>Big Data</h1>
          <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 4 }}>данные твоей аудитории · реальные цифры</p>
        </div>
        {!hasEnoughData && (
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '8px 16px', fontSize: 12, color: '#92400e' }}>
            ⏳ Данные накапливаются · {orders.length} заказов пока
          </div>
        )}
      </div>

      {/* Ключевые метрики */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Покупателей', value: uniqueBuyersCount || orders.length, icon: '👥', sub: 'уникальных' },
          { label: 'Купили', value: activeOrders.length, icon: '🛍️', sub: 'успешных заказов' },
          { label: 'Средний чек', value: stats.avgCheck ? `${(stats.avgCheck/1000).toFixed(1)}K` : '—', icon: '💰', sub: 'рублей' },
          { label: 'Возвраты', value: `${returnRate}%`, icon: '↩️', sub: returnRate < 15 ? 'ниже рынка' : 'выше нормы' },
        ].map((m, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{m.icon}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#111827' }}>{m.value}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginTop: 2 }}>{m.label}</div>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>{m.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Размеры: спрос */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Размеры: спрос покупателей</h2>
            {!hasEnoughData && <span style={{ fontSize: 10, color: '#9ca3af', background: '#f9fafb', padding: '2px 8px', borderRadius: 99 }}>мало данных</span>}
          </div>
          {sizeStats.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sizeStats.map((s, i) => (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>{s.size}</span>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <span style={{ fontSize: 12, color: '#0FBCCE', fontWeight: 600 }}>спрос {s.pct}%</span>
                      {stockSizeMap[s.size] !== undefined && (
                        <span style={{ fontSize: 12, color: '#9ca3af' }}>
                          сток {Math.round((stockSizeMap[s.size] / totalStock) * 100)}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ height: 8, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${s.pct}%`, background: '#0FBCCE', borderRadius: 4, transition: 'width 0.5s' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#9ca3af', fontSize: 13 }}>
              Данные появятся после первых заказов
            </div>
          )}
        </div>

        {/* Топ просматриваемые */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 16 }}>Топ просматриваемых товаров</h2>
          {topViewed.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {topViewed.map(([name, count], i) => (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{name}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#374151', flexShrink: 0 }}>{count} просм.</span>
                  </div>
                  <div style={{ height: 6, background: '#f3f4f6', borderRadius: 3 }}>
                    <div style={{ height: '100%', width: `${(count / (topViewed[0][1] || 1)) * 100}%`, background: '#8b5cf6', borderRadius: 3 }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#9ca3af', fontSize: 13 }}>
              Появится после первых просмотров
            </div>
          )}
        </div>
      </div>

      {/* География */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>География заказов</h2>
          {!hasEnoughData && <span style={{ fontSize: 10, color: '#9ca3af' }}>данные накапливаются</span>}
        </div>
        {cityStats.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {cityStats.map(([city, count], i) => (
              <div key={i} style={{ background: '#f9fafb', borderRadius: 10, padding: '12px 16px' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#111827' }}>{Math.round((count / totalCities) * 100)}%</div>
                <div style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>{city}</div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>{count} заказов</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#9ca3af', fontSize: 13 }}>
            Появится после заказов с адресами доставки
          </div>
        )}
      </div>

      {/* Воронка активности */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 16 }}>Воронка аудитории</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { label: 'Просмотры товаров', value: stats.viewsTotal, color: '#e0f2fe', bar: '#0ea5e9' },
            { label: 'Добавили в корзину', value: stats.cartsTotal, color: '#dcfce7', bar: '#22c55e' },
            { label: 'Оформили заказ', value: stats.ordersFromActivity, color: '#fef9c3', bar: '#eab308' },
            { label: 'Успешно доставлено', value: stats.ordersDelivered, color: '#f0fdf4', bar: '#16a34a' },
          ].map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 13, color: '#374151', width: 180, flexShrink: 0 }}>{f.label}</span>
              <div style={{ flex: 1, height: 28, background: '#f3f4f6', borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
                <div style={{
                  height: '100%',
                  width: `${stats.viewsTotal ? Math.max((f.value / stats.viewsTotal) * 100, f.value > 0 ? 5 : 0) : 0}%`,
                  background: f.bar,
                  borderRadius: 6,
                  transition: 'width 0.5s',
                  display: 'flex',
                  alignItems: 'center',
                  paddingLeft: 8,
                }}>
                  {f.value > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{f.value}</span>}
                </div>
                {f.value === 0 && <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#9ca3af' }}>0</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
