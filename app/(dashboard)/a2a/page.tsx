'use client'

import { useState, useEffect } from 'react'
import { useSellerData } from '@/hooks/useSellerData'

function LiveDialog() {
  const DIALOGS = [
    [
      { from: 'buyer', text: 'Дайте скидку 20%' },
      { from: 'agent', text: 'Привет! Готов предложить 8% — хорошая цена 🤝' },
      { from: 'buyer', text: 'Хочу хотя бы 15%' },
      { from: 'agent', text: 'Максимум 12% — финальное предложение' },
      { from: 'buyer', text: 'Договорились ✅' },
    ],
    [
      { from: 'buyer', text: 'Есть скидка на 2 штуки?' },
      { from: 'agent', text: '2 штуки — минус 10%, 3 штуки — минус 15%' },
      { from: 'buyer', text: 'Беру 2 🙌' },
      { from: 'agent', text: 'Скидка 10% применена ✅' },
    ],
  ]
  const [idx, setIdx] = useState(0)
  const [count, setCount] = useState(0)

  useEffect(() => {
    const dialog = DIALOGS[idx]
    if (count >= dialog.length) {
      const t = setTimeout(() => { setIdx(i => (i + 1) % DIALOGS.length); setCount(0) }, 2500)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => setCount(v => v + 1), count === 0 ? 400 : 1200)
    return () => clearTimeout(t)
  }, [count, idx])

  const dialog = DIALOGS[idx]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 120 }}>
      {dialog.slice(0, count).map((msg, i) => (
        <div key={`${idx}-${i}`} style={{ display: 'flex', justifyContent: msg.from === 'buyer' ? 'flex-start' : 'flex-end' }}>
          <div style={{ maxWidth: '80%', padding: '8px 12px', borderRadius: msg.from === 'buyer' ? '12px 12px 12px 2px' : '12px 12px 2px 12px', fontSize: 12, lineHeight: 1.4, background: msg.from === 'buyer' ? '#f3f4f6' : '#0FBCCE', color: msg.from === 'buyer' ? '#374151' : '#fff' }}>
            {msg.from === 'agent' && <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', display: 'block', marginBottom: 2 }}>AIMEE агент</span>}
            {msg.text}
          </div>
        </div>
      ))}
      {count < dialog.length && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ background: 'rgba(15,188,206,0.15)', padding: '8px 12px', borderRadius: 12, display: 'flex', gap: 4 }}>
            {[0, 1, 2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#0FBCCE', animation: 'bounce 1s infinite', animationDelay: `${i * 150}ms` }} />)}
          </div>
        </div>
      )}
    </div>
  )
}

export default function A2APage() {
  const { activity, orders, stats, loading } = useSellerData()
  const [time, setTime] = useState('')

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [])

  // реальные переговоры из activity
  const negotiations = activity.filter(a => a.type === 'negotiate').slice(0, 8)
  const acceptedNeg = activity.filter(a => a.type === 'negotiate_accept')

  // реальная статистика A2A
  const totalNegotiations = negotiations.length
  const closedDeals = acceptedNeg.length
  const savedMargin = acceptedNeg.reduce((s, a) => {
    const orig = a.data?.original_price || 0
    const agreed = a.data?.agreed_price || orig
    return s + (orig - agreed)
  }, 0)
  const avgDiscount = acceptedNeg.length
    ? Math.round(acceptedNeg.reduce((s, a) => {
        const orig = a.data?.original_price || 1
        const agreed = a.data?.agreed_price || orig
        return s + ((orig - agreed) / orig * 100)
      }, 0) / acceptedNeg.length)
    : 0

  // закрытые сделки из заказов
  const recentOrders = orders.slice(0, 6)

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <div style={{ width: 32, height: 32, border: '2px solid #0FBCCE', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      {/* Заголовок */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827' }}>A2A Сеть</h1>
          <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 4 }}>Агент ведёт переговоры 24/7</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 99, padding: '6px 14px' }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', animation: 'pulse 2s infinite' }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#16a34a' }}>Live · {time}</span>
        </div>
      </div>

      {/* Метрики */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Активных торгов', value: totalNegotiations, sub: 'прямо сейчас', color: '#0FBCCE' },
          { label: 'Сделок закрыто', value: closedDeals, sub: 'без участия селлера', color: '#22c55e' },
          { label: 'Защищено маржи', value: savedMargin ? `₽${(savedMargin/1000).toFixed(1)}K` : '₽0', sub: 'vs первое предложение', color: '#8b5cf6' },
          { label: 'Средняя скидка', value: avgDiscount ? `${avgDiscount}%` : '—', sub: 'агент даёт покупателю', color: '#f59e0b' },
        ].map((m, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>{m.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: m.color }}>{m.value}</div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{m.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Реальные переговоры */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Переговоры</span>
            {negotiations.length === 0 && <span style={{ fontSize: 11, color: '#9ca3af' }}>нет активных</span>}
          </div>
          {negotiations.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {negotiations.map((n, i) => {
                const d = n.data || {}
                return (
                  <div key={i} style={{ padding: '10px 12px', background: '#f9fafb', borderRadius: 10, border: '1px solid #e5e7eb' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>
                          {n.buyer_phone ? n.buyer_phone.slice(0, 6) + '••••' : 'Покупатель'}
                        </p>
                        <p style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{d.product_name || '—'}</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>
                          {d.original_price ? `₽${d.original_price.toLocaleString('ru')}` : ''}
                        </p>
                        <p style={{ fontSize: 10, color: '#0FBCCE', marginTop: 2 }}>💬 торгуется</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <p style={{ fontSize: 32, marginBottom: 8 }}>🤖</p>
              <p style={{ fontSize: 13, color: '#6b7280' }}>Агент готов к переговорам</p>
              <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>Как только покупатель начнёт торг — агент возьмёт на себя</p>
            </div>
          )}
        </div>

        {/* Живая демо-анимация */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Как работает агент</span>
            <span style={{ fontSize: 10, background: '#f3f4f6', color: '#6b7280', borderRadius: 99, padding: '2px 8px', fontWeight: 600 }}>ДЕМО</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#0FBCCE,#0da8b8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff' }}>A</div>
            <div>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>AIMEE агент</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
                <span style={{ fontSize: 10, color: '#22c55e' }}>ведёт переговоры</span>
              </div>
            </div>
          </div>
          <LiveDialog />
        </div>
      </div>

      {/* Последние заказы */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Закрытые сделки</span>
          <a href="/orders" style={{ fontSize: 12, color: '#0FBCCE', textDecoration: 'none' }}>Все заказы →</a>
        </div>
        {recentOrders.length === 0 ? (
          <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Заказов пока нет</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recentOrders.map((o, i) => {
              const items = o.items || []
              return (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 18 }}>{o.is_ai_buyer ? '🤖' : '🛍️'}</span>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>
                        {o.buyer_name || 'Покупатель'}
                        {o.is_ai_buyer && <span style={{ marginLeft: 6, fontSize: 10, color: '#0FBCCE', fontWeight: 600 }}>AI</span>}
                      </p>
                      <p style={{ fontSize: 11, color: '#9ca3af' }}>{items.map((i: any) => i.name).join(', ').slice(0, 40)}</p>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>₽{(o.total_price || 0).toLocaleString('ru')}</p>
                    <p style={{ fontSize: 10, color: ['new','pending'].includes(o.status) ? '#3b82f6' : '#22c55e' }}>
                      {['new','pending'].includes(o.status) ? '● Новый' : '✓ ' + o.status}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        @keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
      `}</style>
    </div>
  )
}
