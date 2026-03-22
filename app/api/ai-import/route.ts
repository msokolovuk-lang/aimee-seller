import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════
interface RawProduct { name: string; price: string; image_url: string; description?: string; sizes?: string[] }
interface ParsedProduct { name: string; price: number; category: string; description: string; sizes: string[]; colors: string[]; image_emoji: string; image_url: string }

// ═══════════════════════════════════════════════════════════════
// FETCH UTILS
// ═══════════════════════════════════════════════════════════════
async function fetchDirect(url: string): Promise<string> {
  const r = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36', 'Accept-Language': 'ru-RU,ru;q=0.9' },
    signal: AbortSignal.timeout(12000)
  })
  if (!r.ok) throw new Error('HTTP ' + r.status)
  return r.text()
}

async function fetchScrapingBee(url: string, jsSnippet?: string): Promise<string> {
  const key = process.env.SCRAPINGBEE_API_KEY
  if (!key) throw new Error('No ScrapingBee key')
  const params = new URLSearchParams({
    api_key: key, url,
    render_js: 'true',
    block_ads: 'true',
    wait: '5000',
    ...(jsSnippet ? { js_snippet: Buffer.from(jsSnippet).toString('base64') } : {})
  })
  const r = await fetch('https://app.scrapingbee.com/api/v1/?' + params, { signal: AbortSignal.timeout(52000) })
  if (!r.ok) throw new Error('ScrapingBee ' + r.status)
  return r.text()
}

// ═══════════════════════════════════════════════════════════════
// PARSER 1: TILDA STORE (acte.website и др.)
// Признак: html содержит 't-store__card' и 'tildacdn'
// Данные: имена в .js-product-name, цены в тексте "11900rub",
//         фото в CSS background-image через optim.tildacdn.com
// ═══════════════════════════════════════════════════════════════
function parseTilda(html: string): RawProduct[] | null {
  if (!html.includes('t-store__card') || !html.includes('tildacdn')) return null

  // Имена — в элементах с классом js-product-name или t-store__card__title
  const nameMatches = Array.from(html.matchAll(
    /class="[^"]*(?:js-product-name|js-store-prod-name|t-store__card__title)[^"]*"[^>]*>\s*([^<]{2,100})/gi
  )).map(m => m[1].trim()).filter(n => n.length > 2 && !n.includes('{'))

  if (!nameMatches.length) return null

  // Цены — из js-product-price элементов (Tilda формат: "11 900" без символа валюты)
  const priceMatches = Array.from(html.matchAll(
    /js-product-price[^>]*>\s*([\d\s]{3,10})/gi
  )).map(m => m[1].replace(/\D/g, ''))
  // Fallback: число перед rub/₽/руб
  if (!priceMatches.length) {
    priceMatches.push(...Array.from(html.matchAll(/(\d[\d\s]{1,6})(?:rub|₽|руб)/gi)).map(m => m[1].replace(/\D/g, '')))
  }

  // Фото Tilda: хранятся в static.tildacdn.com/stor* через background-image
  // В HTML они закодированы как &quot; вместо кавычек
  const decodedHtml = html.replace(/&quot;/g, '"').replace(/&#34;/g, '"')
  
  // Фото Tilda: полный URL = stor{hex}/{hash}.jpg (без трансформаций)
  // В HTML есть два варианта: прямой URL и с /-/resizeb/... — берём прямой
  
  // Ищем прямые URL (без /-/) в контексте js-product-img
  const productImgUrls = Array.from(new Set(
    Array.from(decodedHtml.matchAll(
      /js-product-img[^>]+background-image\s*:\s*url\(["']?(https:\/\/static\.tildacdn\.(?:com|pub)\/stor[^/"'\s)]+\/[a-f0-9]{32}\.(?:jpg|jpeg|png|webp))["']?\)/gi
    )).map(m => m[1])
  ))

  // Fallback: все прямые stor URL на странице (без /-/)
  const fallbackUrls = Array.from(new Set(
    Array.from(decodedHtml.matchAll(
      /(https:\/\/static\.tildacdn\.(?:com|pub)\/stor[^/"'\s)]+\/[a-f0-9]{32}\.(?:jpg|jpeg|png|webp))/gi
    )).map(m => m[1])
  ))

  const imgUrls = productImgUrls.length > 0 ? productImgUrls : fallbackUrls

  return nameMatches.slice(0, 20).map((name, i) => ({
    name,
    price: priceMatches[i] || '0',
    image_url: imgUrls[i] || '',
  }))
}

// ═══════════════════════════════════════════════════════════════
// PARSER 2: NOCONCEPT.RU
// Признак: url содержит noconcept.ru
// Данные: страницы товаров по ссылкам /shop/{cat}/{id}
// ═══════════════════════════════════════════════════════════════
async function parseNoconcept(url: string, html: string): Promise<RawProduct[] | null> {
  if (!url.includes('noconcept.ru')) return null
  const base = 'https://noconcept.ru'

  // Собираем ссылки на отдельные товары
  const links = Array.from(new Set(
    Array.from(html.matchAll(/href="(\/shop\/(?:women|men)\/\d+)"/gi)).map(m => base + m[1])
  )).slice(0, 12)

  if (!links.length) return null

  const results = await Promise.allSettled(links.map(async link => {
    const h = await fetchDirect(link)
    const name = h.match(/<h1[^>]*class="[^"]*product[^"]*"[^>]*>\s*([^<]+)/i)?.[1]?.trim()
      || h.match(/<h1[^>]*>\s*([^<]{3,80})\s*<\/h1>/i)?.[1]?.trim()
    const price = h.match(/(\d[\d\s]{2,6})₽/)?.[1]?.replace(/\D/g, '')
      || h.match(/class="[^"]*price[^"]*"[^>]*>\s*([\d\s]+)/i)?.[1]?.replace(/\D/g, '')
    const imgOg = h.match(/property="og:image"[^>]*content="([^"]+)"/)?.[1] || h.match(/content="([^"]+)"[^>]*property="og:image"/)?.[1]
    const imgUploads = h.match(/https?:\/\/noconcept\.ru\/uploads\/[^\s"'<>]+\.(?:jpeg|jpg|png|webp)/)?.[0]
    const imgRelative = h.match(/\/uploads\/thumbs\/[^\s"'<>]+\.(?:jpeg|jpg|png|webp)/)?.[0]
    const img = imgOg || imgUploads || (imgRelative ? 'https://noconcept.ru' + imgRelative : '')
    return { name: name || '', price: price || '0', image_url: img || '' }
  }))

  const products = results
    .filter((r): r is PromiseFulfilledResult<RawProduct> => r.status === 'fulfilled' && !!r.value?.name && r.value.name.length > 2)
    .map(r => r.value)

  return products.length ? products : null
}

// ═══════════════════════════════════════════════════════════════
// PARSER 3: NEXT.JS SSR (12storeez, lamoda и подобные)
// Признак: html содержит __NEXT_DATA__
// ═══════════════════════════════════════════════════════════════
function parseNextJS(html: string, base: string): string | null {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  if (!m || m[1].length < 200) return null
  return '[SSR]\n' + m[1].slice(0, 4000)
}

// ═══════════════════════════════════════════════════════════════
// PARSER 4: JSON-LD Schema.org (универсальный)
// Признак: <script type="application/ld+json"> с Product
// ═══════════════════════════════════════════════════════════════
function parseJsonLd(html: string): RawProduct[] | null {
  const blocks = Array.from(html.matchAll(/<script[^>]*ld\+json[^>]*>([\s\S]*?)<\/script>/gi))
  const products: RawProduct[] = []
  for (const block of blocks) {
    try {
      const data = JSON.parse(block[1])
      const items = Array.isArray(data) ? data : data['@graph'] || [data]
      for (const item of items) {
        if (item['@type'] !== 'Product') continue
        products.push({
          name: item.name || '',
          price: String(item.offers?.price || item.offers?.lowPrice || 0),
          image_url: Array.isArray(item.image) ? item.image[0] : (item.image || ''),
          description: item.description || '',
        })
      }
    } catch {}
  }
  return products.length ? products : null
}

// ═══════════════════════════════════════════════════════════════
// PARSER 5: GTM DataLayer (WB, Ozon, крупные магазины)
// Признак: "ecommerce" или "impressions" в html
// ═══════════════════════════════════════════════════════════════
function parseDataLayer(html: string): string | null {
  const parts: string[] = []
  const p1 = /"impressions"\s*:\s*\[[\s\S]{50,}?\]/g
  const p2 = /"ecommerce"\s*:\s*\{[\s\S]{50,}?\}/g
  let m
  while ((m = p1.exec(html)) !== null) parts.push(m[0])
  while ((m = p2.exec(html)) !== null) parts.push(m[0])
  return parts.length ? '[DL]\n' + parts.join('\n').slice(0, 3000) : null
}

// ═══════════════════════════════════════════════════════════════
// PARSER 6: CLAUDE FALLBACK (для всего остального)
// Передаём чистый текст + все найденные изображения Claude
// ═══════════════════════════════════════════════════════════════
function extractTextAndImages(html: string, base: string): { text: string; imgs: string[] } {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 5000)

  const SKIP = ['logo', 'icon', 'banner', 'sprite', 'social', 'facebook', 'instagram', 'pixel', 'analytics', 'favicon']
  const imgs = Array.from(new Set(
    Array.from(html.matchAll(/(?:src|data-src|data-lazy|content)=["']([^"']+\.(?:jpg|jpeg|webp|png)[^"'?]*)/gi))
      .map(m => m[1].startsWith('http') ? m[1] : m[1].startsWith('/') ? base + m[1] : '')
      .filter(u => u && !SKIP.some(s => u.toLowerCase().includes(s)))
  )).slice(0, 20)

  return { text, imgs }
}

async function claudeFallback(richData: string[], textAndImgs: { text: string; imgs: string[] }, url: string): Promise<ParsedProduct[]> {
  const SYS = `Извлекай каталог товаров. Верни ТОЛЬКО JSON без markdown:
{"products":[{"name":"...","price":9900,"category":"...","description":"...","sizes":["S","M"],"colors":["черный"],"image_url":"https://...","image_emoji":"👗"}]}
Категории: Верхняя одежда/Платья/Юбки/Брюки/Рубашки/Трикотаж/Футболки/Аксессуары/Обувь/Другое.
- price: число в рублях ("1 990 ₽"→1990, "0" если нет)
- sizes: ["XS","S","M","L","XL"] или ["42","44","46"]
- Максимум 20 товаров. Только реальные товары.`

  const parts = ['URL: ' + url]
  if (richData.length) { parts.push('=== ДАННЫЕ ==='); richData.forEach(d => parts.push(d)) }
  if (textAndImgs.imgs.length) { parts.push('=== ФОТО ==='); parts.push(textAndImgs.imgs.join('\n')) }
  if (!richData.length) { parts.push('=== ТЕКСТ ==='); parts.push(textAndImgs.text) }
  parts.push('Извлеки до 20 товаров.')

  const msg = await claude.messages.create({
    model: 'claude-sonnet-4-20250514', max_tokens: 2000, system: SYS,
    messages: [{ role: 'user', content: parts.join('\n') }]
  })
  const t = msg.content[0]
  if (t.type !== 'text') return []

  const clean = t.text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
  try {
    const parsed = JSON.parse(clean)
    return parsed.products || []
  } catch {
    const m = clean.match(/\{[\s\S]*\}/)
    if (m) try { return JSON.parse(m[0]).products || [] } catch {}
  }
  return []
}

// ═══════════════════════════════════════════════════════════════
// CLASSIFY & ROUTE
// ═══════════════════════════════════════════════════════════════
function needsJS(html: string, url: string): boolean {
  if (['noconcept.ru', 'n-r.store', 'varvara-fashion.com'].some(d => url.includes(d))) return true
  if (html.includes('v-for=') || (html.includes('data-v-') && html.length < 30000)) return true
  if (html.includes('__nuxt') || html.includes('data-n-head')) return true
  if (html.length < 2000 || html.includes('captcha') || html.includes('cf-browser-verification')) return true
  // Tilda Store — товары рендерятся через JS, без ScrapingBee нет данных
  if (html.includes('t-store__card') && !html.includes('js-product-name')) return true
  if (html.includes('tildacdn') && !html.includes('optim.tildacdn')) return true
  return false
}

// ═══════════════════════════════════════════════════════════════
// NORMALIZE: RawProduct → ParsedProduct
// ═══════════════════════════════════════════════════════════════
function normalizeProducts(raws: RawProduct[]): ParsedProduct[] {
  const EMOJI_MAP: Record<string, string> = {
    'Платья': '👗', 'Юбки': '👗', 'Брюки': '👖', 'Рубашки': '👔',
    'Футболки': '👕', 'Трикотаж': '🧶', 'Верхняя одежда': '🧥',
    'Аксессуары': '👜', 'Обувь': '👟', 'Другое': '🏷️'
  }
  return raws.map(p => {
    const price = parseInt(String(p.price).replace(/\D/g, '') || '0') || 0
    const category = 'Другое' // Claude назначит при fallback
    return {
      name: p.name.trim().replace(/\u200b/g, ''),
      price,
      category,
      description: p.description || '',
      sizes: p.sizes || ['XS', 'S', 'M', 'L', 'XL'],
      colors: [],
      image_emoji: EMOJI_MAP[category] || '🏷️',
      image_url: p.image_url || '',
    }
  })
}

function isValidImage(url: string): boolean {
  if (!url || !url.startsWith('http')) return false
  const TRUSTED = ['tildacdn.com', 'tildacdn.pub', 'cdn.', 'static.', 'uploads/', 'upload/', '.myshopify.', 'storage.', 'media.', 'optim.']
  if (TRUSTED.some(p => url.includes(p))) return true
  const FAKE = ['example.com', 'placeholder', '/images/hoodie', '/images/tshirt', '/images/jeans', '/images/shirt', '/img/product']
  return !FAKE.some(p => url.toLowerCase().includes(p))
}

// ═══════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════
export async function POST(request: NextRequest) {
  try {
    const { url, seller_id } = await request.json()
    if (!url) return NextResponse.json({ error: 'URL обязателен' }, { status: 400 })

    const base = (() => { try { const u = new URL(url); return u.protocol + '//' + u.host } catch { return '' } })()
    let html = ''
    let method = 'none'
    let products: ParsedProduct[] = []

    // ── Step 1: загружаем HTML ──────────────────────────────────
    try { html = await fetchDirect(url); method = 'direct' } catch {}

    if (!html || needsJS(html, url)) {
      try { html = await fetchScrapingBee(url); method = 'sb' } catch {}
    }

    if (!html || html.length < 500) {
      return NextResponse.json({ error: 'Не удалось загрузить сайт — проверьте URL' }, { status: 400 })
    }

    // ── Step 2: выбираем парсер ─────────────────────────────────

    // TILDA
    const tildaProducts = parseTilda(html)
    if (tildaProducts && tildaProducts.length > 0) {
      products = normalizeProducts(tildaProducts)
      method += '+tilda'
    }

    // NOCONCEPT
    if (!products.length) {
      const noconceptProducts = await parseNoconcept(url, html).catch(() => null)
      if (noconceptProducts?.length) {
        products = normalizeProducts(noconceptProducts)
        method += '+noconcept'
      }
    }

    // JSON-LD
    if (!products.length) {
      const ldProducts = parseJsonLd(html)
      if (ldProducts?.length) {
        products = normalizeProducts(ldProducts)
        method += '+jsonld'
      }
    }

    // CLAUDE FALLBACK
    if (!products.length) {
      const richData = [parseNextJS(html, base), parseDataLayer(html)].filter((x): x is string => !!x)
      const textAndImgs = extractTextAndImages(html, base)
      const claudeProducts = await claudeFallback(richData, textAndImgs, url)
      if (claudeProducts.length) {
        products = claudeProducts
        method += '+claude'
      }
    }

    if (!products.length) {
      return NextResponse.json({
        error: 'Товары не найдены — укажите страницу категории',
        debug: {
          htmlLen: html.length,
          method,
          hasTilda: html.includes('t-store__card'),
          hasTildaCDN: html.includes('tildacdn'),
          hasOptimTilda: html.includes('optim.tildacdn'),
          namesFound: (html.match(/js-product-name/gi)||[]).length,
          pricesFound: (html.match(/\d[\d\s]{1,6}rub/gi)||[]).length,
          imgsFound: (html.match(/optim\.tildacdn/gi)||[]).length,
        }
      }, { status: 400 })
    }

    // ── Step 3: сохраняем ──────────────────────────────────────
    const { data: existing } = await supabase.from('products').select('name').eq('seller_id', seller_id)
    const existingNames = new Set((existing || []).map((p: { name: string }) => p.name))

    const rows = products
      .filter(p => p.name.length > 2 && !existingNames.has(p.name))
      .map(p => ({
        seller_id,
        name: p.name,
        price: p.price,
        category: p.category || 'Другое',
        description: p.description || '',
        sizes: p.sizes || [],
        colors: p.colors || [],
        image_emoji: p.image_emoji || '🏷️',
        images: isValidImage(p.image_url) ? [p.image_url] : [],
        is_active: true,
      }))

    if (rows.length > 0) await supabase.from('products').insert(rows)

    const noPrice = rows.filter(r => r.price === 0).length
    const noImages = rows.filter(r => r.images.length === 0).length

    return NextResponse.json({
      success: true,
      saved: rows.length,
      total: products.length,
      source: method,
      debug: { htmlLen: html.length, hasTilda: html.includes('t-store__card'), hasTildaCDN: html.includes('tildacdn'), namesFound: (html.match(/js-product-name/g)||[]).length, sampleProduct: products[0] ? { name: products[0].name, price: products[0].price, img: products[0].image_url?.slice(0,60) } : null },
      warnings: {
        no_price: noPrice > 0 ? `${noPrice} товаров без цены — добавьте вручную` : null,
        no_images: noImages > 0 ? `${noImages} товаров без фото — добавьте вручную` : null,
      }
    })

  } catch (e) {
    return NextResponse.json({ error: 'Ошибка импорта', details: String(e) }, { status: 500 })
  }
}
