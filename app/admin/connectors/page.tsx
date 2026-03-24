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

const CATALOG = [
  {
    type: 'moysklad', phase: 1, name: 'МойСклад', icon: '🏭', category: 'Склад',
    description: 'Синхронизация товаров и остатков каждые 15 минут. Заказы AIMEE → МойСклад.',
    fields: [
      { key: 'bearer_token', label: 'Bearer Token', ph: 'eyJ0...' },
    ],
    docs: 'https://dev.moysklad.ru/doc/api/remap/1.2/',
  },
  {
    type: 'cdek', phase: 1, name: 'СДЭК', icon: '📦', category: 'Доставка',
    description: 'Расчёт тарифов, создание накладных, трекинг заказов, список ПВЗ.',
    fields: [
      { key: 'client_id',     label: 'Client ID',     ph: 'EMscd6r9JnFiQ3bLoyjJY6eM...' },
      { key: 'client_secret', label: 'Client Secret', ph: 'PjLZkKBHEiLK3Uf0GjNwNefU...' },
    ],
    docs: 'https://api-docs.cdek.ru/',
    sandbox: 'edu.cdek.ru — тестовый аккаунт',
  },
  {
    type: 'bitrix', phase: 1, name: 'Битрикс24', icon: '🗂️', category: 'CRM',
    description: 'Контакты, сделки, задачи по инцидентам. Двусторонняя синхронизация.',
    fields: [
      { key: 'webhook_url', label: 'Webhook URL', ph: 'https://company.bitrix24.ru/rest/1/xxx/' },
    ],
    docs: 'https://training.bitrix24.ru/rest_help/',
  },
  {
    type: 'yukassa', phase: 1, name: 'ЮKassa', icon: '💳', category: 'Оплата',
    description: 'Приём оплат, возвраты, чеки 54-ФЗ. Вебхук при успешной оплате.',
    fields: [
      { key: 'shop_id',    label: 'Shop ID',    ph: '123456' },
      { key: 'secret_key', label: 'Secret Key', ph: 'test_xxx...' },
    ],
    docs: 'https://yookassa.ru/developers/',
    sandbox: 'Тестовый магазин: shop_id=test, secret_key=test_...',
  },
  {
    type: 'telegram', phase: 1, name: 'Telegram-бот', icon: '💬', category: 'Мессенджер',
    description: 'Уведомления бренду о заказах и инцидентах. Статус заказа покупателю.',
    fields: [
      { key: 'bot_token', label: 'Bot Token', ph: '7123456789:AAH...' },
      { key: 'chat_id',   label: 'Chat ID (ваш)',  ph: '-100123456789' },
    ],
    docs: 'https://core.telegram.org/bots/api',
    hint: 'Создать бота: @BotFather → /newbot. Получить chat_id: @userinfobot',
  },
]

const PHASE_LABELS: Record<number, string> = { 1: '🔴 Фаза 1', 2: '🟡 Фаза 2', 3: '🟢 Фаза 3' }

export default function AdminConnectorsSetupPage() {
  const [sellers, setSellers] = useState<any[]>([])
  const [connectors, setConnectors] = useState<any[]>([])
  const [selectedSeller, setSelectedSeller] = useState('')
  const [connecting, setConnecting] = useState<string | null>(null)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [results, setResults] = useState<Record<string, { ok: boolean; msg: string }>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const [sellRes, connRes] = await Promise.all([
      supabase.from('sellers').select('seller_id, brand_name'),
      supabase.from('brand_connectors').select('*'),
    ])
    setSellers(sellRes.data || [])
    setConnectors(connRes.data || [])
    if (sellRes.data?.length && !selectedSeller) {
      setSelectedSeller(sellRes.data[0].seller_id)
    }
    setLoading(false)
  }

  const getConnector = (type: string) =>
    connectors.find(c => c.seller_id === selectedSeller && c.type === type)

  const connect = async (type: string) => {
    if (!selectedSeller) return alert('Выберите бренд')
    setConnecting(type)
    setResults(prev => ({ ...prev, [type]: { ok: false, msg: 'Подключаем...' } }))

    try {
      const res = await fetch(`/api/connectors/${type}/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seller_id: selectedSeller, credentials: formData }),
      })
      const data = await res.json()

      if (data.success) {
        setResults(prev => ({ ...prev, [type]: { ok: true, msg: '✅ Подключено успешно' } }))
        setFormData({})
        await load()
      } else {
        setResults(prev => ({ ...prev, [type]: { ok: false, msg: `❌ ${data.error}` } }))
      }
    } catch (e: any) {
      setResults(prev => ({ ...prev, [type]: { ok: false, msg: `❌ ${e.message}` } }))
    }

    setConnecting(null)
  }

  const triggerSync = async (type: string) => {
    if (!selectedSeller) return
    setSyncing(type)
    setResults(prev => ({ ...prev, [type]: { ok: false, msg: 'Синхронизируем...' } }))

    try {
      const res = await fetch(`/api/connectors/${type}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seller_id: selectedSeller }),
      })
      const data = await res.json()

      if (data.success) {
        setResults(prev => ({ ...prev, [type]: { ok: true, msg: `✅ ${data.records_synced} записей · ${data.duration_ms}ms` } }))
      } else {
        setResults(prev => ({ ...prev, [type]: { ok: false, msg: `❌ ${data.error}` } }))
      }
    } catch (e: any) {
      setResults(prev => ({ ...prev, [type]: { ok: false, msg: `❌ ${e.message}` } }))
    }

    setSyncing(null)
    await load()
  }

  const disconnect = async (type: string) => {
    if (!confirm(`Отключить ${type}?`)) return
    await supabase.from('brand_connectors')
      .update({ status: 'inactive', credentials: {} })
      .eq('seller_id', selectedSeller)
      .eq('type', type)
    await load()
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, border: `3px solid ${C.accent}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: C.bg, padding: 28 }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text }}>SDK & Коннекторы</h1>
          <p style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>Подключение интеграций по брендам</p>
        </div>

        {/* Brand selector */}
        <div style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Бренд:</span>
          <select
            value={selectedSeller}
            onChange={e => { setSelectedSeller(e.target.value); setFormData({}); setResults({}) }}
            style={{ padding: '8px 14px', borderRadius: 9, border: `1px solid ${C.border}`, fontSize: 14, fontWeight: 600, color: C.text, background: C.bg }}
          >
            {sellers.map(s => (
              <option key={s.seller_id} value={s.seller_id}>{s.brand_name} ({s.seller_id})</option>
            ))}
          </select>
          <span style={{ fontSize: 12, color: C.muted }}>
            {connectors.filter(c => c.seller_id === selectedSeller && c.status === 'active').length} активных коннекторов
          </span>
          <button onClick={load} style={{ marginLeft: 'auto', padding: '7px 14px', borderRadius: 8, background: C.accent, color: '#fff', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            ↻ Обновить
          </button>
        </div>

        {/* Connectors */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {CATALOG.map(item => {
            const conn = getConnector(item.type)
            const isActive = conn?.status === 'active'
            const isError = conn?.status === 'error'
            const isConnecting = connecting === item.type
            const isSyncing = syncing === item.type
            const result = results[item.type]

            return (
              <div key={item.type} style={{
                background: C.surface, borderRadius: 16,
                border: `1px solid ${isActive ? '#bbf7d0' : isError ? '#fecaca' : C.border}`,
                padding: 20,
                borderLeft: `4px solid ${isActive ? '#16A34A' : isError ? '#EF4444' : '#E5E7EB'}`,
              }}>
                {/* Top row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: 14, flex: 1 }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 12,
                      background: isActive ? '#f0fdf4' : C.bg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 24, flexShrink: 0,
                    }}>{item.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{item.name}</span>
                        <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: C.card, color: C.muted, fontWeight: 600 }}>
                          {item.category}
                        </span>
                        <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: C.card, color: C.muted, fontWeight: 600 }}>
                          {PHASE_LABELS[item.phase]}
                        </span>
                        {isActive && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: '#f0fdf4', color: C.ok, fontWeight: 700 }}>✓ Активен</span>}
                        {isError && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: '#fef2f2', color: C.red, fontWeight: 700 }}>✕ Ошибка</span>}
                      </div>
                      <p style={{ fontSize: 13, color: C.muted, marginBottom: 6, lineHeight: 1.5 }}>{item.description}</p>
                      {conn?.last_sync && (
                        <p style={{ fontSize: 11, color: C.muted }}>
                          Sync: {new Date(conn.last_sync).toLocaleString('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          {conn.synced_records_count > 0 && ` · ${conn.synced_records_count} записей`}
                        </p>
                      )}
                      {conn?.last_error && (
                        <p style={{ fontSize: 11, color: C.red, marginTop: 4 }}>⚠ {conn.last_error}</p>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0, marginLeft: 16 }}>
                    {isActive && (
                      <>
                        <button
                          onClick={() => triggerSync(item.type)}
                          disabled={!!isSyncing}
                          style={{ padding: '7px 14px', borderRadius: 9, background: `${C.accent}15`, border: `1px solid ${C.accent}40`, color: C.accent, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                        >
                          {isSyncing ? '...' : '↻ Sync'}
                        </button>
                        <button
                          onClick={() => disconnect(item.type)}
                          style={{ padding: '7px 14px', borderRadius: 9, background: '#fef2f2', border: '1px solid #fecaca', color: C.red, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                        >
                          Откл
                        </button>
                      </>
                    )}
                    {!isActive && (
                      <button
                        onClick={() => setConnecting(isConnecting ? null : item.type)}
                        style={{ padding: '8px 20px', borderRadius: 10, background: C.accent, border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                      >
                        Подключить
                      </button>
                    )}
                  </div>
                </div>

                {/* Result message */}
                {result && (
                  <div style={{
                    marginTop: 12, padding: '8px 12px', borderRadius: 8,
                    background: result.ok ? '#f0fdf4' : '#fef2f2',
                    border: `1px solid ${result.ok ? '#bbf7d0' : '#fecaca'}`,
                  }}>
                    <p style={{ fontSize: 12, color: result.ok ? C.ok : C.red, fontWeight: 600 }}>{result.msg}</p>
                  </div>
                )}

                {/* Connection form */}
                {isConnecting && !isActive && (
                  <div style={{ marginTop: 16, padding: 16, background: C.bg, borderRadius: 12, border: `1px solid ${C.accent}30` }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>Данные для подключения</p>
                    {item.hint && <p style={{ fontSize: 11, color: C.accent, marginBottom: 12 }}>💡 {item.hint}</p>}
                    {item.sandbox && <p style={{ fontSize: 11, color: C.muted, marginBottom: 12 }}>🧪 Sandbox: {item.sandbox}</p>}

                    {item.fields.map(field => (
                      <div key={field.key} style={{ marginBottom: 10 }}>
                        <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 4, fontWeight: 600 }}>
                          {field.label}
                        </label>
                        <input
                          type={field.key.includes('secret') || field.key.includes('token') ? 'password' : 'text'}
                          placeholder={field.ph}
                          value={formData[field.key] || ''}
                          onChange={e => setFormData(p => ({ ...p, [field.key]: e.target.value }))}
                          style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, boxSizing: 'border-box' as const }}
                        />
                      </div>
                    ))}

                    <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
                      <button
                        onClick={() => connect(item.type)}
                        disabled={!!connecting}
                        style={{ padding: '10px 24px', background: C.ok, color: '#fff', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                      >
                        {connecting === item.type ? 'Проверяем...' : 'Подключить'}
                      </button>
                      <button
                        onClick={() => { setConnecting(null); setFormData({}) }}
                        style={{ padding: '10px 14px', background: C.card, color: C.muted, borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 13, cursor: 'pointer' }}
                      >
                        Отмена
                      </button>
                      <a href={item.docs} target="_blank" style={{ fontSize: 12, color: C.accent, marginLeft: 'auto' }}>
                        📖 Документация →
                      </a>
                    </div>
                    <p style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>🔒 Credentials сохраняются зашифрованными в Supabase</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>

      </div>
    </div>
  )
}
