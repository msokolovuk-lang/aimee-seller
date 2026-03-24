/**
 * AIMEE AI Sales Agent — Retell AI
 * Sprint 6 · TZ v2.0
 * Звонки + Email + Telegram
 * Платформа: Retell AI (retellai.com) — $0.07/мин, 31+ языков, русский поддерживается
 */

// ─── Retell AI client ─────────────────────────────────────────────────────────

const RETELL_BASE = 'https://api.retellai.com'

export interface RetellCallResult {
  call_id: string
  status: 'initiated' | 'ringing' | 'in_progress' | 'ended' | 'error'
  duration_seconds?: number
  recording_url?: string
  transcript?: string
  call_analysis?: {
    call_summary?: string
    user_sentiment?: string
    agent_task_completion_rating?: string
    custom_analysis_data?: Record<string, any>
  }
}

export interface SalesAgentParams {
  sellerId: string
  customerId: string
  customerPhone: string
  customerName: string
  triggerType: 'abandoned_cart' | 'reactivation' | 'upsell' | 'birthday'
  brandName: string
  context?: Record<string, any>
}

// ─── Call scripts ─────────────────────────────────────────────────────────────

const SCRIPTS: Record<string, string> = {
  abandoned_cart: `Ты — AI ассистент бренда {brandName}. 
Позвони покупателю {customerName} и мягко напомни, что он оставил товары в корзине.
Уточни, есть ли вопросы по товару или доставке. Предложи помощь с оформлением.
Будь дружелюбным, не навязчивым. Не более 2 минут разговора.
Если не берут трубку — оставь голосовое сообщение.`,

  reactivation: `Ты — AI ассистент бренда {brandName}.
Позвони покупателю {customerName}, который давно не делал заказов.
Сообщи о новой коллекции или специальном предложении для постоянных покупателей.
Спроси о предпочтениях в стиле и размере. Предложи персональную подборку.
Тон: теплый, персональный. Не более 3 минут.`,

  upsell: `Ты — AI ассистент бренда {brandName}.
Позвони покупателю {customerName} после его последнего заказа.
Уточни, всё ли понравилось. Предложи дополняющие товары к тому, что он купил.
Если доволен — попроси оставить отзыв. Если есть вопросы — помоги.
Тон: заботливый, ненавязчивый. Не более 2 минут.`,

  birthday: `Ты — AI ассистент бренда {brandName}.
Позвони покупателю {customerName} и поздравь с днем рождения.
Сообщи о персональной скидке 15% как подарке от бренда.
Уточни, есть ли что-то, что он давно хотел купить.
Тон: праздничный, радостный. Не более 2 минут.`,
}

// ─── Retell AI API ────────────────────────────────────────────────────────────

export async function createRetellCall(params: {
  apiKey: string
  fromNumber: string
  toNumber: string
  agentId: string
  retellLlmDynamicVariables?: Record<string, string>
}): Promise<RetellCallResult> {
  const res = await fetch(`${RETELL_BASE}/v2/create-phone-call`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from_number: params.fromNumber,
      to_number: params.toNumber,
      override_agent_id: params.agentId,
      retell_llm_dynamic_variables: params.retellLlmDynamicVariables || {},
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Retell API: ${err.message || res.status}`)
  }

  const data = await res.json()
  return {
    call_id: data.call_id,
    status: data.call_status || 'initiated',
  }
}

export async function getRetellCallStatus(apiKey: string, callId: string): Promise<RetellCallResult> {
  const res = await fetch(`${RETELL_BASE}/v2/get-call/${callId}`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  })
  if (!res.ok) throw new Error(`Retell get-call: ${res.status}`)
  const data = await res.json()
  return {
    call_id: data.call_id,
    status: data.call_status,
    duration_seconds: data.duration_ms ? Math.round(data.duration_ms / 1000) : undefined,
    recording_url: data.recording_url,
    transcript: data.transcript,
    call_analysis: data.call_analysis,
  }
}

export async function createRetellAgent(params: {
  apiKey: string
  agentName: string
  llmId: string
  voiceId: string
  language?: string
}): Promise<string> {
  const res = await fetch(`${RETELL_BASE}/create-agent`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      agent_name: params.agentName,
      response_engine: {
        type: 'retell-llm',
        llm_id: params.llmId,
      },
      voice_id: params.voiceId,
      language: params.language || 'ru-RU',
      opt_out_sensitive_data_storage: false,
    }),
  })
  if (!res.ok) throw new Error(`Retell create-agent: ${res.status}`)
  const data = await res.json()
  return data.agent_id
}

export async function createRetellLLM(params: {
  apiKey: string
  brandName: string
  triggerType: string
}): Promise<string> {
  const script = SCRIPTS[params.triggerType] || SCRIPTS.reactivation
  const prompt = script
    .replace(/{brandName}/g, params.brandName)
    .replace(/{customerName}/g, '{{customer_name}}')

  const res = await fetch(`${RETELL_BASE}/create-retell-llm`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet',
      general_prompt: prompt,
      general_tools: [],
      begin_message: `Здравствуйте, это звонок от ${params.brandName}. Удобно говорить?`,
    }),
  })
  if (!res.ok) throw new Error(`Retell create-llm: ${res.status}`)
  const data = await res.json()
  return data.llm_id
}
