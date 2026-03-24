import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function POST(req: NextRequest) {
  try {
    const { brand_id, product, params } = await req.json()

    const { height, size, chest, waist } = params || {}

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: `Ты AI-стилист. Определяешь размер одежды по параметрам тела.
Отвечай ТОЛЬКО в формате JSON: {"recommendation": "...", "comment": "..."}
recommendation — рекомендуемый размер (например "Рекомендуемый размер: M / 46")
comment — 1-2 предложения о посадке и подгонке.
Язык: русский.`,
      messages: [{
        role: 'user',
        content: `Товар: ${product?.name || 'одежда'}
Параметры покупателя:
- Рост: ${height || 'не указан'} см
- Российский размер: ${size || 'не указан'}
- Обхват груди: ${chest || 'не указан'} см
- Обхват талии: ${waist || 'не указан'} см

Определи рекомендуемый размер.`,
      }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
    let result: any = {}

    try {
      const clean = text.replace(/```json|```/g, '').trim()
      result = JSON.parse(clean)
    } catch {
      result = {
        recommendation: 'Рекомендуемый размер: M / 46',
        comment: 'По вашим параметрам подойдёт стандартный размер. Уточните у консультанта.',
      }
    }

    return NextResponse.json(result, { headers: CORS })

  } catch (e) {
    console.error('[SDK TryOn]', e)
    return NextResponse.json(
      { recommendation: 'Размер M', comment: 'Попробуйте стандартный размер.' },
      { headers: CORS }
    )
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS })
}
