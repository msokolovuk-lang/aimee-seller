'use client'

import { useState } from 'react'
import { useSellerData } from '@/hooks/useSellerData'

const EVENT_META: Record<string, { icon: string; color: string; bg: string; label: (d: any) => string }> = {
  view:            { icon: '👀', color: '#6b7280', bg: '#f9fafb',   label: d => `смотрит «${d.product_name || '—'}»` },
  add_to_cart:     { icon: '🛒', color: '#3b82f6', bg: '#eff6ff',   label: d => `добавил «${d.product_name || '—'}» в корзину` },
  negotiate:       { icon: '💬', color: '#f59e0b', bg: '#fffbeb',   label: d => `предлагает цену за «${d.product_name || '—'}»` },
  negotiate_accept:{ icon: '✅', color: '#22c55e', bg: '#f0fdf4',   label: d => `согласился на ${d.agreed_price ? d.agreed_price.toLocaleString('ru') + ' ₽' : 'цену'}` },
  order_placed:    { icon: '🎉', color: '#0FBCCE', bg: '#f0fdfe',   label: d => `оформил заказ на ${d.total ? d.total.toLocaleString('ru') + ' ₽' : '—'}` },
  order:           { icon: '🎉', color: '#0FBCCE', bg: '#f0fdfe',   label: d => `оформил заказ на ${d.total ? d.total.toLocaleString('ru') + ' ₽' : '—'}` },
  return:          { icon: '↩️', color: '#ef4444', bg: '#fef2f2',   label: () => `запросил возврат` },
}

const FILTERS = ['Все', 'Просмотры', 'Корзина', 'Заказы']
const FILTER_TYPES: Record<string, string[]> = {
  'Все': [],
  'Просмотры': ['view'],
  'Корзина': ['add_to_cart'],
  'Заказы': ['order_placed', 'order'],
}

function timeAgo(date: string) {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (diff < 60) return `${diff}с назад`
  if (diff < 3600) return `${Math.floor(diff/60)}м назад`
  if (diff < 86400) return `${Math.floor(diff/3600)}ч назад`
  return new Date(date).toLocaleDateString('ru', { day: 'numeric', month: 'short' })
}

export default function ActivityPage() {
  const { activity, stats, loading, refresh } = useSellerData()
  const [filter, setFilter] = useState('Все')

  const filtered = activity.filter(e => {
    const types = FILTER_TYPES[filter]
    return !types.length || types.includes(e.type)
  })

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827' }}>Активность покупателей</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', animation: 'pulse 2s infinite' }} />
            <span style={{ fontSize: 13, color: '#6b7280' }}>Обновляется в реальном времени</span>
          </div>
        </div>
        <button onClick={refresh} style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', fontSize: 13, color: '#374151', cursor: 'pointer', fontWeight: 600 }}>
          ↻ Обновить
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Просмотры',  value: stats.viewsTotal,         icon: '👀', color: '#6b7280' },
          { label: 'В корзину',  value: stats.cartsTotal,         icon: '🛒', color: '#3b82f6' },
          { label: 'Заказы',     value: stats.ordersFromActivity, icon: '🎉', color: '#0FBCCE' },
          { label: 'Выручка',    value: stats.revenueTotal ? `₽${(stats.revenueTotal/1000).toFixed(1)}K` : '₽0', icon: '💰', color: '#22c55e' },
        ].map((s, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: '#9ca3af' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '6px 16px', borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            background: filter === f ? '#0FBCCE' : '#fff',
            color: filter === f ? '#fff' : '#6b7280',
            border: `1px solid ${filter === f ? '#0FBCCE' : '#e5e7eb'}`,
          }}>{f}</button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#9ca3af', alignSelf: 'center' }}>{filtered.length} событий</span>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
          <div style={{ width: 32, height: 32, border: '2px solid #0FBCCE', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', paddingTop: 60 }}>
          <p style={{ fontSize: 48, marginBottom: 16 }}>📭</p>
          <p style={{ fontSize: 16, fontWeight: 600, color: '#374151' }}>Активности пока нет</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.map((ev, i) => {
            const meta = EVENT_META[ev.type] || { icon: '•', color: '#9ca3af', bg: '#f9fafb', label: () => ev.type }
            const d = ev.data || {}
            const isAI = d.is_ai_buyer || false
            return (
              <div key={ev.id || i} style={{
                background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb',
                padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
                borderLeft: `3px solid ${meta.color}`,
              }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                  {meta.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
                      {isAI ? '🤖 AI-покупатель' : (ev.buyer_phone ? ev.buyer_phone.slice(0, 6) + '••••' : 'Покупатель')}
                    </span>
                    <span style={{ fontSize: 13, color: '#374151' }}>{meta.label(d)}</span>
                  </div>
                  {d.size && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>Размер: {d.size}{d.price ? ` · ${Number(d.price).toLocaleString('ru')} ₽` : ''}</div>}
                </div>
                <div style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0 }}>{timeAgo(ev.created_at)}</div>
              </div>
            )
          })}
        </div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  )
}
