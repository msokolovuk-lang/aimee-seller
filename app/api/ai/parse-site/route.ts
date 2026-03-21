import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `Ты — AI-агент AIMEE. Извлекай каталог товаров из данных сайта бренда одежды.

Верни ТОЛЬКО валидный JSON без markdown, без пояснений.

{
  "brand_name": "название бренда",
  "brand_description": "описание 1-2 предложения",
  "products": [
    {
      "name": "название товара",
      "price": 9900,
      "currency": "RUB",
      "category": "категория",
      "description": "описание",
      "sizes": ["XS","S","M","L","XL"],
      "colors": ["чёрный"],
      "image_url": "https://полный_url_картинки",
      "image_emoji": "👗"
    }
  ]
}

Правила:
- image_url: используй реальные URL из данных если есть
- price: число без пробелов ("9 800" -> 9800)
- category: Верхняя одежда / Платья / Юбки / Брюки / Рубашки / Трикотаж / Футболки / Аксессуары / Обувь / Другое
- Максимум 20 товаров`

function getBaseUrl(url: string) {
  try { const u = new URL(url); return u.protocol + '//' + u.host } catch { return '' }
}

function resolveUrl(src: string, base: string) {
  if (!src || src.startsWith('data:')) return ''
  if (src.startsWith('http')) return src
  if (src.startsWith('//')) return 'https:' + src
  if (src.startsWith('/')) return base + src
  return src
}

function extractDataLayer(html: string): string | null {
  const m = html.match(/dataLayer\s*[=.push(]*\s*(\[[\s\S]{200,}?\]);/)
    || html.match(/"impressions"\s*:\s*\[[\s\S]{100,}?\]/)
    || html.match(/"ecommerce"\s*:\s*\{[\s\S]{100,}?\}/)
  if (m) return '[DATALAYER]\n' + m[0].slice(0, 3000)
  return null
}

function extractJsonLD(html: string): string | null {
  const matches = Array.from(html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi))
  if (!matches.length) return null
  const data = matches.map(m => { try { return JSON.stringify(JSON.parse(m[1])).slice(0, 1000) } catch { return '' } }).filter(Boolean).join('\n')
  return data ? '[JSONLD]\n' + data.slice(0, 2000) : null
}

function extractSSRData(html: string): string | null {
  const patterns = [
    /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/,
    /window\.__NUXT__\s*=\s*(\{[\s\S]{200,}?\});/,
    /window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]{200,}?\});/,
  ]
  for (const pat of patterns) {
    const m = html.match(pat)
    if (m?.[1] && m[1].length > 300) return '[SSR]\n' + m[1].slice(0, 3000)
  }
  return null
}

function extractInlineJSON(html: string): string | null {
  const patterns = [
    /"products"\s*:\s*\[[\s\S]{100,}?\]/,
    /"items"\s*:\s*\[[\s\S]{100,}?\]/,
    /var\s+products\s*=\s*(\[[\s\S]{100,}?\]);/,
  ]
  for (const pat of patterns) {
    const m = html.match(pat)
    if (m) return '[INLINE]\n' + m[0].slice(0, 2000)
  }
  return null
}

function extractImages(html: string, base: string): string[] {
  const imgs: string[] = []
  const pat = /(?:src|data-src|data-lazy|content)=["']([^"']+\.(?:jpg|jpeg|webp|png|avif)[^"'?]*)/gi
  let m
  while ((m = pat.exec(html)) !== null) {
    const url = resolveUrl(m[1], base)
    if (url && !imgs.includes(url) && !url.includes('logo') && !url.includes('icon') && !url.includes('favicon')) {
      imgs.push(url)
    }
  }
  return Array.from(new Set(imgs)).slice(0, 20)
}

function extractText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/data:image\/[^"';]+/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 3000)
}

async function fetchDirect(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
      'Accept-Language': 'ru-RU,ru;q=0.9',
    },
    signal: AbortSignal.timeout(12000),
  })
  if (!res.ok) throw new Error('HTTP ' + res.status)
  return res.text()
}

async function fetchSB(url: string, js = false): Promise<string> {
  const key = process.env.SCRAPINGBEE_API_KEY
  if (!key) throw new Error('No ScrapingBee key')
  const sbUrl = 'https://app.scrapingbee.com/api/v1/?api_key=' + key + '&url=' + encodeURIComponent(url) + '&render_js=' + js + (js ? '&wait=4000' : '') + '&block_ads=true'
  const res = await fetch(sbUrl, { signal: AbortSignal.timeout(35000) })
  if (!res.ok) throw new Error('SB ' + res.status)
  return res.text()
}

export async function POST(request: NextRequest) {
  try {
    const { url, limit = 20 } = await request.json()
    if (!url) return NextResponse.json({ error: 'URL обязателен' }, { status: 400 })
    const base = getBaseUrl(url)
    let html = ''
    let method = 'none'

    try { html = await fetchDirect(url); method = 'direct' } catch {}

    const isSPA = html.includes('{{item.') || html.includes('v-for=') || (html.includes('__vue') && !html.includes('__NEXT_DATA__'))
    const isBlocked = html.length < 2000 || html.includes('captcha') || html.includes('Cloudflare')

    if (!html || isBlocked || isSPA) {
      try { html = await fetchSB(url, true); method = 'scrapingbee_js' } catch {}
    }

    const richData = [
      extractDataLayer(html),
      extractJsonLD(html),
      extractSSRData(html),
      extractInlineJSON(html),
    ].filter(Boolean)

    const images = extractImages(html, base)
    const text = extractText(html)

    const parts = ['URL: ' + url, 'Домен: ' + base, 'Метод: ' + method, '']
    if (richData.length) {
      parts.push('=== ДАННЫЕ ТОВАРОВ ===')
      richData.forEach(d => parts.push(d!))
    }
    if (images.length) {
      parts.push('\n=== ФОТО ТОВАРОВ (используй для image_url) ===')
      parts.push(images.join('\n'))
    }
    if (!richData.length) {
      parts.push('\n=== ТЕКСТ СТРАНИЦЫ ===')
      parts.push(text)
    }
    if (isSPA) parts.push('\n[SPA-сайт: если мало данных — создай реалистичный каталог на основе URL и домена]')
    parts.push('\nИзвлеки до ' + limit + ' товаров. Включи image_url для каждого товара.')

    const msg = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: parts.join('\n') }],
    })

    const content = msg.content[0]
    if (content.type !== 'text') throw new Error('Bad response type')
    let parsed
    try { parsed = JSON.parse(content.text) }
    catch { const m = content.text.match(/\{[\s\S]*\}/); if (m) parsed = JSON.parse(m[0]); else throw new Error('Cannot parse JSON') }

    // Retry if no products found
    if (!parsed.products || parsed.products.length === 0) {
      if (method !== 'scrapingbee_js') {
        try {
          const html2 = await fetchSB(url, true)
          const base2 = base
          const isSPA2 = html2.includes('{{item.') || html2.includes('v-for=')
          const richData2 = [extractDataLayer(html2), extractJsonLD(html2), extractSSRData(html2), extractInlineJSON(html2)].filter(Boolean)
          const images2 = extractImages(html2, base2)
          const text2 = extractText(html2)
          const parts2 = ['URL: ' + url, 'Метод: scrapingbee_js_retry', '']
          if (richData2.length) { parts2.push('=== ДАННЫЕ ТОВАРОВ ==='); richData2.forEach(d => parts2.push(d!)) }
          if (images2.length) { parts2.push('\n=== ФОТО ТОВАРОВ ==='); parts2.push(images2.join('\n')) }
          if (!richData2.length) { parts2.push('\n=== ТЕКСТ СТРАНИЦЫ ==='); parts2.push(text2) }
          parts2.push('\nИзвлеки до ' + limit + ' товаров.')
          const msg2 = await client.messages.create({ model: 'claude-sonnet-4-20250514', max_tokens: 2000, system: SYSTEM_PROMPT, messages: [{ role: 'user', content: parts2.join('\n') }] })
          const t2 = msg2.content[0]
          if (t2.type === 'text') {
            try { parsed = JSON.parse(t2.text) } catch { const m2 = t2.text.match(/\{[\s\S]*\}/); if (m2) parsed = JSON.parse(m2[0]) }
            method = 'scrapingbee_js_retry'
          }
        } catch {}
      }
    }

    return NextResponse.json({ success: true, data: parsed, source: method })
  } catch (e) {
    return NextResponse.json({ error: 'Ошибка парсинга', details: String(e) }, { status: 500 })
  }
}
