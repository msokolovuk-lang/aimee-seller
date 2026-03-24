'use client'

const C = {
  bg: '#F8F9FA', surface: '#FFFFFF', card: '#F3F4F6', border: '#E5E7EB',
  text: '#111827', muted: '#6B7280', accent: '#0FBCCE',
}

export default function AdminSettingsPage() {
  return (
    <div style={{ minHeight: '100vh', background: C.bg, padding: 28 }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text }}>Настройки</h1>
          <p style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>SDK конфигурация, whitelist доменов, системные параметры</p>
        </div>

        {/* SDK Config */}
        <div style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, padding: 24, marginBottom: 16 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 16 }}>⚙️ SDK конфигурация</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { label: 'CDN URL', value: 'https://cdn.getaimee.ru/sdk.js', type: 'text' },
              { label: 'API Base URL', value: 'https://api.getaimee.ru', type: 'text' },
              { label: 'SDK версия', value: '2.0.0', type: 'text' },
            ].map((f, i) => (
              <div key={i}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  {f.label}
                </label>
                <input
                  type={f.type}
                  defaultValue={f.value}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 9,
                    border: `1px solid ${C.border}`, fontSize: 13, color: C.text,
                    background: C.card, boxSizing: 'border-box' as const,
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Whitelist */}
        <div style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, padding: 24, marginBottom: 16 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 8 }}>🌐 Whitelist доменов</p>
          <p style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>
            SDK работает только на указанных доменах. Настраивается отдельно для каждого бренда через страницу Бренды.
          </p>
          <div style={{ padding: '12px 14px', background: `${C.accent}10`, borderRadius: 10, border: `1px solid ${C.accent}30` }}>
            <p style={{ fontSize: 12, color: C.accent, fontWeight: 600 }}>
              ℹ️ В Sprint 1 whitelist настраивается через поле <code>config.allowed_domains</code> в таблице <code>brand_connectors</code>
            </p>
          </div>
        </div>

        {/* Sprint roadmap */}
        <div style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, padding: 24 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 16 }}>🗺️ Roadmap спринтов</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { sprint: 'Sprint 1', title: 'Admin Panel переформатирование', status: 'done' },
              { sprint: 'Sprint 2', title: 'SDK Core — embed скрипт', status: 'next' },
              { sprint: 'Sprint 3', title: 'Коннекторы Фаза 1 — МойСклад, СДЭК, Битрикс, ЮKassa', status: 'planned' },
              { sprint: 'Sprint 4', title: 'CRM покупателей', status: 'planned' },
              { sprint: 'Sprint 5', title: 'Коннекторы Фаза 2', status: 'planned' },
              { sprint: 'Sprint 6', title: 'AI Sales Agent — Bland AI / Retell AI', status: 'planned' },
            ].map((s, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                borderRadius: 9, background: s.status === 'done' ? '#f0fdf4' : s.status === 'next' ? `${C.accent}10` : C.bg,
                border: `1px solid ${s.status === 'done' ? '#bbf7d0' : s.status === 'next' ? `${C.accent}30` : C.border}`,
              }}>
                <span style={{ fontSize: 14 }}>{s.status === 'done' ? '✅' : s.status === 'next' ? '▶️' : '⏳'}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.muted, minWidth: 70 }}>{s.sprint}</span>
                <span style={{ fontSize: 13, color: C.text }}>{s.title}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
