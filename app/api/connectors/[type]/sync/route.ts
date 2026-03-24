/**
 * POST /api/connectors/[type]/sync
 * Ручной или автоматический sync коннектора
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { MoyskladConnector } from '@/lib/connectors/moysklad'
import { CdekConnector } from '@/lib/connectors/cdek'
import { BitrixConnector, YukassaConnector, TelegramConnector } from '@/lib/connectors/other'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function getConnector(type: string) {
  switch (type) {
    case 'moysklad': return new MoyskladConnector()
    case 'cdek':     return new CdekConnector()
    case 'bitrix':   return new BitrixConnector()
    case 'yukassa':  return new YukassaConnector()
    case 'telegram': return new TelegramConnector()
    default:         return null
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { type: string } }
) {
  const startedAt = new Date().toISOString()
  const startMs = Date.now()

  try {
    const { type } = params
    const { seller_id } = await req.json()

    if (!seller_id) {
      return NextResponse.json({ error: 'seller_id обязателен' }, { status: 400 })
    }

    // Get connector from DB
    const { data: connectorRow, error: connErr } = await supabase
      .from('brand_connectors')
      .select('*')
      .eq('seller_id', seller_id)
      .eq('type', type)
      .single()

    if (connErr || !connectorRow) {
      return NextResponse.json({ error: 'Коннектор не найден' }, { status: 404 })
    }

    if (connectorRow.status !== 'active') {
      return NextResponse.json({ error: 'Коннектор не активен' }, { status: 422 })
    }

    const connector = getConnector(type)
    if (!connector) {
      return NextResponse.json({ error: `Тип '${type}' не поддерживается` }, { status: 400 })
    }

    // Re-auth with stored credentials
    const authResult = await connector.auth(connectorRow.credentials)
    if (!authResult.success) {
      await supabase.from('brand_connectors')
        .update({ status: 'error', last_error: authResult.error })
        .eq('id', connectorRow.id)
      return NextResponse.json({ error: authResult.error }, { status: 422 })
    }

    // Write sync log — running
    const { data: logRow } = await supabase.from('connector_sync_log').insert({
      connector_id:   connectorRow.id,
      seller_id,
      connector_type: type,
      status:         'running',
      started_at:     startedAt,
    }).select('id').single()

    // Run sync
    let syncResult = { success: false, recordsSynced: 0, error: '', details: {} as any }

    if (connector.syncProducts) {
      // МойСклад — upsert products into Supabase
      if (type === 'moysklad') {
        const ms = connector as MoyskladConnector;
        (ms as any).onProductsBatch = async (products: any[]) => {
          await supabase.from('products').upsert(
            products.map(p => ({
              seller_id:   p.seller_id,
              external_id: p.external_id,
              name:        p.name,
              description: p.description,
              price:       p.price,
              sku:         p.sku,
              is_active:   p.is_active,
              updated_at:  p.updated_at,
            })),
            { onConflict: 'seller_id,external_id', ignoreDuplicates: false }
          )
        }
      }

      syncResult = await connector.syncProducts(seller_id) as any
    }

    const finishedAt  = new Date().toISOString()
    const durationMs  = Date.now() - startMs
    const finalStatus = syncResult.success ? 'success' : 'error'

    // Update sync log
    if (logRow?.id) {
      await supabase.from('connector_sync_log').update({
        status:          finalStatus,
        records_synced:  syncResult.recordsSynced,
        error_message:   syncResult.error || null,
        finished_at:     finishedAt,
        duration_ms:     durationMs,
      }).eq('id', logRow.id)
    }

    // Update connector
    await supabase.from('brand_connectors').update({
      last_sync:            finishedAt,
      last_error:           syncResult.error || null,
      synced_records_count: connectorRow.synced_records_count + syncResult.recordsSynced,
      status:               syncResult.success ? 'active' : 'error',
    }).eq('id', connectorRow.id)

    // Create incident if error
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
