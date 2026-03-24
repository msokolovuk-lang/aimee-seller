import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/admin', '/admin/finance', '/admin/integrations', '/api/ai-import', '/api/ai-import', '/api/sdk']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) return NextResponse.next()
  if (pathname.startsWith('/api/admin')) return NextResponse.next()
  if (pathname.startsWith('/api/activity') || pathname.startsWith('/api/products')) return NextResponse.next()
  if (pathname === '/sdk.js' || pathname.startsWith('/_next') || pathname.startsWith('/favicon')) return NextResponse.next()

  const token = req.cookies.get('seller_token')?.value

  if (!token) {
    if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Verify token in DB and check is_active
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: session } = await supabase
      .from('seller_sessions')
      .select('seller_id, expires_at')
      .eq('token', token)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (!session) {
      const res = NextResponse.redirect(new URL('/login', req.url))
      res.cookies.delete('seller_token')
      return res
    }

    const { data: seller } = await supabase
      .from('sellers')
      .select('is_active')
      .eq('seller_id', session.seller_id)
      .single()

    if (!seller?.is_active) {
      // Seller deactivated — delete session and redirect
      await supabase.from('seller_sessions').delete().eq('token', token)
      const res = NextResponse.redirect(new URL('/login?deactivated=1', req.url))
      res.cookies.delete('seller_token')
      return res
    }

    // Pass seller_id to request headers for use in pages
    const requestHeaders = new Headers(req.headers)
    requestHeaders.set('x-seller-id', session.seller_id)
    return NextResponse.next({ request: { headers: requestHeaders } })

  } catch {
    // On error — allow through (don't break the app)
    return NextResponse.next()
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.*).*)'],
}
