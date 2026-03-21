import { NextRequest, NextResponse } from 'next/server'

const MS_BASE = 'https://api.moysklad.ru/api/remap/1.2'

export async function POST(request: NextRequest) {
  try {
    const { token, endpoint, params } = await request.json()

    if (!token) return NextResponse.json({ error: 'Токен не указан' }, { status: 400 })

    const url = new URL(`${MS_BASE}${endpoint}`)
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)))

    const res = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return NextResponse.json({ error: `МойСклад: ${res.status}`, details: err }, { status: res.status })
    }

    const data = await res.json()
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
