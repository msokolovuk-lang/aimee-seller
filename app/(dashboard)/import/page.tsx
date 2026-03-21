'use client'

import { useState } from 'react'
import { Sparkles, Link, Upload, CheckCircle, AlertCircle, Loader2, Plus, Trash2 } from 'lucide-react'

interface Product {
  name: string
  price: number
  currency: string
  category: string
  description: string
  sizes: string[]
  colors: string[]
  image_emoji: string
  selected?: boolean
}

interface ParseResult {
  brand_name: string
  brand_description: string
  products: Product[]
}

type Step = 'input' | 'parsing' | 'review' | 'done'

export default function ImportPage() {
  const [step, setStep] = useState<Step>('input')
  const [url, setUrl] = useState('')
  const [limit, setLimit] = useState(5)
  const [result, setResult] = useState<ParseResult | null>(null)
  const [error, setError] = useState('')
  const [log, setLog] = useState<string[]>([])

  const addLog = (msg: string) => setLog(prev => [...prev, msg])

  const handleParse = async () => {
    if (!url.trim()) return
    setStep('parsing')
    setError('')
    setLog([])

    addLog('Подключаюсь к сайту бренда...')
    await new Promise(r => setTimeout(r, 800))
    addLog(`Анализирую: ${url}`)
    await new Promise(r => setTimeout(r, 600))
    addLog(`AI сканирует каталог товаров (лимит: ${limit} SKU)...`)

    try {
      const res = await fetch('/api/ai/parse-site', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, limit }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Ошибка парсинга')
      }

      addLog(`Найдено товаров: ${data.data.products.length}`)
      addLog('Формирую каталог...')
      await new Promise(r => setTimeout(r, 400))

      const products = data.data.products.map((p: Product) => ({ ...p, selected: true }))
      setResult({ ...data.data, products })
      setStep('review')
    } catch (err) {
      setError(String(err))
      setStep('input')
    }
  }

  const toggleProduct = (index: number) => {
    if (!result) return
    const products = [...result.products]
    products[index] = { ...products[index], selected: !products[index].selected }
    setResult({ ...result, products })
  }

  const selectedCount = result?.products.filter(p => p.selected).length ?? 0

  const handleConfirm = () => {
    setStep('done')
  }

  const handleReset = () => {
    setStep('input')
    setUrl('')
    setResult(null)
    setError('')
    setLog([])
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">AI Импорт</h1>
        <p className="text-sm text-gray-500 mt-1">Вставь URL сайта бренда — AI извлечёт каталог за минуты</p>
      </div>

      {/* Шаги */}
      <div className="flex items-center gap-2 mb-8">
        {(['input', 'parsing', 'review', 'done'] as Step[]).map((s, i) => {
          const labels = ['URL', 'Парсинг', 'Проверка', 'Готово']
          const active = step === s
          const done = ['input', 'parsing', 'review', 'done'].indexOf(step) > i
          return (
            <div key={s} className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                active ? 'bg-[#0FBCCE] text-white' :
                done ? 'bg-green-100 text-green-700' :
                'bg-gray-100 text-gray-400'
              }`}>
                {done ? <CheckCircle className="w-3.5 h-3.5" /> : <span>{i + 1}</span>}
                {labels[i]}
              </div>
              {i < 3 && <div className="w-6 h-px bg-gray-200" />}
            </div>
          )
        })}
      </div>

      {/* Шаг 1: Ввод URL */}
      {step === 'input' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Link className="w-5 h-5 text-[#0FBCCE]" />
              <span className="font-medium text-gray-900">Сайт бренда</span>
            </div>
            <div className="flex gap-3">
              <input
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleParse()}
                placeholder="https://varvara-fashion.com"
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0FBCCE] focus:border-transparent"
              />
              <select
                value={limit}
                onChange={e => setLimit(Number(e.target.value))}
                className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0FBCCE] bg-white"
              >
                <option value={5}>5 SKU</option>
                <option value={10}>10 SKU</option>
                <option value={20}>20 SKU</option>
              </select>
              <button
                onClick={handleParse}
                disabled={!url.trim()}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#0FBCCE] text-white rounded-xl text-sm font-medium hover:bg-[#0da8b8] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                Запустить AI
              </button>
            </div>
            {error && (
              <div className="mt-3 flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm opacity-50">
            <div className="flex items-center gap-2 mb-2">
              <Upload className="w-5 h-5 text-gray-400" />
              <span className="font-medium text-gray-500">CSV загрузка</span>
              <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">скоро</span>
            </div>
            <p className="text-sm text-gray-400">Загрузи готовый CSV с товарами</p>
          </div>
        </div>
      )}

      {/* Шаг 2: Парсинг */}
      {step === 'parsing' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
          <div className="flex flex-col items-center gap-4">
            <div className="w-14 h-14 bg-[#EBF9FB] rounded-full flex items-center justify-center">
              <Loader2 className="w-7 h-7 text-[#0FBCCE] animate-spin" />
            </div>
            <div className="text-center">
              <p className="font-medium text-gray-900">AI анализирует сайт</p>
              <p className="text-sm text-gray-500 mt-1">{url}</p>
            </div>
            <div className="w-full max-w-md bg-gray-50 rounded-xl p-4 font-mono text-xs text-gray-600 space-y-1.5">
              {log.map((line, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[#0FBCCE]">›</span>
                  {line}
                </div>
              ))}
              <div className="flex items-center gap-2">
                <span className="text-[#0FBCCE]">›</span>
                <span className="animate-pulse">_</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Шаг 3: Проверка */}
      {step === 'review' && result && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-900">{result.brand_name}</h2>
                <p className="text-sm text-gray-500 mt-0.5">{result.brand_description}</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-[#0FBCCE]">{result.products.length}</div>
                <div className="text-xs text-gray-500">товаров найдено</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-50">
              <span className="text-sm font-medium text-gray-700">Выбрано: {selectedCount} из {result.products.length}</span>
              <button
                onClick={() => {
                  const allSelected = result.products.every(p => p.selected)
                  setResult({
                    ...result,
                    products: result.products.map(p => ({ ...p, selected: !allSelected }))
                  })
                }}
                className="text-xs text-[#0FBCCE] hover:underline"
              >
                {result.products.every(p => p.selected) ? 'Снять все' : 'Выбрать все'}
              </button>
            </div>
            <div className="divide-y divide-gray-50">
              {result.products.map((product, i) => (
                <div
                  key={i}
                  onClick={() => toggleProduct(i)}
                  className={`flex items-center gap-4 px-5 py-3.5 cursor-pointer hover:bg-gray-50 transition-colors ${!product.selected ? 'opacity-40' : ''}`}
                >
                  <div className="w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors"
                    style={{ borderColor: product.selected ? '#0FBCCE' : '#D1D5DB', backgroundColor: product.selected ? '#0FBCCE' : 'transparent' }}>
                    {product.selected && <CheckCircle className="w-3 h-3 text-white" />}
                  </div>
                  <div className="text-2xl">{product.image_emoji}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-gray-900 truncate">{product.name}</div>
                    <div className="text-xs text-gray-500">{product.category} · {product.sizes?.join(', ')}</div>
                  </div>
                  <div className="text-sm font-semibold text-gray-900">
                    ₽{product.price.toLocaleString('ru-RU')}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Начать заново
            </button>
            <button
              onClick={handleConfirm}
              disabled={selectedCount === 0}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 bg-[#0FBCCE] text-white rounded-xl text-sm font-medium hover:bg-[#0da8b8] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Plus className="w-4 h-4" />
              Добавить {selectedCount} товаров в каталог
            </button>
          </div>
        </div>
      )}

      {/* Шаг 4: Готово */}
      {step === 'done' && result && (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 shadow-sm text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-1">Импорт завершён</h2>
          <p className="text-gray-500 text-sm mb-6">{selectedCount} товаров добавлено в каталог</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleReset}
              className="px-5 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition-colors"
            >
              Импортировать ещё
            </button>
            <a
              href="/catalog"
              className="px-5 py-2.5 bg-[#0FBCCE] text-white rounded-xl text-sm font-medium hover:bg-[#0da8b8] transition-colors"
            >
              Перейти в каталог
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
