/**
 * СДЭК коннектор
 * OAuth2 · REST API v2
 * Тарифы, накладные, трекинг, ПВЗ
 * Sandbox: https://api.edu.cdek.ru/v2
 * Production: https://api.cdek.ru/v2
 */

import { AimeeConnector, AuthResult, SyncResult, ShippingParams, ShippingOption, TrackingStatus } from './interface'

const CDEK_SANDBOX = 'https://api.edu.cdek.ru/v2'
const CDEK_PROD    = 'https://api.cdek.ru/v2'

export class CdekConnector implements AimeeConnector {
  type = 'cdek' as const
  private accessToken: string = ''
  private baseUrl: string = CDEK_SANDBOX // sandbox by default

  async auth(credentials: Record<string, string>): Promise<AuthResult> {
    const { client_id, client_secret, sandbox } = credentials

    if (!client_id || !client_secret) {
      return { success: false, error: 'client_id и client_secret обязательны' }
    }

    this.baseUrl = sandbox === 'false' ? CDEK_PROD : CDEK_SANDBOX

    try {
      const res = await fetch(`${this.baseUrl}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type:    'client_credentials',
          client_id,
          client_secret,
        }),
      })

      if (!res.ok) {
        return { success: false, error: 'СДЭК: неверные credentials' }
      }

      const data = await res.json()
      this.accessToken = data.access_token

      const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString()

      return {
        success:   true,
        token:     data.access_token,
        expiresAt,
      }
    } catch (e: any) {
      return { success: false, error: `Ошибка соединения СДЭК: ${e.message}` }
    }
  }

  // ─── Calculate shipping ────────────────────────────────────────────────────
  async calculateShipping(params: ShippingParams): Promise<ShippingOption[]> {
    if (!this.accessToken) return []

    try {
      const body = {
        type:         1, // интернет-магазин
        from_location: { address: params.fromCity },
        to_location:   { address: params.toCity },
        packages: [{
          weight: Math.round(params.weight * 1000), // граммы
          length: params.length || 20,
          width:  params.width  || 20,
          height: params.height || 20,
        }],
      }

      const res = await fetch(`${this.baseUrl}/calculator/tarifflist`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (!res.ok) return []

      const data = await res.json()
      const tariffs: any[] = data.tariff_codes || []

      return tariffs
        .filter((t: any) => t.delivery_sum)
        .map((t: any) => ({
          service:  `СДЭК тариф ${t.tariff_code}`,
          price:    t.delivery_sum,
          days:     t.period_max || t.period_min || 3,
          type:     t.tariff_code <= 140 ? 'door' : 'pvz',
        }))
        .sort((a, b) => a.price - b.price)
        .slice(0, 5)

    } catch (e) {
      return []
    }
  }

  // ─── Track shipment ────────────────────────────────────────────────────────
  async trackShipment(uuid: string): Promise<TrackingStatus> {
    if (!this.accessToken) {
      return { status: 'Нет авторизации', updatedAt: new Date().toISOString() }
    }

    try {
      const res = await fetch(`${this.baseUrl}/orders/${uuid}`, {
        headers: { 'Authorization': `Bearer ${this.accessToken}` },
      })

      if (!res.ok) {
        return { status: 'Не найден', updatedAt: new Date().toISOString() }
      }

      const data = await res.json()
      const entity = data.entity || {}
      const statuses: any[] = entity.statuses || []
      const current = statuses[statuses.length - 1]

      return {
        status:    current?.name || 'Неизвестно',
        location:  current?.city || null,
        updatedAt: current?.date_time || new Date().toISOString(),
        history:   statuses.map((s: any) => ({
          status:   s.name,
          date:     s.date_time,
          location: s.city,
        })),
      }
    } catch (e) {
      return { status: 'Ошибка запроса', updatedAt: new Date().toISOString() }
    }
  }

  // ─── Create shipment order ─────────────────────────────────────────────────
  async createShipment(params: {
    toName: string
    toPhone: string
    toAddress: string
    weight: number
    items: Array<{ name: string; cost: number; amount: number }>
  }): Promise<{ uuid: string; trackNumber: string }> {
    if (!this.accessToken) throw new Error('Нет авторизации СДЭК')

    const body = {
      type:          1,
      tariff_code:   136, // Посылка склад-дверь
      to_location:   { address: params.toAddress },
      recipient: {
        name:   params.toName,
        phones: [{ number: params.toPhone }],
      },
      packages: [{
        number: `AIMEE-${Date.now()}`,
        weight: Math.round(params.weight * 1000),
        items:  params.items.map(i => ({
          name:   i.name,
          ware_key: i.name.slice(0, 20),
          payment: { value: 0 },
          cost:   i.cost,
          amount: i.amount,
          weight: 100,
        })),
      }],
    }

    const res = await fetch(`${this.baseUrl}/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err?.requests?.[0]?.errors?.[0]?.message || 'Ошибка создания накладной СДЭК')
    }

    const data = await res.json()
    const entity = data.entity || {}
    return {
      uuid:        entity.uuid || '',
      trackNumber: entity.cdek_number || '',
    }
  }

  async syncProducts(_sellerId: string): Promise<SyncResult> {
    return { success: true, recordsSynced: 0, details: { note: 'СДЭК не имеет каталога товаров' } }
  }
}
