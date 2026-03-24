'use client'

import { useState, useEffect, useCallback } from 'react'

const C = {
  bg: '#F8F9FA', surface: '#FFFFFF', card: '#F3F4F6', border: '#E5E7EB',
  text: '#111827', muted: '#6B7280', accent: '#0FBCCE', ok: '#16A34A',
  orange: '#F59E0B', red: '#EF4444', purple: '#8B5CF6',
}

const TAG_COLORS: Record<string, { bg: string; color: string }> = {
  vip:         { bg: '#fdf4ff', color: '#9333ea' },
  active:      { bg: '#f0fdf4', color: '#16A34A' },
  new:         { bg: '#eff6ff', color: '#3b82f6' },
  churned:     { bg: '#fef2f2', color: '#EF4444' },
  loyal:       { bg: '#fff7ed', color: '#ea580c' },
  big_spender: { bg: '#fdf4ff', color: '#7c3aed' },
}

const SEGMENTS = [
  { key: 'all',         label: 'Все',             tag: null },
  { key: 'vip',         label: '👑 VIP',           tag: 'vip' },
  { key: 'active',      label: '✅ Активные',      tag: 'active' },
  { key: 'new',         label: '🆕 Новые',         tag: 'new' },
  { key: 'churned',     label: '💤 Отток',         tag: 'churned' },
  { key: 'loyal',       label: '🏆 Лояльные',      tag: 'loyal' },
]

export default function AdminCustomersPage() {
  const [customers, setCustomers]   = useState<any[]>([])
  const [sellers, setSellers]       = useState<any[]>([])
  const [filterBrand, setFilterBrand] = useState('all')
  const [filterSeg, setFilterSeg]   = useState('all')
  const [search, setSearch]         = useState('')
  const [sortBy, setSortBy]         = useState<'ltv' | 'orders_count' | 'created_at'>('ltv')
  const [loading, setLoading]       = useState(true)
  const [syncing, setSyncing]       = useState(false)
  const [triggering, setTriggering] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)
  const [expanded, setExpanded]     = useState<string | null>(null)
  const [aiRec, setAiRec]           = useState<Record<string, string>>({})
  const [loadingRec, setLoadingRec] = useState<string | null>(null)
  const [total, setTotal]           = useState(0)

  useEffect(() => { loadSellers() }, [])
  useEffect(() => { loadCustomers() }, [filterBrand, filterSeg, search, sortBy])

  const loadSellers = async () => {
    const res = await fetch('/api/admin/sellers', { headers: { 'x-admin-secret': 'aimee-admin-2026' } })
    const data = await res.json()
    setSellers(data.sellers || [])
  }

  const loadCustomers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterBrand !== 'all') params.set('seller_id', filterBrand)

      const seg = SEGMENTS.find(s => s.key === filterSeg)
      if (seg?.tag) params.set('tag', seg.tag)
      if (search) params.set('search', search)
      params.set('limit', '200')

      // If no brand selected, load for all brands
      if (filterBrand === 'all') {
        // Load all sellers and fetch each
        const res = await fetch('/api/admin/sellers', { headers: { 'x-admin-secret': 'aimee-admin-2026' } })
        const sellersData = await res.json()
        const allSellers: any[] = sellersData.sellers || []

        const allCustomers: any[] = []
        for (const s of allSellers) {
          const p = new URLSearchParams(params)
          p.set('seller_id', s.seller_id)
          const r = await fetch(`/api/customers/sync?${p}`)
          if (r.ok) {
            const d = await r.json()
            allCustomers.push(...(d.customers || []))
          }
        }
        setCustomers(sortCustomers(allCustomers, sortBy))
        setTotal(allCustomers.length)
      } else {
        const res = await fetch(`/api/customers/sync?${params}`)
        const data = await res.json()
        setCustomers(sortCustomers(data.customers || [], sortBy))
        setTotal(data.total || 0)
      }
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }, [filterBrand, filterSeg, search, sortBy])

  const sortCustomers = (list: any[], by: string) => {
    return [...list].sort((a, b) => {
      if (by === 'ltv') return (b.ltv || 0) - (a.ltv || 0)
      if (by === 'orders_count') return (b.orders_count || 0) - (a.orders_count || 0)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }

  const syncCustomers = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      const targetSellers = filterBrand === 'all'
        ? sellers.map(s => s.seller_id)
        : [filterBrand]

      let totalSynced = 0
      for (const sid of targetSellers) {
        const res = await fetch('/api/customers/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ seller_id: sid }),
        })
        const data = await res.json()
        totalSynced += data.synced || 0
      }
      setSyncResult(`✅ Синхронизировано ${totalSynced} покупателей`)
      await loadCustomers()
    } catch (e: any) {
      setSyncResult(`❌ ${e.message}`)
    }
    setSyncing(false)
  }

  const runTriggers = async () => {
    setTriggering(true)
    try {
      const targetSellers = filterBrand === 'all'
        ? sellers.map(s => s.seller_id)
        : [filterBrand]

      let total = 0
      for (const sid of targetSellers) {
        const res = await fetch('/api/customers/triggers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ seller_id: sid }),
        })
        const data = await res.json()
        if (data.results) {
          total += (Object.values(data.results) as number[]).reduce((s, v) => s + v, 0)
        }
      }
      setSyncResult(`✅ Триггеры отправлены: ${total} уведомлений`)
    } catch (e: any) {
      setSyncResult(`❌ ${e.message}`)
    }
    setTriggering(false)
  }

  const getAiRec = async (customer: any) => {
    setLoadingRec(customer.id)
    try {
      const res = await fetch('/api/customers/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: customer.id, seller_id: customer.seller_id, context: 'stylist' }),
      })
      const data = await res.json()
      if (data.recommendation) {
        setAiRec(prev => ({ ...prev, [customer.id]: data.recommendation }))
      }
    } catch (e) {}
    setLoadingRec(null)
  }

  const exportCSV = () => {
    const rows = [
      ['Бренд', 'Имя', 'Email', 'Телефон', 'Заказов', 'LTV', 'Теги', 'Последний заказ'],
      ...customers.map(c => [
        c.seller_id, c.name || '', c.email || '', c.phone || '',
        c.orders_count || 0, c.ltv || 0,
        (c.tags || []).join(';'), c.last_order_at?.slice(0, 10) || '',
      ]),
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `aimee-customers-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  const brandName = (sid: string) => sellers.find(s => s.seller_id === sid)?.brand_name || sid

  // Stats
  const totalLTV    = customers.reduce((s, c) => s + (c.ltv || 0), 0)
  const vipCount    = customers.filter(c => (c.tags || []).includes('vip')).length
  const churnedCount = customers.filter(c => (c.tags || []).includes('churned')).length

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
            <button onClick={exportCSV} style={{ padding: '9px 14px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              📥 CSV
            </button>
            <button onClick={runTriggers} disabled={triggering} style={{ padding: '9px 14px', borderRadius: 10, border: `1px solid ${C.accent}40`, background: `${C.accent}10`, color: C.accent, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              {triggering ? '...' : '⚡ Триггеры'}
            </button>
            <button onClick={syncCustomers} disabled={syncing} style={{ padding: '9px 16px', borderRadius: 10, background: C.accent, color: '#fff', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              {syncing ? '...' : '↻ Sync из заказов'}
            </button>
          </div>
        </div>

        {/* Sync result */}
        {syncResult && (
          <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 10, background: syncResult.startsWith('✅') ? '#f0fdf4' : '#fef2f2', border: `1px solid ${syncResult.startsWith('✅') ? '#bbf7d0' : '#fecaca'}` }}>
            <p style={{ fontSize: 13, color: syncResult.startsWith('✅') ? C.ok : C.red, fontWeight: 600 }}>{syncResult}</p>
          </div>
        )}

        {/* Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Всего покупателей', value: customers.length, icon: '👥', color: C.text },
            { label: 'VIP (LTV > ₽30K)', value: vipCount, icon: '👑', color: C.purple },
            { label: 'Отток', value: churnedCount, icon: '💤', color: C.red },
            { label: 'Суммарный LTV', value: `₽${(totalLTV / 1000).toFixed(0)}K`, icon: '💰', color: C.accent },
          ].map((m, i) => (
            <div key={i} style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, padding: '16px 18px' }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>{m.icon}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: m.color }}>{m.value}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{m.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            placeholder="Поиск по имени, email, телефону..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 200, maxWidth: 300, padding: '9px 14px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 13, background: C.surface, outline: 'none', color: C.text }}
          />
          <select value={filterBrand} onChange={e => setFilterBrand(e.target.value)} style={{ padding: '9px 12px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 12, background: C.surface, color: C.text }}>
            <option value="all">Все бренды</option>
            {sellers.map(s => <option key={s.seller_id} value={s.seller_id}>{s.brand_name}</option>)}
          </select>
          {SEGMENTS.map(seg => (
            <button key={seg.key} onClick={() => setFilterSeg(seg.key)} style={{
              padding: '8px 13px', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: `1px solid ${filterSeg === seg.key ? C.accent : C.border}`,
              background: filterSeg === seg.key ? `${C.accent}15` : C.surface,
              color: filterSeg === seg.key ? C.accent : C.muted,
            }}>{seg.label}</button>
          ))}
          <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} style={{ marginLeft: 'auto', padding: '9px 12px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 12, background: C.surface, color: C.text }}>
            <option value="ltv">По LTV</option>
            <option value="orders_count">По заказам</option>
            <option value="created_at">По дате</option>
          </select>
        </div>

        {/* Table */}
        <div style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{customers.length} покупателей</span>
            <span style={{ fontSize: 12, color: C.muted }}>
              Средний LTV: ₽{customers.length ? Math.round(totalLTV / customers.length).toLocaleString('ru') : 0}
            </span>
          </div>

          {loading ? (
            <div style={{ padding: '60px 0', textAlign: 'center' }}>
              <div style={{ width: 32, height: 32, border: `3px solid ${C.accent}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
              <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
            </div>
          ) : customers.length === 0 ? (
            <div style={{ padding: '60px 0', textAlign: 'center' }}>
              <p style={{ fontSize: 32, marginBottom: 12 }}>👥</p>
              <p style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 6 }}>Покупателей нет</p>
              <p style={{ fontSize: 13, color: C.muted }}>Нажмите «Sync из заказов» чтобы импортировать</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: C.bg }}>
                    {['Покупатель', 'Бренд', 'Контакт', 'Заказов', 'LTV', 'Теги', 'Последний заказ', 'AI'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap', borderBottom: `1px solid ${C.border}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c, i) => (
                    <>
                      <tr key={c.id} onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                        style={{ borderTop: i > 0 ? `1px solid ${C.border}` : 'none', cursor: 'pointer', background: expanded === c.id ? `${C.accent}05` : 'transparent', transition: 'background 0.1s' }}>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                            <div style={{ width: 30, height: 30, borderRadius: 8, background: C.card, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: C.muted, flexShrink: 0 }}>
                              {c.name?.[0]?.toUpperCase() || '?'}
                            </div>
                            <p style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{c.name || 'Аноним'}</p>
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: 12, color: C.muted }}>{brandName(c.seller_id)}</td>
                        <td style={{ padding: '12px 14px' }}>
                          {c.email && <p style={{ fontSize: 11, color: C.text }}>{c.email}</p>}
                          {c.phone && <p style={{ fontSize: 11, color: C.muted }}>{c.phone}</p>}
                          {!c.email && !c.phone && <span style={{ fontSize: 11, color: C.muted }}>—</span>}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: (c.orders_count || 0) > 0 ? C.text : C.muted }}>{c.orders_count || 0}</span>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: (c.ltv || 0) >= 30000 ? C.purple : (c.ltv || 0) > 0 ? C.accent : C.muted }}>
                            {(c.ltv || 0) > 0 ? `₽${c.ltv.toLocaleString('ru')}` : '—'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {(c.tags || []).map((tag: string) => {
                              const tc = TAG_COLORS[tag] || { bg: C.card, color: C.muted }
                              return <span key={tag} style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: tc.bg, color: tc.color }}>{tag}</span>
                            })}
                            {!(c.tags?.length) && <span style={{ fontSize: 11, color: C.muted }}>—</span>}
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: 11, color: C.muted, whiteSpace: 'nowrap' }}>
                          {c.last_order_at ? new Date(c.last_order_at).toLocaleDateString('ru', { day: 'numeric', month: 'short' }) : '—'}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <button onClick={e => { e.stopPropagation(); getAiRec(c) }} disabled={loadingRec === c.id}
                            style={{ padding: '5px 10px', borderRadius: 7, background: `${C.purple}15`, border: `1px solid ${C.purple}30`, color: C.purple, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                            {loadingRec === c.id ? '...' : '✦ AI'}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded row */}
                      {expanded === c.id && (
                        <tr key={`${c.id}-exp`}>
                          <td colSpan={8} style={{ padding: 0, borderTop: `1px solid ${C.border}` }}>
                            <div style={{ background: `${C.accent}05`, padding: '14px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                              <div>
                                <p style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8 }}>Профиль покупателя</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  {c.sizes && <p style={{ fontSize: 11, color: C.muted }}>Размеры: {JSON.stringify(c.sizes)}</p>}
                                  {c.style_prefs?.length > 0 && <p style={{ fontSize: 11, color: C.muted }}>Стиль: {c.style_prefs.join(', ')}</p>}
                                  <p style={{ fontSize: 11, color: C.muted }}>Источник: {c.source}</p>
                                  <p style={{ fontSize: 11, color: C.muted }}>Создан: {new Date(c.created_at).toLocaleDateString('ru')}</p>
                                  {c.external_id && <p style={{ fontSize: 10, color: C.muted, fontFamily: 'monospace' }}>ID: {c.external_id}</p>}
                                </div>
                              </div>
                              {aiRec[c.id] && (
                                <div style={{ background: C.surface, borderRadius: 10, padding: '12px 14px', border: `1px solid ${C.purple}20` }}>
                                  <p style={{ fontSize: 11, fontWeight: 700, color: C.purple, marginBottom: 6 }}>✦ AI Рекомендация</p>
                                  <p style={{ fontSize: 12, color: C.text, lineHeight: 1.6 }}>{aiRec[c.id]}</p>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
