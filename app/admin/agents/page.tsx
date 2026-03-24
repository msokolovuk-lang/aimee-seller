'use client'

import { useState, useEffect } from 'react'

const C = {
  bg: '#F8F9FA', surface: '#FFFFFF', card: '#F3F4F6', border: '#E5E7EB',
  text: '#111827', muted: '#6B7280', accent: '#0FBCCE', ok: '#16A34A',
  orange: '#F59E0B', red: '#EF4444', purple: '#8B5CF6',
}

const TRIGGER_TYPES = [
  { key: 'abandoned_cart', label: '🛒 Брошенная корзина', desc: 'Покупатель не завершил заказ' },
  { key: 'reactivation',   label: '💤 Реактивация',       desc: 'Не покупал 30+ дней' },
  { key: 'upsell',         label: '📈 Допродажа',         desc: 'После недавнего заказа' },
  { key: 'birthday',       label: '🎂 День рождения',     desc: 'Персональный подарок' },
]

const CHANNELS = [
  { key: 'telegram', label: '✈️ Telegram', desc: 'Уведомление бренду' },
  { key: 'email',    label: '📧 Email',    desc: 'Персональное письмо через Unisender' },
  { key: 'call',     label: '📞 Звонок',   desc: 'AI звонок через Retell AI (ru-RU)' },
]

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pending:   { bg: '#F3F4F6', color: '#6B7280' },
  sent:      { bg: '#eff6ff', color: '#3b82f6' },
  answered:  { bg: '#fffbeb', color: '#D97706' },
  converted: { bg: '#f0fdf4', color: '#16A34A' },
  rejected:  { bg: '#fef2f2', color: '#EF4444' },
  failed:    { bg: '#fef2f2', color: '#EF4444' },
}

export default function AdminAgentsPage() {
  const [sellers, setSellers]       = useState<any[]>([])
  const [customers, setCustomers]   = useState<any[]>([])
  const [logs, setLogs]             = useState<any[]>([])
  const [stats, setStats]           = useState<any>({})
  const [loading, setLoading]       = useState(true)

  // Test trigger form
  const [selSeller,   setSelSeller]   = useState('')
  const [selCustomer, setSelCustomer] = useState('')
  const [selTrigger,  setSelTrigger]  = useState('abandoned_cart')
  const [selChannels, setSelChannels] = useState<string[]>(['telegram'])
  const [dryRun,      setDryRun]      = useState(true)
  const [triggering,  setTriggering]  = useState(false)
  const [trigResult,  setTrigResult]  = useState<any>(null)
  const [filterSeller, setFilterSeller] = useState('all')

  useEffect(() => { loadAll() }, [])
  useEffect(() => { if (selSeller) loadCustomers(selSeller) }, [selSeller])
  useEffect(() => { if (filterSeller !== 'all') loadStats(filterSeller) }, [filterSeller])

  const loadAll = async () => {
    setLoading(true)
    const r = await fetch('/api/admin/sellers', { headers: { 'x-admin-secret': 'aimee-admin-2026' } })
    const d = await r.json()
    setSellers(d.sellers || [])
    if (d.sellers?.length) {
      setSelSeller(d.sellers[0].seller_id)
      setFilterSeller(d.sellers[0].seller_id)
      await loadStats(d.sellers[0].seller_id)
    }
    setLoading(false)
  }

  const loadCustomers = async (sid: string) => {
    const r = await fetch(`/api/customers/sync?seller_id=${sid}&limit=50`)
    const d = await r.json()
    setCustomers(d.customers || [])
  }

  const loadStats = async (sid: string) => {
    const r = await fetch(`/api/agents/trigger?seller_id=${sid}`)
    const d = await r.json()
    setLogs(d.logs || [])
    setStats(d.stats || {})
  }

  const toggleChannel = (ch: string) => {
    setSelChannels(prev =>
      prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]
    )
  }

  const triggerAgent = async () => {
    if (!selSeller || !selCustomer) return alert('Выберите бренд и покупателя')
    if (!selChannels.length) return alert('Выберите хотя бы один канал')
    setTriggering(true)
    setTrigResult(null)
    try {
      const r = await fetch('/api/agents/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seller_id:    selSeller,
          customer_id:  selCustomer,
          trigger_type: selTrigger,
          channels:     selChannels,
          dry_run:      dryRun,
        }),
      })
      const d = await r.json()
      setTrigResult(d)
      if (!dryRun) await loadStats(filterSeller)
    } catch (e: any) {
      setTrigResult({ error: e.message })
    }
    setTriggering(false)
  }

  const brandName = (sid: string) => sellers.find(s => s.seller_id === sid)?.brand_name || sid

  if (loading) return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, border: `3px solid ${C.accent}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  )

  const totalConverted = logs.filter(l => l.converted).length
  const convRate = logs.length ? ((totalConverted / logs.length) * 100).toFixed(1) : '0'

  return (
    <div style={{ minHeight: '100vh', background: C.bg, padding: 28 }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text }}>AI Агенты</h1>
            <p style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
              Sales Agent · Retell AI (ru-RU) · $0.07/мин
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 11, padding: '5px 10px', borderRadius: 99, background: '#f0fdf4', color: C.ok, fontWeight: 700, border: '1px solid #bbf7d0' }}>
              ✓ Retell AI — русский язык
            </span>
            <button onClick={() => loadStats(filterSeller)} style={{ padding: '9px 16px', borderRadius: 10, background: C.accent, color: '#fff', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              ↻
            </button>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Запусков',      value: logs.length,     icon: '🤖', color: C.purple },
            { label: 'Конверсий',     value: totalConverted,  icon: '✅', color: C.ok },
            { label: 'Конверсия',     value: `${convRate}%`,  icon: '📊', color: C.accent },
            { label: 'По каналам',    value: Object.entries(stats.by_channel || {}).map(([k,v])=>`${k}:${v}`).join(' '), icon: '📡', color: C.orange },
          ].map((m, i) => (
            <div key={i} style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, padding: '16px 18px' }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>{m.icon}</div>
              <div style={{ fontSize: i===3?13:24, fontWeight: 800, color: m.color }}>{m.value || '—'}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{m.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 20, marginBottom: 20 }}>

          {/* Trigger Panel */}
          <div style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, padding: 22 }}>
            <p style={{ fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 18 }}>🚀 Запустить агента</p>

            {/* Brand */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase' }}>Бренд</label>
              <select value={selSeller} onChange={e => setSelSeller(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: `1px solid ${C.border}`, fontSize: 13, color: C.text }}>
                {sellers.map(s => <option key={s.seller_id} value={s.seller_id}>{s.brand_name}</option>)}
              </select>
            </div>

            {/* Customer */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase' }}>Покупатель</label>
              <select value={selCustomer} onChange={e => setSelCustomer(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: `1px solid ${C.border}`, fontSize: 13, color: C.text }}>
                <option value="">— выберите —</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name || 'Аноним'} {c.phone ? `· ${c.phone}` : ''} {c.ltv ? `· ₽${c.ltv.toLocaleString('ru')}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Trigger type */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase' }}>Триггер</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {TRIGGER_TYPES.map(t => (
                  <div key={t.key} onClick={() => setSelTrigger(t.key)}
                    style={{ padding: '10px 12px', borderRadius: 9, cursor: 'pointer', border: `1px solid ${selTrigger === t.key ? C.accent : C.border}`, background: selTrigger === t.key ? `${C.accent}10` : C.bg }}>
                    <p style={{ fontSize: 13, fontWeight: selTrigger === t.key ? 700 : 500, color: selTrigger === t.key ? C.accent : C.text }}>{t.label}</p>
                    <p style={{ fontSize: 11, color: C.muted }}>{t.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Channels */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase' }}>Каналы</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {CHANNELS.map(ch => (
                  <div key={ch.key} onClick={() => toggleChannel(ch.key)}
                    style={{ padding: '9px 12px', borderRadius: 9, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, border: `1px solid ${selChannels.includes(ch.key) ? C.ok : C.border}`, background: selChannels.includes(ch.key) ? '#f0fdf4' : C.bg }}>
                    <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${selChannels.includes(ch.key) ? C.ok : C.border}`, background: selChannels.includes(ch.key) ? C.ok : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10, flexShrink: 0 }}>
                      {selChannels.includes(ch.key) ? '✓' : ''}
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{ch.label}</p>
                      <p style={{ fontSize: 11, color: C.muted }}>{ch.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Dry run toggle */}
            <div onClick={() => setDryRun(d => !d)}
              style={{ padding: '9px 12px', borderRadius: 9, cursor: 'pointer', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10, border: `1px solid ${dryRun ? C.orange : C.border}`, background: dryRun ? '#fffbeb' : C.bg }}>
              <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${dryRun ? C.orange : C.border}`, background: dryRun ? C.orange : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10 }}>
                {dryRun ? '✓' : ''}
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: C.text }}>🧪 Dry Run</p>
                <p style={{ fontSize: 11, color: C.muted }}>Проверить без реальной отправки</p>
              </div>
            </div>

            <button onClick={triggerAgent} disabled={triggering}
              style={{ width: '100%', padding: '12px', borderRadius: 10, background: triggering ? C.muted : dryRun ? C.orange : C.ok, color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: triggering ? 'not-allowed' : 'pointer' }}>
              {triggering ? 'Запускаем...' : dryRun ? '🧪 Тест' : '🚀 Запустить'}
            </button>

            {/* Result */}
            {trigResult && (
              <div style={{ marginTop: 12, padding: 12, borderRadius: 9, background: trigResult.error ? '#fef2f2' : '#f0fdf4', border: `1px solid ${trigResult.error ? '#fecaca' : '#bbf7d0'}` }}>
                <pre style={{ fontSize: 11, color: C.text, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  {JSON.stringify(trigResult, null, 2)}
                </pre>
              </div>
            )}
          </div>

          {/* Logs */}
          <div style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Лог агента</span>
              <select value={filterSeller} onChange={e => { setFilterSeller(e.target.value); loadStats(e.target.value) }}
                style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12 }}>
                {sellers.map(s => <option key={s.seller_id} value={s.seller_id}>{s.brand_name}</option>)}
              </select>
            </div>

            {logs.length === 0 ? (
              <div style={{ padding: '60px 0', textAlign: 'center' }}>
                <p style={{ fontSize: 36, marginBottom: 12 }}>🤖</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 6 }}>Агент ещё не запускался</p>
                <p style={{ fontSize: 12, color: C.muted }}>Нажмите «Запустить» слева для первого теста</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: C.bg }}>
                      {['Покупатель', 'Канал', 'Триггер', 'Статус', 'Конверсия', 'Дата'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((l, i) => {
                      const st = STATUS_COLORS[l.status] || STATUS_COLORS.pending
                      return (
                        <tr key={l.id} style={{ borderTop: i > 0 ? `1px solid ${C.border}` : 'none' }}>
                          <td style={{ padding: '11px 14px', fontSize: 12, color: C.text }}>{l.customer_id?.slice(0, 8) || '—'}…</td>
                          <td style={{ padding: '11px 14px', fontSize: 12, color: C.text }}>{l.channel}</td>
                          <td style={{ padding: '11px 14px', fontSize: 12, color: C.text }}>{l.trigger_type}</td>
                          <td style={{ padding: '11px 14px' }}>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: st.bg, color: st.color }}>{l.status}</span>
                          </td>
                          <td style={{ padding: '11px 14px', textAlign: 'center', fontSize: 14 }}>
                            {l.converted ? '✅' : '—'}
                          </td>
                          <td style={{ padding: '11px 14px', fontSize: 11, color: C.muted, whiteSpace: 'nowrap' }}>
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

        {/* Retell AI setup guide */}
        <div style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.accent}30`, padding: 22 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: C.accent, marginBottom: 14 }}>⚙️ Настройка Retell AI — звонки на русском</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 8 }}>1. Регистрация и настройка</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  'Зарегистрируйтесь на retellai.com',
                  'Получите API Key в Dashboard → Settings',
                  'Создайте агента с языком ru-RU',
                  'Купите номер телефона ($2/мес)',
                  'Настройте вебхук: seller.getaimee.ru/api/agents/retell-webhook',
                ].map((step, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.accent, background: `${C.accent}15`, borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i+1}</span>
                    <p style={{ fontSize: 12, color: C.text }}>{step}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 8 }}>2. Переменные окружения (Vercel)</p>
              <div style={{ background: C.bg, borderRadius: 9, padding: 12 }}>
                {[
                  'RETELL_API_KEY=key_xxxxxxxxxx',
                  'RETELL_FROM_NUMBER=+7XXXXXXXXXX',
                  'RETELL_AGENT_ID=agent_xxxxxxxxxx',
                ].map((env, i) => (
                  <code key={i} style={{ display: 'block', fontSize: 11, color: C.text, fontFamily: 'monospace', marginBottom: 4 }}>{env}</code>
                ))}
              </div>
              <p style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>
                Добавить в Vercel → Settings → Environment Variables
              </p>
              <a href="https://retellai.com" target="_blank" style={{ display: 'inline-block', marginTop: 10, fontSize: 12, color: C.accent, textDecoration: 'none', fontWeight: 600 }}>
                📖 retellai.com/docs →
              </a>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
