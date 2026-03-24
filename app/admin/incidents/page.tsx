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

const PRIORITY_CFG: Record<string, { bg: string; color: string; border: string; dot: string }> = {
  critical: { bg: '#fef2f2', color: '#EF4444', border: '#fecaca', dot: '#EF4444' },
  high:     { bg: '#fffbeb', color: '#D97706', border: '#fde68a', dot: '#F59E0B' },
  medium:   { bg: '#eff6ff', color: '#3b82f6', border: '#bfdbfe', dot: '#3b82f6' },
  low:      { bg: '#F3F4F6', color: '#6B7280', border: '#E5E7EB', dot: '#9CA3AF' },
}

const TYPE_CFG: Record<string, { icon: string; label: string }> = {
  connector_error:  { icon: '🔌', label: 'Ошибка коннектора' },
  high_returns:     { icon: '↩️', label: 'Высокий возврат' },
  abandoned_cart:   { icon: '🛒', label: 'Брошенная корзина' },
  low_stock:        { icon: '📦', label: 'Мало остатков' },
  payment_failed:   { icon: '💳', label: 'Ошибка оплаты' },
}

const STATUS_CFG: Record<string, { label: string; bg: string; color: string }> = {
  open:        { label: 'Открыт',     bg: '#fef2f2', color: '#EF4444' },
  in_progress: { label: 'В работе',   bg: '#fffbeb', color: '#D97706' },
  resolved:    { label: 'Решён',      bg: '#f0fdf4', color: '#16A34A' },
  ignored:     { label: 'Игнорирован', bg: C.card,   color: '#6B7280' },
}

export default function AdminIncidentsPage() {
  const [incidents, setIncidents] = useState<any[]>([])
  const [sellers, setSellers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('open')
  const [filterPriority, setFilterPriority] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const [incRes, sellRes] = await Promise.all([
      supabase.from('incidents').select('*').order('created_at', { ascending: false }),
      supabase.from('sellers').select('seller_id, brand_name'),
    ])
    setIncidents(incRes.data || [])
    setSellers(sellRes.data || [])
    setLoading(false)
  }

  const brandName = (sellerId: string) =>
    sellers.find(s => s.seller_id === sellerId)?.brand_name || sellerId

  const updateStatus = async (id: string, status: string) => {
    setUpdatingId(id)
    await supabase.from('incidents').update({
      status,
      ...(status === 'resolved' ? { resolved_at: new Date().toISOString(), resolved_by: 'admin' } : {}),
    }).eq('id', id)
    await load()
    setUpdatingId(null)
  }

  const filtered = incidents.filter(inc => {
    if (filterStatus !== 'all' && inc.status !== filterStatus) return false
    if (filterPriority !== 'all' && inc.priority !== filterPriority) return false
    if (filterType !== 'all' && inc.type !== filterType) return false
    return true
  })

  const openCount = incidents.filter(i => i.status === 'open').length
  const criticalCount = incidents.filter(i => i.priority === 'critical' && i.status === 'open').length
  const resolvedToday = incidents.filter(i => {
    return i.status === 'resolved' && i.resolved_at &&
      new Date(i.resolved_at).toDateString() === new Date().toDateString()
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text }}>Инциденты</h1>
            <p style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
              {openCount > 0
                ? <span style={{ color: C.red, fontWeight: 600 }}>{openCount} открытых инцидентов</span>
                : <span style={{ color: C.ok }}>Все инциденты закрыты ✓</span>}
            </p>
          </div>
          <button onClick={load} style={{
            padding: '9px 18px', borderRadius: 10, background: C.accent,
            color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>↻ Обновить</button>
        </div>

        {/* Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Открытых',    value: openCount,     icon: '🔴', color: openCount > 0 ? C.red : C.ok },
            { label: 'Критических', value: criticalCount,  icon: '🚨', color: criticalCount > 0 ? C.red : C.ok },
            { label: 'Всего',       value: incidents.length, icon: '📋', color: C.text },
            { label: 'Решено сегодня', value: resolvedToday, icon: '✅', color: C.ok },
          ].map((m, i) => (
            <div key={i} style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, padding: '16px 18px' }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>{m.icon}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: m.color }}>{m.value}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{m.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {/* Status */}
          <div style={{ display: 'flex', gap: 6 }}>
            {['open', 'in_progress', 'resolved', 'all'].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)} style={{
                padding: '7px 13px', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: `1px solid ${filterStatus === s ? C.accent : C.border}`,
                background: filterStatus === s ? `${C.accent}15` : C.surface,
                color: filterStatus === s ? C.accent : C.muted,
              }}>
                {{ open: '🔴 Открытые', in_progress: '🟡 В работе', resolved: '✅ Решённые', all: 'Все' }[s]}
              </button>
            ))}
          </div>

          {/* Priority */}
          <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} style={{
            padding: '7px 12px', borderRadius: 9, border: `1px solid ${C.border}`,
            fontSize: 12, background: C.surface, color: C.text, cursor: 'pointer',
          }}>
            <option value="all">Все приоритеты</option>
            <option value="critical">🚨 Critical</option>
            <option value="high">⚠️ High</option>
            <option value="medium">🔵 Medium</option>
            <option value="low">⚪ Low</option>
          </select>

          {/* Type */}
          <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{
            padding: '7px 12px', borderRadius: 9, border: `1px solid ${C.border}`,
            fontSize: 12, background: C.surface, color: C.text, cursor: 'pointer',
          }}>
            <option value="all">Все типы</option>
            {Object.entries(TYPE_CFG).map(([key, val]) => (
              <option key={key} value={key}>{val.icon} {val.label}</option>
            ))}
          </select>
        </div>

        {/* Incidents feed */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.length === 0 ? (
            <div style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, padding: '60px 0', textAlign: 'center' }}>
              <p style={{ fontSize: 32, marginBottom: 12 }}>✅</p>
              <p style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 6 }}>Инцидентов нет</p>
              <p style={{ fontSize: 13, color: C.muted }}>Все системы работают нормально</p>
            </div>
          ) : (
            filtered.map(inc => {
              const pCfg = PRIORITY_CFG[inc.priority] || PRIORITY_CFG.low
              const tCfg = TYPE_CFG[inc.type] || { icon: '❓', label: inc.type }
              const sCfg = STATUS_CFG[inc.status] || STATUS_CFG.open

              return (
                <div key={inc.id} style={{
                  background: C.surface, borderRadius: 14,
                  border: `1px solid ${inc.priority === 'critical' ? pCfg.border : C.border}`,
                  padding: '16px 18px',
                  borderLeft: `4px solid ${pCfg.dot}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      {/* Top row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 16 }}>{tCfg.icon}</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{inc.title}</span>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                          background: pCfg.bg, color: pCfg.color,
                        }}>{inc.priority.toUpperCase()}</span>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                          background: sCfg.bg, color: sCfg.color,
                        }}>{sCfg.label}</span>
                      </div>

                      {/* Description */}
                      {inc.description && (
                        <p style={{ fontSize: 13, color: C.muted, marginBottom: 8, lineHeight: 1.5 }}>
                          {inc.description}
                        </p>
                      )}

                      {/* Meta row */}
                      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, color: C.muted }}>
                          🏷️ {brandName(inc.seller_id)}
                        </span>
                        <span style={{ fontSize: 11, color: C.muted }}>
                          🏷 {tCfg.label}
                        </span>
                        <span style={{ fontSize: 11, color: C.muted }}>
                          🕐 {new Date(inc.created_at).toLocaleString('ru', {
                            day: 'numeric', month: 'short',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </span>
                        {inc.resolved_at && (
                          <span style={{ fontSize: 11, color: C.ok }}>
                            ✓ Решён {new Date(inc.resolved_at).toLocaleString('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                      {inc.status === 'open' && (
                        <>
                          <button
                            onClick={() => updateStatus(inc.id, 'in_progress')}
                            disabled={updatingId === inc.id}
                            style={{
                              padding: '6px 14px', borderRadius: 8, background: '#fffbeb',
                              border: '1px solid #fde68a', color: '#D97706',
                              fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                            }}
                          >▶ В работу</button>
                          <button
                            onClick={() => updateStatus(inc.id, 'resolved')}
                            disabled={updatingId === inc.id}
                            style={{
                              padding: '6px 14px', borderRadius: 8, background: '#f0fdf4',
                              border: '1px solid #bbf7d0', color: C.ok,
                              fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                            }}
                          >✓ Решить</button>
                          <button
                            onClick={() => updateStatus(inc.id, 'ignored')}
                            disabled={updatingId === inc.id}
                            style={{
                              padding: '6px 14px', borderRadius: 8, background: C.card,
                              border: `1px solid ${C.border}`, color: C.muted,
                              fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                            }}
                          >✕ Игнор</button>
                        </>
                      )}
                      {inc.status === 'in_progress' && (
                        <button
                          onClick={() => updateStatus(inc.id, 'resolved')}
                          disabled={updatingId === inc.id}
                          style={{
                            padding: '6px 14px', borderRadius: 8, background: '#f0fdf4',
                            border: '1px solid #bbf7d0', color: C.ok,
                            fontSize: 11, fontWeight: 600, cursor: 'pointer',
                          }}
                        >✓ Решить</button>
                      )}
                      {(inc.status === 'resolved' || inc.status === 'ignored') && (
                        <button
                          onClick={() => updateStatus(inc.id, 'open')}
                          disabled={updatingId === inc.id}
                          style={{
                            padding: '6px 14px', borderRadius: 8, background: '#fef2f2',
                            border: '1px solid #fecaca', color: C.red,
                            fontSize: 11, fontWeight: 600, cursor: 'pointer',
                          }}
                        >↺ Переоткрыть</button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

      </div>
    </div>
  )
}
