import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const CATALOG = [
  { sku: 'VF-441', name: 'Пальто oversize', category: 'Верхняя одежда', price: 24900, costPrice: 9800 },
  { sku: 'VF-089', name: 'Брюки wide leg', category: 'Брюки', price: 12900, costPrice: 4100 },
  { sku: 'VF-661', name: 'Свитер кашемир', category: 'Трикотаж', price: 19900, costPrice: 6200 },
  { sku: 'VF-774', name: 'Куртка утеплённая', category: 'Верхняя одежда', price: 29900, costPrice: 11200 },
  { sku: 'VF-517', name: 'Худи oversize', category: 'Трикотаж', price: 11900, costPrice: 3800 },
  { sku: 'VF-203', name: 'Рубашка лён', category: 'Рубашки', price: 8900, costPrice: 2900 },
  { sku: 'VF-108', name: 'Футболка базовая', category: 'Футболки', price: 4900, costPrice: 1200 },
  { sku: 'VF-332', name: 'Джинсы прямые', category: 'Брюки', price: 13900, costPrice: 5400 },
]

export async function POST(request: NextRequest) {
  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `Ты аналитик цен для fashion-бренда Varvara Fashion на российском рынке.

Наш каталог:
${CATALOG.map(p => `- ${p.name} (${p.sku}): наша цена ₽${p.price}, себестоимость ₽${p.costPrice}`).join('\n')}

Рыночный контекст (актуальные данные):
- 12 STOREEZ: пальто ₽21 500 (снизили с ₽27 900), трикотаж ₽15 000–22 000
- Zarina: брюки ₽8 900–13 500, рубашки ₽6 900–9 900
- Befree: худи ₽8 900–11 400, джинсы ₽10 900–14 900
- Sela: футболки ₽3 900–5 900, куртки ₽19 900–27 900
- Средний сезонный тренд: весна, спрос на лёгкие вещи растёт

Проанализируй наши цены и верни СТРОГО JSON без markdown:
{
  "summary": "2-3 предложения: общая картина по ценам",
  "items": [
    {
      "sku": "артикул",
      "name": "название",
      "our_price": число,
      "market_min": число,
      "market_max": число,
      "competitor": "название конкурента с минимальной ценой",
      "status": "ok" | "warning" | "critical",
      "recommendation": число или null,
      "reason": "краткое объяснение (1 предложение)"
    }
  ]
}`
      }]
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const clean = text.replace(/```json|```/g, '').trim()
    const data = JSON.parse(clean)

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
