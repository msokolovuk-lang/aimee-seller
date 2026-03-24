/**
 * POST /api/customers/recommend
 * AI персонализация — рекомендации на основе профиля покупателя
 * Claude Haiku
 */
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
const supabase  = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { customer_id, seller_id, context } = await req.json()

    if (!customer_id || !seller_id) {
      return NextResponse.json({ error: 'customer_id and seller_id required' }, { status: 400 })
    }

    // Get customer profile
    const { data: customer } = await supabase
      .from('brand_customers')
      .select('*')
      .eq('id', customer_id)
      .eq('seller_id', seller_id)
      .single()

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Get brand info
    const { data: seller } = await supabase
      .from('sellers')
      .select('brand_name')
      .eq('seller_id', seller_id)
      .single()

    // Build customer context
    const profile = [
      customer.name ? `Имя: ${customer.name}` : null,
      customer.sizes ? `Размеры: ${JSON.stringify(customer.sizes)}` : null,
      customer.style_prefs?.length ? `Стиль: ${customer.style_prefs.join(', ')}` : null,
      `Заказов: ${customer.orders_count}`,
      `LTV: ₽${customer.ltv?.toLocaleString('ru') || 0}`,
      customer.tags?.length ? `Теги: ${customer.tags.join(', ')}` : null,
      customer.last_order_at
        ? `Последний заказ: ${new Date(customer.last_order_at).toLocaleDateString('ru')}`
        : 'Заказов ещё не было',
    ].filter(Boolean).join('\n')

    const prompt = context === 'stylist'
      ? `На основе профиля покупателя дай персональную рекомендацию по стилю и подбору одежды бренда ${seller?.brand_name}.`
      : `На основе профиля покупателя предложи что ему стоит купить следующим и почему. Бренд: ${seller?.brand_name}.`

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 250,
      system: `Ты AI-персонализатор для fashion-бренда ${seller?.brand_name}. 
Отвечай на русском языке, коротко (2-3 предложения), по делу.
Используй профиль покупателя для максимально персональной рекомендации.`,
      messages: [{
        role: 'user',
        content: `Профиль покупателя:\n${profile}\n\n${prompt}`,
      }],
    })

    const recommendation = response.content[0].type === 'text'
      ? response.content[0].text
      : 'Рекомендуем обратить внимание на новинки сезона.'

    return NextResponse.json({
      customer_id,
      recommendation,
      profile_summary: {
        name:         customer.name,
        orders_count: customer.orders_count,
        ltv:          customer.ltv,
        tags:         customer.tags,
      },
    })

  } catch (e: any) {
    console.error('[Recommend]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
