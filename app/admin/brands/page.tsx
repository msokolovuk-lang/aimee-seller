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

const PLAN_PRICE: Record<string, number> = { pilot: 0, pro: 9900, enterprise: 49900, demo: 0 }
const PLAN_COLOR: Record<string, string> = { pilot: '#16A34A', pro: '#0FBCCE', enterprise: '#8B5CF6', demo: '#6B7280' }

const CONNECTOR_ICONS: Record<string, string> = {
  moysklad: '🏭', cdek: '📦', bitrix: '🗂️', amocrm: '🗂️',
  telegram: '💬', yukassa: '💳', tilda: '🌐', bitrixcms: '🌐',
}

export default function AdminBrandsPage() {
  const [sellers, setSellers] = useState<any[]>([])
  const [connectors, setConnectors] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterPlan, setFilterPlan] = useState('all')

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const [sellersRes, connectorsRes] = await Promise.all([
      supabase.from('sellers').select('*').order('created_at', { ascending: false }),
      supabase.from('brand_connectors').select('*'),
    ])
    setSellers(sellersRes.data || [])
    setConnectors(connectorsRes.data || [])
    setLoading(false)
  }

  const getConnectors = (sellerId: string) =>
    connectors.filter(c => c.seller_id === sellerId)

  const filtered = sellers.filter(s => {
    const matchSearch = !search ||
      s.brand_name?.toLowerCase().includes(search.toLowerCase()) ||
      s.seller_id?.toLowerCase().includes(search.toLowerCase())
    const matchPlan = filterPlan === 'all' || s.plan === filterPlan
    return matchSearch && matchPlan
  })

  const totalMRR = sellers.reduce((sum, s) => sum + (PLAN_PRICE[s.plan] || 0), 0)
  const sdkActive = sellers.filter(s => {
    const sc = getConnectors(s.seller_id)
    return sc.some(c => c.status === 'active')
  }).length

  if (loading) return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, border: `3px solid ${C.accent}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: C.bg, padding: 28 }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text }}>Бренды</h1>
          <p style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
            {sellers.length} брендов · {sdkActive} с активным SDK
          </p>
        </div>

        {/* Top metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Всего брендов', value: sellers.length, icon: '🏷️', color: C.text },
            { label: 'SDK активен', value: sdkActive, icon: '✅', color: C.ok },
            { label: 'MRR платформы', value: `₽${(totalMRR / 1000).toFixed(1)}K`, icon: '💰', color: C.accent },
            { label: 'Активных', value: sellers.filter(s => s.is_active).length, icon: '🟢', color: C.ok },
          ].map((m, i) => (
            <div key={i} style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, padding: '16px 18px' }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>{m.icon}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: m.color }}>{m.value}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{m.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
          <input
            placeholder="Поиск по бренду или ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              flex: 1, maxWidth: 300, padding: '9px 14px', borderRadius: 10,
              border: `1px solid ${C.border}`, fontSize: 13, background: C.surface,
              color: C.text, outline: 'none',
            }}
          />
          {['all', 'pilot', 'pro', 'enterprise', 'demo'].map(p => (
            <button key={p} onClick={() => setFilterPlan(p)} style={{
              padding: '8px 14px', borderRadius: 9, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', border: `1px solid ${filterPlan === p ? C.accent : C.border}`,
              background: filterPlan === p ? `${C.accent}15` : C.surface,
              color: filterPlan === p ? C.accent : C.muted,
            }}>
              {p === 'all' ? 'Все планы' : p}
            </button>
          ))}
          <button onClick={load} style={{
            marginLeft: 'auto', padding: '8px 16px', borderRadius: 9,
            background: C.accent, color: '#fff', border: 'none', fontSize: 12,
            fontWeight: 600, cursor: 'pointer',
          }}>↻ Обновить</button>
        </div>

        {/* Brands table */}
        <div style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: C.bg }}>
                {['Бренд', 'ID', 'SDK & Коннекторы', 'Тариф', 'MRR', 'Статус', 'Создан'].map(h => (
                  <th key={h} style={{
                    padding: '11px 14px', textAlign: 'left', fontSize: 10,
                    fontWeight: 700, color: C.muted, textTransform: 'uppercase',
                    letterSpacing: 0.5, whiteSpace: 'nowrap',
                    borderBottom: `1px solid ${C.border}`,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: '40px 0', textAlign: 'center', color: C.muted, fontSize: 13 }}>
                    Нет брендов
                  </td>
                </tr>
              )}
              {filtered.map((s, i) => {
                const sc = getConnectors(s.seller_id)
                const activeCount = sc.filter(c => c.status === 'active').length
                const errorCount = sc.filter(c => c.status === 'error').length
                const mrr = PLAN_PRICE[s.plan] || 0

                return (
                  <tr key={s.seller_id} style={{
                    borderTop: i > 0 ? `1px solid ${C.border}` : 'none',
                    transition: 'background 0.1s',
                  }}>
                    {/* Brand */}
                    <td style={{ padding: '14px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: 9,
                          background: `${C.accent}20`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 14, fontWeight: 800, color: C.accent, flexShrink: 0,
                        }}>
                          {s.brand_name?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{s.brand_name}</p>
                          <p style={{ fontSize: 11, color: C.muted }}>{s.name || '—'}</p>
                        </div>
                      </div>
                    </td>

                    {/* ID */}
                    <td style={{ padding: '14px 14px' }}>
                      <code style={{
                        fontSize: 10, color: C.muted, background: C.card,
                        padding: '3px 6px', borderRadius: 5,
                      }}>{s.seller_id}</code>
                    </td>

                    {/* SDK & Connectors */}
                    <td style={{ padding: '14px 14px' }}>
                      {sc.length === 0 ? (
                        <span style={{ fontSize: 11, color: C.muted }}>Не подключено</span>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {sc.map(c => (
                              <span key={c.id} style={{
                                fontSize: 10, padding: '2px 7px', borderRadius: 99,
                                fontWeight: 600,
                                background: c.status === 'active' ? '#f0fdf4' : c.status === 'error' ? '#fef2f2' : C.card,
                                color: c.status === 'active' ? C.ok : c.status === 'error' ? C.red : C.muted,
                                border: `1px solid ${c.status === 'active' ? '#bbf7d0' : c.status === 'error' ? '#fecaca' : C.border}`,
                              }}>
                                {CONNECTOR_ICONS[c.type] || '🔌'} {c.type}
                              </span>
                            ))}
                          </div>
                          <p style={{ fontSize: 10, color: C.muted }}>
                            {activeCount} активных
                            {errorCount > 0 && <span style={{ color: C.red, marginLeft: 4 }}>· {errorCount} ошибок</span>}
                          </p>
                        </div>
                      )}
                    </td>

                    {/* Plan */}
                    <td style={{ padding: '14px 14px' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '3px 9px',
                        borderRadius: 99, background: `${PLAN_COLOR[s.plan] || C.muted}20`,
                        color: PLAN_COLOR[s.plan] || C.muted,
                      }}>{s.plan || '—'}</span>
                    </td>

                    {/* MRR */}
                    <td style={{ padding: '14px 14px' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: mrr > 0 ? C.accent : C.muted }}>
                        {mrr > 0 ? `₽${mrr.toLocaleString('ru')}` : '—'}
                      </span>
                    </td>

                    {/* Status */}
                    <td style={{ padding: '14px 14px' }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 99,
                        background: s.is_active ? '#f0fdf4' : '#fef2f2',
                        color: s.is_active ? C.ok : C.red,
                      }}>
                        {s.is_active ? '● Активен' : '● Откл'}
                      </span>
                    </td>

                    {/* Created */}
                    <td style={{ padding: '14px 14px' }}>
                      <span style={{ fontSize: 11, color: C.muted }}>
                        {s.created_at
                          ? new Date(s.created_at).toLocaleDateString('ru', { day: 'numeric', month: 'short', year: '2-digit' })
                          : '—'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* SDK install hint */}
        <div style={{ marginTop: 16, padding: '14px 18px', background: `${C.accent}10`, borderRadius: 12, border: `1px solid ${C.accent}30` }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: C.accent, marginBottom: 4 }}>
            SDK — один тег на сайт бренда
          </p>
          <code style={{ fontSize: 11, color: C.text, background: C.surface, padding: '6px 10px', borderRadius: 7, display: 'block', fontFamily: 'monospace' }}>
            {'<script src="https://cdn.getaimee.ru/sdk.js" data-brand="BRAND_ID" async></script>'}
          </code>
        </div>

      </div>
    </div>
  )
}
