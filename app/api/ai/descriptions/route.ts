import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: NextRequest) {
  try {
    const { product } = await request.json()
    if (!product) return NextResponse.json({ error: 'Нет данных о товаре' }, { status: 400 })

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `Ты копирайтер для fashion-бренда Varvara Fashion (минималистичная одежда, Россия).

Товар: ${product.name}
Артикул: ${product.sku}
Категория: ${product.category}
Цена: ₽${product.price}

Напиши продающее описание для маркетплейса. Строго в формате JSON (без markdown, без пояснений):
{
  "title": "заголовок карточки (до 60 символов, SEO)",
  "description": "описание (2-3 предложения, 80-120 слов, продающий тон, минималистичный стиль бренда)",
  "tags": ["тег1", "тег2", "тег3", "тег4", "тег5"],
  "seo_title": "SEO заголовок для поиска (до 80 символов)"
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
