'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const ADMIN_SECRET = process.env.NEXT_PUBLIC_ADMIN_SECRET || 'aimee-admin-2025'

interface Seller {
  seller_id: string
  name: string
  brand_name: string
  email: string
  plan: string
  is_active: boolean
  created_at: string
  last_login: string | null
  password_hash?: string
}

interface NewSeller {
  brand_name: string
  name: string
  email: string
  plan: string
}

export default function AdminPage() {
  const [secret, setSecret] = useState('')
  const [authed, setAuthed] = useState(false)
  const [sellers, setSellers] = useState<Seller[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newSeller, setNewSeller] = useState<NewSeller>({ brand_name: '', name: '', email: '', plan: 'pilot' })
  const [created, setCreated] = useState<{ seller_id: string; password: string; login_url: string; buyer_url: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [simSellerId, setSimSellerId] = useState('')
  const [simCount, setSimCount] = useState(3)
  const [simRunning, setSimRunning] = useState(false)
  const [simResult, setSimResult] = useState<any>(null)
  const [simConfigs, setSimConfigs] = useState<Record<string, boolean>>({})

  const supabaseClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const loadSimConfigs = async () => {
    const res = await supabaseClient.from('simulation_config').select('seller_id,is_active')
    if (res.data) {
      const map: Record<string, boolean> = {}
      res.data.forEach((c: any) => { map[c.seller_id] = c.is_active })
      setSimConfigs(map)
    }
  }

  const toggleSim = async (seller_id: string, brand_name: string, currentActive: boolean) => {
    const newActive = !currentActive
    await supabaseClient.from('simulation_config').upsert({
      seller_id, is_active: newActive, agents_per_wave: 3, interval_minutes: 30
    }, { onConflict: 'seller_id' })
    setSimConfigs(prev => ({ ...prev, [seller_id]: newActive }))
    alert(newActive ? `Симуляция для ${brand_name} включена` : `Симуляция для ${brand_name} выключена`)
  }

  const load = async (s = secret) => {
    setLoading(true)
    const res = await fetch('/api/admin/sellers', { headers: { 'x-admin-secret': s } })
    if (res.ok) {
      const data = await res.json()
      setSellers(data.sellers)
      setAuthed(true)
      loadSimConfigs()
    } else {
      alert('Неверный секрет')
    }
    setLoading(false)
  }

  const createSeller = async () => {
    if (!newSeller.brand_name || !newSeller.name) return
    setCreating(true)
    const res = await fetch('/api/admin/sellers', {
      method: 'POST',
      headers: { 'x-admin-secret': secret, 'Content-Type': 'application/json' },
      body: JSON.stringify(newSeller),
    })
    const data = await res.json()
    if (res.ok) {
      setCreated(data)
      setNewSeller({ brand_name: '', name: '', email: '', plan: 'pilot' })
      load()
    } else {
      alert(data.error)
    }
    setCreating(false)
  }

  const deleteSeller = async (seller_id: string, brand_name: string) => {
    if (!confirm(`Удалить аккаунт "${brand_name}"? Это действие нельзя отменить.`)) return
    const res = await fetch('/api/admin/sellers', {
      method: 'DELETE',
      headers: { 'x-admin-secret': secret, 'Content-Type': 'application/json' },
      body: JSON.stringify({ seller_id }),
    })
    if (res.ok) load()
    else alert('Ошибка удаления')
  }

  const runSimulation = async () => {
    if (!simSellerId) return alert('Выберите селлера')
    setSimRunning(true)
    setSimResult(null)
    const res = await fetch('/api/admin/simulate', {
      method: 'POST',
      headers: { 'x-admin-secret': secret, 'Content-Type': 'application/json' },
      body: JSON.stringify({ seller_id: simSellerId, agent_count: simCount }),
    })
    const data = await res.json()
    setSimResult(data)
    setSimRunning(false)
  }

  const toggleActive = async (seller_id: string, is_active: boolean) => {
    await fetch('/api/admin/sellers', {
      method: 'PATCH',
      headers: { 'x-admin-secret': secret, 'Content-Type': 'application/json' },
      body: JSON.stringify({ seller_id, is_active: !is_active }),
    })
    load()
  }

  const copyCredentials = () => {
    if (!created) return
    const text = `🎉 Добро пожаловать в AIMEE!\n\nВаши данные для входа:\n\n🔑 Логин: ${created.seller_id}\n🔒 Пароль: ${created.password}\n\n📱 Кабинет продавца: ${created.login_url}\n🛍 Ваш магазин для покупателей: ${created.buyer_url}\n\nПо вопросам: hello@aimee.app`
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const C = {
    bg: '#F8F9FA', surface: '#FFFFFF', card: '#F3F4F6',
    border: '#E5E7EB', text: '#111827', muted: '#6B7280',
    accent: '#0FBCCE', ok: '#16A34A', orange: '#F59E0B', pink: '#EC4899',
  }

  if (!authed) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 360, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: 32 }}>
          <p style={{ fontSize: 24, fontWeight: 900, color: C.text, marginBottom: 8 }}>AIMEE Admin</p>
          <p style={{ fontSize: 13, color: C.muted, marginBottom: 24 }}>Управление аккаунтами селлеров</p>
          <input type="password" placeholder="Admin secret" value={secret} onChange={e => setSecret(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load()}
            style={{ width: '100%', background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 14px', fontSize: 15, color: C.text, outline: 'none', marginBottom: 12, boxSizing: 'border-box' as const }} />
          <button onClick={() => load()} style={{ width: '100%', padding: 14, borderRadius: 12, background: C.accent, color: C.bg, border: 'none', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>
            {loading ? 'Входим...' : 'Войти'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, padding: '24px 20px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <div>
            <p style={{ fontSize: 28, fontWeight: 900, color: C.text }}>AIMEE Admin</p>
            <p style={{ fontSize: 13, color: C.muted }}>{sellers.length} селлеров в системе</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <a href="/" style={{ padding: '8px 16px', borderRadius: 10, background: C.card, border: `1px solid ${C.border}`, color: C.muted, fontSize: 13, textDecoration: 'none', fontWeight: 600 }}>← Дашборд</a>
          </div>
        </div>

        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 16, padding: 20, marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 16 }}>🤖 AI Симуляция покупателей</h2>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' as const }}>
            <div>
              <label style={{ fontSize: 12, color: '#374151', display: 'block', marginBottom: 4 }}>Селлер</label>
              <select value={simSellerId} onChange={e => setSimSellerId(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d1fae5', fontSize: 13, minWidth: 200 }}>
                <option value="">— выберите селлера —</option>
                {sellers.map(s => <option key={s.seller_id} value={s.seller_id}>{s.brand_name} ({s.seller_id})</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#374151', display: 'block', marginBottom: 4 }}>Покупателей</label>
              <input type="number" min={1} max={20} value={simCount} onChange={e => setSimCount(Number(e.target.value))}
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d1fae5', fontSize: 13, width: 80 }} />
            </div>
            <button onClick={runSimulation} disabled={simRunning || !simSellerId}
              style={{ padding: '10px 24px', background: simRunning ? '#9ca3af' : '#16a34a', color: '#fff', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 700, cursor: simRunning ? 'not-allowed' : 'pointer' }}>
              {simRunning ? 'Запускаем...' : 'Запустить симуляцию'}
            </button>
          </div>
          {simResult && (
            <div style={{ marginTop: 16, padding: 12, background: '#fff', borderRadius: 10, border: '1px solid #d1fae5' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#15803d', marginBottom: 8 }}>
                ✅ Готово: {simResult.agents_run} агентов · {simResult.orders_created} заказов создано
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {(simResult.summary || []).map((r: {ordered: boolean; name: string; product?: string; price?: number; size?: string}, i: number) => (
                  <div key={i} style={{ fontSize: 12, color: '#374151' }}>
                    {r.ordered ? `✓ ${r.name}` : `✗ ${r.name} — не купил`}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Create new seller */}
        <div style={{ background: C.surface, border: `1px solid ${C.accent}30`, borderRadius: 16, padding: 24, marginBottom: 24 }}>
          <p style={{ fontSize: 16, fontWeight: 800, color: C.accent, marginBottom: 16 }}>✦ Создать аккаунт селлера</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            {[
              { label: 'НАЗВАНИЕ БРЕНДА *', key: 'brand_name' as keyof NewSeller, ph: 'N&R Collection' },
              { label: 'ИМЯ КОНТАКТА *', key: 'name' as keyof NewSeller, ph: 'Иван Петров' },
              { label: 'EMAIL', key: 'email' as keyof NewSeller, ph: 'brand@email.com' },
              { label: 'ПЛАН', key: 'plan' as keyof NewSeller, ph: 'pilot' },
            ].map(f => (
              <div key={f.key}>
                <p style={{ fontSize: 10, fontWeight: 600, color: C.muted, marginBottom: 5, letterSpacing: 1 }}>{f.label}</p>
                <input value={newSeller[f.key]} onChange={e => setNewSeller(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.ph}
                  style={{ width: '100%', background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 14, color: C.text, outline: 'none', boxSizing: 'border-box' as const }} />
              </div>
            ))}
          </div>
          <button onClick={createSeller} disabled={creating || !newSeller.brand_name || !newSeller.name}
            style={{ padding: '12px 28px', borderRadius: 12, background: newSeller.brand_name && newSeller.name ? C.accent : C.card, color: newSeller.brand_name && newSeller.name ? C.bg : C.muted, border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            {creating ? 'Создаём...' : '+ Создать аккаунт'}
          </button>
        </div>

        {/* Credentials card */}
        {created && (
          <div style={{ background: 'rgba(63,185,80,0.08)', border: `1px solid ${C.ok}40`, borderRadius: 16, padding: 24, marginBottom: 24 }}>
            <p style={{ fontSize: 16, fontWeight: 800, color: C.ok, marginBottom: 16 }}>✓ Аккаунт создан — отправьте данные селлеру</p>
            <div style={{ background: C.card, borderRadius: 12, padding: 16, fontFamily: 'monospace', fontSize: 13, color: C.text, lineHeight: 1.8, marginBottom: 14 }}>
              <p>🔑 Логин: <span style={{ color: C.accent }}>{created.seller_id}</span></p>
              <p>🔒 Пароль: <span style={{ color: C.orange }}>{created.password}</span></p>
              <p>📱 Кабинет: <span style={{ color: C.muted }}>{created.login_url}</span></p>
              <p>🛍 Магазин: <span style={{ color: C.muted }}>{created.buyer_url}</span></p>
            </div>
            <button onClick={copyCredentials} style={{ padding: '10px 20px', borderRadius: 10, background: copied ? C.ok : C.accent, color: C.bg, border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
              {copied ? '✓ Скопировано!' : '📋 Копировать для отправки'}
            </button>
          </div>
        )}

        {/* Sellers list */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Все селлеры</p>
            <button onClick={() => load()} style={{ padding: '6px 12px', borderRadius: 8, background: C.card, border: `1px solid ${C.border}`, color: C.muted, fontSize: 12, cursor: 'pointer' }}>Обновить</button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {['Бренд', 'Логин', 'Email', 'План', 'Последний вход', 'Статус', ''].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left' as const, fontSize: 10, fontWeight: 600, color: C.muted, letterSpacing: 1 }}>{h.toUpperCase()}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sellers.map(s => (
                <tr key={s.seller_id} style={{ borderBottom: `1px solid ${C.border}20` }}>
                  <td style={{ padding: '12px 16px' }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{s.brand_name}</p>
                    <p style={{ fontSize: 11, color: C.muted }}>{s.name}</p>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <code style={{ fontSize: 12, color: C.accent, background: C.card, padding: '2px 8px', borderRadius: 6 }}>{s.seller_id}</code>
                    <code style={{ fontSize: 12, color: C.orange || '#f59e0b', background: C.card, padding: '2px 8px', borderRadius: 6, marginTop: 4, display: 'block' }}>{s.password_hash?.replace('PLAIN:', '') || '—'}</code>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: C.muted }}>{s.email || '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.orange, background: 'rgba(255,166,87,0.12)', padding: '2px 8px', borderRadius: 99 }}>{s.plan}</span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: C.muted }}>
                    {s.last_login ? new Date(s.last_login).toLocaleDateString('ru') : 'Ещё не входил'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: s.is_active ? C.ok : C.muted, background: s.is_active ? 'rgba(63,185,80,0.12)' : C.card, padding: '2px 8px', borderRadius: 99 }}>
                      {s.is_active ? 'Активен' : 'Отключён'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', display:'flex', gap:6 }}>
                    <button onClick={() => toggleActive(s.seller_id, s.is_active)}
                      style={{ padding: '5px 10px', borderRadius: 8, background: C.card, border: `1px solid ${C.border}`, color: C.muted, fontSize: 11, cursor: 'pointer' }}>
                      {s.is_active ? 'Отключить' : 'Активировать'}
                    </button>
                    <button onClick={() => deleteSeller(s.seller_id, s.brand_name)}
                      style={{ padding: '5px 10px', borderRadius: 8, background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.3)', color: '#FF6B6B', fontSize: 11, cursor: 'pointer' }}>
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Управление симуляцией для каждого селлера */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: 20, marginTop: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 16 }}>⚡ Управление симуляцией</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sellers.map(s => {
            const active = simConfigs[s.seller_id] || false
            return (
              <div key={s.seller_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: active ? '#f0fdf4' : '#f9fafb', borderRadius: 12, border: `1px solid ${active ? '#bbf7d0' : '#e5e7eb'}` }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{s.brand_name}</p>
                  <p style={{ fontSize: 12, color: active ? '#16a34a' : '#9ca3af' }}>
                    {active ? '🟢 Симуляция активна · 3 агента каждые 30 минут' : '⚪ Симуляция выключена'}
                  </p>
                </div>
                <button onClick={() => toggleSim(s.seller_id, s.brand_name, active)} style={{
                  padding: '8px 20px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  background: active ? '#ef4444' : '#16a34a', color: '#fff'
                }}>
                  {active ? 'Выключить' : 'Включить'}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
