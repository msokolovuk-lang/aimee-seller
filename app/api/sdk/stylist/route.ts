import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function POST(req: NextRequest) {
  try {
    const { brand_id, message, session_id } = await req.json()

    if (!brand_id || !message) {
      return NextResponse.json({ error: 'brand_id and message required' }, { status: 400, headers: CORS })
    }

    // Get brand info for context
    const { data: seller } = await supabase
      .from('sellers')
      .select('brand_name')
      .eq('seller_id', brand_id)
      .single()

    const brandName = seller?.brand_name || brand_id

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: `Ты AI-стилист бренда ${brandName}. 
Отвечай коротко, по делу, на русском языке.
Помогаешь покупателям с выбором размера, стиля и составлением образов.
Тон: дружелюбный, профессиональный. 
Максимум 2-3 предложения на ответ.
Если не знаешь точных данных о товарах — дай общую рекомендацию и предложи уточнить у консультанта.`,
      messages: [{ role: 'user', content: message }],
    })

    const reply = response.content[0].type === 'text'
      ? response.content[0].text
      : 'Уточните вопрос, я помогу!'

    return NextResponse.json({ reply }, { headers: CORS })

  } catch (e) {
    console.error('[SDK Stylist]', e)
    return NextResponse.json(
      { reply: 'Временная ошибка. Попробуйте снова.' },
      { status: 500, headers: CORS }
    )
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS })
}
