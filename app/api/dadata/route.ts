import { NextRequest, NextResponse } from 'next/server'

const DADATA_TOKEN = process.env.DADATA_TOKEN || '282a067b6f18e215363fff4144765ae9c219b1dc'

export async function POST(req: NextRequest) {
  const { inn } = await req.json()
  
  if (!inn || !/^\d{10}(\d{2})?$/.test(inn.replace(/\s/g, ''))) {
    return NextResponse.json({ error: 'Неверный формат ИНН' }, { status: 400 })
  }

  try {
    const res = await fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Token ${DADATA_TOKEN}`,
      },
      body: JSON.stringify({ query: inn.replace(/\s/g, ''), count: 1 }),
    })

    if (!res.ok) throw new Error(`DaData error: ${res.status}`)
    const data = await res.json()

    if (!data.suggestions?.length) {
      return NextResponse.json({ error: 'Компания не найдена. Проверь ИНН.' }, { status: 404 })
    }

    const s = data.suggestions[0]
    const d = s.data

    return NextResponse.json({
      name: d.name?.short_with_opf || d.name?.full_with_opf || s.value,
      fullName: d.name?.full_with_opf || s.value,
      opf: d.opf?.short || '',
      inn: d.inn,
      kpp: d.kpp || null,
      ogrn: d.ogrn,
      address: d.address?.value || '',
      okved: d.okved,
      okvedName: d.okved_type || '',
      status: d.state?.status || '',
      director: d.management?.name || null,
      directorPost: d.management?.post || null,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Ошибка запроса' }, { status: 500 })
  }
}
