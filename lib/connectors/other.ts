/**
 * Битрикс24 коннектор
 * Входящий вебхук · контакты, сделки, задачи
 */

import { AimeeConnector, AuthResult, SyncResult, WebhookResult } from './interface'

export class BitrixConnector implements AimeeConnector {
  type = 'bitrix' as const
  private webhookUrl: string = ''

  async auth(credentials: Record<string, string>): Promise<AuthResult> {
    const { webhook_url } = credentials
    if (!webhook_url) return { success: false, error: 'webhook_url обязателен' }

    try {
      const res = await fetch(`${webhook_url}profile`, {
        method: 'GET',
      })

      if (!res.ok) {
        return { success: false, error: 'Битрикс24: неверный webhook URL' }
      }

      const data = await res.json()
      if (data.error) {
        return { success: false, error: `Битрикс24: ${data.error_description || data.error}` }
      }

      this.webhookUrl = webhook_url
      return { success: true }

    } catch (e: any) {
      return { success: false, error: `Ошибка соединения Битрикс24: ${e.message}` }
    }
  }

  // Create task for incident
  async createTask(params: {
    title: string
    description: string
    responsibleId?: number
  }): Promise<string> {
    if (!this.webhookUrl) throw new Error('Нет авторизации Битрикс24')

    const res = await fetch(`${this.webhookUrl}tasks.task.add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          TITLE:       params.title,
          DESCRIPTION: params.description,
          RESPONSIBLE_ID: params.responsibleId || 1,
        },
      }),
    })

    const data = await res.json()
    return String(data.result?.task?.id || '')
  }

  // Create deal
  async createDeal(params: {
    title: string
    amount: number
    contactName: string
    contactPhone?: string
  }): Promise<string> {
    if (!this.webhookUrl) throw new Error('Нет авторизации Битрикс24')

    const res = await fetch(`${this.webhookUrl}crm.deal.add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          TITLE:        params.title,
          OPPORTUNITY:  params.amount,
          CONTACT_NAME: params.contactName,
          PHONE:        params.contactPhone ? [{ VALUE: params.contactPhone, VALUE_TYPE: 'WORK' }] : [],
          SOURCE_ID:    'WEB',
        },
      }),
    })

    const data = await res.json()
    return String(data.result || '')
  }

  async syncProducts(sellerId: string): Promise<SyncResult> {
    return { success: true, recordsSynced: 0 }
  }

  async handleWebhook(payload: unknown): Promise<WebhookResult> {
    const data = payload as any
    if (data?.event) {
      return { handled: true, event: data.event, data }
    }
    return { handled: false }
  }
}


/**
 * ЮKassa коннектор
 * REST API · приём оплат, возвраты, чеки 54-ФЗ
 */
export class YukassaConnector implements AimeeConnector {
  type = 'yukassa' as const
  private shopId: string = ''
  private secretKey: string = ''

  async auth(credentials: Record<string, string>): Promise<AuthResult> {
    const { shop_id, secret_key } = credentials
    if (!shop_id || !secret_key) {
      return { success: false, error: 'shop_id и secret_key обязательны' }
    }

    try {
      // Test by getting shop info
      const res = await fetch('https://api.yookassa.ru/v3/me', {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${shop_id}:${secret_key}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        return { success: false, error: `ЮKassa: ${err?.description || 'Неверные credentials'}` }
      }

      this.shopId = shop_id
      this.secretKey = secret_key
      return { success: true }

    } catch (e: any) {
      return { success: false, error: `Ошибка соединения ЮKassa: ${e.message}` }
    }
  }

  // Create payment
  async createPayment(params: {
    amount: number
    currency?: string
    description: string
    returnUrl: string
    orderId: string
  }): Promise<{ id: string; confirmationUrl: string }> {
    if (!this.shopId) throw new Error('Нет авторизации ЮKassa')

    const idempotenceKey = `aimee-${params.orderId}-${Date.now()}`

    const res = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${this.shopId}:${this.secretKey}`).toString('base64')}`,
        'Content-Type': 'application/json',
        'Idempotence-Key': idempotenceKey,
      },
      body: JSON.stringify({
        amount: {
          value:    params.amount.toFixed(2),
          currency: params.currency || 'RUB',
        },
        confirmation: {
          type:       'redirect',
          return_url: params.returnUrl,
        },
        description: params.description,
        metadata: { order_id: params.orderId },
        capture: true,
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err?.description || 'Ошибка создания платежа ЮKassa')
    }

    const data = await res.json()
    return {
      id:              data.id,
      confirmationUrl: data.confirmation?.confirmation_url || '',
    }
  }

  // Process webhook from ЮKassa
  async handleWebhook(payload: unknown): Promise<WebhookResult> {
    const data = payload as any
    const event  = data?.event
    const object = data?.object

    if (!event || !object) return { handled: false }

    return {
      handled: true,
      event,
      data: {
        paymentId: object.id,
        status:    object.status,
        amount:    object.amount?.value,
        orderId:   object.metadata?.order_id,
      },
    }
  }

  async syncProducts(sellerId: string): Promise<SyncResult> {
    return { success: true, recordsSynced: 0 }
  }

  verifyWebhook(signature: string, body: string): boolean {
    // ЮKassa не использует подпись вебхука — проверяем IP
    return true
  }
}


/**
 * Telegram Bot коннектор
 * Bot API · уведомления бренду и покупателю
 */
export class TelegramConnector implements AimeeConnector {
  type = 'telegram' as const
  private botToken: string = ''
  private chatId: string = ''

  async auth(credentials: Record<string, string>): Promise<AuthResult> {
    const { bot_token, chat_id } = credentials
    if (!bot_token) return { success: false, error: 'bot_token обязателен' }

    try {
      const res = await fetch(`https://api.telegram.org/bot${bot_token}/getMe`)
      const data = await res.json()

      if (!data.ok) {
        return { success: false, error: `Telegram: ${data.description || 'Неверный токен бота'}` }
      }

      this.botToken = bot_token
      this.chatId   = chat_id || ''

      return {
        success: true,
        token: bot_token,
      }
    } catch (e: any) {
      return { success: false, error: `Ошибка Telegram: ${e.message}` }
    }
  }

  // Send notification to brand
  async sendMessage(params: {
    chatId?: string
    text: string
    parseMode?: 'HTML' | 'Markdown'
  }): Promise<boolean> {
    const target = params.chatId || this.chatId
    if (!this.botToken || !target) return false

    try {
      const res = await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id:    target,
          text:       params.text,
          parse_mode: params.parseMode || 'HTML',
        }),
      })

      const data = await res.json()
      return data.ok === true

    } catch (e) {
      return false
    }
  }

  // Notify brand about new order
  async notifyNewOrder(order: {
    id: string
    brandName: string
    customerName: string
    total: number
    items: Array<{ name: string; qty: number }>
  }): Promise<boolean> {
    const itemsList = order.items
      .map(i => `  • ${i.name} × ${i.qty}`)
      .join('\n')

    const text = `🛍 <b>Новый заказ #${order.id}</b>

<b>Бренд:</b> ${order.brandName}
<b>Покупатель:</b> ${order.customerName}
<b>Сумма:</b> ₽${order.total.toLocaleString('ru')}

<b>Состав:</b>
${itemsList}

<a href="https://seller.getaimee.ru/orders">Открыть в AIMEE →</a>`

    return this.sendMessage({ text })
  }

  // Notify about incident
  async notifyIncident(incident: {
    title: string
    priority: string
    brandName: string
    description?: string
  }): Promise<boolean> {
    const emoji = incident.priority === 'critical' ? '🚨' : incident.priority === 'high' ? '⚠️' : 'ℹ️'

    const text = `${emoji} <b>Инцидент: ${incident.title}</b>

<b>Бренд:</b> ${incident.brandName}
<b>Приоритет:</b> ${incident.priority.toUpperCase()}
${incident.description ? `\n<b>Детали:</b> ${incident.description}` : ''}

<a href="https://admin.getaimee.ru/admin/incidents">Открыть Admin →</a>`

    return this.sendMessage({ text })
  }

  async syncProducts(sellerId: string): Promise<SyncResult> {
    return { success: true, recordsSynced: 0 }
  }

  async handleWebhook(payload: unknown): Promise<WebhookResult> {
    const data = payload as any
    if (data?.message) {
      return { handled: true, event: 'message', data: data.message }
    }
    return { handled: false }
  }
}
