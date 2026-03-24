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

const CONNECTOR_CATALOG = [
  { type: 'moysklad',   name: 'МойСклад',        icon: '🏭', category: 'Склад' },
  { type: 'cdek',       name: 'СДЭК',             icon: '📦', category: 'Доставка' },
  { type: 'bitrix',     name: 'Битрикс24',        icon: '🗂️', category: 'CRM' },
  { type: 'amocrm',     name: 'amoCRM',           icon: '🗂️', category: 'CRM' },
  { type: 'yukassa',    name: 'ЮKassa',           icon: '💳', category: 'Оплата' },
  { type: 'telegram',   name: 'Telegram-бот',     icon: '💬', category: 'Мессенджер' },
  { type: 'tilda',      name: 'Tilda',            icon: '🌐', category: 'CMS' },
  { type: 'bitrixcms',  name: '1С-Битрикс',      icon: '🌐', category: 'CMS' },
]

const STATUS_LABEL: Record<string, { label: string; bg: string; color: string }> = {
  active:   { label: 'Активен',  bg: '#f0fdf4', color: '#16A34A' },
  inactive: { label: 'Не подключён', bg: '#F3F4F6', color: '#6B7280' },
  error:    { label: 'Ошибка',   bg: '#fef2f2', color: '#EF4444' },
  pending:  { label: 'Ожидание', bg: '#fffbeb', color: '#F59E0B' },
}

export default function AdminConnectorsPage() {
  const [sellers, setSellers] = useState<any[]>([])
  const [connectors, setConnectors] = useState<any[]>([])
  const [syncLogs, setSyncLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedSeller, setExpandedSeller] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const [sellersRes, connectorsRes, logsRes] = await Promise.all([
      supabase.from('sellers').select('seller_id, brand_name, is_active').order('created_at', { ascending: false }),
      supabase.from('brand_connectors').select('*'),
      supabase.from('connector_sync_log').select('*').order('started_at', { ascending: false }).limit(100),
    ])
    setSellers(sellersRes.data || [])
    setConnectors(connectorsRes.data || [])
    setSyncLogs(logsRes.data || [])
    setLoading(false)
  }

  const getConnector = (sellerId: string, type: string) =>
    connectors.find(c => c.seller_id === sellerId && c.type === type)

  const getLastLog = (connectorId: string) =>
    syncLogs.find(l => l.connector_id === connectorId)

  // Summary stats
  const totalActive = connectors.filter(c => c.status === 'active').length
  const totalError = connectors.filter(c => c.status === 'error').length
  const totalPending = connectors.filter(c => c.status === 'pending').length
  const errorsLast24h = syncLogs.filter(l => {
    const h24 = new Date(Date.now() - 86400000)
    return l.status === 'error' && new Date(l.started_at) > h24
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
            <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text }}>SDK & Коннекторы</h1>
            <p style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>Статус синхронизации по каждому бренду</p>
          </div>
          <button onClick={load} style={{
            padding: '9px 18px', borderRadius: 10, background: C.accent,
            color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>↻ Обновить</button>
        </div>

        {/* Summary metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Активных коннекторов', value: totalActive, icon: '✅', color: C.ok },
            { label: 'Ошибок sync (24ч)', value: errorsLast24h, icon: '🔴', color: C.red },
            { label: 'В ошибке сейчас', value: totalError, icon: '⚠️', color: C.orange },
            { label: 'Ожидают настройки', value: totalPending, icon: '⏳', color: C.muted },
          ].map((m, i) => (
            <div key={i} style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, padding: '16px 18px' }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>{m.icon}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: m.color }}>{m.value}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{m.label}</div>
            </div>
          ))}
        </div>

        {/* Matrix: seller × connector */}
        <div style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Матрица подключений — Фаза 1</span>
            <span style={{ fontSize: 11, color: C.muted }}>Клик по бренду — детали и логи</span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: C.bg }}>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: C.muted, whiteSpace: 'nowrap', borderBottom: `1px solid ${C.border}`, minWidth: 160 }}>
                    Бренд
                  </th>
                  {CONNECTOR_CATALOG.map(c => (
                    <th key={c.type} style={{ padding: '10px 12px', textAlign: 'center', fontSize: 10, fontWeight: 700, color: C.muted, whiteSpace: 'nowrap', borderBottom: `1px solid ${C.border}` }}>
                      <div>{c.icon}</div>
                      <div style={{ marginTop: 2 }}>{c.name}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sellers.map((s, i) => (
                  <>
                    <tr
                      key={s.seller_id}
                      onClick={() => setExpandedSeller(expandedSeller === s.seller_id ? null : s.seller_id)}
                      style={{
                        borderTop: i > 0 ? `1px solid ${C.border}` : 'none',
                        cursor: 'pointer',
                        background: expandedSeller === s.seller_id ? `${C.accent}08` : 'transparent',
                        transition: 'background 0.15s',
                      }}
                    >
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: 7, background: `${C.accent}20`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 12, fontWeight: 800, color: C.accent, flexShrink: 0,
                          }}>{s.brand_name?.[0]?.toUpperCase()}</div>
                          <div>
                            <p style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{s.brand_name}</p>
                            <p style={{ fontSize: 10, color: C.muted }}>{s.seller_id}</p>
                          </div>
                          <span style={{ marginLeft: 6, fontSize: 11, color: C.muted }}>{expandedSeller === s.seller_id ? '▲' : '▼'}</span>
                        </div>
                      </td>
                      {CONNECTOR_CATALOG.map(cat => {
                        const conn = getConnector(s.seller_id, cat.type)
                        const st = conn?.status || 'inactive'
                        const cfg = STATUS_LABEL[st]
                        return (
                          <td key={cat.type} style={{ padding: '12px', textAlign: 'center' }}>
                            <span style={{
                              display: 'inline-block', padding: '3px 8px', borderRadius: 99,
                              fontSize: 10, fontWeight: 700,
                              background: cfg.bg, color: cfg.color,
                            }}>
                              {st === 'active' ? '✓' : st === 'error' ? '✕' : st === 'pending' ? '…' : '—'}
                            </span>
                          </td>
                        )
                      })}
                    </tr>

                    {/* Expanded row — connector details */}
                    {expandedSeller === s.seller_id && (
                      <tr key={`${s.seller_id}-expanded`}>
                        <td colSpan={CONNECTOR_CATALOG.length + 1} style={{ padding: 0, borderTop: `1px solid ${C.border}` }}>
                          <div style={{ background: `${C.accent}06`, padding: '16px 20px' }}>
                            <p style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 12 }}>
                              Коннекторы бренда {s.brand_name}
                            </p>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                              {CONNECTOR_CATALOG.map(cat => {
                                const conn = getConnector(s.seller_id, cat.type)
                                const log = conn ? getLastLog(conn.id) : null
                                const st = conn?.status || 'inactive'
                                const cfg = STATUS_LABEL[st]
                                return (
                                  <div key={cat.type} style={{
                                    background: C.surface, borderRadius: 10, padding: '12px 14px',
                                    border: `1px solid ${st === 'error' ? '#fecaca' : st === 'active' ? '#bbf7d0' : C.border}`,
                                  }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                      <span style={{ fontSize: 16 }}>{cat.icon}</span>
                                      <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 99, background: cfg.bg, color: cfg.color }}>
                                        {cfg.label}
                                      </span>
                                    </div>
                                    <p style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 4 }}>{cat.name}</p>
                                    {conn ? (
                                      <>
                                        {conn.last_sync && (
                                          <p style={{ fontSize: 10, color: C.muted }}>
                                            Sync: {new Date(conn.last_sync).toLocaleString('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                          </p>
                                        )}
                                        {conn.synced_records_count > 0 && (
                                          <p style={{ fontSize: 10, color: C.ok }}>↑ {conn.synced_records_count} записей</p>
                                        )}
                                        {conn.last_error && (
                                          <p style={{ fontSize: 10, color: C.red, marginTop: 4 }}>⚠ {conn.last_error.slice(0, 60)}</p>
                                        )}
                                        {log && (
                                          <p style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>
                                            Лог: {log.records_synced} зап · {log.duration_ms ? `${log.duration_ms}ms` : '—'}
                                          </p>
                                        )}
                                      </>
                                    ) : (
                                      <p style={{ fontSize: 10, color: C.muted }}>Не настроен</p>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent sync errors */}
        {syncLogs.filter(l => l.status === 'error').length > 0 && (
          <div style={{ background: C.surface, borderRadius: 16, border: `1px solid #fecaca`, padding: 20 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: C.red, marginBottom: 12 }}>⚠ Последние ошибки синхронизации</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {syncLogs.filter(l => l.status === 'error').slice(0, 5).map((l, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 12px', background: '#fef2f2', borderRadius: 8,
                }}>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{l.connector_type} · {l.seller_id}</p>
                    <p style={{ fontSize: 11, color: C.red }}>{l.error_message || 'Неизвестная ошибка'}</p>
                  </div>
                  <span style={{ fontSize: 10, color: C.muted, flexShrink: 0, marginLeft: 12 }}>
                    {new Date(l.started_at).toLocaleString('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
