import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const SP_BUYER = `Ты — AI-агент покупателя на маркетплейсе AIMEE. Торгуешься за лучшую цену для покупателя.
Правила:
- Отвечай коротко: 2-3 предложения максимум
- Используй аргументы: цена конкурентов, объём покупки, лояльность, сезонность
- Начинай с предложения на 15-25% ниже стартовой цены
- Каждый раунд немного уступай, но не сразу соглашайся
- На 4-5 раунде можешь принять финальное предложение
- Отвечай на русском языке`

const SP_SELLER = `Ты — AI-агент бренда на маркетплейсе AIMEE. Защищаешь маржу бренда, но хочешь закрыть сделку.
Правила:
- Отвечай коротко: 2-3 предложения максимум
- Используй аргументы: качество, уникальность, бренд-ценность, ограниченный остаток
- Начинай с минимальной скидки 3-5%
- Каждый раунд чуть уступай
- Можешь предлагать альтернативы: бесплатная доставка, подарок, скидка на следующий заказ
- На 4-5 раунде предлагай финальную цену
- Отвечай на русском языке`

export async function POST(request: NextRequest) {
  try {
    const { product, startPrice, history, role } = await request.json()

    const systemPrompt = role === 'buyer' ? SP_BUYER : SP_SELLER
    const contextMsg = `Товар: ${product.name} (${product.id})
Стартовая цена: ₽${startPrice.toLocaleString('ru-RU')}
Себестоимость бренда: ₽${Math.round(startPrice * 0.45).toLocaleString('ru-RU')}
Минимальная цена бренда: ₽${Math.round(startPrice * 0.82).toLocaleString('ru-RU')}
Остаток на складе: ${product.stock} шт`

    const messages = [
      { role: 'user' as const, content: contextMsg },
      { role: 'assistant' as const, content: 'Понял контекст, готов к переговорам.' },
      ...history.map((msg: { role: string; content: string }) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
    ]

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system: systemPrompt,
      messages,
    })

    const content = response.content[0]
    if (content.type !== 'text') throw new Error('Unexpected response type')

    return NextResponse.json({ success: true, message: content.text })
  } catch (error) {
    console.error('A2A error:', error)
    return NextResponse.json({ error: 'Ошибка переговоров', details: String(error) }, { status: 500 })
  }
}
