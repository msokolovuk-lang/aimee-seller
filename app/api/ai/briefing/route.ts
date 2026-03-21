import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { brandName, stats, orders, activity, products } = body

    const today = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

    // топ товары по продажам
    const soldMap: Record<string, number> = {}
    ;(orders || []).filter((o: any) => !['returned'].includes(o.status)).forEach((o: any) => {
      ;(o.items || []).forEach((item: any) => {
        soldMap[item.name] = (soldMap[item.name] || 0) + (item.quantity || 1)
      })
    })
    const topProducts = Object.entries(soldMap).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, qty]) => `${name}: ${qty} шт.`).join(', ')

    // товары без продаж
    const noSales = (products || []).filter((p: any) => p.is_active && !soldMap[p.name]).slice(0, 3).map((p: any) => p.name).join(', ')

    // возвраты
    const returnOrders = (orders || []).filter((o: any) => ['returned', 'return_requested'].includes(o.status))

    // активность за последние 24ч
    const since24h = new Date(Date.now() - 86400000).toISOString()
    const recentActivity = (activity || []).filter((a: any) => a.created_at > since24h)
    const recentViews = recentActivity.filter((a: any) => a.type === 'view').length
    const recentCarts = recentActivity.filter((a: any) => a.type === 'add_to_cart').length
    const recentOrders = recentActivity.filter((a: any) => ['order_placed', 'order'].includes(a.type)).length

    const context = `
Бренд: ${brandName || 'AIMEE Seller'}
Сегодня: ${today}

Показатели:
- Выручка всего: ${stats.revenueTotal.toLocaleString('ru')} руб (сегодня: ${stats.revenueToday.toLocaleString('ru')} руб)
- Заказов всего: ${stats.ordersTotal} (новых: ${stats.ordersNew}, в пути: ${stats.ordersShipped}, доставлено: ${stats.ordersDelivered})
- Возвраты: ${stats.ordersReturned} заказов
- Средний чек: ${stats.avgCheck.toLocaleString('ru')} руб
- Конверсия из просмотров в заказы: ${stats.conversionRate}% (просмотров: ${stats.viewsTotal}, в корзину: ${stats.cartsTotal})
- AI покупателей: ${stats.aiOrdersCount}

Активность за 24 часа:
- Просмотров: ${recentViews}, добавлений в корзину: ${recentCarts}, заказов: ${recentOrders}

Каталог:
- Активных товаров: ${stats.productsActive}
- Топ продажи: ${topProducts || 'нет данных'}
- Без продаж: ${noSales || 'нет'}

Возвраты:
- Кол-во: ${returnOrders.length}
${returnOrders.slice(0, 2).map((o: any) => `- ${(o.items || []).map((i: any) => i.name).join(', ')}: ${o.total_price} руб`).join('\n')}
`.trim()

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: `Ты — AI-аналитик бренда одежды на маркетплейсе AIMEE. Анализируешь реальные данные и генерируешь утренний брифинг для основателя бренда.
Отвечай ТОЛЬКО валидным JSON без markdown, без пояснений, без \`\`\`json.
Структура:
{
  "summary": "3-4 предложения — связный вывод о состоянии бизнеса с конкретными цифрами из данных и главным приоритетом",
  "insights": [
    {
      "title": "короткий заголовок",
      "observation": "что происходит с конкретными цифрами из данных",
      "why": "почему это важно для бизнеса",
      "action": "конкретное действие",
      "impact": "ожидаемый эффект в рублях или %",
      "priority": "high | medium | low"
    }
  ],
  "decision": {
    "question": "конкретный вопрос требующий решения сегодня на основе данных",
    "context": "1-2 предложения контекста из реальных данных",
    "optionA": "вариант А (короткий)",
    "optionB": "вариант Б (короткий)"
  }
}
Ровно 3 инсайта. Используй только реальные цифры из переданных данных. Если данных мало — честно скажи что данные накапливаются и дай советы по росту.`,
      messages: [{ role: 'user', content: `Данные бренда:\n${context}\n\nСгенерируй утренний брифинг.` }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const cleaned = text.replace(/```json|```/g, '').trim()
    const data = JSON.parse(cleaned)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Briefing error:', error)
    return NextResponse.json({ success: false, error: 'Ошибка генерации брифинга' }, { status: 500 })
  }
}
