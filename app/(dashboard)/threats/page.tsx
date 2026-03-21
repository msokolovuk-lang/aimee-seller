'use client'

import { useRouter } from 'next/navigation'
import { useSellerData } from '@/hooks/useSellerData'

interface Threat {
  id: string
  type: 'stock' | 'returns' | 'no_sales' | 'conversion' | 'positive'
  severity: 'critical' | 'watch' | 'ok'
  title: string
  description: string
  metric: string
  action: string
  href?: string
  value?: number
}

export default function ThreatsPage() {
  const router = useRouter()
  const { orders, products, activity, stats, loading } = useSellerData()

  const threats: Threat[] = []

  if (!loading) {
    // 1. Товары без продаж
    const soldNames = new Set<string>()
    orders.filter(o => !['returned'].includes(o.status)).forEach(o => {
      ;(o.items || []).forEach((i: any) => soldNames.add(i.name))
    })
    const noSalesProducts = products.filter(p => p.is_active && !soldNames.has(p.name))
    noSalesProducts.slice(0, 3).forEach(p => {
      threats.push({
        id: 'no_sales_' + p.id,
        type: 'no_sales',
        severity: 'watch',
        title: `«${p.name}» — нет продаж`,
        description: `Товар активен, но ни одной продажи. Возможные причины: цена выше рынка, слабое описание или фото.`,
        metric: `₽${(p.price || 0).toLocaleString('ru')} · нет заказов`,
        action: 'Проверить цену и описание',
        href: '/catalog',
      })
    })

    // 2. Возвраты
    const returnOrders = orders.filter(o => ['returned', 'return_requested'].includes(o.status))
    if (returnOrders.length > 0) {
      const returnRevenue = returnOrders.reduce((s, o) => s + (o.total_price || 0), 0)
      const returnRate = stats.ordersTotal ? Math.round((returnOrders.length / stats.ordersTotal) * 100) : 0
      threats.push({
        id: 'returns',
        type: 'returns',
        severity: returnRate > 20 ? 'critical' : 'watch',
        title: `Возвраты ${returnRate}% — выше нормы`,
        description: `${returnOrders.length} возврат(а) на ₽${returnRevenue.toLocaleString('ru')}. Проверьте размерную сетку и описания товаров.`,
        metric: `${returnOrders.length} возвратов · ₽${returnRevenue.toLocaleString('ru')} потерь`,
        action: 'Посмотреть заказы',
        href: '/orders',
        value: returnRate,
      })
    }

    // 3. Низкая конверсия
    if (stats.viewsTotal > 5 && stats.conversionRate < 5) {
      threats.push({
        id: 'conversion',
        type: 'conversion',
        severity: 'watch',
        title: `Конверсия ${stats.conversionRate}% — есть куда расти`,
        description: `${stats.viewsTotal} просмотров, ${stats.cartsTotal} добавлений в корзину, ${stats.ordersFromActivity} заказов. Покупатели смотрят но не покупают.`,
        metric: `${stats.viewsTotal} просмотров → ${stats.ordersFromActivity} заказов`,
        action: 'Улучшить карточки товаров',
        href: '/catalog',
      })
    }

    // 4. Новые заказы без обработки
    const newOrders = orders.filter(o => ['new', 'pending'].includes(o.status))
    if (newOrders.length > 0) {
      threats.push({
        id: 'new_orders',
        type: 'stock',
        severity: newOrders.length > 3 ? 'critical' : 'watch',
        title: `${newOrders.length} новых заказов ждут обработки`,
        description: `Покупатели оформили заказы и ждут подтверждения. Быстрая обработка улучшает рейтинг бренда.`,
        metric: `₽${newOrders.reduce((s, o) => s + (o.total_price || 0), 0).toLocaleString('ru')} к отправке`,
        action: 'Перейти к заказам',
        href: '/orders',
      })
    }

    // 5. Позитив — если всё хорошо
    if (stats.ordersTotal > 0 && returnOrders.length === 0) {
      threats.push({
        id: 'positive_returns',
        type: 'positive',
        severity: 'ok',
        title: 'Возвратов нет — отличный результат',
        description: 'Покупатели довольны качеством и соответствием описания. Так держать.',
        metric: '0% возвратов',
        action: 'Сохранить стандарт',
        href: '/orders',
      })
    }

    if (stats.conversionRate > 20) {
      threats.push({
        id: 'positive_conversion',
        type: 'positive',
        severity: 'ok',
        title: `Конверсия ${stats.conversionRate}% — выше рынка`,
        description: 'Покупатели активно добавляют товары в корзину и оформляют заказы. Фото и описания работают.',
        metric: `${stats.conversionRate}% конверсия`,
        action: 'Применить на новые товары',
        href: '/catalog',
      })
    }
  }

  const critical = threats.filter(t => t.severity === 'critical')
  const watch = threats.filter(t => t.severity === 'watch')
  const ok = threats.filter(t => t.severity === 'ok')

  const severityConfig = {
    critical: { dot: '#ef4444', label: 'Срочно', border: '#fecaca', bg: '#fef2f2', text: '#dc2626' },
    watch: { dot: '#f59e0b', label: 'Следи', border: '#fde68a', bg: '#fffbeb', text: '#d97706' },
    ok: { dot: '#22c55e', label: 'Норма', border: '#bbf7d0', bg: '#f0fdf4', text: '#16a34a' },
  }

  const typeIcon: Record<string, string> = {
    stock: '📦', returns: '↩️', no_sales: '😴', conversion: '📉', positive: '✅'
  }

  const ThreatCard = ({ t }: { t: Threat }) => {
    const cfg = severityConfig[t.severity]
    return (
      <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${cfg.border}`, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
            {typeIcon[t.type]}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: cfg.text, background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 99, padding: '2px 10px' }}>
                {cfg.label}
              </span>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{t.title}</span>
            </div>
            <p style={{ fontSize: 13, color: '#374151', marginBottom: 8, lineHeight: 1.5 }}>{t.description}</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#6b7280', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '4px 10px' }}>{t.metric}</span>
              <button onClick={() => t.href && router.push(t.href)} style={{ fontSize: 12, fontWeight: 600, color: '#0FBCCE', background: 'none', border: 'none', cursor: 'pointer' }}>
                {t.action} →
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <div style={{ width: 32, height: 32, border: '2px solid #0FBCCE', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827' }}>Угрозы</h1>
        <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 4 }}>Автоматический анализ на основе реальных данных</p>
      </div>

      {/* Счётчики */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Срочно', count: critical.length, color: '#ef4444', bg: '#fef2f2' },
          { label: 'Следить', count: watch.length, color: '#f59e0b', bg: '#fffbeb' },
          { label: 'Норма', count: ok.length, color: '#22c55e', bg: '#f0fdf4' },
        ].map((s, i) => (
          <div key={i} style={{ background: s.bg, borderRadius: 14, padding: '16px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: s.color }}>{s.count}</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {threats.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <p style={{ fontSize: 48 }}>✅</p>
          <p style={{ fontSize: 16, fontWeight: 600, color: '#374151', marginTop: 12 }}>Всё в порядке</p>
          <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 8 }}>Угроз не обнаружено</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {critical.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', animation: 'pulse 2s infinite' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#dc2626' }}>Требуют действия · {critical.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {critical.map(t => <ThreatCard key={t.id} t={t} />)}
              </div>
            </div>
          )}
          {watch.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>Следить · {watch.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {watch.map(t => <ThreatCard key={t.id} t={t} />)}
              </div>
            </div>
          )}
          {ok.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>Всё хорошо · {ok.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {ok.map(t => <ThreatCard key={t.id} t={t} />)}
              </div>
            </div>
          )}
        </div>
      )}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  )
}
