import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'aimee-admin-2025'

// GET /api/admin/sellers — list all sellers
export async function GET(req: NextRequest) {
  if (req.headers.get('x-admin-secret') !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data } = await supabase
    .from('sellers')
    .select('seller_id, name, brand_name, email, plan, is_active, created_at, last_login')
    .order('created_at', { ascending: false })

  return NextResponse.json({ sellers: data || [] })
}

// POST /api/admin/sellers — create new seller
export async function POST(req: NextRequest) {
  if (req.headers.get('x-admin-secret') !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { brand_name, name, email, plan = 'pilot' } = await req.json()

  if (!brand_name || !name) {
    return NextResponse.json({ error: 'brand_name and name required' }, { status: 400 })
  }

  // Generate seller_id from brand name
  const seller_id = brand_name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 20) + '-' + randomBytes(2).toString('hex')

  // Generate random password
  const password = randomBytes(4).toString('hex').toUpperCase() + '-' +
                   randomBytes(3).toString('hex').toUpperCase()

  const { data, error } = await supabase.from('sellers').insert({
    seller_id,
    name,
    brand_name,
    email: email || null,
    password_hash: `PLAIN:${password}`,
    plan,
    is_active: true,
  }).select().single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    seller_id,
    password,
    login_url: `https://aimee-seller.vercel.app/login`,
    buyer_url: `https://aimee-buyer.vercel.app/stylist?seller=${seller_id}`,
    credentials: {
      login: seller_id,
      password,
    },
    seller: data,
  })
}

// DELETE /api/admin/sellers — remove seller
export async function DELETE(req: NextRequest) {
  if (req.headers.get('x-admin-secret') !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { seller_id } = await req.json()
  if (!seller_id) return NextResponse.json({ error: 'seller_id required' }, { status: 400 })

  // Delete sessions first, then seller
  await supabase.from('seller_sessions').delete().eq('seller_id', seller_id)
  const { error } = await supabase.from('sellers').delete().eq('seller_id', seller_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
export async function PATCH(req: NextRequest) {
  if (req.headers.get('x-admin-secret') !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { seller_id, is_active, plan, password } = await req.json()

  const updates: Record<string, unknown> = {}
  if (is_active !== undefined) updates.is_active = is_active
  if (plan) updates.plan = plan
  if (password) updates.password_hash = `PLAIN:${password}`

  const { error } = await supabase.from('sellers')
    .update(updates)
    .eq('seller_id', seller_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
