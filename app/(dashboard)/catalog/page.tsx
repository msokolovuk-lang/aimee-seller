'use client'

import { useState, useEffect } from 'react'
import { Search, Plus, Eye, EyeOff, Package, Globe, PenLine, Link2, Zap, X, Check, RefreshCw, Image as ImageIcon, AlertCircle, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Product {
  id: string
  sku: string | null
  name: string
  category: string | null
  price: number
  images: string[] | null
  gallery_images: string[] | null
  is_active: boolean
  description: string | null
  sizes: string[] | null
  colors: string[] | null
  source_url: string | null
  product_url: string | null
  seller_id: string | null
}

type ImportMethod = 'moysklad' | 'wb' | 'excel' | 'site' | 'manual' | null

const IMPORT_STAGES = [
  'Загружаем страницу сайта...',
  'Рендерим JavaScript...',
  'AI анализирует каталог...',
  'Извлекаем карточки товаров...',
  'Загружаем фотографии...',
  'Сохраняем в базу данных...',
]

function ImportProgress({ stage }: { stage: number }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{IMPORT_STAGES[Math.min(stage, IMPORT_STAGES.length - 1)]}</span>
        <span>{Math.round((stage / IMPORT_STAGES.length) * 100)}%</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-1.5">
        <div
          className="bg-[#0FBCCE] h-1.5 rounded-full transition-all duration-500"
          style={{ width: `${(stage / IMPORT_STAGES.length) * 100}%` }}
        />
      </div>
      <div className="text-xs text-gray-400 text-center">30–60 секунд</div>
    </div>
  )
}

interface ImportModalProps {
  onClose: () => void
  onImported: (products: Product[]) => void
}

function ImportModal({ onClose, onImported }: ImportModalProps) {
  const [method, setMethod] = useState<ImportMethod>(null)
  const [token, setToken] = useState('')
  const [site, setSite] = useState('')
  const [loading, setLoading] = useState(false)
  const [stage, setStage] = useState(0)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [importWarnings, setImportWarnings] = useState<{no_price?:string|null, no_images?:string|null} | null>(null)
  const [count, setCount] = useState(0)

  const handleExcelFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true); setError('')
    const stageInterval = setInterval(() => setStage(prev => prev < IMPORT_STAGES.length - 1 ? prev + 1 : prev), 2000)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('seller_id', typeof window !== 'undefined' ? localStorage.getItem('seller_id') || 'catalog' : 'catalog')
      const res = await fetch('/api/excel-import', { method: 'POST', body: formData })
      const data = await res.json()
      clearInterval(stageInterval)
      if (!res.ok || data.error) { setError(data.error || 'Ошибка'); return }
      setStage(IMPORT_STAGES.length); setCount(data.saved || 0); setDone(true)
      onImported(data.products || [])
      setTimeout(onClose, 2000)
    } catch { clearInterval(stageInterval); setError('Ошибка загрузки') }
    finally { setLoading(false) }
  }

  const handleImport = async () => {
    if (!method) return
    setLoading(true)
    setError('')

    if (method === 'wb') {
      if (!site) { setLoading(false); return }
      const stageInterval = setInterval(() => setStage(prev => prev < IMPORT_STAGES.length - 1 ? prev + 1 : prev), 5000)
      try {
        const sellerId = typeof window !== 'undefined' ? localStorage.getItem('seller_id') || 'catalog' : 'catalog'
        const res = await fetch('/api/wb-import', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ wb_token: site, seller_id: sellerId }),
        })
        const data = await res.json()
        clearInterval(stageInterval)
        if (!res.ok || data.error) { setError(data.error || 'Ошибка WB API'); setLoading(false); return }
        setStage(IMPORT_STAGES.length); setCount(data.saved || 0); setDone(true); if (data.warnings) setImportWarnings(data.warnings)
        onImported(data.products || [])
        setTimeout(onClose, 2000)
      } catch { clearInterval(stageInterval); setError('Ошибка соединения') }
      finally { setLoading(false) }
      return
    }

    if (method === 'moysklad' || method === 'manual') {
      // Simulate for now
      for (let i = 0; i <= IMPORT_STAGES.length; i++) {
        await new Promise(r => setTimeout(r, 350))
        setStage(i)
      }
      setDone(true)
      setLoading(false)
      setTimeout(onClose, 1500)
      return
    }

    if (method === 'site') {
      if (!site) return

      // Animate stages while API runs
      const interval = setInterval(() => {
        setStage(prev => prev < IMPORT_STAGES.length - 1 ? prev + 1 : prev)
      }, 8000)

      try {
        const sellerId = typeof window !== 'undefined'
          ? localStorage.getItem('seller_id') || 'catalog'
          : 'catalog'

        const res = await fetch('/api/ai-import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: site, seller_id: sellerId }),
        })

        clearInterval(interval)
        const data = await res.json()

        if (!res.ok || data.error) {
          setError(data.error || 'Не удалось импортировать')
          setLoading(false)
          return
        }

        setStage(IMPORT_STAGES.length)
        setCount(data.saved || 0)
        setDone(true)
        if (data.warnings) setImportWarnings(data.warnings)

        // Convert to Product format and notify parent
        const newProducts: Product[] = (data.products || []).map((p: any) => ({
          id: p.id,
          sku: p.article || null,
          name: p.name,
          category: p.category || null,
          price: p.price || 0,
          images: p.images || null,
          is_active: true,
          description: p.description || null,
          sizes: p.sizes || null,
          colors: p.colors || null,
          source_url: site,
          seller_id: sellerId,
        }))

        onImported(newProducts)
        setTimeout(onClose, 2000)
      } catch (e) {
        clearInterval(interval)
        setError('Ошибка соединения')
        setLoading(false)
      }
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 pb-4">
          <div className="text-base font-semibold text-gray-900">Добавить товары</div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500" disabled={loading}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pb-6 space-y-3">
          {!done && (
            <>
              {[
                { key: 'moysklad' as const, icon: <Package className="w-5 h-5" />, title: 'МойСклад', sub: 'Синхронизация остатков и цен в реальном времени', badge: 'Рекомендуем' },
                { key: 'wb' as const, icon: <Globe className="w-5 h-5" />, title: 'Wildberries API', sub: 'Вставь токен WB — товары подгрузятся автоматически', badge: 'DEMO' },
                { key: 'excel' as const, icon: <Package className="w-5 h-5" />, title: 'Excel / CSV', sub: 'Выгрузи каталог из WB и загрузи файл', badge: 'Быстро' },
                { key: 'site' as const, icon: <Globe className="w-5 h-5" />, title: 'AI Импорт с сайта', sub: 'AIMEE AI парсит товары с сайта автоматически', badge: 'DEMO' },
                { key: 'manual' as const, icon: <PenLine className="w-5 h-5" />, title: 'Добавить вручную', sub: 'Заполни карточку товара самостоятельно', badge: null },
              ].map(opt => (
                <button key={opt.key} onClick={() => { setMethod(opt.key); setError('') }}
                  disabled={loading}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 text-left transition-all ${method === opt.key ? 'border-[#0FBCCE] bg-[#EBF9FB]' : 'border-gray-100 hover:border-gray-200'} disabled:opacity-50`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${method === opt.key ? 'bg-[#0FBCCE] text-white' : 'bg-gray-100 text-gray-500'}`}>
                    {opt.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">{opt.title}</span>
                      {opt.badge && <span className="text-xs px-1.5 py-0.5 bg-[#0FBCCE] text-white rounded-full">{opt.badge}</span>}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">{opt.sub}</div>
                  </div>
                  {method === opt.key && <Check className="w-4 h-4 text-[#0FBCCE] flex-shrink-0" />}
                </button>
              ))}

              {method === 'moysklad' && (
                <div className="pt-1 space-y-2">
                  <input type="text" value={token} onChange={e => setToken(e.target.value)}
                    placeholder="Токен МойСклад" disabled={loading}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#0FBCCE] disabled:opacity-50" />
                  <div className="text-xs text-gray-400">Настройки → Безопасность → Токен</div>
                  {loading ? <ImportProgress stage={stage} /> : (
                    <button onClick={handleImport} disabled={!token}
                      className="w-full py-2.5 bg-[#0FBCCE] text-white rounded-xl text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-2">
                      <Link2 className="w-4 h-4" />Подключить
                    </button>
                  )}
                </div>
              )}

              {method === 'wb' && (
                <div className="pt-1 space-y-2">
                  <div className="text-xs text-gray-400">ЛК WB → Профиль → Интеграции по API → Создать токен</div>
                  <input type="text" value={site} onChange={e => setSite(e.target.value)}
                    placeholder="Вставь токен Wildberries" disabled={loading}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#0FBCCE] disabled:opacity-50" />
                  {loading ? <ImportProgress stage={stage} /> : (
                    <>
                      <button onClick={handleImport} disabled={!site}
                        className="w-full py-2.5 bg-[#0FBCCE] text-white rounded-xl text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-2">
                        <Zap className="w-4 h-4" />Загрузить товары из WB
                      </button>
                      {error && <div className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{error}</div>}
                      {importWarnings && (
                        <div className="mt-2 space-y-1">
                          {importWarnings.no_price && <div className="text-xs text-amber-600 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />⚠ {importWarnings.no_price}</div>}
                          {importWarnings.no_images && <div className="text-xs text-amber-600 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />⚠ {importWarnings.no_images}</div>}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {method === 'excel' && (
                <div className="pt-1 space-y-2">
                  <div className="text-xs text-gray-400">Товары → Карточки товаров → Экспорт → CSV</div>
                  {loading ? <ImportProgress stage={stage} /> : (
                    <>
                      <label className="w-full py-2.5 bg-[#0FBCCE] text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 cursor-pointer hover:bg-[#0da8b8]">
                        <input type="file" accept=".csv,.xlsx,.xls" onChange={handleExcelFile} className="hidden" />
                        📂 Выбрать файл CSV / Excel
                      </label>
                      {error && <div className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{error}</div>}
                    </>
                  )}
                </div>
              )}

              {method === 'site' && (
                <div className="pt-1 space-y-2">
                  <input type="text" value={site} onChange={e => setSite(e.target.value)}
                    placeholder="https://your-brand.ru/catalog" disabled={loading}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#0FBCCE] disabled:opacity-50" />
                  {loading ? <ImportProgress stage={stage} /> : (
                    <>
                      <button onClick={handleImport} disabled={!site}
                        className="w-full py-2.5 bg-[#0FBCCE] text-white rounded-xl text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-2">
                        <Zap className="w-4 h-4" />Запустить импорт
                      </button>
                      {error && (
                        <div className="flex items-center gap-2 text-xs text-red-500">
                          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{error}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {method === 'manual' && !loading && (
                <button onClick={handleImport}
                  className="w-full py-2.5 bg-[#0FBCCE] text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2">
                  <PenLine className="w-4 h-4" />Создать карточку
                </button>
              )}
            </>
          )}

          {done && (
            <div className="flex items-center gap-3 p-3.5 bg-green-50 rounded-2xl border border-green-100">
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                <Check className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="text-sm font-semibold text-green-800">
                  {count > 0 ? `Импортировано ${count} товаров` : 'Готово!'}
                </div>
                <div className="text-xs text-green-600">Каталог обновлён</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


// ── Product Modal with Gallery ────────────────────────────────────
function ProductModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const [images, setImages] = useState<string[]>(product.gallery_images || product.images || [])
  const [loading, setLoading] = useState(false)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [imgError, setImgError] = useState<Record<number, boolean>>({})

  useEffect(() => {
    // Load gallery if not cached and product_url exists
    if (!product.gallery_images?.length && product.product_url) {
      setLoading(true)
      fetch('/api/fetch-product-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: product.id, product_url: product.product_url }),
      })
        .then(r => r.json())
        .then(data => {
          if (data.images?.length) {
            setImages(data.images)
          }
        })
        .catch(console.error)
        .finally(() => setLoading(false))
    }
  }, [product.id, product.product_url])

  const prev = () => setCurrentIdx(i => (i - 1 + images.length) % images.length)
  const next = () => setCurrentIdx(i => (i + 1) % images.length)

  // Close on backdrop click
  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [images.length])

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={handleBackdrop}
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col md:flex-row">
        {/* Image gallery */}
        <div className="relative bg-gray-50 md:w-1/2 flex-shrink-0">
          {/* Main image */}
          <div className="aspect-square flex items-center justify-center relative overflow-hidden">
            {loading && !images.length ? (
              <div className="flex flex-col items-center gap-2 text-gray-400">
                <Loader2 className="w-8 h-8 animate-spin text-[#0FBCCE]" />
                <span className="text-xs">Загружаем фото...</span>
              </div>
            ) : images.length > 0 && !imgError[currentIdx] ? (
              <img
                src={images[currentIdx]}
                alt={product.name}
                className="w-full h-full object-cover"
                onError={() => setImgError(prev => ({ ...prev, [currentIdx]: true }))}
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-gray-300">
                <ImageIcon className="w-12 h-12" />
                <span className="text-xs">Нет фото</span>
              </div>
            )}

            {/* Navigation arrows */}
            {images.length > 1 && (
              <>
                <button
                  onClick={prev}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center shadow-md hover:bg-white transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 text-gray-700" />
                </button>
                <button
                  onClick={next}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center shadow-md hover:bg-white transition-colors"
                >
                  <ChevronRight className="w-4 h-4 text-gray-700" />
                </button>
              </>
            )}

            {/* Loading indicator overlay */}
            {loading && images.length > 0 && (
              <div className="absolute bottom-2 right-2">
                <Loader2 className="w-4 h-4 animate-spin text-[#0FBCCE]" />
              </div>
            )}
          </div>

          {/* Thumbnails */}
          {images.length > 1 && (
            <div className="flex gap-1.5 p-3 overflow-x-auto">
              {images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentIdx(i)}
                  className={`flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${currentIdx === i ? 'border-[#0FBCCE]' : 'border-transparent opacity-60 hover:opacity-100'}`}
                >
                  {!imgError[i] ? (
                    <img src={img} alt="" className="w-full h-full object-cover"
                      onError={() => setImgError(prev => ({ ...prev, [i]: true }))} />
                  ) : (
                    <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                      <ImageIcon className="w-4 h-4 text-gray-300" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Counter */}
          {images.length > 1 && (
            <div className="absolute top-3 left-3 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
              {currentIdx + 1} / {images.length}
            </div>
          )}
        </div>

        {/* Product info */}
        <div className="flex-1 p-6 overflow-y-auto flex flex-col">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900 leading-tight">{product.name}</h2>
              <div className="text-sm text-gray-400 mt-1">
                {product.sku && <span>{product.sku} · </span>}
                {product.category}
              </div>
            </div>
            <button onClick={onClose} className="text-gray-300 hover:text-gray-500 flex-shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="text-2xl font-bold text-gray-900 mb-4">
            ₽{product.price?.toLocaleString('ru-RU')}
          </div>

          {product.description && (
            <p className="text-sm text-gray-500 leading-relaxed mb-4">{product.description}</p>
          )}

          {product.sizes && product.sizes.length > 0 && (
            <div className="mb-4">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Размеры</div>
              <div className="flex flex-wrap gap-2">
                {product.sizes.map(s => (
                  <span key={s} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-700 hover:border-[#0FBCCE] cursor-pointer transition-colors">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {product.colors && product.colors.length > 0 && (
            <div className="mb-4">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Цвета</div>
              <div className="flex flex-wrap gap-2">
                {product.colors.map(c => (
                  <span key={c} className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">{c}</span>
                ))}
              </div>
            </div>
          )}

          {product.source_url && (
            <div className="mt-auto pt-4 border-t border-gray-100">
              <a
                href={product.product_url || product.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#0FBCCE] hover:underline"
              >
                Открыть на сайте бренда →
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ProductCard({ product, onToggle }: { product: Product; onToggle: (id: string) => void }) {
  const hasImage = product.images && product.images.length > 0
  const [imgError, setImgError] = useState(false)

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${product.is_active ? 'border-gray-100' : 'border-gray-100 opacity-60'}`}>
      {/* Image */}
      <div className={`h-40 flex items-center justify-center relative ${product.is_active ? 'bg-[#F0F4FF]' : 'bg-gray-50'}`}>
        {hasImage && !imgError ? (
          <img
            src={product.images![0]}
            alt={product.name}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex flex-col items-center gap-1 text-gray-300">
            <ImageIcon className="w-8 h-8" />
            <span className="text-xs">Нет фото</span>
          </div>
        )}
        {product.source_url && (
          <span className="absolute top-2 right-2 text-xs px-1.5 py-0.5 bg-[#0FBCCE] text-white rounded-md font-medium">AI ✓</span>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="font-medium text-sm text-gray-900 leading-tight line-clamp-2">{product.name}</div>
          <button onClick={() => onToggle(product.id)} className="flex-shrink-0 text-gray-300 hover:text-gray-500">
            {product.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
        </div>

        <div className="text-xs text-gray-400 mb-2">
          {product.sku && <span>{product.sku} · </span>}
          {product.category || 'Без категории'}
        </div>

        {product.description && (
          <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 mb-2">{product.description}</p>
        )}

        {product.sizes && product.sizes.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {product.sizes.slice(0, 4).map(s => (
              <span key={s} className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">{s}</span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-900">₽{product.price.toLocaleString('ru-RU')}</span>
          {!product.is_active && (
            <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded-md">архив</span>
          )}
        </div>
      </div>
    </div>
  )
}

export default function CatalogPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'archive'>('all')
  const [showImport, setShowImport] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [categories, setCategories] = useState<string[]>(['Все'])
  const [category, setCategory] = useState('Все')

  const loadProducts = async () => {
    setLoading(true)
    try {
      const currentSellerId = typeof window !== 'undefined' ? localStorage.getItem('seller_id') : null
      if (!currentSellerId) { setProducts([]); setLoading(false); return }
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('seller_id', currentSellerId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Supabase error:', error)
        setProducts([])
      } else {
        setProducts(data || [])
        // Extract unique categories
        const cats = ['Все', ...Array.from(new Set((data || []).map((p: Product) => p.category).filter(Boolean))) as string[]]
        setCategories(cats)
      }
    } catch (e) {
      console.error('Load error:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProducts()
  }, [])

  const handleToggle = async (id: string) => {
    const product = products.find(p => p.id === id)
    if (!product) return

    // Optimistic update
    setProducts(prev => prev.map(p => p.id === id ? { ...p, is_active: !p.is_active } : p))

    await supabase
      .from('products')
      .update({ is_active: !product.is_active })
      .eq('id', id)
  }

  const handleImported = (newProducts: Product[]) => {
    setProducts(prev => [...newProducts, ...prev])
    const newCats = Array.from(new Set([...categories, ...newProducts.map(p => p.category).filter(Boolean) as string[]]))
    setCategories(newCats)
  }

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku || '').toLowerCase().includes(search.toLowerCase())
    const matchCat = category === 'Все' || p.category === category
    const matchFilter = filter === 'all' || (filter === 'active' ? p.is_active : !p.is_active)
    return matchSearch && matchCat && matchFilter
  })

  const activeCount = products.filter(p => p.is_active).length
  const brandName = typeof window !== 'undefined' ? localStorage.getItem('brand_name') || '' : ''

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {selectedProduct && (
        <ProductModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />
      )}
      {showImport && (
        <ImportModal
          onClose={() => { setShowImport(false); loadProducts() }}
          onImported={handleImported}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Каталог</h1>
          <p className="text-sm text-gray-500 mt-1">
            {brandName ? brandName + " · " : ""}{activeCount} активных товаров
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadProducts} disabled={loading}
            className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-40">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#0FBCCE] text-white rounded-xl text-sm font-medium hover:bg-[#0da8b8] transition-colors">
            <Plus className="w-4 h-4" />
            Добавить товар
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по названию или артикулу..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-gray-100 rounded-xl text-sm focus:outline-none focus:border-[#0FBCCE] shadow-sm" />
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {(['all', 'active', 'archive'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
              {f === 'all' ? 'Все' : f === 'active' ? 'Активные' : 'Архив'}
            </button>
          ))}
        </div>
      </div>

      {categories.length > 1 && (
        <div className="flex gap-2 mb-5 flex-wrap">
          {categories.map(cat => (
            <button key={cat} onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${category === cat ? 'bg-[#0FBCCE] text-white' : 'bg-white border border-gray-100 text-gray-600 hover:bg-gray-50'}`}>
              {cat}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4,5,6,7,8].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-pulse">
              <div className="h-40 bg-gray-100" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-gray-100 rounded w-3/4" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
                <div className="h-4 bg-gray-100 rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center">
          <div className="text-4xl mb-4">📦</div>
          <div className="text-sm font-medium text-gray-500 mb-2">
            {products.length === 0 ? 'Каталог пуст' : 'Ничего не найдено'}
          </div>
          <div className="text-xs text-gray-400 mb-4">
            {products.length === 0 ? 'Добавь товары через импорт или вручную' : 'Попробуй изменить фильтр или поиск'}
          </div>
          {products.length === 0 && (
            <button onClick={() => setShowImport(true)}
              className="px-4 py-2 bg-[#0FBCCE] text-white rounded-xl text-sm font-medium hover:bg-[#0da8b8]">
              Добавить товары
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-4">
          {filtered.map(p => (
            <div key={p.id} onClick={() => setSelectedProduct(p)} className="cursor-pointer">
            <ProductCard product={p} onToggle={handleToggle} />
          </div>
          ))}
        </div>
      )}
    </div>
  )
}
