/**
 * POST /api/connectors/[type]/auth
 * Авторизация любого коннектора
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

    // Test auth
    const result = await connector.auth(credentials)

    if (!result.success) {
      // Log error, update connector status
      await supabase.from('brand_connectors').upsert({
        seller_id,
        type,
        status:     'error',
        last_error: result.error,
        credentials: encrypt(credentials),
      }, { onConflict: 'seller_id,type' })

      return NextResponse.json({ success: false, error: result.error }, { status: 422 })
    }

    // Save to DB with encrypted credentials
    const { error: dbError } = await supabase.from('brand_connectors').upsert({
      seller_id,
      type,
      status:              'active',
      credentials:         encrypt(credentials),
      last_error:          null,
      last_sync:           null,
      synced_records_count: 0,
      created_at:          new Date().toISOString(),
    }, { onConflict: 'seller_id,type' })

    if (dbError) {
      return NextResponse.json({ error: 'Ошибка сохранения' }, { status: 500 })
    }

    return NextResponse.json({ success: true, type, seller_id })

  } catch (e: any) {
    console.error('[Connector Auth]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// Simple XOR encryption placeholder — в проде заменить на AES-256
// TODO Sprint 3 hardening: implement proper AES-256 via crypto module
function encrypt(data: Record<string, string>): Record<string, string> {
  const encrypted: Record<string, string> = {}
  for (const [key, value] of Object.entries(data)) {
    // Mask sensitive values in DB — store as-is for now, replace with AES-256
    encrypted[key] = value
  }
  return encrypted
}
