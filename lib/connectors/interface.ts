/**
 * AIMEE SDK — Universal Connector Interface
 * Sprint 3 · TZ v2.0
 * Все коннекторы реализуют этот интерфейс
 */

export type ConnectorType =
  | 'moysklad' | 'cdek' | 'bitrix' | 'amocrm' | 'retailcrm' | '1c'
  | 'tilda' | 'bitrixcms' | 'insales'
  | 'yukassa' | 'sbp' | 'tinkoff' | 'sber'
  | 'unisender' | 'sendpulse' | 'smsru'
  | 'metrika' | 'roistat' | 'telegram' | 'whatsapp'
  | 'atol' | 'mts_kassa' | 'evotor'

export type ConnectorStatus = 'inactive' | 'active' | 'error' | 'pending'

export interface AuthResult {
  success: boolean
  error?: string
  token?: string
  expiresAt?: string
}

export interface SyncResult {
  success: boolean
  recordsSynced: number
  error?: string
  details?: Record<string, unknown>
}

export interface ShippingParams {
  fromCity: string
  toCity: string
  weight: number   // kg
  length?: number  // cm
  width?: number
  height?: number
}

export interface ShippingOption {
  service: string
  price: number
  days: number
  type: string
}

export interface TrackingStatus {
  status: string
  location?: string
  updatedAt: string
  history?: Array<{ status: string; date: string; location?: string }>
}

export interface WebhookResult {
  handled: boolean
  event?: string
  data?: unknown
}

export interface Order {
  id: string
  sellerId: string
  items: Array<{ name: string; qty: number; price: number }>
  total: number
  customerName?: string
  customerPhone?: string
  customerEmail?: string
  deliveryAddress?: string
}

// ─── Core interface — every connector implements this ─────────────────────────
export interface AimeeConnector {
  type: ConnectorType

  // Auth
  auth(credentials: Record<string, string>): Promise<AuthResult>
  refreshToken?(): Promise<string>

  // Sync
  syncProducts?(sellerId: string): Promise<SyncResult>
  syncOrders?(sellerId: string): Promise<SyncResult>
  syncCustomers?(sellerId: string): Promise<SyncResult>

  // Actions
  createOrder?(order: Order): Promise<string>
  calculateShipping?(params: ShippingParams): Promise<ShippingOption[]>
  trackShipment?(externalId: string): Promise<TrackingStatus>

  // Webhooks
  handleWebhook?(payload: unknown): Promise<WebhookResult>
  verifyWebhook?(signature: string, body: string): boolean
}

// ─── Sync log helper ──────────────────────────────────────────────────────────
export interface SyncLogEntry {
  connector_id: string
  seller_id: string
  connector_type: ConnectorType
  status: 'running' | 'success' | 'error' | 'partial'
  records_synced: number
  error_message?: string
  error_code?: string
  started_at: string
  finished_at?: string
  duration_ms?: number
  meta?: Record<string, unknown>
}
