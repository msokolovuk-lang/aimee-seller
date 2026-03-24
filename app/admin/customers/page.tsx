'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const C = {
  bg: '#F8F9FA', surface: '#FFFFFF', card: '#F3F4F6', border: '#E5E7EB',
  text: '#111827', muted: '#6B7280', accent: '#0FBCCE', ok: '#16A34A',
  orange: '#F59E0B', red: '#EF4444', purple: '#8B5CF6',
}

const TAG_COLORS: Record<string, { bg: string; color: string }> = {
  vip:     { bg: '#fdf4ff', color: '#9333ea' },
  active:  { bg: '#f0fdf4', color: '#16A34A' },
  new:     { bg: '#eff6ff', color: '#3b82f6' },
  churned: { bg: '#fef2f2', color: '#EF4444' },
}

const SOURCE_LABEL: Record<string, string> = {
  sdk: '🌐 SDK', import: '📥 Импорт', manual: '✏️ Вручную', crm_sync: '🔄 CRM Sync',
}

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<any[]>([])
  const [sellers, setSellers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterBrand, setFilterBrand] = useState('all')
  const [filterTag, setFilterTag] = useState('all')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'ltv' | 'created_at' | 'orders_count'>('ltv')

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const [custRes, sellRes] = await Promise.all([
      supabase.from('brand_customers').select('*').order('ltv', { ascending: false }),
      supabase.from('sellers').select('seller_id, brand_name'),
    ])
    setCustomers(custRes.data || [])
    setSellers(sellRes.data || [])
    setLoading(false)
  }

  const brandName = (sellerId: string) =>
    sellers.find(s => s.seller_id === sellerId)?.brand_name || sellerId

  const filtered = customers
    .filter(c => {
      if (filterBrand !== 'all' && c.seller_id !== filterBrand) return false
      if (filterTag !== 'all' && !(c.tags || []).includes(filterTag)) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          c.name?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.phone?.includes(q)
        )
      }
      return true
    })
    .sort((a, b) => {
      if (sortBy === 'ltv') return (b.ltv || 0) - (a.ltv || 0)
      if (sortBy === 'orders_count') return (b.orders_count || 0) - (a.orders_count || 0)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

  const totalLTV = customers.reduce((s, c) => s + (c.ltv || 0), 0)
  const vipCount = customers.filter(c => (c.tags || []).includes('vip')).length
  const churnedCount = customers.filter(c => (c.tags || []).includes('churned')).length
  const newCount = customers.filter(c => {
    const d7 = new Date(Date.now() - 7 * 86400000)
    return new Date(c.created_at) > d7
  }).length

  const exportCSV = () => {
    const rows = [
      ['Бренд', 'Имя', 'Email', 'Телефон', 'Заказов', 'LTV', 'Теги', 'Источник', 'Создан'],
      ...filtered.map(c => [
        brandName(c.seller_id), c.name || '', c.email || '', c.phone || '',
        c.orders_count || 0, c.ltv || 0,
        (c.tags || []).join(';'), c.source || '', c.created_at?.slice(0, 10) || '',
      ]),
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `aimee-customers-${new Date().toISOString().slice(0, 10)}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, border: `3px solid ${C.accent}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: C.bg, padding: 28 }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text }}>Покупатели</h1>
            <p style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>CRM всех брендов AIMEE</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={exportCSV} style={{
              padding: '9px 16px', borderRadius: 10, border: `1px solid ${C.border}`,
              background: C.surface, color: C.text, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>📥 Экспорт CSV</button>
            <button onClick={load} style={{
              padding: '9px 16px', borderRadius: 10, background: C.accent,
              color: '#fff', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>↻ Обновить</button>
          </div>
        </div>

        {/* Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Всего покупателей', value: customers.length, icon: '👥', color: C.text },
            { label: 'VIP (LTV > ₽30K)', value: vipCount, icon: '👑', color: C.purple },
            { label: 'Новых за 7д', value: newCount, icon: '🆕', color: C.ok },
            { label: 'Суммарный LTV', value: `₽${(totalLTV / 1000).toFixed(0)}K`, icon: '💰', color: C.accent },
          ].map((m, i) => (
            <div key={i} style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, padding: '16px 18px' }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>{m.icon}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: m.color }}>{m.value}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{m.label}</div>
            </div>
          ))}
        </div>

        {/* Segment quick-filter */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            placeholder="Поиск по имени, email, телефону..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              flex: 1, minWidth: 220, maxWidth: 320, padding: '9px 14px', borderRadius: 10,
              border: `1px solid ${C.border}`, fontSize: 13, background: C.surface, outline: 'none', color: C.text,
            }}
          />

          <select value={filterBrand} onChange={e => setFilterBrand(e.target.value)} style={{
            padding: '9px 12px', borderRadius: 10, border: `1px solid ${C.border}`,
            fontSize: 12, background: C.surface, color: C.text, cursor: 'pointer',
          }}>
            <option value="all">Все бренды</option>
            {sellers.map(s => <option key={s.seller_id} value={s.seller_id}>{s.brand_name}</option>)}
          </select>

          {['all', 'vip', 'active', 'new', 'churned'].map(t => (
            <button key={t} onClick={() => setFilterTag(t)} style={{
              padding: '8px 14px', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: `1px solid ${filterTag === t ? C.accent : C.border}`,
              background: filterTag === t ? `${C.accent}15` : C.surface,
              color: filterTag === t ? C.accent : C.muted,
            }}>
              {t === 'all' ? 'Все' : t === 'vip' ? '👑 VIP' : t === 'active' ? '✅ Активные' : t === 'new' ? '🆕 Новые' : '💤 Отток'}
            </button>
          ))}

          <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} style={{
            marginLeft: 'auto', padding: '9px 12px', borderRadius: 10, border: `1px solid ${C.border}`,
            fontSize: 12, background: C.surface, color: C.text, cursor: 'pointer',
          }}>
            <option value="ltv">Сортировка: LTV</option>
            <option value="orders_count">Сортировка: Заказы</option>
            <option value="created_at">Сортировка: Дата</option>
          </select>
        </div>

        {/* Customers table */}
        <div style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
              {filtered.length} покупателей
            </span>
            <span style={{ fontSize: 12, color: C.muted }}>
              Средний LTV: ₽{filtered.length ? Math.round(filtered.reduce((s, c) => s + (c.ltv || 0), 0) / filtered.length).toLocaleString('ru') : 0}
            </span>
          </div>

          {customers.length === 0 ? (
            <div style={{ padding: '60px 0', textAlign: 'center' }}>
              <p style={{ fontSize: 32, marginBottom: 12 }}>👥</p>
              <p style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 6 }}>Покупателей пока нет</p>
              <p style={{ fontSize: 13, color: C.muted }}>Они появятся автоматически после установки SDK и первых заказов</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: C.bg }}>
                    {['Покупатель', 'Бренд', 'Контакт', 'Заказов', 'LTV', 'Теги', 'Источник', 'Последний заказ'].map(h => (
                      <th key={h} style={{
                        padding: '10px 14px', textAlign: 'left', fontSize: 10,
                        fontWeight: 700, color: C.muted, textTransform: 'uppercase',
                        letterSpacing: 0.5, whiteSpace: 'nowrap', borderBottom: `1px solid ${C.border}`,
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c, i) => (
                    <tr key={c.id} style={{ borderTop: i > 0 ? `1px solid ${C.border}` : 'none' }}>
                      {/* Name */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                          <div style={{
                            width: 30, height: 30, borderRadius: 8, background: C.card,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 13, fontWeight: 700, color: C.muted, flexShrink: 0,
                          }}>
                            {c.name?.[0]?.toUpperCase() || '?'}
                          </div>
                          <p style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                            {c.name || 'Аноним'}
                          </p>
                        </div>
                      </td>

                      {/* Brand */}
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontSize: 12, color: C.muted }}>{brandName(c.seller_id)}</span>
                      </td>

                      {/* Contact */}
                      <td style={{ padding: '12px 14px' }}>
                        {c.email && <p style={{ fontSize: 11, color: C.text }}>{c.email}</p>}
                        {c.phone && <p style={{ fontSize: 11, color: C.muted }}>{c.phone}</p>}
                        {!c.email && !c.phone && <span style={{ fontSize: 11, color: C.muted }}>—</span>}
                      </td>

                      {/* Orders */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: (c.orders_count || 0) > 0 ? C.text : C.muted }}>
                          {c.orders_count || 0}
                        </span>
                      </td>

                      {/* LTV */}
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: (c.ltv || 0) >= 30000 ? C.purple : (c.ltv || 0) > 0 ? C.accent : C.muted }}>
                          {(c.ltv || 0) > 0 ? `₽${(c.ltv).toLocaleString('ru')}` : '—'}
                        </span>
                      </td>

                      {/* Tags */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {(c.tags || []).map((tag: string) => {
                            const tc = TAG_COLORS[tag] || { bg: C.card, color: C.muted }
                            return (
                              <span key={tag} style={{
                                fontSize: 10, fontWeight: 700, padding: '2px 7px',
                                borderRadius: 99, background: tc.bg, color: tc.color,
                              }}>{tag}</span>
                            )
                          })}
                          {(c.tags || []).length === 0 && <span style={{ fontSize: 11, color: C.muted }}>—</span>}
                        </div>
                      </td>

                      {/* Source */}
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontSize: 11, color: C.muted }}>
                          {SOURCE_LABEL[c.source] || c.source || '—'}
                        </span>
                      </td>

                      {/* Last order */}
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontSize: 11, color: C.muted }}>
                          {c.last_order_at
                            ? new Date(c.last_order_at).toLocaleDateString('ru', { day: 'numeric', month: 'short' })
                            : '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Segment info */}
        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {[
            { label: 'VIP', desc: 'LTV > ₽30K', count: vipCount, color: C.purple },
            { label: 'Отток', desc: 'Не покупали 60+ дней', count: churnedCount, color: C.red },
            { label: 'Новые', desc: 'Зарегистрированы за 7д', count: newCount, color: C.ok },
          ].map((seg, i) => (
            <div key={i} style={{
              padding: '12px 14px', background: C.surface, borderRadius: 10,
              border: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between',
            }}>
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{seg.label}</p>
                <p style={{ fontSize: 11, color: C.muted }}>{seg.desc}</p>
              </div>
              <p style={{ fontSize: 20, fontWeight: 800, color: seg.color }}>{seg.count}</p>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
