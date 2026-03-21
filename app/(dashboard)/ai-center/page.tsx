'use client'
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

import { useState, useEffect } from 'react'
import { Sparkles, CheckCircle, AlertCircle, Loader2, Plus, ChevronRight, RefreshCw, Copy, Check } from 'lucide-react'

function friendlyError(err: unknown): string {
  const msg = String(err)
  if (msg.includes('429') || msg.includes('rate_limit')) return 'Слишком много запросов — подождите минуту и попробуйте снова'
  if (msg.includes('timeout') || msg.includes('AbortError')) return 'Сайт не отвечает — попробуйте позже или другой URL'
  if (msg.includes('404') || msg.includes('Not Found')) return 'Страница не найдена — проверьте URL'
  if (msg.includes('403') || msg.includes('Forbidden')) return 'Сайт закрыт для автоматического доступа'
  if (msg.includes('Cannot parse') || msg.includes('JSON')) return 'Не удалось распознать каталог — попробуйте другую страницу сайта'
  if (msg.includes('no_products') || msg.includes('товары не найдены')) return 'Товары не найдены — попробуйте указать страницу конкретной категории (например /catalog/платья)'
  if (msg.includes('fetch') || msg.includes('network')) return 'Ошибка сети — проверьте подключение и попробуйте снова'
  return 'Не удалось загрузить каталог — попробуйте другой URL или позже'
}



// ─── Типы ────────────────────────────────────────────────────────────────────

interface Product { name: string; price: number; currency: string; category: string; description: string; sizes: string[]; colors: string[]; image_emoji: string; image_url?: string; selected?: boolean }
interface ParseResult { brand_name: string; brand_description: string; products: Product[] }
type ImportStep = 'input' | 'parsing' | 'review' | 'done'

// ─── Импорт каталога ─────────────────────────────────────────────────────────

function ImportTool() {
  const [step, setStep] = useState<ImportStep>('input')
  const [url, setUrl] = useState('')
  const [limit, setLimit] = useState(5)
  const [result, setResult] = useState<ParseResult | null>(null)
  const [error, setError] = useState('')
  const [log, setLog] = useState<string[]>([])

  const addLog = (msg: string) => setLog(prev => [...prev, msg])

  const handleParse = async () => {
    if (!url.trim()) return
    setStep('parsing'); setError(''); setLog([])
    addLog('Подключаюсь к сайту бренда...')
    await new Promise(r => setTimeout(r, 800))
    addLog(`Анализирую: ${url}`)
    await new Promise(r => setTimeout(r, 600))
    addLog(`Сканирую каталог (лимит: ${limit} SKU)...`)
    try {
      const res = await fetch('/api/ai/parse-site', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, limit }) })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Ошибка парсинга')
      const products = data.data?.products
      if (!products || products.length === 0) throw new Error('no_products')
      addLog(`Найдено: ${products.length} товаров`)
      await new Promise(r => setTimeout(r, 400))
      setResult({ ...data.data, products: products.map((p: Product) => ({ ...p, selected: true })) })
      setStep('review')
    } catch (err) { setError(friendlyError(err)); setStep('input') }
  }

  const toggleProduct = (i: number) => {
    if (!result) return
    const products = [...result.products]
    products[i] = { ...products[i], selected: !products[i].selected }
    setResult({ ...result, products })
  }

  const selectedCount = result?.products.filter(p => p.selected).length ?? 0

  const handleSave = async () => {
    if (!result) return
    const sellerId = typeof window !== 'undefined' ? localStorage.getItem('seller_id') || 'catalog' : 'catalog'
    const selected = result.products.filter(p => p.selected)
    try {
      // Get existing product names to avoid duplicates
      const { data: existing } = await supabase.from('products').select('name').eq('seller_id', sellerId)
      const existingNames = new Set((existing || []).map((p: {name: string}) => p.name))
      const rows = selected
        .filter(p => !existingNames.has(p.name))
        .map(p => ({
          seller_id: sellerId,
          name: p.name,
          price: p.price,
          category: p.category,
          description: p.description || '',
          sizes: p.sizes || [],
          colors: p.colors || [],
          image_emoji: p.image_emoji || '👗',
          images: p.image_url ? [p.image_url] : [],
          is_active: true,
        }))
      if (rows.length === 0) { setStep('done'); return }
      await supabase.from('products').insert(rows)
      setStep('done')
    } catch (e) { setError(friendlyError(e)) }
  }

  const handleReset = () => { setStep('input'); setUrl(''); setResult(null); setError(''); setLog([]) }

  if (step === 'input') return (
    <div className="space-y-3">
      <div className="bg-[#F0F4FF] rounded-2xl p-4 space-y-3">
        <input type="url" value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleParse()}
          placeholder="https://varvara-fashion.com"
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#0FBCCE] bg-white" />
        <div className="flex gap-2">
          <select value={limit} onChange={e => setLimit(Number(e.target.value))}
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:border-[#0FBCCE]">
            <option value={5}>5 SKU</option>
            <option value={20}>20 SKU</option>
            <option value={100}>100 SKU</option>
          </select>
          <button onClick={handleParse} disabled={!url.trim()}
            className="flex-1 flex items-center justify-center gap-2 py-2 bg-[#0FBCCE] text-white rounded-xl text-sm font-medium hover:bg-[#0da8b8] disabled:opacity-40">
            <Sparkles className="w-4 h-4" />Запустить импорт
          </button>
        </div>
        {error && <div className="flex items-center gap-2 text-red-600 text-xs"><AlertCircle className="w-4 h-4" />{error}</div>}
      </div>
    </div>
  )

  if (step === 'parsing') return (
    <div className="bg-[#F0F4FF] rounded-2xl p-5 flex flex-col items-center gap-3">
      <Loader2 className="w-7 h-7 text-[#0FBCCE] animate-spin" />
      <div className="text-sm font-medium text-gray-700">Анализирую сайт...</div>
      <div className="w-full bg-white rounded-xl p-3 font-mono text-xs text-gray-500 space-y-1">
        {log.map((l, i) => <div key={i} className="flex gap-2"><span className="text-[#0FBCCE]">›</span>{l}</div>)}
        <div className="flex gap-2"><span className="text-[#0FBCCE]">›</span><span className="animate-pulse">_</span></div>
      </div>
    </div>
  )

  if (step === 'review' && result) return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-gray-500 px-1">
        <span>Найдено <strong>{result.products.length}</strong>Выбрано <strong className="text-[#0FBCCE]">{selectedCount}</strong></span>
        <button onClick={() => setResult({ ...result, products: result.products.map(p => ({ ...p, selected: !result.products.every(q => q.selected) })) })} className="text-[#0FBCCE] hover:underline">
          {result.products.every(p => p.selected) ? 'Снять все' : 'Выбрать все'}
        </button>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden max-h-72 overflow-y-auto">
        {result.products.map((p, i) => (
          <div key={i} onClick={() => toggleProduct(i)} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 border-b border-gray-50 last:border-0 ${!p.selected ? 'opacity-40' : ''}`}>
            <div className={`w-4 h-4 rounded border-2 flex-shrink-0 ${p.selected ? 'bg-[#0FBCCE] border-[#0FBCCE]' : 'border-gray-300'}`} />
            <span className="text-lg">{p.image_emoji}</span>
            <div className="flex-1 min-w-0"><div className="text-xs font-medium text-gray-900 truncate">{p.name}</div><div className="text-xs text-gray-400">{p.category}</div></div>
            <div className="text-xs font-semibold">₽{p.price.toLocaleString()}</div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button onClick={handleReset} className="px-3 py-2 border border-gray-200 text-gray-500 rounded-xl text-xs">Сбросить</button>
        <button onClick={handleSave} disabled={selectedCount === 0} className="flex-1 py-2 bg-[#0FBCCE] text-white rounded-xl text-xs font-medium disabled:opacity-40">
          Добавить {selectedCount} в каталог
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex items-center gap-3 bg-green-50 rounded-2xl p-4 border border-green-100">
      <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0"><Check className="w-4 h-4 text-white" /></div>
      <div className="flex-1"><div className="text-sm font-semibold text-green-800">{selectedCount} товаров добавлено</div><div className="text-xs text-green-600">Импорт завершён</div></div>
      <button onClick={handleReset} className="text-xs text-green-700 hover:underline">Ещё</button>
      <a href="/catalog" className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg">В каталог →</a>
    </div>
  )
}

// ─── Описания товаров ─────────────────────────────────────────────────────────

const CATALOG_ITEMS = [
  { sku: 'VF-441', name: 'Пальто oversize', category: 'Верхняя одежда', price: 24900 },
  { sku: 'VF-089', name: 'Брюки wide leg', category: 'Брюки', price: 12900 },
  { sku: 'VF-661', name: 'Свитер кашемир', category: 'Трикотаж', price: 19900 },
  { sku: 'VF-774', name: 'Куртка утеплённая', category: 'Верхняя одежда', price: 29900 },
  { sku: 'VF-517', name: 'Худи oversize', category: 'Трикотаж', price: 11900 },
  { sku: 'VF-203', name: 'Рубашка лён', category: 'Рубашки', price: 8900 },
  { sku: 'VF-108', name: 'Футболка базовая', category: 'Футболки', price: 4900 },
  { sku: 'VF-332', name: 'Джинсы прямые', category: 'Брюки', price: 13900 },
]

interface DescResult { title: string; description: string; tags: string[]; seo_title: string }

function DescriptionsTool() {
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<Record<string, DescResult>>({})
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  const [error, setError] = useState('')

  // Подгружаем уже сохранённые
  useEffect(() => {
    const s: Record<string, boolean> = {}
    CATALOG_ITEMS.forEach(p => {
      if (localStorage.getItem(`aimee_desc_${p.sku}`)) s[p.sku] = true
    })
    setSaved(s)
  }, [])

  const generate = async (sku: string) => {
    const product = CATALOG_ITEMS.find(p => p.sku === sku)
    if (!product) return
    setSelected(sku); setLoading(true); setError('')
    try {
      const res = await fetch('/api/ai/descriptions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product }) })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setResults(prev => ({ ...prev, [sku]: data.data }))
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  const saveToCatalog = (sku: string) => {
    const result = results[sku]
    if (!result) return
    localStorage.setItem(`aimee_desc_${sku}`, JSON.stringify(result))
    setSaved(prev => ({ ...prev, [sku]: true }))
  }

  const saveAllToCatalog = () => {
    const newSaved: Record<string, boolean> = {}
    Object.entries(results).forEach(([sku, result]) => {
      localStorage.setItem(`aimee_desc_${sku}`, JSON.stringify(result))
      newSaved[sku] = true
    })
    setSaved(prev => ({ ...prev, ...newSaved }))
  }

  const generateAll = async () => {
    for (const p of CATALOG_ITEMS) {
      if (!results[p.sku]) await generate(p.sku)
    }
  }

  const generatedCount = Object.keys(results).length

  const copy = (text: string) => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }

  const activeResult = selected ? results[selected] : null

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {CATALOG_ITEMS.map(p => (
          <button key={p.sku} onClick={() => generate(p.sku)}
            className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-all ${selected === p.sku ? 'border-[#0FBCCE] bg-[#EBF9FB]' : 'border-gray-100 bg-gray-50 hover:border-gray-200'}`}>
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${results[p.sku] ? 'bg-green-500' : 'bg-gray-300'}`} />
            <div className="min-w-0">
              <div className="text-xs font-medium text-gray-900 truncate">{p.name}</div>
              <div className="text-xs text-gray-400">{p.sku}</div>
            </div>
            {loading && selected === p.sku && <Loader2 className="w-3 h-3 text-[#0FBCCE] animate-spin ml-auto flex-shrink-0" />}
            {results[p.sku] && selected !== p.sku && <Check className="w-3 h-3 text-green-500 ml-auto flex-shrink-0" />}
          </button>
        ))}
      </div>

      {error && <div className="text-xs text-red-500 px-1">{error}</div>}

      {activeResult && !loading && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-gray-700">{CATALOG_ITEMS.find(p => p.sku === selected)?.name}</div>
            <div className="flex items-center gap-2">
              <button onClick={() => copy(`${activeResult.title}\n\n${activeResult.description}\n\nТеги: ${activeResult.tags.join(', ')}`)}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Скопировано' : 'Копировать'}
              </button>
              <button onClick={() => selected && saveToCatalog(selected)}
                className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${saved[selected!] ? 'bg-green-100 text-green-700' : 'bg-[#0FBCCE] text-white hover:bg-[#0da8b8]'}`}>
                {saved[selected!] ? <><Check className="w-3 h-3" />Сохранено</> : <>Сохранить в каталог →</>}
              </button>
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-1">Заголовок</div>
            <div className="text-sm font-medium text-gray-900">{activeResult.title}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-1">Описание</div>
            <div className="text-xs text-gray-600 leading-relaxed">{activeResult.description}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-1">Теги</div>
            <div className="flex flex-wrap gap-1">
              {activeResult.tags.map(tag => <span key={tag} className="text-xs px-2 py-0.5 bg-[#EBF9FB] text-[#0FBCCE] rounded-md">{tag}</span>)}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-1">SEO заголовок</div>
            <div className="text-xs text-gray-500 italic">{activeResult.seo_title}</div>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-3 p-4 bg-[#F0F4FF] rounded-2xl">
          <Loader2 className="w-5 h-5 text-[#0FBCCE] animate-spin" />
          <div className="text-sm text-gray-600">Генерирую описание...</div>
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={generateAll} disabled={loading}
          className="flex-1 py-2.5 border border-[#0FBCCE] text-[#0FBCCE] rounded-xl text-sm font-medium hover:bg-[#EBF9FB] disabled:opacity-40 transition-colors">
          {loading ? 'Генерирую...' : 'Сгенерировать все'}
        </button>
        {generatedCount > 0 && (
          <button onClick={saveAllToCatalog}
            className="flex-1 py-2.5 bg-[#0FBCCE] text-white rounded-xl text-sm font-medium hover:bg-[#0da8b8] transition-colors">
            Сохранить все в каталог ({generatedCount})
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Анализ цен ───────────────────────────────────────────────────────────────

interface PriceItem { sku: string; name: string; our_price: number; market_min: number; market_max: number; competitor: string; status: 'ok' | 'warning' | 'critical'; recommendation: number | null; reason: string }
interface PriceData { summary: string; items: PriceItem[] }

function PricesTool() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<PriceData | null>(null)
  const [error, setError] = useState('')

  const analyze = async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/ai/prices', { method: 'POST', headers: { 'Content-Type': 'application/json' } })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      setData(json.data)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  const STATUS = { ok: { label: 'Норма', cls: 'bg-green-100 text-green-700' }, warning: { label: 'Внимание', cls: 'bg-amber-100 text-amber-700' }, critical: { label: 'Критично', cls: 'bg-red-100 text-red-600' } }

  if (!data && !loading) return (
    <div className="space-y-3">
      <div className="bg-[#F0F4FF] rounded-2xl p-5 text-center">
        <div className="text-3xl mb-2">📊</div>
        <div className="text-sm font-medium text-gray-700 mb-1">Анализ цен конкурентов</div>
        <div className="text-xs text-gray-400 mb-4">Сравниваем твои цены с рынком: 12 STOREEZ, Zarina, Befree, Sela</div>
        <button onClick={analyze} className="px-6 py-2.5 bg-[#0FBCCE] text-white rounded-xl text-sm font-medium hover:bg-[#0da8b8]">
          Запустить анализ
        </button>
        {error && <div className="mt-2 text-xs text-red-500">{error}</div>}
      </div>
    </div>
  )

  if (loading) return (
    <div className="flex flex-col items-center gap-3 p-8 bg-[#F0F4FF] rounded-2xl">
      <Loader2 className="w-7 h-7 text-[#0FBCCE] animate-spin" />
      <div className="text-sm text-gray-600">Анализирую рынок...</div>
      <div className="text-xs text-gray-400">Сравниваю 8 SKU с конкурентами</div>
    </div>
  )

  return (
    <div className="space-y-3">
      {data?.summary && (
        <div className="bg-[#F0F4FF] rounded-xl p-3 text-xs text-gray-600 leading-relaxed">{data.summary}</div>
      )}
      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {data?.items.map((item, i) => {
          const s = STATUS[item.status]
          return (
            <div key={i} className={`p-3.5 rounded-xl border ${item.status === 'critical' ? 'border-red-100 bg-red-50' : item.status === 'warning' ? 'border-amber-50 bg-amber-50' : 'border-gray-100 bg-white'}`}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-xs font-semibold text-gray-800">{item.name} <span className="text-gray-400 font-normal">{item.sku}</span></div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.cls}`}>{s.label}</span>
              </div>
              <div className="flex items-center gap-3 text-xs mb-1">
                <span><span className="text-gray-400">Наша: </span><span className="font-semibold">₽{item.our_price.toLocaleString()}</span></span>
                <span><span className="text-gray-400">{item.competitor}: </span><span className={`font-semibold ${item.status !== 'ok' ? 'text-red-600' : 'text-green-600'}`}>₽{item.market_min.toLocaleString()}</span></span>
                {item.recommendation && <span className="ml-auto"><span className="text-gray-400">Рек: </span><span className="font-semibold text-[#0FBCCE]">₽{item.recommendation.toLocaleString()}</span></span>}
              </div>
              <div className="text-xs text-gray-400">{item.reason}</div>
            </div>
          )
        })}
      </div>
      <button onClick={analyze} className="flex items-center gap-2 justify-center w-full py-2 border border-gray-200 text-gray-500 rounded-xl text-xs hover:bg-gray-50">
        <RefreshCw className="w-3.5 h-3.5" />Обновить анализ
      </button>
    </div>
  )
}

// ─── Конфиг инструментов ──────────────────────────────────────────────────────

const TOOLS = [
  { id: 'import', icon: '🌐', name: 'Импорт каталога', desc: 'Парсит сайт бренда и загружает весь каталог за минуты', badge: null, soon: false, stats: '8 товаров импортировано' },
  { id: 'descriptions', icon: '✍️', name: 'Описания товаров', desc: 'Генерирует продающие тексты и SEO-теги для карточек', badge: null, soon: false, stats: null },
  { id: 'prices', icon: '📊', name: 'Анализ цен', desc: 'Мониторит конкурентов и советует оптимальную цену', badge: null, soon: false, stats: '2 алерта сегодня' },
  { id: 'returns', icon: '🎯', name: 'Прогноз возвратов', desc: 'Предсказывает вероятность возврата по каждому SKU', badge: 'Про', soon: false, stats: '1 риск выявлен' },
  { id: 'tryon', icon: '👗', name: 'Виртуальная примерка', desc: 'Покупатель примеряет товар онлайн — конверсия растёт, возвраты падают', badge: 'Про', soon: false, stats: '200 примерок/мес' },
  { id: 'trends', icon: '📡', name: 'Trend Radar', desc: 'Анализирует тренды по категориям — узнай хит до конкурентов', badge: null, soon: false, stats: 'Обновлено сегодня' },
  { id: 'bundles', icon: '🎁', name: 'Бандлы и образы', desc: 'Автоматически создаёт образы и наборы — средний чек +23%', badge: 'Скоро', soon: true, stats: null },
  { id: 'sizing', icon: '📐', name: 'Подбор размера', desc: 'Подбирает размер покупателю — главная причина возвратов', badge: 'Скоро', soon: true, stats: null },
  { id: 'photos', icon: '📸', name: 'Фотостудия', desc: 'Убирает фон, генерирует модельные снимки из одного фото', badge: 'Скоро', soon: true, stats: null },
]

const AI_ACTIVITY = [
  { action: 'Описания обновлены для 3 SKU', time: '09:14', impact: '+8% CTR прогноз', icon: '✍️', alert: false },
  { action: 'VF-089: риск возврата 24%', time: '08:30', impact: 'Требует внимания', icon: '🎯', alert: true },
  { action: 'Genuine Leather снизила цену на 12%', time: '08:15', impact: 'Рек: ₽21 500', icon: '📊', alert: true },
  { action: 'Тренды обновлены: Монохром +34%', time: '07:00', impact: 'Trend Radar', icon: '📡', alert: false },
]

// ─── Главная страница ─────────────────────────────────────────────────────────

export default function AICenterPage() {
  const [activeId, setActiveId] = useState<string | null>(null)

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold text-gray-900">ИИ-центр</h1>
        <p className="text-sm text-gray-500 mt-1"></p>
      </div>

      {/* Активность за день */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-gray-900">⚡ Сделано сегодня</span>
          <span className="text-xs text-gray-400">12 марта</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {AI_ACTIVITY.map((a, i) => (
            <div key={i} className={`flex items-center gap-2.5 p-2.5 rounded-xl ${a.alert ? 'bg-red-50 border border-red-100' : 'bg-gray-50'}`}>
              <span className="text-lg flex-shrink-0">{a.icon}</span>
              <div className="min-w-0">
                <div className="text-xs font-medium text-gray-700 truncate">{a.action}</div>
                <div className={`text-xs ${a.alert ? 'text-red-500' : 'text-gray-400'}`}>{a.impact} · {a.time}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Список */}
        <div className="col-span-1 space-y-1.5">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 mb-2">Сервисы</div>
          {TOOLS.map(tool => (
            <button key={tool.id}
              onClick={() => !tool.soon && setActiveId(activeId === tool.id ? null : tool.id)}
              className={`w-full flex items-center gap-2.5 p-3 rounded-2xl text-left transition-all border ${
                activeId === tool.id ? 'border-[#0FBCCE] bg-[#EBF9FB]' :
                tool.soon ? 'border-transparent bg-gray-50 opacity-50 cursor-default' :
                'border-transparent bg-white hover:border-gray-100 shadow-sm'
              }`}>
              <span className="text-lg flex-shrink-0">{tool.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-medium text-gray-900">{tool.name}</span>
                  {tool.badge && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${tool.badge === 'Скоро' ? 'bg-gray-100 text-gray-400' : 'bg-[#0FBCCE] text-white'}`}>
                      {tool.badge}
                    </span>
                  )}
                </div>
                {tool.stats && <div className="text-xs text-gray-400 mt-0.5">{tool.stats}</div>}
              </div>
              {!tool.soon && <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 ${activeId === tool.id ? 'text-[#0FBCCE]' : 'text-gray-300'}`} />}
            </button>
          ))}
        </div>

        {/* Правая панель */}
        <div className="col-span-2">
          {!activeId && (
            <div className="bg-white rounded-2xl border border-dashed border-gray-200 h-full min-h-64 flex items-center justify-center">
              <div className="text-center p-8">
                <div className="text-4xl mb-3">🤖</div>
                <div className="text-sm font-medium text-gray-600 mb-1">Выбери сервис слева</div>
                <div className="text-xs text-gray-400">AIMEE AI автоматизирует рутину</div>
              </div>
            </div>
          )}

          {activeId && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              {(() => {
                const tool = TOOLS.find(t => t.id === activeId)!
                return (
                  <>
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-xl">{tool.icon}</span>
                      <div>
                        <div className="text-sm font-semibold text-gray-900">{tool.name}</div>
                        <div className="text-xs text-gray-400">{tool.desc}</div>
                      </div>
                    </div>
                    {activeId === 'import' && <ImportTool />}
                    {activeId === 'descriptions' && <DescriptionsTool />}
                    {activeId === 'prices' && <PricesTool />}
                    {activeId === 'returns' && (
                      <div className="space-y-2">
                        {[
                          { sku: 'VF-089', name: 'Брюки wide leg', risk: 24, reason: 'Несоответствие размера', color: 'red' },
                          { sku: 'VF-108', name: 'Футболка базовая', risk: 11, reason: 'Качество ткани', color: 'amber' },
                          { sku: 'VF-441', name: 'Пальто oversize', risk: 5, reason: 'Низкий риск', color: 'green' },
                          { sku: 'VF-661', name: 'Свитер кашемир', risk: 8, reason: 'Низкий риск', color: 'green' },
                        ].map((item, i) => (
                          <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                            <div className="flex-1"><div className="text-xs font-semibold text-gray-800">{item.name} <span className="text-gray-400 font-normal">{item.sku}</span></div><div className="text-xs text-gray-400 mt-0.5">{item.reason}</div></div>
                            <div className={`text-sm font-bold px-2.5 py-1 rounded-lg ${item.color === 'red' ? 'bg-red-100 text-red-600' : item.color === 'amber' ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'}`}>{item.risk}%</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {activeId === 'tryon' && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-3 gap-3">
                          {[{ label: 'Примерок/мес', value: '200' }, { label: 'Конверсия', value: '+18%' }, { label: 'Возвраты', value: '−30%' }].map((s, i) => (
                            <div key={i} className="bg-[#F0F4FF] rounded-xl p-3 text-center"><div className="text-lg font-bold text-[#0FBCCE]">{s.value}</div><div className="text-xs text-gray-500 mt-0.5">{s.label}</div></div>
                          ))}
                        </div>
                        <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-500 text-center">Покупатель загружает фото → AIMEE AI накладывает товар → видит себя в образе</div>
                      </div>
                    )}
                    {activeId === 'trends' && (
                      <div className="space-y-2">
                        {[{ trend: 'Монохром', change: +34, cat: 'Одежда' }, { trend: 'Лён', change: +28, cat: 'Ткани' }, { trend: 'Oversize пальто', change: +21, cat: 'Верхняя одежда' }, { trend: 'Wide leg', change: +17, cat: 'Брюки' }, { trend: 'Мини-юбка', change: -8, cat: 'Юбки' }].map((t, i) => (
                          <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                            <div className="text-xs text-gray-400 w-4">{i + 1}</div>
                            <div className="flex-1"><div className="text-xs font-semibold text-gray-800">{t.trend}</div><div className="text-xs text-gray-400">{t.cat}</div></div>
                            <div className={`text-sm font-bold ${t.change > 0 ? 'text-green-600' : 'text-red-500'}`}>{t.change > 0 ? '+' : ''}{t.change}%</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
