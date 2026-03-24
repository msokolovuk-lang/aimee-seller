/**
 * POST /api/connectors/[type]/auth
 * Авторизация любого коннектора — Фаза 1 + 2
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getConnector } from '@/lib/connectors/factory'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(
  req: NextRequest,
  { params }: { params: { type: string } }
) {
  try {
    const { type } = params
    const { seller_id, credentials } = await req.json()

    if (!seller_id || !credentials) {
      return NextResponse.json({ error: 'seller_id и credentials обязательны' }, { status: 400 })
    }

    const connector = getConnector(type)
    if (!connector) {
      return NextResponse.json({ error: `Коннектор '${type}' не поддерживается` }, { status: 400 })
    }

    const result = await connector.auth(credentials)

    if (!result.success) {
      await supabase.from('brand_connectors').upsert({
        seller_id,
        type,
        status:     'error',
        last_error: result.error,
        credentials,
      }, { onConflict: 'seller_id,type' })
      return NextResponse.json({ success: false, error: result.error }, { status: 422 })
    }

    await supabase.from('brand_connectors').upsert({
      seller_id,
      type,
      status:              'active',
      credentials,
      last_error:          null,
      synced_records_count: 0,
    }, { onConflict: 'seller_id,type' })

    return NextResponse.json({ success: true, type, seller_id })

  } catch (e: any) {
    console.error('[Connector Auth]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
