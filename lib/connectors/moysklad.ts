/**
 * МойСклад коннектор
 * OAuth2 Bearer token · REST API v1.2
 * Sync: товары, остатки, заказы, контрагенты
 */

import { AimeeConnector, AuthResult, SyncResult, Order } from './interface'

const MS_BASE = 'https://api.moysklad.ru/api/remap/1.2'

export class MoyskladConnector implements AimeeConnector {
  type = 'moysklad' as const
  private token: string = ''

  async auth(credentials: Record<string, string>): Promise<AuthResult> {
    const { bearer_token } = credentials

    if (!bearer_token) {
      return { success: false, error: 'bearer_token обязателен' }
    }

    try {
      // Verify token by hitting /context/employee
      const res = await fetch(`${MS_BASE}/context/employee`, {
        headers: {
          'Authorization': `Bearer ${bearer_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        return {
          success: false,
          error: `МойСклад: ${err?.errors?.[0]?.error || 'Неверный токен'}`,
        }
      }

      const data = await res.json()
      this.token = bearer_token

      return {
        success: true,
        token: bearer_token,
      }
    } catch (e: any) {
      return { success: false, error: `Ошибка соединения: ${e.message}` }
    }
  }

  // ─── Sync Products ─────────────────────────────────────────────────────────
  async syncProducts(sellerId: string): Promise<SyncResult> {
    if (!this.token) return { success: false, recordsSynced: 0, error: 'Нет токена' }

    try {
      let offset = 0
      const limit = 100
      let total = 0
      let synced = 0

      do {
        const res = await fetch(
          `${MS_BASE}/entity/product?limit=${limit}&offset=${offset}&expand=uom,productFolder`,
          {
            headers: {
              'Authorization': `Bearer ${this.token}`,
              'Content-Type': 'application/json',
            },
          }
        )

        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          return {
            success: false,
            recordsSynced: synced,
            error: err?.errors?.[0]?.error || 'Ошибка API МойСклад',
          }
        }

        const data = await res.json()
        total = data.meta?.size || 0
        const rows: any[] = data.rows || []

        // Map МойСклад products → AIMEE products format
        const products = rows.map((p: any) => ({
          external_id:  p.id,
          seller_id:    sellerId,
          name:         p.name,
          description:  p.description || null,
          price:        p.salePrices?.[0]?.value ? p.salePrices[0].value / 100 : 0,
          sku:          p.article || p.code || null,
          category:     p.productFolder?.name || null,
          is_active:    !p.archived,
          source:       'moysklad',
          meta:         { moysklad_id: p.id, uom: p.uom?.name },
          updated_at:   p.updated,
        }))

        synced += products.length
        offset += limit

        // Return mapped data for caller to upsert
        // Actual DB upsert happens in the API route
        if (typeof (this as any).onProductsBatch === 'function') {
          await (this as any).onProductsBatch(products)
        }

      } while (offset < total)

      return { success: true, recordsSynced: synced }

    } catch (e: any) {
      return { success: false, recordsSynced: 0, error: e.message }
    }
  }

  // ─── Sync Orders ───────────────────────────────────────────────────────────
  async syncOrders(sellerId: string): Promise<SyncResult> {
    if (!this.token) return { success: false, recordsSynced: 0, error: 'Нет токена' }

    try {
      const res = await fetch(
        `${MS_BASE}/entity/customerorder?limit=100&order=moment,desc&expand=agent,positions`,
        {
          headers: { 'Authorization': `Bearer ${this.token}` },
        }
      )

      if (!res.ok) {
        return { success: false, recordsSynced: 0, error: 'Ошибка загрузки заказов' }
      }

      const data = await res.json()
      const orders: any[] = data.rows || []

      return { success: true, recordsSynced: orders.length, details: { orders } }

    } catch (e: any) {
      return { success: false, recordsSynced: 0, error: e.message }
    }
  }

  // ─── Create Order in МойСклад ──────────────────────────────────────────────
  async createOrder(order: Order): Promise<string> {
    if (!this.token) throw new Error('Нет токена МойСклад')

    const body = {
      name: `AIMEE-${order.id}`,
      agent: { meta: { type: 'counterparty' } }, // placeholder
      positions: order.items.map(item => ({
        quantity: item.qty,
        price: item.price * 100, // МойСклад в копейках
        assortment: { meta: { type: 'product' } },
      })),
    }

    const res = await fetch(`${MS_BASE}/entity/customerorder`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err?.errors?.[0]?.error || 'Ошибка создания заказа')
    }

    const data = await res.json()
    return data.id
  }

  // ─── Get stock levels ──────────────────────────────────────────────────────
  async getStock(): Promise<Array<{ productId: string; stock: number; reserve: number }>> {
    if (!this.token) return []

    const res = await fetch(`${MS_BASE}/report/stock/all?limit=1000`, {
      headers: { 'Authorization': `Bearer ${this.token}` },
    })

    if (!res.ok) return []

    const data = await res.json()
    return (data.rows || []).map((r: any) => ({
      productId: r.assortmentId,
      stock:     r.stock || 0,
      reserve:   r.reserve || 0,
    }))
  }
}
