'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, ChevronLeft, Check, Zap, Shield, TrendingUp, Link2, Globe, Package, Search, AlertCircle, Building2, ExternalLink, Image as ImageIcon } from 'lucide-react'

type Step = 0 | 1 | 2 | 3

interface CompanyData {
  name: string
  fullName: string
  opf: string
  inn: string
  kpp: string | null
  ogrn: string
  address: string
  okved: string
  okvedName: string
  status: string
  director: string | null
  directorPost: string | null
}

interface ImportedProduct {
  id: string
  name: string
  price: number
  images: string[]
}

interface BrandData {
  inn: string
  company: CompanyData | null
  site: string
  msToken: string
  discountMin: number
  discountMax: number
  importMethod: 'moysklad' | 'wb' | 'excel' | 'site' | 'manual' | null
  skuCount: 5 | 20 | 100
}

const STEPS = ['О компании', 'Товары', 'A2A агент', 'Готово']

const A2A_MESSAGES = [
  { from: 'buyer', text: 'Можете сделать скидку 25%? 🙏' },
  { from: 'agent', text: 'Привет! Могу предложить 7% — это уже ниже рынка.' },
  { from: 'buyer', text: 'Маловато... Хотя бы 20%?' },
  { from: 'agent', text: 'Понимаю. Для тебя — 11%. Финальное предложение 🤝' },
  { from: 'buyer', text: 'Договорились! Беру ✅' },
]

function A2ADemo() {
  const [visibleCount, setVisibleCount] = useState(0)
  useEffect(() => {
    if (visibleCount >= A2A_MESSAGES.length) return
    const t = setTimeout(() => setVisibleCount(v => v + 1), visibleCount === 0 ? 400 : 1200)
    return () => clearTimeout(t)
  }, [visibleCount])

  return (
    <div className="bg-[#F0F4FF] rounded-2xl p-4 mt-4">
      <div className="text-xs text-gray-400 mb-3 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
        Пример переговоров A2A прямо сейчас
      </div>
      <div className="space-y-2 min-h-[120px]">
        {A2A_MESSAGES.slice(0, visibleCount).map((msg, i) => (
          <div key={i} className={`flex ${msg.from === 'buyer' ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-xs leading-relaxed ${
              msg.from === 'buyer' ? 'bg-white text-gray-700 rounded-tl-sm' : 'bg-[#0FBCCE] text-white rounded-tr-sm'
            }`}>
              {msg.from === 'agent' && <span className="text-white/70 text-[10px] block mb-0.5">AIMEE агент</span>}
              {msg.text}
            </div>
          </div>
        ))}
        {visibleCount < A2A_MESSAGES.length && (
          <div className="flex justify-end">
            <div className="bg-[#0FBCCE]/20 px-3 py-2 rounded-2xl flex gap-1 items-center">
              {[0,150,300].map(d => <span key={d} className="w-1.5 h-1.5 bg-[#0FBCCE] rounded-full animate-bounce" style={{animationDelay:`${d}ms`}} />)}
            </div>
          </div>
        )}
      </div>
      {visibleCount >= A2A_MESSAGES.length && (
        <div className="mt-3 text-xs text-gray-500 text-center">🎯 Агент удержал маржу — скидка 11% вместо 25%</div>
      )}
    </div>
  )
}

function SavingsCounter({ revenue }: { revenue: number }) {
  const [displayed, setDisplayed] = useState(0)
  const target = Math.round(revenue * 0.22) - Math.round(revenue * 0.065) - 14900
  useEffect(() => {
    setDisplayed(0)
    const steps = 40; const step = target / steps; let current = 0
    const t = setInterval(() => {
      current += step
      if (current >= target) { setDisplayed(target); clearInterval(t) }
      else setDisplayed(Math.round(current))
    }, 30)
    return () => clearInterval(t)
  }, [target])
  return <span className="text-2xl font-bold text-green-600">+₽{displayed.toLocaleString()}</span>
}

// Import progress stages
const IMPORT_STAGES = [
  'Загружаем страницу сайта...',
  'Рендерим JavaScript...',
  'AI анализирует структуру каталога...',
  'Извлекаем карточки товаров...',
  'Загружаем фотографии...',
  'Сохраняем в базу данных...',
]

function ImportProgress({ stage }: { stage: number }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{IMPORT_STAGES[Math.min(stage, IMPORT_STAGES.length - 1)]}</span>
        <span>{Math.round((stage / IMPORT_STAGES.length) * 100)}%</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div
          className="bg-[#0FBCCE] h-2 rounded-full transition-all duration-500"
          style={{ width: `${(stage / IMPORT_STAGES.length) * 100}%` }}
        />
      </div>
      <div className="text-xs text-gray-400 text-center">Это займёт 30–60 секунд</div>
    </div>
  )
}


// ── Excel Upload Component ────────────────────────────────────────
function ExcelUpload({ sellerId, onImported, onError }: {
  sellerId: string
  onImported: (products: ImportedProduct[]) => void
  onError: (err: string) => void
}) {
  const [loading, setLoading] = useState(false)
  const [stage, setStage] = useState(0)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)

    const stageInterval = setInterval(() => {
      setStage(prev => prev < IMPORT_STAGES.length - 1 ? prev + 1 : prev)
    }, 2000)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('seller_id', sellerId)

      const res = await fetch('/api/excel-import', { method: 'POST', body: formData })
      const data = await res.json()
      clearInterval(stageInterval)

      if (!res.ok || data.error) { onError(data.error || 'Ошибка'); return }
      setStage(IMPORT_STAGES.length)
      onImported(data.products || [])
    } catch { clearInterval(stageInterval); onError('Ошибка загрузки') }
    finally { setLoading(false) }
  }

  if (loading) return <ImportProgress stage={stage} />

  return (
    <label className="w-full py-2.5 bg-[#0FBCCE] text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 cursor-pointer hover:bg-[#0da8b8]">
      <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} className="hidden" />
      📂 Выбрать файл CSV / Excel
    </label>
  )
}

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(0)
  const [revenue, setRevenue] = useState(500000)
  const [brand, setBrand] = useState<BrandData>({
    inn: '', company: null, site: '', msToken: '',
    discountMin: 5, discountMax: 15, importMethod: null, skuCount: 20,
  })
  const [innInput, setInnInput] = useState('')
  const [innLoading, setInnLoading] = useState(false)
  const [innError, setInnError] = useState('')
  const [importing, setImporting] = useState(false)
  const [importStage, setImportStage] = useState(0)
  const [imported, setImported] = useState(false)
  const [importedProducts, setImportedProducts] = useState<ImportedProduct[]>([])
  const [importError, setImportError] = useState('')

  const update = (key: keyof BrandData, value: any) => setBrand(prev => ({ ...prev, [key]: value }))

  const lookupInn = async () => {
    const inn = innInput.replace(/\D/g, '')
    if (inn.length !== 10 && inn.length !== 12) {
      setInnError('ИНН должен содержать 10 цифр (юрлицо) или 12 (ИП)')
      return
    }
    setInnLoading(true); setInnError('')
    try {
      const res = await fetch('/api/dadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inn }),
      })
      const data = await res.json()
      if (!res.ok) { setInnError(data.error || 'Ошибка'); return }
      if (data.status === 'LIQUIDATED') {
        setInnError('Компания ликвидирована. Проверь ИНН.')
        return
      }
      update('inn', inn)
      update('company', data)
    } catch {
      setInnError('Ошибка соединения')
    } finally {
      setInnLoading(false)
    }
  }

  const handleImport = async () => {
    if (!brand.importMethod) return

    if (brand.importMethod === 'moysklad') {
      // МойСклад — simulate as before
      setImporting(true)
      for (let i = 0; i <= IMPORT_STAGES.length; i++) {
        await new Promise(r => setTimeout(r, 400))
        setImportStage(i)
      }
      setImporting(false)
      setImported(true)
      return
    }

    if (brand.importMethod === 'wb') {
      if (!brand.site) return // reuse site field for wb token
      setImporting(true)
      setImportError('')
      setImportStage(0)
      const stageInterval = setInterval(() => {
        setImportStage(prev => prev < IMPORT_STAGES.length - 1 ? prev + 1 : prev)
      }, 5000)
      try {
        const sellerId = brand.company?.inn || 'onboarding'
        const res = await fetch('/api/wb-import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ wb_token: brand.site, seller_id: sellerId }),
        })
        const data = await res.json()
        clearInterval(stageInterval)
        if (!res.ok || data.error) { setImportError(data.error || 'Ошибка'); setImporting(false); return }
        setImportStage(IMPORT_STAGES.length)
        setImportedProducts(data.products || [])
        setImported(true)
      } catch { clearInterval(stageInterval); setImportError('Ошибка соединения') }
      finally { setImporting(false) }
      return
    }

    if (brand.importMethod === 'excel') {
      setImporting(true)
      setImportError('')
      // File upload handled separately via input
      setImported(true)
      setImporting(false)
      return
    }

    if (brand.importMethod === 'site') {
      if (!brand.site) return
      setImporting(true)
      setImportError('')
      setImportStage(0)

      // Animate progress stages while waiting for API
      const stageInterval = setInterval(() => {
        setImportStage(prev => {
          if (prev < IMPORT_STAGES.length - 1) return prev + 1
          return prev
        })
      }, 8000) // advance stage every 8 seconds

      try {
        const sellerId = brand.company?.inn || 'onboarding'
        const res = await fetch('/api/ai-import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: brand.site, seller_id: sellerId }),
        })

        const data = await res.json()
        clearInterval(stageInterval)

        if (!res.ok || data.error) {
          setImportError(data.error || 'Не удалось импортировать товары')
          setImporting(false)
          return
        }

        setImportStage(IMPORT_STAGES.length)
        setImportedProducts(data.products || [])
        setImported(true)
      } catch (e) {
        clearInterval(stageInterval)
        setImportError('Ошибка соединения. Попробуй ещё раз.')
      } finally {
        setImporting(false)
      }
      return
    }

    if (brand.importMethod === 'manual') {
      setImported(true)
    }
  }

  const handleFinish = () => {
    localStorage.setItem('onboarding_complete', '1')
    localStorage.setItem('brand_name', brand.company?.name || 'Мой бренд')
    if (brand.msToken) localStorage.setItem('ms_token', brand.msToken)
    router.push('/dashboard')
  }

  const canNext = () => {
    if (step === 0) return !!brand.company
    if (step === 1) return imported || brand.importMethod === null
    return true
  }

  return (
    <div className="min-h-screen bg-[#F0F4FF] flex flex-col">
      {/* Хедер */}
      <div className="flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#0FBCCE] rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">A</span>
          </div>
          <span className="font-semibold text-gray-900">AIMEE</span>
        </div>
        <button onClick={() => router.push('/dashboard')} className="text-xs text-gray-400 hover:text-gray-600">
          Пропустить →
        </button>
      </div>

      {/* Прогресс */}
      <div className="flex items-center justify-center gap-0 mb-8 px-8">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center">
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                i < step ? 'bg-[#0FBCCE] text-white' :
                i === step ? 'bg-white border-2 border-[#0FBCCE] text-[#0FBCCE]' :
                'bg-white border border-gray-200 text-gray-300'
              }`}>
                {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span className={`text-xs font-medium ${i === step ? 'text-gray-900' : 'text-gray-400'}`}>{s}</span>
            </div>
            {i < STEPS.length - 1 && <div className={`w-16 h-px mx-3 ${i < step ? 'bg-[#0FBCCE]' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      <div className="flex-1 flex items-start justify-center px-4 pb-8">
        <div className="w-full max-w-2xl">

          {/* ── ШАГ 0: О компании ── */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#EBF9FB] rounded-full text-xs font-medium text-[#0FBCCE] mb-4">
                  <Zap className="w-3.5 h-3.5" />AI-маркетплейс нового поколения
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-3 leading-tight">
                  Твои товары продаёт<br />AI-агент. 24/7.
                </h1>
                <p className="text-gray-500 text-sm leading-relaxed mb-5">
                  Никаких комиссий 34–38% как у WB и Ozon. Фиксированная ставка 6.5%.
                  Агент сам торгуется с покупателями и защищает твою маржу.
                </p>
                <div className="bg-[#F0F4FF] rounded-2xl p-4 mb-5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500">Твоя выручка в месяц</span>
                    <span className="text-sm font-bold text-gray-900">₽{revenue.toLocaleString()}</span>
                  </div>
                  <input type="range" min={100000} max={3000000} step={50000} value={revenue}
                    onChange={e => setRevenue(Number(e.target.value))}
                    className="w-full accent-[#0FBCCE] mb-3" />
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-gray-400">Экономишь с AIMEE vs WB</div>
                      <SavingsCounter revenue={revenue} />
                      <div className="text-xs text-gray-400">в месяц</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-400">WB забрал бы</div>
                      <div className="text-xl font-bold text-red-400">−₽{Math.round(revenue * 0.34).toLocaleString()}</div>
                      <div className="text-xs text-gray-400">комиссия 34%</div>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-5">
                  {[
                    { icon: <TrendingUp className="w-4 h-4 text-[#0FBCCE]" />, label: 'Комиссия 6.5%', sub: 'vs 34–38% у конкурентов' },
                    { icon: <Zap className="w-4 h-4 text-[#0FBCCE]" />, label: 'A2A переговоры', sub: 'агент торгуется за тебя' },
                    { icon: <Shield className="w-4 h-4 text-[#0FBCCE]" />, label: 'Твои данные', sub: 'Data Wallet — только твоё' },
                  ].map((f, i) => (
                    <div key={i} className="bg-[#F0F4FF] rounded-2xl p-3 text-center">
                      <div className="flex justify-center mb-1.5">{f.icon}</div>
                      <div className="text-xs font-semibold text-gray-900">{f.label}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{f.sub}</div>
                    </div>
                  ))}
                </div>
                <A2ADemo />
              </div>

              <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                <div className="text-sm font-semibold text-gray-900 mb-1">Войти как компания</div>
                <div className="text-xs text-gray-400 mb-4">Введи ИНН — все данные подтянутся автоматически</div>
                {!brand.company ? (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <input
                        type="text" value={innInput}
                        onChange={e => { setInnInput(e.target.value.replace(/\D/g, '')); setInnError('') }}
                        onKeyDown={e => e.key === 'Enter' && lookupInn()}
                        placeholder="ИНН (10 или 12 цифр)"
                        maxLength={12}
                        className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#0FBCCE] font-mono tracking-wider transition-colors"
                      />
                      <button onClick={lookupInn} disabled={innInput.length < 10 || innLoading}
                        className="px-4 py-2.5 bg-[#0FBCCE] text-white rounded-xl text-sm font-medium hover:bg-[#0da8b8] disabled:opacity-40 flex items-center gap-2">
                        {innLoading
                          ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          : <Search className="w-4 h-4" />}
                        {innLoading ? 'Ищу...' : 'Найти'}
                      </button>
                    </div>
                    {innError && (
                      <div className="flex items-center gap-2 text-xs text-red-500">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{innError}
                      </div>
                    )}
                    <div className="text-xs text-gray-400">Данные из официального реестра ФНС — проверка займёт секунду</div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="bg-green-50 border border-green-100 rounded-2xl p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-5 h-5 text-green-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-bold text-gray-900 truncate">{brand.company.name}</span>
                            <span className="text-xs px-1.5 py-0.5 bg-green-200 text-green-700 rounded-full flex-shrink-0">✓ Активна</span>
                          </div>
                          <div className="space-y-0.5 text-xs text-gray-500">
                            <div>ИНН: <span className="font-mono text-gray-700">{brand.company.inn}</span>{brand.company.kpp && <span> · КПП: <span className="font-mono text-gray-700">{brand.company.kpp}</span></span>}</div>
                            <div>ОГРН: <span className="font-mono text-gray-700">{brand.company.ogrn}</span></div>
                            {brand.company.director && <div>{brand.company.directorPost}: <span className="text-gray-700">{brand.company.director}</span></div>}
                            <div className="truncate">{brand.company.address}</div>
                            {brand.company.okved && <div>ОКВЭД: <span className="text-gray-700">{brand.company.okved}</span></div>}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="border border-gray-100 rounded-2xl p-4">
                      <div className="text-xs font-semibold text-gray-500 mb-3">💳 Рекомендуемый банк для селлеров</div>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-yellow-50 rounded-xl flex items-center justify-center flex-shrink-0 text-lg">🟡</div>
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-gray-900">Точка Банк</div>
                          <div className="text-xs text-gray-400">Счёт для селлеров · 0 ₽/мес первые 3 месяца</div>
                        </div>
                        <a href="https://tochka.com/sellers/" target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 px-3 py-1.5 bg-yellow-400 text-gray-900 rounded-lg text-xs font-semibold hover:bg-yellow-500">
                          Открыть счёт <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                    <button onClick={() => { update('company', null); setInnInput('') }}
                      className="text-xs text-gray-400 hover:text-gray-600">
                      ← Ввести другой ИНН
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── ШАГ 1: Товары ── */}
          {step === 1 && (
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
              <div className="text-lg font-bold text-gray-900 mb-1">Загрузи свои товары</div>
              <p className="text-sm text-gray-400 mb-6">Выбери удобный способ. Можно изменить позже.</p>

              {!imported && (
                <>
                  <div className="space-y-3 mb-6">
                    {[
                      { key: 'moysklad' as const, icon: <Package className="w-5 h-5" />, title: 'МойСклад', sub: 'Синхронизация остатков и цен в реальном времени', badge: 'Рекомендуем' },
                      { key: 'wb' as const, icon: <Globe className="w-5 h-5" />, title: 'Wildberries API', sub: 'Вставь токен WB — товары подгрузятся автоматически', badge: 'WB' },
                      { key: 'excel' as const, icon: <Package className="w-5 h-5" />, title: 'Загрузить Excel / CSV', sub: 'Выгрузи каталог из WB и загрузи сюда', badge: null },
                      { key: 'site' as const, icon: <Globe className="w-5 h-5" />, title: 'AI Импорт с сайта', sub: 'AIMEE AI сам парсит товары с твоего сайта', badge: 'Быстро' },
                      { key: 'manual' as const, icon: <ChevronRight className="w-5 h-5" />, title: 'Добавить вручную', sub: 'Заполни карточки товаров самостоятельно', badge: null },
                    ].map(opt => (
                      <button key={opt.key} onClick={() => { update('importMethod', opt.key); setImportError('') }}
                        className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all ${brand.importMethod === opt.key ? 'border-[#0FBCCE] bg-[#EBF9FB]' : 'border-gray-100 hover:border-gray-200'}`}>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${brand.importMethod === opt.key ? 'bg-[#0FBCCE] text-white' : 'bg-gray-100 text-gray-500'}`}>
                          {opt.icon}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900">{opt.title}</span>
                            {opt.badge && <span className="text-xs px-2 py-0.5 bg-[#0FBCCE] text-white rounded-full">{opt.badge}</span>}
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">{opt.sub}</div>
                        </div>
                        {brand.importMethod === opt.key && <Check className="w-5 h-5 text-[#0FBCCE] flex-shrink-0" />}
                      </button>
                    ))}
                  </div>

                  {/* МойСклад */}
                  {brand.importMethod === 'moysklad' && (
                    <div className="space-y-3 p-4 bg-[#F0F4FF] rounded-2xl">
                      <div className="text-xs text-gray-500">Найди токен: <strong>Настройки → Безопасность → Токен</strong></div>
                      <input type="text" value={brand.msToken} onChange={e => update('msToken', e.target.value)}
                        placeholder="Вставь токен МойСклад"
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#0FBCCE] bg-white" />
                      {importing ? (
                        <ImportProgress stage={importStage} />
                      ) : (
                        <button onClick={handleImport} disabled={!brand.msToken || importing}
                          className="w-full py-2.5 bg-[#0FBCCE] text-white rounded-xl text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-2">
                          <Link2 className="w-4 h-4" />Подключить МойСклад
                        </button>
                      )}
                    </div>
                  )}

                  {/* WB API */}
                  {brand.importMethod === 'wb' && (
                    <div className="space-y-3 p-4 bg-[#F0F4FF] rounded-2xl">
                      <div className="text-xs text-gray-500">
                        Найди токен: ЛК WB → Профиль → Интеграции по API → Создать токен
                      </div>
                      <input
                        type="text" value={brand.site}
                        onChange={e => update('site', e.target.value)}
                        placeholder="Вставь токен Wildberries"
                        disabled={importing}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#0FBCCE] bg-white disabled:opacity-50"
                      />
                      {importing ? (
                        <ImportProgress stage={importStage} />
                      ) : (
                        <>
                          <button onClick={handleImport} disabled={!brand.site || importing}
                            className="w-full py-2.5 bg-[#0FBCCE] text-white rounded-xl text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-2">
                            <Zap className="w-4 h-4" />Загрузить товары из WB
                          </button>
                          {importError && (
                            <div className="flex items-center gap-2 text-xs text-red-500">
                              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{importError}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* Excel / CSV */}
                  {brand.importMethod === 'excel' && (
                    <div className="space-y-3 p-4 bg-[#F0F4FF] rounded-2xl">
                      <div className="text-xs text-gray-500">
                        Выгрузи каталог из WB: Товары → Карточки товаров → Экспорт → CSV
                      </div>
                      <ExcelUpload sellerId={brand.company?.inn || 'onboarding'} onImported={(products) => { setImportedProducts(products); setImported(true) }} onError={setImportError} />
                      {importError && (
                        <div className="flex items-center gap-2 text-xs text-red-500">
                          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{importError}
                        </div>
                      )}
                    </div>
                  )}

                  {/* AI Импорт с сайта */}
                  {brand.importMethod === 'site' && (
                    <div className="space-y-3 p-4 bg-[#F0F4FF] rounded-2xl">
                      <div className="text-xs text-gray-500">
                        AIMEE AI загрузит страницу, найдёт все товары и импортирует фото, цены и описания
                      </div>
                      <input
                        type="text" value={brand.site}
                        onChange={e => update('site', e.target.value)}
                        placeholder="https://your-brand.ru/catalog"
                        disabled={importing}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#0FBCCE] bg-white disabled:opacity-50"
                      />
                      {importing ? (
                        <ImportProgress stage={importStage} />
                      ) : (
                        <>
                          <button onClick={handleImport} disabled={!brand.site || importing}
                            className="w-full py-2.5 bg-[#0FBCCE] text-white rounded-xl text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-2">
                            <Zap className="w-4 h-4" />Запустить AI Импорт
                          </button>
                          {importError && (
                            <div className="flex items-center gap-2 text-xs text-red-500 mt-1">
                              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{importError}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Результат импорта */}
              {imported && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-green-50 rounded-2xl border border-green-100">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-green-800">
                        {importedProducts.length > 0
                          ? `Импортировано ${importedProducts.length} товаров`
                          : 'Товары подключены'}
                      </div>
                      <div className="text-xs text-green-600">
                        {importedProducts.length > 0
                          ? 'Фото и цены сохранены в каталог'
                          : 'Синхронизация активна'}
                      </div>
                    </div>
                    <button
                      onClick={() => { setImported(false); setImportedProducts([]); setImportError('') }}
                      className="text-xs text-gray-400 hover:text-gray-600"
                    >
                      Изменить
                    </button>
                  </div>

                  {/* Превью товаров */}
                  {importedProducts.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-gray-500 mb-3">Импортированные товары</div>
                      <div className="grid grid-cols-2 gap-3 max-h-80 overflow-y-auto">
                        {importedProducts.slice(0, 8).map((p) => (
                          <div key={p.id} className="bg-[#F0F4FF] rounded-2xl overflow-hidden">
                            {p.images?.[0] ? (
                              <img
                                src={p.images[0]}
                                alt={p.name}
                                className="w-full h-32 object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none'
                                }}
                              />
                            ) : (
                              <div className="w-full h-32 bg-gray-100 flex items-center justify-center">
                                <ImageIcon className="w-8 h-8 text-gray-300" />
                              </div>
                            )}
                            <div className="p-2">
                              <div className="text-xs font-semibold text-gray-900 truncate">{p.name}</div>
                              <div className="text-xs text-[#0FBCCE] font-medium">₽{p.price?.toLocaleString()}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                      {importedProducts.length > 8 && (
                        <div className="text-xs text-gray-400 text-center mt-2">
                          +{importedProducts.length - 8} ещё товаров в каталоге
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── ШАГ 2: A2A ── */}
          {step === 2 && (
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
              <div className="text-lg font-bold text-gray-900 mb-1">Настрой AI-агента</div>
              <p className="text-sm text-gray-400 mb-6">Агент торгуется с покупателями в этих рамках. Можно изменить в любой момент.</p>
              <div className="space-y-6">
                <div className="p-5 bg-[#F0F4FF] rounded-2xl">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-sm font-semibold text-gray-900">Диапазон скидок</div>
                    <div className="text-sm font-bold text-[#0FBCCE]">{brand.discountMin}% — {brand.discountMax}%</div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-xs text-gray-400 mb-2"><span>Минимальная скидка</span><span>{brand.discountMin}%</span></div>
                      <input type="range" min={0} max={20} value={brand.discountMin}
                        onChange={e => update('discountMin', Math.min(+e.target.value, brand.discountMax - 1))}
                        className="w-full accent-[#0FBCCE]" />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-gray-400 mb-2"><span>Максимальная скидка</span><span>{brand.discountMax}%</span></div>
                      <input type="range" min={1} max={40} value={brand.discountMax}
                        onChange={e => update('discountMax', Math.max(+e.target.value, brand.discountMin + 1))}
                        className="w-full accent-[#0FBCCE]" />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Консервативно', min: 3, max: 8, sub: 'Маржа в приоритете' },
                    { label: 'Сбалансировано', min: 5, max: 15, sub: 'Рекомендуем' },
                    { label: 'Агрессивно', min: 10, max: 25, sub: 'Объём в приоритете' },
                  ].map(p => (
                    <button key={p.label} onClick={() => { update('discountMin', p.min); update('discountMax', p.max) }}
                      className={`p-3 rounded-2xl border-2 text-center transition-all ${brand.discountMin === p.min && brand.discountMax === p.max ? 'border-[#0FBCCE] bg-[#EBF9FB]' : 'border-gray-100 hover:border-gray-200'}`}>
                      <div className="text-xs font-semibold text-gray-900">{p.label}</div>
                      <div className="text-xs text-[#0FBCCE] font-medium mt-0.5">{p.min}–{p.max}%</div>
                      <div className="text-xs text-gray-400 mt-0.5">{p.sub}</div>
                    </button>
                  ))}
                </div>
                <div className="p-4 bg-gray-50 rounded-2xl text-xs text-gray-500">
                  💡 Агент начинает с минимальной скидки и уступает до максимальной за 4–5 раундов. Конверсия растёт на 23%.
                </div>
              </div>
            </div>
          )}

          {/* ── ШАГ 3: Готово ── */}
          {step === 3 && (
            <div className="bg-white rounded-3xl p-10 shadow-sm border border-gray-100 text-center">
              <div className="w-16 h-16 bg-[#EBF9FB] rounded-full flex items-center justify-center mx-auto mb-5">
                <Check className="w-8 h-8 text-[#0FBCCE]" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {brand.company?.name || 'Твой бренд'} подключён!
              </h2>
              <p className="text-sm text-gray-400 mb-8">
                AI-агент готов торговаться за тебя. Скидки {brand.discountMin}–{brand.discountMax}%.
              </p>
              <div className="grid grid-cols-3 gap-3 mb-8 text-left">
                {[
                  { emoji: '📦', label: 'Каталог', sub: 'Управляй товарами' },
                  { emoji: '🤖', label: 'A2A Сеть', sub: 'Live переговоры' },
                  { emoji: '💡', label: 'AI Брифинг', sub: 'Аналитика каждый день' },
                ].map((f, i) => (
                  <div key={i} className="p-4 bg-[#F0F4FF] rounded-2xl">
                    <div className="text-2xl mb-2">{f.emoji}</div>
                    <div className="text-sm font-semibold text-gray-900">{f.label}</div>
                    <div className="text-xs text-gray-400">{f.sub}</div>
                  </div>
                ))}
              </div>
              <button onClick={handleFinish}
                className="w-full py-3.5 bg-[#0FBCCE] text-white rounded-2xl font-semibold hover:bg-[#0da8b8] flex items-center justify-center gap-2">
                Перейти в дашборд <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {step < 3 && (
            <div className="flex items-center justify-between mt-4">
              <button onClick={() => setStep(s => (s - 1) as Step)} disabled={step === 0}
                className="flex items-center gap-1 px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-0">
                <ChevronLeft className="w-4 h-4" />Назад
              </button>
              <button onClick={() => step === 2 ? setStep(3) : setStep(s => (s + 1) as Step)}
                disabled={!canNext()}
                className="flex items-center gap-2 px-6 py-2.5 bg-[#0FBCCE] text-white rounded-xl text-sm font-medium hover:bg-[#0da8b8] disabled:opacity-40 disabled:cursor-not-allowed">
                {step === 2 ? 'Завершить настройку' : 'Продолжить'} <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
