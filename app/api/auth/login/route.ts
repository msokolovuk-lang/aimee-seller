import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { seller_id, password } = await req.json()

  if (!seller_id || !password) {
    return NextResponse.json({ error: 'Укажите логин и пароль' }, { status: 400 })
  }

  // Find seller
  const { data: seller, error } = await supabase
    .from('sellers')
    .select('*')
    .eq('seller_id', seller_id.toLowerCase().trim())
    .eq('is_active', true)
    .single()

  if (error || !seller) {
    return NextResponse.json({ error: 'Неверный логин или пароль' }, { status: 401 })
  }

  // Check password — PLAIN: prefix for pilot phase, will upgrade to bcrypt later
  const isValid = seller.password_hash === `PLAIN:${password}` ||
                  seller.password_hash === password

  if (!isValid) {
    return NextResponse.json({ error: 'Неверный логин или пароль' }, { status: 401 })
  }

  // Create session token
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days

  await supabase.from('seller_sessions').insert({
    seller_id: seller.seller_id,
    token,
    expires_at: expiresAt.toISOString(),
  })

  // Update last_login
  await supabase.from('sellers')
    .update({ last_login: new Date().toISOString() })
    .eq('seller_id', seller.seller_id)

  return NextResponse.json({
    success: true,
    token,
    seller: {
      seller_id: seller.seller_id,
      name: seller.name,
      brand_name: seller.brand_name,
      plan: seller.plan,
    },
    expires_at: expiresAt.toISOString(),
  })
}
