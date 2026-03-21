'use client'

import { useState, useEffect } from 'react'
import { useSellerData } from '@/hooks/useSellerData'
import { RefreshCw, Link2, Link2Off, Search, AlertTriangle, TrendingUp, TrendingDown, Plus, Pencil, Trash2, X, Check, Save } from 'lucide-react'
import React from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ── A2A Live Dialog ───────────────────────────────────────────────
const A2A_DIALOGS = [
  [
    { from: 'buyer', text: 'Пальто — последний S, дайте скидку?' },
    { from: 'agent', text: 'Для тебя — 9%. Финальная цена ₽22 700 🤝' },
    { from: 'buyer', text: 'Отлично, беру! ✅' },
  ],
  [
    { from: 'buyer', text: 'Есть скидка если возьму 2 куртки?' },
    { from: 'agent', text: '2 штуки — минус 11%. Итого ₽53 200.' },
    { from: 'buyer', text: 'Беру обе 🙌' },
    { from: 'agent', text: 'Заказ оформлен, доставим за 2 дня 🚀' },
  ],
]

function LiveDialog() {
  const [dialogIdx, setDialogIdx] = React.useState(0)
  const [visibleCount, setVisibleCount] = React.useState(0)
  React.useEffect(() => {
    const dialog = A2A_DIALOGS[dialogIdx]
    if (visibleCount >= dialog.length) {
      const t = setTimeout(() => { setDialogIdx(i => (i + 1) % A2A_DIALOGS.length); setVisibleCount(0) }, 2500)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => setVisibleCount(v => v + 1), visibleCount === 0 ? 300 : 1100)
    return () => clearTimeout(t)
  }, [visibleCount, dialogIdx])
  const dialog = A2A_DIALOGS[dialogIdx]
  return (
    <div className="space-y-1.5 min-h-[60px]">
      {dialog.slice(0, visibleCount).map((msg, i) => (
        <div key={`${dialogIdx}-${i}`} className={`flex ${msg.from === 'buyer' ? 'justify-start' : 'justify-end'}`}>
          <div className={`max-w-[85%] px-2.5 py-1.5 rounded-xl text-xs leading-relaxed ${msg.from === 'buyer' ? 'bg-gray-100 text-gray-700' : 'bg-[#0FBCCE] text-white'}`}>
            {msg.from === 'agent' && <span className="text-white/60 text-[9px] block mb-0.5">AIMEE агент</span>}
            {msg.text}
          </div>
        </div>
      ))}
      {visibleCount < dialog.length && (
        <div className="flex justify-end">
          <div className="bg-[#0FBCCE]/20 px-2.5 py-1.5 rounded-xl flex gap-1">
            {[0,150,300].map(d => <span key={d} className="w-1.5 h-1.5 bg-[#0FBCCE] rounded-full animate-bounce" style={{animationDelay:`${d}ms`}} />)}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Types ─────────────────────────────────────────────────────────
interface SupabaseProduct {
  id: string
  sku: string | null
  name: string
  category: string | null
  price: number
  stock: number
  return_rate: number
  images: string[] | null
  is_active: boolean
  description: string | null
  sizes: string[] | null
  colors: string[] | null
  source_url: string | null
}

interface EditForm {
  name: string
  sku: string
  category: string
  price: string
  stock: string
  return_rate: string
  description: string
  sizes: string
  colors: string
}

const EMPTY_FORM: EditForm = {
  name: '', sku: '', category: '', price: '', stock: '0',
  return_rate: '0', description: '', sizes: '', colors: '',
}

// ── Edit / Add Panel ──────────────────────────────────────────────
function EditPanel({
  product,
  onClose,
  onSaved,
}: {
  product: SupabaseProduct | null // null = new product
  onClose: () => void
  onSaved: (p: SupabaseProduct) => void
}) {
  const isNew = !product
  const [form, setForm] = useState<EditForm>(
    product ? {
      name: product.name,
      sku: product.sku || '',
      category: product.category || '',
      price: product.price?.toString() || '',
      stock: product.stock?.toString() || '0',
      return_rate: product.return_rate?.toString() || '0',
      description: product.description || '',
      sizes: (product.sizes || []).join(', '),
      colors: (product.colors || []).join(', '),
    } : EMPTY_FORM
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k: keyof EditForm, v: string) => setForm(prev => ({ ...prev, [k]: v }))

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Название обязательно'); return }
    setSaving(true); setError('')
    try {
      const payload = {
        name: form.name.trim(),
        sku: form.sku.trim() || null,
        category: form.category.trim() || null,
        price: parseFloat(form.price) || 0,
        stock: parseInt(form.stock) || 0,
        return_rate: parseFloat(form.return_rate) || 0,
        description: form.description.trim() || null,
        sizes: form.sizes ? form.sizes.split(',').map(s => s.trim()).filter(Boolean) : [],
        colors: form.colors ? form.colors.split(',').map(s => s.trim()).filter(Boolean) : [],
        is_active: true,
      }

      if (isNew) {
        const { data, error: err } = await supabase
          .from('products').insert(payload).select().single()
        if (err) throw new Error(err.message)
        onSaved(data as SupabaseProduct)
      } else {
        const { data, error: err } = await supabase
          .from('products').update(payload).eq('id', product!.id).select().single()
        if (err) throw new Error(err.message)
        onSaved(data as SupabaseProduct)
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const fields: { key: keyof EditForm; label: string; placeholder: string; type?: string }[] = [
    { key: 'name', label: 'Название *', placeholder: 'Пальто oversize' },
    { key: 'sku', label: 'Артикул', placeholder: 'VF-441' },
    { key: 'category', label: 'Категория', placeholder: 'Верхняя одежда' },
    { key: 'price', label: 'Цена (₽)', placeholder: '24900', type: 'number' },
    { key: 'stock', label: 'Остаток (шт)', placeholder: '10', type: 'number' },
    { key: 'return_rate', label: 'Процент возврата (%)', placeholder: '5', type: 'number' },
    { key: 'sizes', label: 'Размеры (через запятую)', placeholder: 'XS, S, M, L, XL' },
    { key: 'colors', label: 'Цвета (через запятую)', placeholder: 'чёрный, белый' },
    { key: 'description', label: 'Описание', placeholder: 'Краткое описание товара...' },
  ]

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex justify-end">
      <div className="bg-white w-full max-w-md h-full flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="text-base font-semibold text-gray-900">
            {isNew ? 'Добавить товар' : 'Редактировать товар'}
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {fields.map(f => (
            <div key={f.key}>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">{f.label}</label>
              {f.key === 'description' ? (
                <textarea
                  value={form[f.key]}
                  onChange={e => set(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  rows={3}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#0FBCCE] resize-none"
                />
              ) : (
                <input
                  type={f.type || 'text'}
                  value={form[f.key]}
                  onChange={e => set(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#0FBCCE]"
                />
              )}
            </div>
          ))}
          {error && (
            <div className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">{error}</div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
            Отмена
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 bg-[#0FBCCE] text-white rounded-xl text-sm font-medium hover:bg-[#0da8b8] disabled:opacity-40 flex items-center justify-center gap-2">
            {saving
              ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Сохраняем...</>
              : <><Save className="w-4 h-4" />{isNew ? 'Добавить' : 'Сохранить'}</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── MойСклад types ────────────────────────────────────────────────
interface MSProduct {
  id: string; name: string; code: string; article?: string
  salePrices?: { value: number }[]; buyPrice?: { value: number }
  stock?: number; meta: { href: string }
}

interface CatalogItem {
  id: string; sku: string; name: string; category: string
  price: number; costPrice: number; stock: number
  returnRate: number; daysLeft: number | null
  status: 'critical' | 'low' | 'ok' | 'dead'
  trend: 'up' | 'down' | 'flat'; emoji: string
  // supabase fields for editing
  supabaseId?: string
}

const SYNTHETIC: Record<string, { returnRate: number; salesPerDay: number; trend: 'up'|'down'|'flat'; emoji: string; category: string }> = {
  'VF-441': { returnRate: 5, salesPerDay: 3.2, trend: 'up', emoji: '🧥', category: 'Верхняя одежда' },
  'VF-089': { returnRate: 24, salesPerDay: 1.8, trend: 'down', emoji: '👖', category: 'Брюки' },
  'VF-661': { returnRate: 8, salesPerDay: 1.4, trend: 'up', emoji: '🧶', category: 'Трикотаж' },
  'VF-774': { returnRate: 4, salesPerDay: 0.9, trend: 'flat', emoji: '🧥', category: 'Верхняя одежда' },
  'VF-517': { returnRate: 9, salesPerDay: 2.1, trend: 'up', emoji: '👕', category: 'Трикотаж' },
  'VF-203': { returnRate: 7, salesPerDay: 0.6, trend: 'flat', emoji: '👔', category: 'Рубашки' },
  'VF-108': { returnRate: 11, salesPerDay: 1.1, trend: 'flat', emoji: '👕', category: 'Футболки' },
  'VF-332': { returnRate: 0, salesPerDay: 0, trend: 'down', emoji: '🩲', category: 'Брюки' },
}

function getStatus(stock: number, daysLeft: number | null): CatalogItem['status'] {
  if (stock === 0 || daysLeft === null) return 'dead'
  if (daysLeft <= 3) return 'critical'
  if (daysLeft <= 14) return 'low'
  return 'ok'
}

function msToItem(p: MSProduct): CatalogItem {
  const code = p.code || p.article || p.id
  const syn = SYNTHETIC[code] || { returnRate: 0, salesPerDay: 0, trend: 'flat' as const, emoji: '📦', category: 'Прочее' }
  const price = (p.salePrices?.[0]?.value || 0) / 100
  const costPrice = (p.buyPrice?.value || 0) / 100
  const stock = p.stock || 0
  const daysLeft = syn.salesPerDay > 0 ? Math.round(stock / syn.salesPerDay) : null
  return { id: p.id, sku: code, name: p.name, category: syn.category, price, costPrice, stock, returnRate: syn.returnRate, daysLeft, status: getStatus(stock, daysLeft), trend: syn.trend, emoji: syn.emoji }
}

// Generate deterministic synthetic metrics for demo
function syntheticMetrics(name: string) {
  // Use char codes for deterministic but varied results
  const seed = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const salesPerDay = 0.5 + (seed % 30) / 10        // 0.5 – 3.5
  const returnRate = 3 + (seed % 20)                 // 3 – 22%
  const trend: 'up'|'down'|'flat' = seed % 3 === 0 ? 'up' : seed % 3 === 1 ? 'down' : 'flat'
  return { salesPerDay, returnRate, trend }
}

function supabaseToItem(p: SupabaseProduct): CatalogItem {
  const syn = syntheticMetrics(p.name)
  const stock = p.stock || Math.round(5 + (p.name.charCodeAt(0) % 90)) // synthetic stock if 0
  const daysLeft = syn.salesPerDay > 0 ? Math.round(stock / syn.salesPerDay) : null
  return {
    id: p.id, sku: p.sku || '—', name: p.name,
    category: p.category || 'Прочее',
    price: p.price || 0, costPrice: p.price * 0.45 || 0,
    stock,
    returnRate: p.return_rate || syn.returnRate,
    daysLeft, status: getStatus(stock, daysLeft),
    trend: syn.trend, emoji: '📦',
    supabaseId: p.id,
  }
}

const STATUS_CONFIG = {
  critical: { label: 'Критично', badge: 'bg-red-100 text-red-600' },
  low: { label: 'Мало', badge: 'bg-amber-100 text-amber-600' },
  ok: { label: 'Норма', badge: 'bg-green-50 text-green-600' },
  dead: { label: 'Неликвид', badge: 'bg-gray-100 text-gray-400' },
}

// ── Main Page ─────────────────────────────────────────────────────
export default function WarehousePage() {
  const { stats } = useSellerData()
  const [token, setToken] = useState('')
  const [tokenInput, setTokenInput] = useState('')
  const [connected, setConnected] = useState(false)
  const [items, setItems] = useState<CatalogItem[]>([])
  const [supabaseProducts, setSupabaseProducts] = useState<SupabaseProduct[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [lastSync, setLastSync] = useState('')
  const [mounted, setMounted] = useState(false)
  const [editProduct, setEditProduct] = useState<SupabaseProduct | null | 'new'>()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [showClearAll, setShowClearAll] = useState(false)
  const [clearingAll, setClearingAll] = useState(false)
  const [useSupabase, setUseSupabase] = useState(false)

  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem('ms_token')
    if (saved) {
      setToken(saved); setConnected(true); fetchMoysklad(saved)
    } else {
      // Load from Supabase
      setUseSupabase(true)
      loadSupabase()
    }
  }, [])

  const loadSupabase = async () => {
    setLoading(true)
    try {
      const currentSellerId = typeof window !== 'undefined' ? localStorage.getItem('seller_id') : null
      if (!currentSellerId) { setSupabaseProducts([]); return }
      const { data, error: err } = await supabase
        .from('products').select('*').eq('seller_id', currentSellerId).order('created_at', { ascending: false })
      if (err) throw new Error(err.message)
      const prods = (data || []) as SupabaseProduct[]
      setSupabaseProducts(prods)
      setItems(prods.map(supabaseToItem))
      setLastSync(new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }))
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchMoysklad = async (t: string) => {
    setLoading(true); setError('')
    try {
      const prodRes = await fetch('/api/moysklad', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: t, endpoint: '/entity/product', params: { limit: 100 } }),
      })
      const prodData = await prodRes.json()
      if (!prodData.success) throw new Error(prodData.error)
      const products: MSProduct[] = prodData.data.rows || []
      const stockRes = await fetch('/api/moysklad', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: t, endpoint: '/report/stock/all', params: { limit: 100, stockMode: 'all' } }),
      })
      const stockData = await stockRes.json()
      const stockRows = stockData.data?.rows || []
      const stockMap: Record<string, number> = {}
      stockRows.forEach((s: any) => { stockMap[s.code || ''] = s.stock || 0 })
      setItems(products.map(p => msToItem({ ...p, stock: stockMap[p.code] ?? 0 })))
      setLastSync(new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }))
    } catch (e: any) {
      setError(e.message || 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = () => {
    if (!tokenInput.trim()) return
    localStorage.setItem('ms_token', tokenInput.trim())
    setToken(tokenInput.trim()); setConnected(true); setUseSupabase(false)
    fetchMoysklad(tokenInput.trim())
  }

  const handleDisconnect = () => {
    localStorage.removeItem('ms_token')
    setToken(''); setTokenInput(''); setConnected(false)
    setUseSupabase(true); loadSupabase()
  }

  const handleClearAll = async () => {
    setClearingAll(true)
    try {
      const currentSellerIdDel = typeof window !== 'undefined' ? localStorage.getItem('seller_id') : null
      if (!currentSellerIdDel) return
      const { error } = await supabase.from('products').delete().eq('seller_id', currentSellerIdDel)
      if (error) throw new Error(error.message)
      setSupabaseProducts([])
      setItems([])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setClearingAll(false)
      setShowClearAll(false)
    }
  }

  const handleSaved = (p: SupabaseProduct) => {
    setSupabaseProducts(prev => {
      const exists = prev.find(x => x.id === p.id)
      if (exists) return prev.map(x => x.id === p.id ? p : x)
      return [p, ...prev]
    })
    setItems(prev => {
      const exists = prev.find(x => x.supabaseId === p.id)
      const newItem = supabaseToItem(p)
      if (exists) return prev.map(x => x.supabaseId === p.id ? newItem : x)
      return [newItem, ...prev]
    })
    setEditProduct(undefined)
  }

  const handleDelete = async (id: string) => {
    setDeleting(true)
    try {
      const { error: err } = await supabase.from('products').delete().eq('id', id)
      if (err) throw new Error(err.message)
      setSupabaseProducts(prev => prev.filter(p => p.id !== id))
      setItems(prev => prev.filter(i => i.supabaseId !== id))
    } catch (e: any) {
      setError(e.message)
    } finally {
      setDeleting(false)
      setDeleteId(null)
    }
  }

  if (!mounted) return null

  const filtered = items.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.sku.toLowerCase().includes(search.toLowerCase())
  )

  const totalValue = items.reduce((s, i) => s + i.stock * (i.costPrice || i.price * 0.5), 0)
  const criticalCount = items.filter(i => i.status === 'critical').length
  const deadValue = items.filter(i => i.status === 'dead').reduce((s, i) => s + i.stock * (i.costPrice || 0), 0)
  const brandName = typeof window !== 'undefined' ? localStorage.getItem('brand_name') || '' : ''

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>{[{ label: "Активных SKU", value: stats.productsActive, color: "#0FBCCE" },{ label: "Продано заказов", value: stats.ordersTotal, color: "#22c55e" },{ label: "Возвраты", value: stats.ordersReturned, color: stats.ordersReturned > 0 ? "#ef4444" : "#22c55e" },{ label: "Выручка", value: (stats.revenueTotal/1000).toFixed(1) + "K", color: "#111827" }].map((m, i) => (<div key={i} style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", padding: 16 }}><div style={{ fontSize: 22, fontWeight: 800, color: m.color }}>{m.value}</div><div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>{m.label}</div></div>))}</div>
      {/* Edit / Add Panel */}
      {editProduct !== undefined && (
        <EditPanel
          product={editProduct === 'new' ? null : editProduct}
          onClose={() => setEditProduct(undefined)}
          onSaved={handleSaved}
        />
      )}

      {/* Delete confirmation */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <div className="text-base font-semibold text-gray-900 mb-2">Удалить товар?</div>
            <div className="text-sm text-gray-500 mb-5">Это действие нельзя отменить.</div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                Отмена
              </button>
              <button onClick={() => handleDelete(deleteId)} disabled={deleting}
                className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 disabled:opacity-40">
                {deleting ? 'Удаляем...' : 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Confirmation */}
      {showClearAll && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <div className="text-base font-semibold text-gray-900 mb-2">Удалить весь каталог?</div>
            <div className="text-sm text-gray-500 mb-2">Все товары будут удалены из базы данных. Это действие <strong>нельзя отменить</strong>.</div>
            <div className="text-sm text-red-500 mb-5">Фотографии также будут недоступны.</div>
            <div className="flex gap-3">
              <button onClick={() => setShowClearAll(false)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                Отмена
              </button>
              <button onClick={handleClearAll} disabled={clearingAll}
                className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 disabled:opacity-40">
                {clearingAll ? 'Удаляем...' : 'Удалить всё'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Склад</h1>
          <p className="text-sm text-gray-500 mt-1">
            {lastSync ? `обновлено ${lastSync}` : ''}
            {useSupabase && <span className="ml-2 text-xs px-2 py-0.5 bg-[#EBF9FB] text-[#0FBCCE] rounded-full">Каталог AIMEE</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {useSupabase && (
            <button onClick={() => setEditProduct('new')}
              className="flex items-center gap-2 px-4 py-2 bg-[#0FBCCE] text-white rounded-xl text-sm font-medium hover:bg-[#0da8b8]">
              <Plus className="w-4 h-4" />Добавить товар
            </button>
          )}
          {connected ? (
            <>
              <button onClick={() => fetchMoysklad(token)} disabled={loading}
                className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />Обновить
              </button>
              <div className="flex items-center gap-1.5 px-3 py-2 bg-green-50 border border-green-100 rounded-xl text-sm text-green-700">
                <Link2 className="w-4 h-4" />МойСклад
              </div>
              <button onClick={handleDisconnect} className="text-gray-300 hover:text-gray-500">
                <Link2Off className="w-4 h-4" />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <input type="text" value={tokenInput} onChange={e => setTokenInput(e.target.value)}
                placeholder="Токен МойСклад" onKeyDown={e => e.key === 'Enter' && handleConnect()}
                className="px-3 py-2 border border-gray-200 rounded-xl text-sm w-52 focus:outline-none focus:border-[#0FBCCE]" />
              <button onClick={handleConnect}
                className="flex items-center gap-2 px-3 py-2 border border-[#0FBCCE] text-[#0FBCCE] rounded-xl text-sm font-medium hover:bg-[#EBF9FB]">
                <Link2 className="w-4 h-4" />МойСклад
              </button>
            </div>
          )}
          {useSupabase && (
            <>
              <button onClick={loadSupabase} disabled={loading}
                className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-40">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              {items.length > 0 && (
                <button onClick={() => setShowClearAll(true)}
                  className="flex items-center gap-1.5 px-3 py-2 border border-red-200 text-red-500 rounded-xl text-sm hover:bg-red-50 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />Очистить каталог
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600 mb-4">{error}</div>}

      {/* Metrics */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        {[
          { label: 'Товаров', value: items.length, sub: 'в каталоге' },
          { label: 'Стоимость склада', value: totalValue > 0 ? `₽${(totalValue / 1000).toFixed(0)}K` : '—', sub: 'оценочно' },
          { label: 'Заканчивается', value: criticalCount, sub: 'позиций критично' },
          { label: 'Активных', value: supabaseProducts.filter(p => p.is_active).length || items.length, sub: 'товаров' },
        ].map((m, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">{m.label}</div>
            <div className="text-2xl font-bold text-gray-900">{m.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{m.sub}</div>
          </div>
        ))}
      </div>

      {/* A2A live */}
      <div className="bg-white rounded-2xl border border-[#0FBCCE]/20 p-4 shadow-sm mb-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-sm font-semibold text-gray-900">A2A · Переговоры прямо сейчас</span>
          <span className="ml-auto text-xs text-[#0FBCCE] font-medium">● 3 активных</span>
        </div>
        <LiveDialog />
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Поиск по названию или артикулу..."
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:outline-none focus:border-[#0FBCCE] shadow-sm" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-6 h-6 text-[#0FBCCE] animate-spin mx-auto mb-2" />
            <div className="text-sm text-gray-400">Загружаем данные...</div>
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-3">📦</div>
            <div className="text-sm font-medium text-gray-500 mb-2">Склад пуст</div>
            <div className="text-xs text-gray-400 mb-4">Добавь товары или подключи МойСклад</div>
            <button onClick={() => setEditProduct('new')}
              className="px-4 py-2 bg-[#0FBCCE] text-white rounded-xl text-sm font-medium hover:bg-[#0da8b8]">
              Добавить товар
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-50">
                <th className="py-3 px-5 text-xs font-semibold text-gray-400 uppercase tracking-wide text-left">Товар</th>
                <th className="py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide text-right">Цена</th>
                <th className="py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide text-right">Остаток</th>
                <th className="py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide text-right">До нуля</th>
                <th className="py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide text-right">Возврат</th>
                <th className="py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide text-center">Статус</th>
                {useSupabase && <th className="py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide text-center">Действия</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(item => {
                const cfg = STATUS_CONFIG[item.status]
                const sprod = supabaseProducts.find(p => p.id === item.supabaseId)
                return (
                  <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        {sprod?.images?.[0] ? (
                          <img src={sprod.images[0]} alt={item.name} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                        ) : (
                          <span className="text-lg">{item.emoji}</span>
                        )}
                        <div>
                          <div className="font-medium text-gray-900">{item.name}</div>
                          <div className="text-xs text-gray-400">{item.sku} · {item.category}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right text-gray-700 font-medium">
                      {item.price > 0 ? `₽${item.price.toLocaleString('ru-RU')}` : '—'}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {item.trend === 'up' ? <TrendingUp className="w-3 h-3 text-green-500" /> :
                         item.trend === 'down' ? <TrendingDown className="w-3 h-3 text-red-400" /> : null}
                        <span className={`font-semibold ${item.status === 'critical' ? 'text-red-600' : item.status === 'low' ? 'text-amber-600' : 'text-gray-700'}`}>
                          {item.stock} шт
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      {item.daysLeft !== null
                        ? <span className={`font-medium ${item.daysLeft <= 3 ? 'text-red-600' : item.daysLeft <= 14 ? 'text-amber-600' : 'text-gray-500'}`}>{item.daysLeft} дн</span>
                        : <span className="text-gray-300">∞</span>}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      {item.returnRate > 0
                        ? <span className={`font-medium ${item.returnRate > 15 ? 'text-red-500' : 'text-gray-500'}`}>
                            {item.returnRate > 15 && <AlertTriangle className="w-3 h-3 inline mr-0.5" />}{item.returnRate}%
                          </span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.badge}`}>{cfg.label}</span>
                    </td>
                    {useSupabase && (
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setEditProduct(sprod || null)}
                            className="p-1.5 text-gray-400 hover:text-[#0FBCCE] hover:bg-[#EBF9FB] rounded-lg transition-colors"
                            title="Редактировать"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteId(item.supabaseId || item.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Удалить"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-sm text-gray-400">Ничего не найдено</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
