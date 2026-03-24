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

const CHANNEL_CFG: Record<string, { icon: string; label: string; color: string }> = {
  call:     { icon: '📞', label: 'Звонок',  color: '#8B5CF6' },
  email:    { icon: '📧', label: 'Email',   color: '#0FBCCE' },
  telegram: { icon: '✈️', label: 'Telegram', color: '#3b82f6' },
}

const TRIGGER_CFG: Record<string, { icon: string; label: string }> = {
  abandoned_cart: { icon: '🛒', label: 'Брошенная корзина' },
  reactivation:   { icon: '💤', label: 'Реактивация' },
  upsell:         { icon: '📈', label: 'Допродажа' },
  birthday:       { icon: '🎂', label: 'День рождения' },
}

const STATUS_CFG: Record<string, { bg: string; color: string; label: string }> = {
  pending:   { bg: '#F3F4F6', color: '#6B7280', label: 'Ожидание' },
  sent:      { bg: '#eff6ff', color: '#3b82f6', label: 'Отправлен' },
  answered:  { bg: '#fffbeb', color: '#D97706', label: 'Ответили' },
  converted: { bg: '#f0fdf4', color: '#16A34A', label: 'Конверсия' },
  rejected:  { bg: '#fef2f2', color: '#EF4444', label: 'Отказ' },
  failed:    { bg: '#fef2f2', color: '#EF4444', label: 'Ошибка' },
}

export default function AdminAgentsPage() {
  const [logs, setLogs] = useState<any[]>([])
  const [sellers, setSellers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterSeller, setFilterSeller] = useState('all')
  const [filterChannel, setFilterChannel] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')

  // Agent enable/disable state per seller (stored locally for now, Sprint 6 = DB-backed)
  const [agentEnabled, setAgentEnabled] = useState<Record<string, boolean>>({})
  const [callLimits, setCallLimits] = useState<Record<string, number>>({})

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const [logsRes, sellRes] = await Promise.all([
      supabase.from('sales_agent_log').select('*').order('triggered_at', { ascending: false }).limit(200),
      supabase.from('sellers').select('seller_id, brand_name'),
    ])
    setLogs(logsRes.data || [])
    setSellers(sellRes.data || [])
    // Init limits
    const limits: Record<string, number> = {}
    sellRes.data?.forEach((s: any) => { limits[s.seller_id] = 10 })
    setCallLimits(limits)
    setLoading(false)
  }

  const brandName = (sellerId: string) =>
    sellers.find(s => s.seller_id === sellerId)?.brand_name || sellerId

  const filtered = logs.filter(l => {
    if (filterSeller !== 'all' && l.seller_id !== filterSeller) return false
    if (filterChannel !== 'all' && l.channel !== filterChannel) return false
    if (filterStatus !== 'all' && l.status !== filterStatus) return false
    return true
  })

  // Global stats
  const totalSent = logs.filter(l => l.status !== 'pending' && l.status !== 'failed').length
  const totalConverted = logs.filter(l => l.converted).length
  const conversionRate = totalSent > 0 ? ((totalConverted / totalSent) * 100).toFixed(1) : '0'
  const totalRevenue = logs.filter(l => l.converted).reduce((s, l) => s + (l.conversion_amount || 0), 0)

  // Per-channel stats
  const channelStats = ['call', 'email', 'telegram'].map(ch => {
    const chLogs = logs.filter(l => l.channel === ch)
    const chConverted = chLogs.filter(l => l.converted).length
    return {
      channel: ch,
      total: chLogs.length,
      converted: chConverted,
      rate: chLogs.length > 0 ? ((chConverted / chLogs.length) * 100).toFixed(1) : '0',
    }
  })

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
            <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text }}>AI Агенты</h1>
            <p style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>Sales Agent · конверсия и логи · Sprint 6</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 11, padding: '5px 10px', borderRadius: 99, background: '#fffbeb', color: C.orange, fontWeight: 700, border: '1px solid #fde68a' }}>
              🚧 Фаза 2 — Sprint 6
            </span>
            <button onClick={load} style={{
              padding: '9px 18px', borderRadius: 10, background: C.accent,
              color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>↻ Обновить</button>
          </div>
        </div>

        {/* Global metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Запусков агента', value: logs.length, icon: '🤖', color: C.purple },
            { label: 'Конверсий', value: totalConverted, icon: '✅', color: C.ok },
            { label: 'Конверсия %', value: `${conversionRate}%`, icon: '📊', color: C.accent },
            { label: 'Выручка с агента', value: `₽${(totalRevenue / 1000).toFixed(1)}K`, icon: '💰', color: C.ok },
          ].map((m, i) => (
            <div key={i} style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, padding: '16px 18px' }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>{m.icon}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: m.color }}>{m.value}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{m.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20, marginBottom: 20 }}>

          {/* Channel breakdown */}
          <div style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, padding: 20 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16 }}>Конверсия по каналам</p>
            {channelStats.map(ch => {
              const cfg = CHANNEL_CFG[ch.channel]
              const pct = parseFloat(ch.rate)
              return (
                <div key={ch.channel} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 18 }}>{cfg.icon}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{cfg.label}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: C.muted }}>{ch.total} запусков</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: cfg.color }}>{ch.rate}%</span>
                    </div>
                  </div>
                  <div style={{ height: 8, background: C.card, borderRadius: 4 }}>
                    <div style={{
                      height: '100%', width: `${Math.min(pct * 2, 100)}%`,
                      background: cfg.color, borderRadius: 4, transition: 'width 0.6s',
                    }} />
                  </div>
                  <p style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>
                    {ch.converted} конверсий из {ch.total}
                  </p>
                </div>
              )
            })}
          </div>

          {/* Agent controls per brand */}
          <div style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, padding: 20 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 4 }}>Управление по брендам</p>
            <p style={{ fontSize: 11, color: C.muted, marginBottom: 16 }}>Sprint 6 — полный контроль, пока preview</p>

            {sellers.length === 0 ? (
              <p style={{ fontSize: 12, color: C.muted, textAlign: 'center', padding: '20px 0' }}>Нет брендов</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {sellers.map(s => {
                  const enabled = agentEnabled[s.seller_id] || false
                  const limit = callLimits[s.seller_id] || 10
                  const sellerLogs = logs.filter(l => l.seller_id === s.seller_id)
                  const sellerConverted = sellerLogs.filter(l => l.converted).length

                  return (
                    <div key={s.seller_id} style={{
                      padding: '12px 14px', borderRadius: 10,
                      background: enabled ? '#f0fdf4' : C.bg,
                      border: `1px solid ${enabled ? '#bbf7d0' : C.border}`,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: enabled ? 8 : 0 }}>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{s.brand_name}</p>
                          <p style={{ fontSize: 10, color: C.muted }}>
                            {sellerLogs.length} запусков · {sellerConverted} конверсий
                          </p>
                        </div>
                        <button
                          onClick={() => setAgentEnabled(p => ({ ...p, [s.seller_id]: !enabled }))}
                          style={{
                            padding: '5px 14px', borderRadius: 8, border: 'none',
                            fontSize: 11, fontWeight: 700, cursor: 'pointer',
                            background: enabled ? C.red : C.ok, color: '#fff',
                          }}
                        >{enabled ? 'Выкл' : 'Вкл'}</button>
                      </div>
                      {enabled && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11, color: C.muted }}>Лимит звонков/день:</span>
                          <input
                            type="number" min={1} max={100} value={limit}
                            onChange={e => setCallLimits(p => ({ ...p, [s.seller_id]: Number(e.target.value) }))}
                            style={{
                              width: 55, padding: '4px 8px', borderRadius: 6,
                              border: `1px solid ${C.border}`, fontSize: 12, textAlign: 'center',
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Log table */}
        <div style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Лог агента</span>
            <span style={{ fontSize: 11, color: C.muted, marginRight: 'auto' }}>{filtered.length} записей</span>

            <select value={filterSeller} onChange={e => setFilterSeller(e.target.value)} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12, background: C.surface }}>
              <option value="all">Все бренды</option>
              {sellers.map(s => <option key={s.seller_id} value={s.seller_id}>{s.brand_name}</option>)}
            </select>
            <select value={filterChannel} onChange={e => setFilterChannel(e.target.value)} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12, background: C.surface }}>
              <option value="all">Все каналы</option>
              {Object.entries(CHANNEL_CFG).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12, background: C.surface }}>
              <option value="all">Все статусы</option>
              {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>

          {logs.length === 0 ? (
            <div style={{ padding: '60px 0', textAlign: 'center' }}>
              <p style={{ fontSize: 40, marginBottom: 12 }}>🤖</p>
              <p style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 6 }}>Агент ещё не запускался</p>
              <p style={{ fontSize: 13, color: C.muted }}>Логи появятся после интеграции Bland AI / Retell AI в Sprint 6</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: C.bg }}>
                    {['Бренд', 'Канал', 'Триггер', 'Статус', 'Конверсия', 'Сумма', 'Дата'].map(h => (
                      <th key={h} style={{
                        padding: '10px 14px', textAlign: 'left', fontSize: 10,
                        fontWeight: 700, color: C.muted, textTransform: 'uppercase',
                        letterSpacing: 0.5, borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((l, i) => {
                    const chCfg = CHANNEL_CFG[l.channel] || { icon: '?', label: l.channel, color: C.muted }
                    const trCfg = TRIGGER_CFG[l.trigger_type] || { icon: '?', label: l.trigger_type }
                    const stCfg = STATUS_CFG[l.status] || STATUS_CFG.pending
                    return (
                      <tr key={l.id} style={{ borderTop: i > 0 ? `1px solid ${C.border}` : 'none' }}>
                        <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: C.text }}>
                          {brandName(l.seller_id)}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: chCfg.color }}>
                            {chCfg.icon} {chCfg.label}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: 12, color: C.text }}>
                          {trCfg.icon} {trCfg.label}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: stCfg.bg, color: stCfg.color }}>
                            {stCfg.label}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          <span style={{ fontSize: 14 }}>{l.converted ? '✅' : '—'}</span>
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: l.conversion_amount ? C.ok : C.muted }}>
                          {l.conversion_amount ? `₽${l.conversion_amount.toLocaleString('ru')}` : '—'}
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: 11, color: C.muted, whiteSpace: 'nowrap' }}>
                          {new Date(l.triggered_at).toLocaleString('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
