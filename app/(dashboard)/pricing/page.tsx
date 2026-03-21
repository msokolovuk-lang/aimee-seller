'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'

const PLANS = [
  {
    id: 'start',
    name: 'Старт',
    price: 4900,
    commission: 7.5,
    skuLimit: '100 SKU',
    current: false,
    highlight: null,
    features: ['До 100 SKU', 'Импорт каталога', 'A2A агент', 'Trend Radar базовый', 'Анализ цен'],
    nofeatures: ['Описания товаров', 'Виртуальная примерка', 'Прогноз возвратов', 'Big Data', 'Персонализация покупателя'],
  },
  {
    id: 'pro',
    name: 'Про',
    price: 14900,
    commission: 6.5,
    skuLimit: '1 000 SKU',
    current: true,
    highlight: 'Популярный',
    features: ['До 1 000 SKU', 'Всё из Старт', 'Описания товаров 50/мес', 'Виртуальная примерка 200/мес', 'Прогноз возвратов 100/мес', 'Big Data базовый', 'A2A приоритет'],
    nofeatures: ['Персонализация покупателя', 'Описания безлимит', 'Примерка безлимит'],
  },
  {
    id: 'brand',
    name: 'Бренд',
    price: 39900,
    commission: 5.8,
    skuLimit: 'Безлимит',
    current: false,
    highlight: 'Максимум лояльности',
    features: ['Безлимит SKU', 'Всё из Про', 'Описания безлимит', 'Примерка 2 000/мес', 'Прогноз возвратов безлимит', 'Big Data полный', 'Персонализация покупателя', 'Trend Radar real-time', 'A2A аналитика'],
    nofeatures: [],
  },
]

const WB_COMMISSION = 34
const OZON_COMMISSION = 38

export default function TariffsPage() {
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly')
  const [revenue, setRevenue] = useState(500000)
  const [marketplace, setMarketplace] = useState<'wb' | 'ozon'>('wb')

  const getPrice = (base: number) => billing === 'yearly' ? Math.round(base * 0.7) : base
  const getYearPrice = (base: number) => Math.round(base * 0.7 * 12)

  const marketCommission = marketplace === 'wb' ? WB_COMMISSION : OZON_COMMISSION

  const savings = (commission: number, planPrice: number) => {
    const marketFee = revenue * (marketCommission / 100)
    const aimeeFee = revenue * (commission / 100) + planPrice
    return Math.round(marketFee - aimeeFee)
  }

  // Дополнительная ценность AI инструментов (примерная конверсия)
  const aiValue = (planId: string) => {
    if (planId === 'start') return 0
    if (planId === 'pro') return Math.round(revenue * 0.08) // +8% конверсия от AI
    return Math.round(revenue * 0.18) // +18% от персонализации
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold text-gray-900">Тарифы</h1>
        <p className="text-sm text-gray-500 mt-1">текущий план: Про</p>
      </div>

      {/* Калькулятор */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-semibold text-gray-900">💰 Считай реальную экономию</div>
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            <button onClick={() => setMarketplace('wb')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${marketplace === 'wb' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
              WB {WB_COMMISSION}%
            </button>
            <button onClick={() => setMarketplace('ozon')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${marketplace === 'ozon' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
              Ozon {OZON_COMMISSION}%
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-500">Месячная выручка</span>
          <span className="text-sm font-bold text-gray-900">₽{revenue.toLocaleString()}</span>
        </div>
        <input type="range" min={100000} max={5000000} step={50000} value={revenue}
          onChange={e => setRevenue(Number(e.target.value))}
          className="w-full accent-[#0FBCCE] mb-1" />
        <div className="flex justify-between text-xs text-gray-400 mb-4">
          <span>₽100K</span><span>₽5M</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {PLANS.map(plan => {
            const s = savings(plan.commission, getPrice(plan.price))
            const ai = aiValue(plan.id)
            const total = s + ai
            return (
              <div key={plan.id} className={`p-3.5 rounded-xl ${plan.current ? 'bg-[#EBF9FB] border border-[#0FBCCE]/30' : 'bg-gray-50'}`}>
                <div className="text-xs text-gray-500 mb-2">{plan.name}</div>
                <div className={`text-xl font-bold ${total > 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {total > 0 ? '+' : ''}₽{Math.abs(total).toLocaleString()}
                </div>
                <div className="text-xs text-gray-400 mb-2">экономия/мес</div>
                <div className="space-y-0.5 text-xs text-gray-500">
                  <div>Экономия на комиссии: <span className="font-medium text-green-600">+₽{Math.round(revenue * (marketCommission - plan.commission) / 100).toLocaleString()}</span></div>
                  <div>Подписка: <span className="font-medium text-gray-600">−₽{getPrice(plan.price).toLocaleString()}</span></div>
                  {ai > 0 && <div>AI доход: <span className="font-medium text-green-600">+₽{ai.toLocaleString()}</span></div>}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Переключатель */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {(['monthly', 'yearly'] as const).map(b => (
            <button key={b} onClick={() => setBilling(b)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${billing === b ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
              {b === 'monthly' ? 'Ежемесячно' : 'Ежегодно'}
            </button>
          ))}
        </div>
        {billing === 'yearly' && (
          <span className="text-xs px-2.5 py-1 bg-green-100 text-green-700 rounded-full font-medium">−30% · платишь за 8.4 месяца</span>
        )}
      </div>

      {/* Планы */}
      <div className="grid grid-cols-3 gap-4">
        {PLANS.map(plan => (
          <div key={plan.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${plan.current ? 'border-[#0FBCCE] ring-1 ring-[#0FBCCE]/20' : 'border-gray-100'}`}>
            {plan.current && (
              <div className="bg-[#0FBCCE] text-white text-xs font-semibold text-center py-1.5">✓ Текущий план</div>
            )}
            {!plan.current && plan.highlight && (
              <div className="bg-gray-900 text-white text-xs font-semibold text-center py-1.5">{plan.highlight}</div>
            )}
            <div className="p-5">
              <div className="mb-4">
                <div className="text-base font-bold text-gray-900">{plan.name}</div>
                <div className="mt-2 flex items-end gap-1">
                  <span className="text-2xl font-bold text-gray-900">₽{getPrice(plan.price).toLocaleString()}</span>
                  <span className="text-xs text-gray-400 mb-0.5">/мес</span>
                </div>
                {billing === 'yearly' && (
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="text-xs text-gray-400 line-through">₽{plan.price.toLocaleString()}/мес</div>
                    <div className="text-xs text-green-600 font-medium">₽{getYearPrice(plan.price).toLocaleString()}/год</div>
                  </div>
                )}
                <div className="mt-2 flex items-center gap-2 flex-wrap text-xs">
                  <span className="font-semibold text-[#0FBCCE]">{plan.commission}% комиссия</span>
                  <span className="text-gray-300"></span>
                  <span className="text-gray-400">{plan.skuLimit}</span>
                </div>
              </div>

              <div className="space-y-1.5 mb-5">
                {plan.features.map(f => (
                  <div key={f} className="flex items-start gap-2 text-xs text-gray-700">
                    <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0 mt-0.5" />{f}
                  </div>
                ))}
                {plan.nofeatures.map(f => (
                  <div key={f} className="flex items-start gap-2 text-xs text-gray-400">
                    <div className="w-3.5 h-3.5 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <div className="w-2.5 h-px bg-gray-300" />
                    </div>{f}
                  </div>
                ))}
              </div>

              {plan.current ? (
                <div className="w-full py-2 text-center text-xs text-[#0FBCCE] font-medium bg-[#EBF9FB] rounded-xl">Активен</div>
              ) : (
                <button className="w-full py-2 bg-[#0FBCCE] text-white rounded-xl text-sm font-medium hover:bg-[#0da8b8]">
                  {plan.id === 'brand' ? 'Перейти на Бренд' : 'Выбрать Старт'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 text-center text-xs text-gray-400">
        Комиссия списывается с каждой продажи · Без контракта · Отменить в любой момент
      </div>
    </div>
  )
}
