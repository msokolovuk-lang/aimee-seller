'use client'

import { useState, useEffect } from 'react'
import { Loader2, RefreshCw, ChevronRight, Check } from 'lucide-react'
import { useSellerData } from '@/hooks/useSellerData'

interface Insight {
  title: string
  observation: string
  why: string
  action: string
  impact: string
  priority: 'high' | 'medium' | 'low'
}

interface Decision {
  question: string
  context: string
  optionA: string
  optionB: string
}

interface BriefingData {
  summary: string
  insights: Insight[]
  decision: Decision
}

const PRIORITY_COLORS = {
  high: 'border-red-100 bg-red-50/50',
  medium: 'border-amber-100 bg-amber-50/50',
  low: 'border-gray-100 bg-gray-50/30',
}

const PRIORITY_BADGE = {
  high: 'bg-red-100 text-red-600',
  medium: 'bg-amber-100 text-amber-600',
  low: 'bg-gray-100 text-gray-500',
}

const PRIORITY_LABEL = {
  high: 'Приоритет',
  medium: 'Важно',
  low: 'К сведению',
}

export default function BriefingPage() {
  const { stats, orders, activity, products } = useSellerData()
  const [data, setData] = useState<BriefingData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [decision, setDecision] = useState<'A' | 'B' | null>(null)
  const [time, setTime] = useState('')
  const [dataReady, setDataReady] = useState(false)

  useEffect(() => {
    setTime(new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }))
  }, [])

  // кеш брифинга на день
  useEffect(() => {
    const cacheKey = 'briefing_cache'
    const cached = localStorage.getItem(cacheKey)
    if (cached) {
      try {
        const { data: cachedData, date } = JSON.parse(cached)
        if (date === new Date().toDateString()) {
          setData(cachedData)
          return
        }
      } catch {}
    }
    // нет кеша — ждём данные и генерируем
    if (!dataReady && (orders.length > 0 || activity.length > 0 || products.length > 0)) {
      setDataReady(true)
      fetchBriefing()
    }
  }, [orders, activity, products])

  const fetchBriefing = async () => {
    setLoading(true)
    setError('')
    setDecision(null)
    localStorage.removeItem('briefing_cache')
    try {
      const brandName = typeof window !== 'undefined' ? localStorage.getItem('brand_name') || '' : ''
      const res = await fetch('/api/ai/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandName, stats, orders, activity: activity.slice(0, 50), products }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      setData(json.data)
      localStorage.setItem('briefing_cache', JSON.stringify({ data: json.data, date: new Date().toDateString() }))
    } catch (e) {
      setError('Не удалось загрузить брифинг. Попробуйте обновить.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">AI Брифинг</h1>
          <p className="text-sm text-gray-500 mt-1">{time}</p>
        </div>
        <button onClick={fetchBriefing} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Обновить
        </button>
      </div>

      {loading && (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
          <Loader2 className="w-8 h-8 text-[#0FBCCE] animate-spin mx-auto mb-3" />
          <div className="text-sm text-gray-500">AIMEE AI анализирует данные бренда...</div>
          <div className="text-xs text-gray-400 mt-2">
            {stats.ordersTotal} заказов · {stats.viewsTotal} просмотров · {products.length} товаров
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 rounded-2xl border border-red-100 p-5 text-sm text-red-600">{error}</div>
      )}

      {!loading && !data && !error && (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
          <Loader2 className="w-8 h-8 text-[#0FBCCE] animate-spin mx-auto mb-3" />
          <div className="text-sm text-gray-500">Загружаем данные бренда...</div>
        </div>
      )}

      {data && !loading && (
        <div className="space-y-4">
          {/* Резюме */}
          <div className="bg-gradient-to-br from-[#EBF9FB] to-white rounded-2xl border border-[#0FBCCE]/20 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">💡</span>
              <span className="text-sm font-semibold text-gray-700">Резюме дня</span>
              <span className="ml-auto text-xs text-gray-400">на основе реальных данных</span>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">{data.summary}</p>
          </div>

          {/* Инсайты */}
          <div className="space-y-3">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">Инсайты</div>
            {data.insights.map((insight, i) => (
              <div key={i} className={`rounded-2xl border p-5 ${PRIORITY_COLORS[insight.priority]}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_BADGE[insight.priority]}`}>
                    {PRIORITY_LABEL[insight.priority]}
                  </span>
                  <span className="text-sm font-semibold text-gray-900">{insight.title}</span>
                </div>
                <p className="text-sm text-gray-700 mb-1">{insight.observation}</p>
                <p className="text-xs text-gray-500 mb-3">{insight.why}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 bg-white/70 px-2 py-1 rounded-lg">Эффект: {insight.impact}</span>
                  <button className="flex items-center gap-1 text-xs font-medium text-[#0FBCCE] hover:underline">
                    {insight.action} <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Решение дня */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">⚖️</span>
              <span className="text-sm font-semibold text-gray-700">Решение дня</span>
            </div>
            <p className="text-sm font-medium text-gray-900 mb-1">{data.decision.question}</p>
            <p className="text-xs text-gray-500 mb-4">{data.decision.context}</p>
            {decision ? (
              <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 rounded-xl px-4 py-3">
                <Check className="w-4 h-4" />
                Решение зафиксировано: {decision === 'A' ? data.decision.optionA : data.decision.optionB}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setDecision('A')}
                  className="px-4 py-3 bg-[#0FBCCE] text-white rounded-xl text-sm font-medium hover:bg-[#0da8b8] transition-colors">
                  {data.decision.optionA}
                </button>
                <button onClick={() => setDecision('B')}
                  className="px-4 py-3 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
                  {data.decision.optionB}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
