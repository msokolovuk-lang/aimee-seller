'use client'

import { useState, useEffect } from 'react'
import { Check, Eye, EyeOff, Zap, Package, AlertCircle } from 'lucide-react'

export default function ProfilePage() {
  const [brandName, setBrandName] = useState('')
  const [brandEmail, setBrandEmail] = useState('')
  const [brandCategory, setBrandCategory] = useState('Женская одежда')
  const [savedBrand, setSavedBrand] = useState(false)

  const [msToken, setMsToken] = useState('')
  const [msConnected, setMsConnected] = useState(false)
  const [msConnecting, setMsConnecting] = useState(false)
  const [msError, setMsError] = useState('')
  const [showToken, setShowToken] = useState(false)

  const [a2aEnabled, setA2aEnabled] = useState(true)
  const [discountMin, setDiscountMin] = useState(5)
  const [discountMax, setDiscountMax] = useState(15)
  const [savedA2a, setSavedA2a] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('ms_token')
    const name = localStorage.getItem('brand_name')
    if (token) { setMsToken(token); setMsConnected(true) }
    if (name) setBrandName(name)
  }, [])

  const saveBrand = () => {
    localStorage.setItem('brand_name', brandName)
    setSavedBrand(true)
    setTimeout(() => setSavedBrand(false), 2000)
  }

  const connectMoysklad = async () => {
    if (!msToken.trim()) return
    setMsConnecting(true); setMsError('')
    try {
      const res = await fetch('/api/moysklad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: msToken, endpoint: '/entity/organization', params: {} })
      })
      const data = await res.json()
      if (data.rows?.length > 0) {
        localStorage.setItem('ms_token', msToken)
        setMsConnected(true)
      } else {
        setMsError('Неверный токен или нет доступа')
      }
    } catch {
      setMsError('Ошибка подключения')
    }
    setMsConnecting(false)
  }

  const disconnectMoysklad = () => {
    localStorage.removeItem('ms_token')
    setMsToken(''); setMsConnected(false)
  }

  const saveA2a = () => {
    setSavedA2a(true)
    setTimeout(() => setSavedA2a(false), 2000)
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Профиль</h1>
        <p className="text-sm text-gray-500 mt-1">Настройки бренда и подключений</p>
      </div>

      <div className="space-y-4">

        {/* ── БРЕНД ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="text-sm font-semibold text-gray-900 mb-4">🏷 Бренд</div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Название</label>
              <input value={brandName} onChange={e => setBrandName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#0FBCCE]" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Email</label>
                <input value={brandEmail} onChange={e => setBrandEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#0FBCCE]" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Категория</label>
                <select value={brandCategory} onChange={e => setBrandCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#0FBCCE] bg-white">
                  <option>Женская одежда</option>
                  <option>Мужская одежда</option>
                  <option>Унисекс</option>
                  <option>Детская одежда</option>
                  <option>Аксессуары</option>
                </select>
              </div>
            </div>
            <button onClick={saveBrand}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${savedBrand ? 'bg-green-500 text-white' : 'bg-[#0FBCCE] text-white hover:bg-[#0da8b8]'}`}>
              {savedBrand ? <><Check className="w-4 h-4" />Сохранено</> : 'Сохранить'}
            </button>
          </div>
        </div>

        {/* ── ПОДКЛЮЧЕНИЯ ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="text-sm font-semibold text-gray-900 mb-4">🔌 Подключения</div>

          {/* МойСклад */}
          <div className={`p-4 rounded-xl border mb-3 ${msConnected ? 'border-green-100 bg-green-50' : 'border-gray-100 bg-gray-50'}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-900">МойСклад</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${msConnected ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span className={`text-xs font-medium ${msConnected ? 'text-green-600' : 'text-gray-400'}`}>
                  {msConnected ? 'Подключён' : 'Не подключён'}
                </span>
              </div>
            </div>
            {!msConnected ? (
              <div className="space-y-2">
                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={msToken} onChange={e => setMsToken(e.target.value)}
                    placeholder="Токен доступа МойСклад"
                    className="w-full px-3 py-2 pr-10 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#0FBCCE] bg-white font-mono" />
                  <button onClick={() => setShowToken(!showToken)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="text-xs text-gray-400">МойСклад → Настройки → Безопасность → Токены</div>
                {msError && <div className="flex items-center gap-1 text-xs text-red-500"><AlertCircle className="w-3 h-3" />{msError}</div>}
                <button onClick={connectMoysklad} disabled={!msToken.trim() || msConnecting}
                  className="px-4 py-2 bg-[#0FBCCE] text-white rounded-xl text-sm font-medium hover:bg-[#0da8b8] disabled:opacity-40 flex items-center gap-2">
                  {msConnecting ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />Проверяю...</> : 'Подключить'}
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="text-xs text-green-600"></div>
                <button onClick={disconnectMoysklad} className="text-xs text-gray-400 hover:text-red-500">Отключить</button>
              </div>
            )}
          </div>

          {/* Маркетплейсы */}
          {[
            { name: 'Wildberries', status: 'soon' },
            { name: 'Ozon', status: 'soon' },
          ].map(mp => (
            <div key={mp.name} className="p-4 rounded-xl border border-gray-100 flex items-center justify-between mb-2 last:mb-0 opacity-60">
              <span className="text-sm text-gray-600">{mp.name}</span>
              <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-400 rounded-full">Скоро</span>
            </div>
          ))}
        </div>

        {/* ── A2A АГЕНТ ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#0FBCCE]" />
              <span className="text-sm font-semibold text-gray-900">A2A Агент</span>
            </div>
            <button onClick={() => setA2aEnabled(!a2aEnabled)}
              className={`relative w-11 h-6 rounded-full transition-colors ${a2aEnabled ? 'bg-[#0FBCCE]' : 'bg-gray-200'}`}>
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${a2aEnabled ? 'left-6' : 'left-1'}`} />
            </button>
          </div>

          {a2aEnabled ? (
            <div className="space-y-4">
              <div className="p-3 bg-[#EBF9FB] rounded-xl text-xs text-[#0a7d8a]">
                ⚡ Агент активен — автоматически торгуется с покупателями в заданном диапазоне
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500">Минимальная скидка</span>
                  <span className="text-sm font-bold text-gray-900">{discountMin}%</span>
                </div>
                <input type="range" min={0} max={20} value={discountMin}
                  onChange={e => setDiscountMin(Math.min(Number(e.target.value), discountMax - 1))}
                  className="w-full accent-[#0FBCCE]" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500">Максимальная скидка</span>
                  <span className="text-sm font-bold text-gray-900">{discountMax}%</span>
                </div>
                <input type="range" min={1} max={30} value={discountMax}
                  onChange={e => setDiscountMax(Math.max(Number(e.target.value), discountMin + 1))}
                  className="w-full accent-[#0FBCCE]" />
              </div>
              <div className="flex items-center justify-between text-xs text-gray-400 bg-gray-50 rounded-xl p-3">
                <span>Агент торгуется в диапазоне</span>
                <span className="font-semibold text-gray-700">{discountMin}% — {discountMax}%</span>
              </div>
              <button onClick={saveA2a}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${savedA2a ? 'bg-green-500 text-white' : 'bg-[#0FBCCE] text-white hover:bg-[#0da8b8]'}`}>
                {savedA2a ? <><Check className="w-4 h-4" />Сохранено</> : 'Сохранить настройки'}
              </button>
            </div>
          ) : (
            <div className="p-3 bg-gray-50 rounded-xl text-xs text-gray-500">
              Агент отключён — заказы принимаются только по полной цене
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
