import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const VALID_EVENTS = [
  'view', 'add_to_cart', 'purchase',
  'tryon_click', 'tryon_submit',
  'stylist_open', 'stylist_message',
]

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { brand_id, session_id, type, url, ts, ...meta } = body

    if (!brand_id || !type) {
      return NextResponse.json({ error: 'brand_id and type required' }, { status: 400, headers: CORS })
    }

    if (!VALID_EVENTS.includes(type)) {
      return NextResponse.json({ error: 'Unknown event type' }, { status: 400, headers: CORS })
    }

    await supabase.from('buyer_activity').insert({
      seller_id:  brand_id,
      session_id: session_id || null,
      type,
      url:        url || null,
      data:       { ts, ...meta },
      created_at: new Date().toISOString(),
    })

    return NextResponse.json({ ok: true }, { headers: CORS })

  } catch (e) {
    console.error('[SDK Event]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500, headers: CORS })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS })
}
