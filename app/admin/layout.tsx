'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'

const C = {
  bg: '#F8F9FA', surface: '#FFFFFF', border: '#E5E7EB',
  text: '#111827', muted: '#6B7280', accent: '#0FBCCE',
  sidebarW: 220,
}

const NAV = [
  { href: '/admin',            icon: '🏠', label: 'Дашборд' },
  { href: '/admin/brands',     icon: '🏷️', label: 'Бренды' },
  { href: '/admin/connectors', icon: '🔌', label: 'SDK & Коннекторы' },
  { href: '/admin/customers',  icon: '👥', label: 'Покупатели' },
  { href: '/admin/incidents',  icon: '⚠️', label: 'Инциденты' },
  { href: '/admin/agents',     icon: '🤖', label: 'AI Агенты' },
  { href: '/admin/finance',    icon: '💰', label: 'Финансы' },
  { href: '/admin/integrations', icon: '🔗', label: 'Интеграции' },
  { href: '/admin/settings',   icon: '⚙️', label: 'Настройки' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg }}>

      {/* Sidebar */}
      <aside style={{
        width: C.sidebarW, flexShrink: 0, background: C.surface,
        borderRight: `1px solid ${C.border}`, display: 'flex',
        flexDirection: 'column', position: 'fixed', top: 0, left: 0,
        height: '100vh', zIndex: 50,
      }}>
        {/* Logo */}
        <div style={{ padding: '20px 16px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 9, background: C.accent,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 900, color: '#fff', flexShrink: 0,
            }}>A</div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 800, color: C.text, lineHeight: 1 }}>AIMEE</p>
              <p style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>Admin Panel</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
          {NAV.map(item => {
            // exact match for /admin, prefix match for rest
            const isActive = item.href === '/admin'
              ? pathname === '/admin'
              : pathname.startsWith(item.href)

            return (
              <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 10px', borderRadius: 9, marginBottom: 2,
                  background: isActive ? `${C.accent}15` : 'transparent',
                  cursor: 'pointer', transition: 'background 0.15s',
                }}>
                  <span style={{ fontSize: 15, lineHeight: 1 }}>{item.icon}</span>
                  <span style={{
                    fontSize: 13, fontWeight: isActive ? 700 : 500,
                    color: isActive ? C.accent : C.text,
                  }}>{item.label}</span>
                  {isActive && (
                    <div style={{
                      marginLeft: 'auto', width: 5, height: 5,
                      borderRadius: '50%', background: C.accent,
                    }} />
                  )}
                </div>
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.border}` }}>
          <p style={{ fontSize: 10, color: C.muted }}>AIMEE SDK · v2.0</p>
          <p style={{ fontSize: 10, color: C.muted }}>Sprint 1 · 2026</p>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ marginLeft: C.sidebarW, flex: 1, minWidth: 0 }}>
        {children}
      </main>
    </div>
  )
}
