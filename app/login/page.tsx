'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function LoginForm() {
  const [sellerId, setSellerId] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const params = useSearchParams()
  const deactivated = params.get('deactivated') === '1'

  const handleLogin = async () => {
    if (!sellerId || !password) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seller_id: sellerId, password }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Ошибка входа')
        return
      }

      // Clear ALL previous session data before setting new
      const keysToKeep = []
      const keysToRemove = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k) keysToRemove.push(k)
      }
      keysToRemove.forEach(k => localStorage.removeItem(k))
      // Clear seller cookie
      document.cookie = 'seller_token=; path=/; max-age=0'

      localStorage.setItem('seller_token', data.token)
      localStorage.setItem('seller_id', data.seller.seller_id)
      localStorage.setItem('seller_data', JSON.stringify(data.seller))
      localStorage.setItem('seller_brand', data.seller.brand_name)
      localStorage.setItem('brand_name', data.seller.brand_name)
      // Clear any leftover profile data from previous sessions
      localStorage.removeItem('seller_profile')
      document.cookie = `seller_token=${data.token}; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=Lax`

      router.push('/')
    } catch {
      setError('Ошибка подключения')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight:'100vh', background:'#0D1117', display:'flex', alignItems:'center', justifyContent:'center', padding:'0 24px' }}>
      <div style={{ width:'100%', maxWidth:380 }}>

        <div style={{ textAlign:'center', marginBottom:40 }}>
          <div style={{ width:72, height:72, borderRadius:20, background:'linear-gradient(135deg,#00E5C7,#00B4A0)', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:32, fontWeight:900, color:'#0D1117', marginBottom:12, boxShadow:'0 0 48px rgba(0,229,199,0.25)' }}>A</div>
          <p style={{ fontSize:24, fontWeight:900, letterSpacing:5, color:'#E6EDF3' }}>AIMEE</p>
          <p style={{ fontSize:13, color:'#8B949E', marginTop:4 }}>Seller Portal</p>
        </div>

        <div style={{ background:'#161B22', border:'1px solid #2A3444', borderRadius:20, padding:'28px 24px' }}>
          <p style={{ fontSize:18, fontWeight:800, color:'#E6EDF3', marginBottom:24 }}>Вход в кабинет</p>

          <div style={{ marginBottom:14 }}>
            <p style={{ fontSize:11, fontWeight:600, color:'#8B949E', marginBottom:6, letterSpacing:1 }}>ЛОГИН</p>
            <input type="text" value={sellerId} onChange={e => setSellerId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="your-brand-id"
              style={{ width:'100%', background:'#1C2333', border:'1px solid #2A3444', borderRadius:12, padding:'12px 14px', fontSize:15, color:'#E6EDF3', outline:'none', boxSizing:'border-box' as const, fontFamily:'monospace' }}
            />
          </div>

          <div style={{ marginBottom:20 }}>
            <p style={{ fontSize:11, fontWeight:600, color:'#8B949E', marginBottom:6, letterSpacing:1 }}>ПАРОЛЬ</p>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="••••••••"
              style={{ width:'100%', background:'#1C2333', border:'1px solid #2A3444', borderRadius:12, padding:'12px 14px', fontSize:15, color:'#E6EDF3', outline:'none', boxSizing:'border-box' as const }}
            />
          </div>

          {deactivated && (
            <div style={{ background:'rgba(255,107,107,0.1)', border:'1px solid rgba(255,107,107,0.3)', borderRadius:10, padding:'10px 14px', marginBottom:16 }}>
              <p style={{ fontSize:13, color:'#FF6B6B' }}>⚠️ Ваш аккаунт деактивирован. Обратитесь к администратору.</p>
            </div>
          )}

          {error && (
            <div style={{ background:'rgba(255,107,107,0.1)', border:'1px solid rgba(255,107,107,0.3)', borderRadius:10, padding:'10px 14px', marginBottom:16 }}>
              <p style={{ fontSize:13, color:'#FF6B6B' }}>⚠️ {error}</p>
            </div>
          )}

          <button onClick={handleLogin} disabled={loading || !sellerId || !password}
            style={{ width:'100%', padding:14, borderRadius:14, fontSize:15, fontWeight:800, background: sellerId && password ? '#00E5C7' : '#1C2333', color: sellerId && password ? '#0D1117' : '#484F58', border:'none', cursor: sellerId && password ? 'pointer' : 'default', boxShadow: sellerId && password ? '0 4px 24px rgba(0,229,199,0.25)' : 'none' }}>
            {loading ? 'Входим...' : 'Войти →'}
          </button>
        </div>

        <p style={{ textAlign:'center', fontSize:12, color:'#484F58', marginTop:20 }}>
          Нет аккаунта? Напишите нам — <span style={{ color:'#00E5C7' }}>hello@aimee.app</span>
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return <Suspense fallback={null}><LoginForm /></Suspense>
}
