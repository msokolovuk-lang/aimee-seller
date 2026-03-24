/**
 * GET /api/admin/connectors?seller_id=xxx
 * Список коннекторов бренда — для Admin Panel
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const sellerId = req.nextUrl.searchParams.get('seller_id')
  if (!sellerId) return NextResponse.json({ error: 'seller_id required' }, { status: 400 })

  const { data, error } = await supabase
    .from('brand_connectors')
    .select('*')
    .eq('seller_id', sellerId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ connectors: data || [] })
}

export async function DELETE(req: NextRequest) {
  const { seller_id, type } = await req.json()
  if (!seller_id || !type) return NextResponse.json({ error: 'seller_id and type required' }, { status: 400 })

  const { error } = await supabase
    .from('brand_connectors')
    .update({ status: 'inactive', credentials: {}, last_error: null })
    .eq('seller_id', seller_id)
    .eq('type', type)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
