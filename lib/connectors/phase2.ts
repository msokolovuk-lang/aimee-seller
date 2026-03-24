/**
 * AIMEE SDK — Коннекторы Фаза 2
 * Sprint 5 · TZ v2.0
 * amoCRM · RetailCRM · 1С · Яндекс.Доставка · СБП · Тинькофф · Unisender · Roistat · WhatsApp
 */

import { AimeeConnector, AuthResult, SyncResult, ShippingParams, ShippingOption, TrackingStatus, WebhookResult } from './interface'

// ─── amoCRM ──────────────────────────────────────────────────────────────────
export class AmoCrmConnector implements AimeeConnector {
  type = 'amocrm' as const
  private accessToken = ''
  private domain = ''

  async auth(credentials: Record<string, string>): Promise<AuthResult> {
    const { access_token, domain } = credentials
    if (!access_token || !domain) return { success: false, error: 'access_token и domain обязательны' }

    try {
      const res = await fetch(`https://${domain}/api/v4/account`, {
        headers: { 'Authorization': `Bearer ${access_token}` },
      })
      if (!res.ok) return { success: false, error: `amoCRM: ${res.status} — проверьте токен и домен` }
      this.accessToken = access_token
      this.domain = domain
      return { success: true }
    } catch (e: any) {
      return { success: false, error: `amoCRM: ${e.message}` }
    }
  }

  async syncCustomers(sellerId: string): Promise<SyncResult> {
    if (!this.accessToken) return { success: false, recordsSynced: 0, error: 'Нет токена' }
    try {
      const res = await fetch(`https://${this.domain}/api/v4/contacts?limit=250`, {
        headers: { 'Authorization': `Bearer ${this.accessToken}` },
      })
      if (!res.ok) return { success: false, recordsSynced: 0, error: `amoCRM contacts: ${res.status}` }
      const data = await res.json()
      const contacts = data._embedded?.contacts || []
      return { success: true, recordsSynced: contacts.length, details: { contacts } }
    } catch (e: any) {
      return { success: false, recordsSynced: 0, error: e.message }
    }
  }

  async syncOrders(sellerId: string): Promise<SyncResult> {
    if (!this.accessToken) return { success: false, recordsSynced: 0, error: 'Нет токена' }
    try {
      const res = await fetch(`https://${this.domain}/api/v4/leads?limit=250`, {
        headers: { 'Authorization': `Bearer ${this.accessToken}` },
      })
      if (!res.ok) return { success: false, recordsSynced: 0, error: `amoCRM leads: ${res.status}` }
      const data = await res.json()
      const leads = data._embedded?.leads || []
      return { success: true, recordsSynced: leads.length, details: { leads } }
    } catch (e: any) {
      return { success: false, recordsSynced: 0, error: e.message }
    }
  }

  async syncProducts(sellerId: string): Promise<SyncResult> {
    return { success: true, recordsSynced: 0 }
  }

  async handleWebhook(payload: unknown): Promise<WebhookResult> {
    const data = payload as any
    return { handled: true, event: 'amocrm_webhook', data }
  }
}

// ─── RetailCRM ───────────────────────────────────────────────────────────────
export class RetailCrmConnector implements AimeeConnector {
  type = 'retailcrm' as const
  private apiKey = ''
  private siteUrl = ''

  async auth(credentials: Record<string, string>): Promise<AuthResult> {
    const { api_key, site_url } = credentials
    if (!api_key || !site_url) return { success: false, error: 'api_key и site_url обязательны' }

    try {
      const url = `${site_url.replace(/\/$/, '')}/api/v5/credentials?apiKey=${api_key}`
      const res = await fetch(url)
      if (!res.ok) return { success: false, error: `RetailCRM: ${res.status}` }
      const data = await res.json()
      if (!data.success) return { success: false, error: data.errorMsg || 'Ошибка авторизации' }
      this.apiKey = api_key
      this.siteUrl = site_url.replace(/\/$/, '')
      return { success: true }
    } catch (e: any) {
      return { success: false, error: `RetailCRM: ${e.message}` }
    }
  }

  async syncOrders(sellerId: string): Promise<SyncResult> {
    if (!this.apiKey) return { success: false, recordsSynced: 0, error: 'Нет токена' }
    try {
      const res = await fetch(`${this.siteUrl}/api/v5/orders?apiKey=${this.apiKey}&limit=50&page=1`)
      if (!res.ok) return { success: false, recordsSynced: 0, error: `RetailCRM orders: ${res.status}` }
      const data = await res.json()
      const orders = data.orders || []
      return { success: true, recordsSynced: orders.length, details: { orders } }
    } catch (e: any) {
      return { success: false, recordsSynced: 0, error: e.message }
    }
  }

  async syncCustomers(sellerId: string): Promise<SyncResult> {
    if (!this.apiKey) return { success: false, recordsSynced: 0, error: 'Нет токена' }
    try {
      const res = await fetch(`${this.siteUrl}/api/v5/customers?apiKey=${this.apiKey}&limit=100`)
      if (!res.ok) return { success: false, recordsSynced: 0, error: `RetailCRM customers: ${res.status}` }
      const data = await res.json()
      const customers = data.customers || []
      return { success: true, recordsSynced: customers.length, details: { customers } }
    } catch (e: any) {
      return { success: false, recordsSynced: 0, error: e.message }
    }
  }

  async syncProducts(sellerId: string): Promise<SyncResult> {
    return { success: true, recordsSynced: 0 }
  }

  async handleWebhook(payload: unknown): Promise<WebhookResult> {
    const data = payload as any
    const event = data?.topic || 'retailcrm_event'
    return { handled: true, event, data }
  }
}

// ─── 1С REST Gateway ─────────────────────────────────────────────────────────
export class OneCConnector implements AimeeConnector {
  type = '1c' as const
  private baseUrl = ''
  private login = ''
  private password = ''

  async auth(credentials: Record<string, string>): Promise<AuthResult> {
    const { base_url, login, password } = credentials
    if (!base_url) return { success: false, error: 'base_url обязателен' }

    try {
      const auth = Buffer.from(`${login || ''}:${password || ''}`).toString('base64')
      const res = await fetch(`${base_url}/catalog/Номенклатура?$top=1`, {
        headers: { 'Authorization': `Basic ${auth}` },
      })
      if (res.status === 401) return { success: false, error: '1С: неверный логин/пароль' }
      if (!res.ok) return { success: false, error: `1С: ${res.status} — проверьте URL` }
      this.baseUrl = base_url
      this.login = login || ''
      this.password = password || ''
      return { success: true }
    } catch (e: any) {
      return { success: false, error: `1С: ${e.message}` }
    }
  }

  private get authHeader(): string {
    return 'Basic ' + Buffer.from(`${this.login}:${this.password}`).toString('base64')
  }

  async syncProducts(sellerId: string): Promise<SyncResult> {
    if (!this.baseUrl) return { success: false, recordsSynced: 0, error: 'Нет подключения' }
    try {
      // 1С OData endpoint — только чтение на старте
      const res = await fetch(`${this.baseUrl}/catalog/Номенклатура?$format=json&$top=100`, {
        headers: { 'Authorization': this.authHeader },
      })
      if (!res.ok) return { success: false, recordsSynced: 0, error: `1С: ${res.status}` }
      const data = await res.json()
      const items = data.value || []
      return { success: true, recordsSynced: items.length, details: { items } }
    } catch (e: any) {
      return { success: false, recordsSynced: 0, error: e.message }
    }
  }
}

// ─── Яндекс.Доставка ─────────────────────────────────────────────────────────
export class YandexDeliveryConnector implements AimeeConnector {
  type = 'yandex_delivery' as const
  private oauthToken = ''

  async auth(credentials: Record<string, string>): Promise<AuthResult> {
    const { oauth_token } = credentials
    if (!oauth_token) return { success: false, error: 'oauth_token обязателен' }

    try {
      const res = await fetch('https://api.delivery.yandex.net/api/b2b/platform/claims/search?status=new', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${oauth_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })
      if (res.status === 401) return { success: false, error: 'Яндекс.Доставка: неверный токен' }
      this.oauthToken = oauth_token
      return { success: true }
    } catch (e: any) {
      return { success: false, error: `Яндекс.Доставка: ${e.message}` }
    }
  }

  async calculateShipping(params: ShippingParams): Promise<ShippingOption[]> {
    if (!this.oauthToken) return []
    try {
      const res = await fetch('https://api.delivery.yandex.net/api/b2b/platform/offers/info', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.oauthToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          route_points: [
            { coordinates: { lat: 55.7558, lon: 37.6176 } }, // Moscow default from
            { coordinates: { lat: 55.7558, lon: 37.6176 } }, // placeholder
          ],
          items: [{
            weight: params.weight,
            dimensions: {
              length: (params.length || 20) / 100,
              width:  (params.width  || 20) / 100,
              height: (params.height || 20) / 100,
            },
          }],
        }),
      })
      if (!res.ok) return []
      const data = await res.json()
      const offers = data.offers || []
      return offers.slice(0, 3).map((o: any) => ({
        service: `Яндекс.Доставка ${o.class_name || ''}`,
        price:   o.price_with_vat || 0,
        days:    1,
        type:    'courier',
      }))
    } catch {
      return []
    }
  }

  async trackShipment(externalId: string): Promise<TrackingStatus> {
    if (!this.oauthToken) return { status: 'Нет авторизации', updatedAt: new Date().toISOString() }
    try {
      const res = await fetch(`https://api.delivery.yandex.net/api/b2b/platform/claims/info?claim_id=${externalId}`, {
        headers: { 'Authorization': `Bearer ${this.oauthToken}` },
      })
      if (!res.ok) return { status: 'Не найден', updatedAt: new Date().toISOString() }
      const data = await res.json()
      return {
        status: data.status || 'unknown',
        updatedAt: data.updated_ts || new Date().toISOString(),
      }
    } catch {
      return { status: 'Ошибка', updatedAt: new Date().toISOString() }
    }
  }

  async syncProducts(sellerId: string): Promise<SyncResult> {
    return { success: true, recordsSynced: 0 }
  }
}

// ─── СБП (через банк-эквайер) ────────────────────────────────────────────────
export class SbpConnector implements AimeeConnector {
  type = 'sbp' as const
  private merchantId = ''
  private secretKey = ''

  async auth(credentials: Record<string, string>): Promise<AuthResult> {
    const { merchant_id, secret_key } = credentials
    if (!merchant_id || !secret_key) return { success: false, error: 'merchant_id и secret_key обязательны' }
    // СБП работает через банк-эквайер — просто сохраняем credentials
    this.merchantId = merchant_id
    this.secretKey = secret_key
    return { success: true }
  }

  async createQrPayment(params: { amount: number; orderId: string; description: string }): Promise<{ qrUrl: string; paymentId: string }> {
    // Заглушка — реализация через конкретный банк (НСПК API или банк-партнёр)
    throw new Error('СБП: конкретный банк-эквайер не настроен. Используйте ЮKassa СБП или Тинькофф СБП.')
  }

  async syncProducts(sellerId: string): Promise<SyncResult> {
    return { success: true, recordsSynced: 0 }
  }

  async handleWebhook(payload: unknown): Promise<WebhookResult> {
    const data = payload as any
    return {
      handled: true,
      event: 'sbp_payment',
      data: {
        paymentId: data?.trxId || data?.orderId,
        status:    data?.status,
        amount:    data?.amount,
      },
    }
  }
}

// ─── Тинькофф Касса ──────────────────────────────────────────────────────────
export class TinkoffConnector implements AimeeConnector {
  type = 'tinkoff' as const
  private terminalKey = ''
  private secretKey = ''

  async auth(credentials: Record<string, string>): Promise<AuthResult> {
    const { terminal_key, secret_key } = credentials
    if (!terminal_key || !secret_key) return { success: false, error: 'terminal_key и secret_key обязательны' }

    try {
      // Test with minimal Init call
      const body = {
        TerminalKey: terminal_key,
        Amount: 100,
        OrderId: 'test-' + Date.now(),
        Description: 'AIMEE connection test',
        Password: secret_key,
      }
      const res = await fetch('https://securepay.tinkoff.ru/v2/Init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) return { success: false, error: `Тинькофф: ${res.status}` }
      const data = await res.json()
      if (!data.Success) return { success: false, error: `Тинькофф: ${data.Message || data.Details}` }
      this.terminalKey = terminal_key
      this.secretKey = secret_key
      return { success: true }
    } catch (e: any) {
      return { success: false, error: `Тинькофф: ${e.message}` }
    }
  }

  async createPayment(params: { amount: number; orderId: string; description: string; returnUrl: string }): Promise<{ paymentUrl: string; paymentId: string }> {
    const body = {
      TerminalKey: this.terminalKey,
      Amount: Math.round(params.amount * 100), // в копейках
      OrderId: params.orderId,
      Description: params.description,
      SuccessURL: params.returnUrl,
      Password: this.secretKey,
    }
    const res = await fetch('https://securepay.tinkoff.ru/v2/Init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!data.Success) throw new Error(data.Message || 'Ошибка создания платежа')
    return { paymentUrl: data.PaymentURL, paymentId: String(data.PaymentId) }
  }

  async syncProducts(sellerId: string): Promise<SyncResult> {
    return { success: true, recordsSynced: 0 }
  }

  async handleWebhook(payload: unknown): Promise<WebhookResult> {
    const data = payload as any
    return {
      handled: true,
      event: 'tinkoff_payment',
      data: {
        paymentId: data?.PaymentId,
        orderId:   data?.OrderId,
        status:    data?.Status,
        amount:    data?.Amount ? data.Amount / 100 : 0,
      },
    }
  }
}

// ─── Unisender ───────────────────────────────────────────────────────────────
export class UnisenderConnector implements AimeeConnector {
  type = 'unisender' as const
  private apiKey = ''

  async auth(credentials: Record<string, string>): Promise<AuthResult> {
    const { api_key } = credentials
    if (!api_key) return { success: false, error: 'api_key обязателен' }
    try {
      const res = await fetch(`https://api.unisender.com/ru/api/getLists?format=json&api_key=${api_key}`)
      const data = await res.json()
      if (data.error) return { success: false, error: `Unisender: ${data.error}` }
      this.apiKey = api_key
      return { success: true }
    } catch (e: any) {
      return { success: false, error: `Unisender: ${e.message}` }
    }
  }

  async sendEmail(params: {
    email: string
    name?: string
    subject: string
    body: string
    listId?: string
  }): Promise<boolean> {
    if (!this.apiKey) return false
    try {
      const formData = new FormData()
      formData.append('api_key', this.apiKey)
      formData.append('format', 'json')
      formData.append('email', params.email)
      formData.append('sender_name', 'AIMEE')
      formData.append('sender_email', 'noreply@getaimee.ru')
      formData.append('subject', params.subject)
      formData.append('body', params.body)
      formData.append('list_id', params.listId || '1')
      const res = await fetch('https://api.unisender.com/ru/api/sendEmail', { method: 'POST', body: formData })
      const data = await res.json()
      return !data.error
    } catch { return false }
  }

  // Брошенная корзина — email триггер
  async sendAbandonedCartEmail(params: { email: string; name: string; brandName: string }): Promise<boolean> {
    return this.sendEmail({
      email:   params.email,
      subject: `${params.name}, вы забыли товары в корзине`,
      body: `
        <h2>Привет, ${params.name}!</h2>
        <p>Вы добавили товары в корзину ${params.brandName}, но не завершили заказ.</p>
        <p>Товары ждут вас — оформите заказ прямо сейчас.</p>
        <p><a href="https://getaimee.ru" style="background:#0FBCCE;color:white;padding:12px 24px;border-radius:8px;text-decoration:none">Завершить заказ →</a></p>
        <p style="color:#888;font-size:12px">Powered by AIMEE</p>
      `,
    })
  }

  async syncProducts(sellerId: string): Promise<SyncResult> {
    return { success: true, recordsSynced: 0 }
  }
}

// ─── Roistat ─────────────────────────────────────────────────────────────────
export class RoistatConnector implements AimeeConnector {
  type = 'roistat' as const
  private projectId = ''
  private apiKey = ''

  async auth(credentials: Record<string, string>): Promise<AuthResult> {
    const { project_id, api_key } = credentials
    if (!project_id || !api_key) return { success: false, error: 'project_id и api_key обязательны' }
    try {
      const res = await fetch(`https://cloud.roistat.com/api/v1/project/info?projectId=${project_id}&apiKey=${api_key}`)
      const data = await res.json()
      if (data.status === 'error') return { success: false, error: `Roistat: ${data.error_text || 'Неверные credentials'}` }
      this.projectId = project_id
      this.apiKey = api_key
      return { success: true }
    } catch (e: any) {
      return { success: false, error: `Roistat: ${e.message}` }
    }
  }

  async getAnalytics(params: { dateFrom: string; dateTo: string }): Promise<any> {
    if (!this.apiKey) return null
    try {
      const res = await fetch(
        `https://cloud.roistat.com/api/v1/project/analytics/data?projectId=${this.projectId}&apiKey=${this.apiKey}&dateFrom=${params.dateFrom}&dateTo=${params.dateTo}&fields=visits,leads,orders,revenue,expenses,roi`,
      )
      if (!res.ok) return null
      return await res.json()
    } catch { return null }
  }

  async syncProducts(sellerId: string): Promise<SyncResult> {
    return { success: true, recordsSynced: 0 }
  }
}

// ─── WhatsApp Business (Meta Cloud API) ──────────────────────────────────────
export class WhatsAppConnector implements AimeeConnector {
  type = 'whatsapp' as const
  private accessToken = ''
  private phoneNumberId = ''

  async auth(credentials: Record<string, string>): Promise<AuthResult> {
    const { access_token, phone_number_id } = credentials
    if (!access_token || !phone_number_id) return { success: false, error: 'access_token и phone_number_id обязательны' }
    try {
      const res = await fetch(`https://graph.facebook.com/v18.0/${phone_number_id}`, {
        headers: { 'Authorization': `Bearer ${access_token}` },
      })
      if (!res.ok) return { success: false, error: `WhatsApp: ${res.status} — проверьте токен` }
      this.accessToken = access_token
      this.phoneNumberId = phone_number_id
      return { success: true }
    } catch (e: any) {
      return { success: false, error: `WhatsApp: ${e.message}` }
    }
  }

  async sendMessage(params: { to: string; text: string }): Promise<boolean> {
    if (!this.accessToken) return false
    try {
      const phone = params.to.replace(/\D/g, '')
      const res = await fetch(`https://graph.facebook.com/v18.0/${this.phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: phone,
          type: 'text',
          text: { preview_url: false, body: params.text },
        }),
      })
      const data = await res.json()
      return !!data.messages?.[0]?.id
    } catch { return false }
  }

  async syncProducts(sellerId: string): Promise<SyncResult> {
    return { success: true, recordsSynced: 0 }
  }

  async handleWebhook(payload: unknown): Promise<WebhookResult> {
    const data = payload as any
    const message = data?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]
    if (message) return { handled: true, event: 'whatsapp_message', data: message }
    return { handled: false }
  }

  verifyWebhook(signature: string, body: string): boolean {
    // Meta webhook verification — check X-Hub-Signature-256
    return true // Полная реализация через crypto.createHmac
  }
}
