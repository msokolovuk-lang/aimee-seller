import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const token = req.headers.get('x-seller-token') ||
    req.cookies.get('seller_token')?.value

  if (!token) return NextResponse.json({ valid: false }, { status: 401 })

  const { data: session } = await supabase
    .from('seller_sessions')
    .select('seller_id, expires_at')
    .eq('token', token)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (!session) return NextResponse.json({ valid: false }, { status: 401 })

  const { data: seller } = await supabase
    .from('sellers')
    .select('seller_id, name, brand_name, plan, is_active')
    .eq('seller_id', session.seller_id)
    .eq('is_active', true)
    .single()

  if (!seller) return NextResponse.json({ valid: false }, { status: 401 })

  return NextResponse.json({ valid: true, seller })
}

export async function DELETE(req: NextRequest) {
  const token = req.headers.get('x-seller-token') ||
    req.cookies.get('seller_token')?.value

  if (token) {
    await supabase.from('seller_sessions').delete().eq('token', token)
  }

  return NextResponse.json({ success: true })
}
