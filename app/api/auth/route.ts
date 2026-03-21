import { NextRequest, NextResponse } from 'next/server'

const PASSWORD = process.env.SITE_PASSWORD || 'aimee2026'

export async function POST(req: NextRequest) {
  const { password } = await req.json()

  if (password !== PASSWORD) {
    return NextResponse.json({ error: 'Неверный пароль' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set('aimee_access', PASSWORD, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 30, // 30 дней
    path: '/',
    sameSite: 'lax',
  })
  return res
}
