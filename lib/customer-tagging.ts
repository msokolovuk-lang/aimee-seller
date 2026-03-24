/**
 * AIMEE CRM — Customer Auto-Tagging Engine
 * Sprint 4 · TZ v2.0
 * Правила авто-теггинга покупателей
 */

export interface CustomerForTagging {
  id: string
  seller_id: string
  orders_count: number
  total_spent: number
  ltv: number
  last_order_at: string | null
  created_at: string
  tags: string[]
}

// ─── Tagging rules ──────────────────────────────────────────────────────────
export function computeTags(customer: CustomerForTagging): string[] {
  const tags = new Set<string>()
  const now = new Date()

  const lastOrderDate = customer.last_order_at ? new Date(customer.last_order_at) : null
  const daysSinceLastOrder = lastOrderDate
    ? Math.floor((now.getTime() - lastOrderDate.getTime()) / 86400000)
    : null

  const createdDate = new Date(customer.created_at)
  const daysSinceCreated = Math.floor((now.getTime() - createdDate.getTime()) / 86400000)

  // NEW — зарегистрирован последние 7 дней
  if (daysSinceCreated <= 7) {
    tags.add('new')
  }

  // VIP — LTV > ₽30K
  if (customer.ltv >= 30000) {
    tags.add('vip')
  }

  // ACTIVE — купил хотя бы раз, последний заказ <= 30 дней
  if (customer.orders_count > 0 && daysSinceLastOrder !== null && daysSinceLastOrder <= 30) {
    tags.add('active')
  }

  // CHURNED — не покупал 60+ дней
  if (daysSinceLastOrder !== null && daysSinceLastOrder > 60) {
    tags.add('churned')
  }

  // LOYAL — 3+ заказа
  if (customer.orders_count >= 3) {
    tags.add('loyal')
  }

  // BIG_SPENDER — средний чек > ₽10K
  if (customer.orders_count > 0 && (customer.total_spent / customer.orders_count) >= 10000) {
    tags.add('big_spender')
  }

  return Array.from(tags)
}

// ─── Segment filters ────────────────────────────────────────────────────────
export const SEGMENTS = {
  repeat_buyers: {
    label: 'Повторные покупатели',
    description: 'Купили 2+ раза',
    filter: (c: CustomerForTagging) => c.orders_count >= 2,
  },
  inactive_60d: {
    label: 'Неактивные 60д',
    description: 'Не покупали 60+ дней',
    filter: (c: CustomerForTagging) => {
      if (!c.last_order_at) return false
      const days = Math.floor((Date.now() - new Date(c.last_order_at).getTime()) / 86400000)
      return days > 60
    },
  },
  vip: {
    label: 'VIP',
    description: 'LTV > ₽30K',
    filter: (c: CustomerForTagging) => c.ltv >= 30000,
  },
  new_7d: {
    label: 'Новые (7д)',
    description: 'Зарегистрированы за 7 дней',
    filter: (c: CustomerForTagging) => {
      const days = Math.floor((Date.now() - new Date(c.created_at).getTime()) / 86400000)
      return days <= 7
    },
  },
  no_orders: {
    label: 'Без заказов',
    description: 'Зарегистрированы, но ничего не купили',
    filter: (c: CustomerForTagging) => c.orders_count === 0,
  },
} as const

export type SegmentKey = keyof typeof SEGMENTS
