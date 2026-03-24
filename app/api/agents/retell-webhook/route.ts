/**
 * POST /api/agents/retell-webhook
 * Retell AI вебхук — статус звонка, транскрипт, результат
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { event, call } = body

    if (!call?.call_id) return NextResponse.json({ ok: true })

    const callId   = call.call_id
    const status   = call.call_status
    const duration = call.duration_ms ? Math.round(call.duration_ms / 1000) : null
    const analysis = call.call_analysis || {}

    // Determine conversion from call analysis
    const converted = analysis.custom_analysis_data?.converted === true ||
      analysis.call_summary?.toLowerCase().includes('заказ') ||
      analysis.call_summary?.toLowerCase().includes('купил') ||
      analysis.agent_task_completion_rating === 'Complete'

    // Find log entry by call_id in meta
    const { data: logEntry } = await supabase
      .from('sales_agent_log')
      .select('id, seller_id, customer_id')
      .contains('meta', { call_id: callId })
      .single()

    if (logEntry) {
      await supabase.from('sales_agent_log').update({
        status:            status === 'ended' ? (converted ? 'converted' : 'answered') : status,
        converted,
        duration_sec:      duration,
        completed_at:      status === 'ended' ? new Date().toISOString() : null,
        meta: {
          call_id:     callId,
          recording:   call.recording_url,
          transcript:  call.transcript?.slice(0, 500),
          summary:     analysis.call_summary?.slice(0, 200),
          sentiment:   analysis.user_sentiment,
        },
      }).eq('id', logEntry.id)

      // Create incident if call failed
      if (status === 'error') {
        await supabase.from('incidents').insert({
          seller_id:   logEntry.seller_id,
          type:        'connector_error',
          priority:    'medium',
          status:      'open',
          title:       'Ошибка звонка Sales Agent',
          description: `Call ID: ${callId}`,
          meta:        { call_id: callId, status },
        })
      }
    }

    return NextResponse.json({ ok: true })

  } catch (e: any) {
    console.error('[Retell Webhook]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
