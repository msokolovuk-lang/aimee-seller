/**
 * POST /api/connectors/[type]/sync
 * Sync коннектора — Фаза 1 + 2
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getConnector, MoyskladConnector } from '@/lib/connectors/factory'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(
  req: NextRequest,
  { params }: { params: { type: string } }
) {
  const startMs = Date.now()
  const startedAt = new Date().toISOString()

  try {
    const { type } = params
    const { seller_id } = await req.json()
    if (!seller_id) return NextResponse.json({ error: 'seller_id обязателен' }, { status: 400 })

    // Load connector from DB
    const { data: connectorRow, error: connErr } = await supabase
      .from('brand_connectors')
      .select('*')
      .eq('seller_id', seller_id)
      .eq('type', type)
      .single()

    if (connErr || !connectorRow) return NextResponse.json({ error: 'Коннектор не найден' }, { status: 404 })
    if (connectorRow.status !== 'active') return NextResponse.json({ error: 'Коннектор не активен' }, { status: 422 })

    const connector = getConnector(type)
    if (!connector) return NextResponse.json({ error: `Тип '${type}' не поддерживается` }, { status: 400 })

    // Re-auth
    const authResult = await connector.auth(connectorRow.credentials)
    if (!authResult.success) {
      await supabase.from('brand_connectors')
        .update({ status: 'error', last_error: authResult.error })
        .eq('id', connectorRow.id)
      return NextResponse.json({ error: authResult.error }, { status: 422 })
    }

    // Write log — running
    const { data: logRow } = await supabase.from('connector_sync_log').insert({
      connector_id:   connectorRow.id,
      seller_id,
      connector_type: type,
      status:         'running',
      started_at:     startedAt,
    }).select('id').single()

    // МойСклад — product upsert с внешним ID
    if (type === 'moysklad') {
      const ms = connector as MoyskladConnector;
      (ms as any).onProductsBatch = async (products: any[]) => {
        const rows = products.map(p => ({
          seller_id:   p.seller_id,
          external_id: p.external_id,
          name:        p.name,
          description: p.description,
          price:       p.price,
          sku:         p.sku,
          is_active:   p.is_active,
          updated_at:  p.updated_at,
        }))
        await supabase.from('products').upsert(rows, {
          onConflict: 'seller_id,external_id',
          ignoreDuplicates: false,
        })
      }
    }

    // Determine which sync method to call
    let syncResult = { success: false, recordsSynced: 0, error: '', details: {} as any }

    if (connector.syncProducts) {
      syncResult = await connector.syncProducts(seller_id) as any
    }
    // For CRM connectors — sync customers
    const connectorAny = connector as any
    if (!syncResult.recordsSynced && connectorAny.syncCustomers) {
      const r2 = await connectorAny.syncCustomers(seller_id)
      if (r2.success) syncResult = r2
    }

    const durationMs  = Date.now() - startMs
    const finishedAt  = new Date().toISOString()
    const finalStatus = syncResult.success ? 'success' : 'error'

    // Update log
    if (logRow?.id) {
      await supabase.from('connector_sync_log').update({
        status:         finalStatus,
        records_synced: syncResult.recordsSynced,
        error_message:  syncResult.error || null,
        finished_at:    finishedAt,
        duration_ms:    durationMs,
      }).eq('id', logRow.id)
    }

    // Update connector
    await supabase.from('brand_connectors').update({
      last_sync:            finishedAt,
      last_error:           syncResult.error || null,
      synced_records_count: (connectorRow.synced_records_count || 0) + syncResult.recordsSynced,
      status:               syncResult.success ? 'active' : 'error',
    }).eq('id', connectorRow.id)

    // Create incident on error
    if (!syncResult.success) {
      await supabase.from('incidents').insert({
        seller_id,
        connector_id: connectorRow.id,
        type:         'connector_error',
        priority:     'high',
        status:       'open',
        title:        `Ошибка sync: ${type}`,
        description:  syncResult.error,
        meta:         { connector_type: type, duration_ms: durationMs },
      })
    }

    return NextResponse.json({
      success:        syncResult.success,
      type,
      seller_id,
      records_synced: syncResult.recordsSynced,
      duration_ms:    durationMs,
      error:          syncResult.error || null,
    })

  } catch (e: any) {
    console.error('[Connector Sync]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
