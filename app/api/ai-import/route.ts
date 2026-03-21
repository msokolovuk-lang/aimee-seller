import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const SYS = `Извлекай каталог товаров из данных сайта. Верни ТОЛЬКО JSON без markdown.
{"brand_name":"...","products":[{"name":"...","price":9900,"currency":"RUB","category":"...","description":"...","sizes":["S","M"],"colors":["черный"],"image_url":"https://...","image_emoji":"👗"}]}
Категории: Верхняя одежда/Платья/Юбки/Брюки/Рубашки/Трикотаж/Футболки/Аксессуары/Обувь/Другое.
Правила:
- price всегда число в рублях (убери пробелы, символы: "1 990 ₽" → 1990)
- если цены нет — поставь 0
- sizes: русские размеры ["XS","S","M","L","XL"] или числовые ["42","44","46"]
- image_url: полный URL фото товара (не логотип, не баннер)
- description: 1-2 предложения о товаре
- Максимум 20 товаров. Только реальные товары, не категории и не баннеры.`

function getBase(url: string): string { try { const u = new URL(url); return u.protocol + '//' + u.host } catch { return '' } }

function resolve(src: string, base: string): string {
  if (!src || src.startsWith('data:')) return ''
  if (src.startsWith('http')) return src
  if (src.startsWith('//')) return 'https:' + src
  if (src.startsWith('/')) return base + src
  return src
}

function extractDL(h: string): string | null {
  const allMatches: string[] = []
  const pat1 = /"impressions"\s*:\s*\[[\s\S]{50,}?\]/g
  const pat2 = /"ecommerce"\s*:\s*\{[\s\S]{50,}?\}/g
  let m
  while ((m = pat1.exec(h)) !== null) allMatches.push(m[0])
  while ((m = pat2.exec(h)) !== null) allMatches.push(m[0])
  if (!allMatches.length) return null

  // Extract product IDs and try to find matching image URLs in HTML
  const idMatches = allMatches.join('').matchAll(/"id"\s*:\s*"(\d{5,6})"/g)
  const ids = Array.from(idMatches).map(x => x[1])
  const imgMap: Record<string, string> = {}
  for (const id of ids) {
    const imgPat = new RegExp('(https?://[^"\\s]+/' + id + '/[^"\\s]+\\.(?:jpg|jpeg|webp|png))', 'i')
    const imgM = h.match(imgPat)
    if (imgM) imgMap[id] = imgM[1]
  }
  
  const result = allMatches.join('\n').slice(0, 4000)
  const imgSection = Object.keys(imgMap).length > 0 
    ? '\n[PRODUCT_IMAGES_BY_ID]\n' + Object.entries(imgMap).map(([id, url]) => id + ':' + url).join('\n')
    : ''
  return '[DL]\n' + result + imgSection
}

function extractLD(h: string): string | null {
  const matches = Array.from(h.matchAll(/<script[^>]*ld\+json[^>]*>([\s\S]*?)<\/script>/gi))
  const parts = matches.map(x => {
    const txt = x[1]
    if (!txt) return ''
    try { return JSON.stringify(JSON.parse(txt)).slice(0, 400) } catch { return '' }
  }).filter(Boolean).join('\n')
  return parts ? '[LD]\n' + parts.slice(0, 2000) : null
}

function extractSSR(h: string): string | null {
  const m = h.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  const d = m ? m[1] : null
  if (d && d.length > 300) return '[SSR]\n' + d.slice(0, 3000)
  return null
}

function extractImgs(h: string, base: string): string[] {
  const imgs: string[] = []
  const SKIP = ['logo', 'icon', 'banner', 'sprite', 'bg', 'background', 'social', 'facebook', 'instagram', 'vk.com', 'pixel', 'tracking', 'analytics', 'favicon', 'arrow', 'button', 'placeholder', 'blank', 'dummy', '/iblock/']
  const pat = /(?:src|data-src|data-lazy|data-original|content)=["']([^"']+\.(?:jpg|jpeg|webp|png)[^"'?]*)/gi
  let m = pat.exec(h)
  while (m !== null) {
    const u = resolve(m[1], base)
    const lower = u.toLowerCase()
    const isGood = u && !imgs.includes(u) && !SKIP.some(s => lower.includes(s))
    // приоритет — фото которые выглядят как товарные (содержат /product/, /catalog/, /upload/, /goods/, /items/)
    if (isGood) imgs.push(u)
    m = pat.exec(h)
  }
  // сортируем: product-like URLs первыми
  const priority = ['product', 'catalog', 'upload', 'goods', 'item', 'foto', 'photo', 'img', 'image']
  imgs.sort((a, b) => {
    const aScore = priority.findIndex(p => a.toLowerCase().includes(p))
    const bScore = priority.findIndex(p => b.toLowerCase().includes(p))
    const aVal = aScore === -1 ? 99 : aScore
    const bVal = bScore === -1 ? 99 : bScore
    return aVal - bVal
  })
  return Array.from(new Set(imgs)).slice(0, 25)
}

function extractTxt(h: string): string {
  return h.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, 4000)
}

async function fetchD(url: string): Promise<string> {
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 Chrome/121', 'Accept-Language': 'ru-RU,ru;q=0.9' }, signal: AbortSignal.timeout(12000) })
  if (!r.ok) throw new Error('HTTP ' + r.status)
  return r.text()
}

async function fetchSB(url: string, js = false, extractVue = false): Promise<string> {
  const k = process.env.SCRAPINGBEE_API_KEY
  if (!k) throw new Error('No SB key')
  
  const vueScript = extractVue ? `
    (function() {
      try {
        var cards = document.querySelectorAll('[class*="ProductCard"]');
        var seen = {};
        var products = [];
        cards.forEach(function(c) {
          var pd = c.__vue__ && c.__vue__.$props && c.__vue__.$props.productData;
          if (!pd || seen[pd.article]) return;
          seen[pd.article] = 1;
          var variants = pd.images && pd.images[0] && pd.images[0].variants || [];
          var preview = variants.filter(function(v){return v.name==="PRODUCT_PREVIEW"})[0] || variants[0];
          products.push({
            article: pd.article,
            name: pd.ecommerce && pd.ecommerce.name,
            price: pd.ecommerce && pd.ecommerce.price,
            color: pd.color && pd.color.title,
            category: pd.ecommerce && pd.ecommerce.category,
            image_url: preview && preview.url
          });
        });
        if (products.length > 0) {
          var el = document.createElement('div');
          el.id = '__aimee_products__';
          el.style.display = 'none';
          el.textContent = JSON.stringify(products);
          document.body.appendChild(el);
        }
      } catch(e) {}
    })();
  ` : ''
  
  const params = new URLSearchParams({
    api_key: k,
    url,
    render_js: String(js),
    block_ads: 'true',
    ...(js ? {
      wait: '5000',
      js_scenario: JSON.stringify({
        instructions: [
          { wait: 2000 },
          { scroll_y: 2000 },
          { wait: 1000 },
          { scroll_y: 4000 },
          { wait: 1000 },
        ]
      })
    } : {})
  })
  const r = await fetch('https://app.scrapingbee.com/api/v1/?' + params.toString(), { signal: AbortSignal.timeout(45000) })
  if (!r.ok) throw new Error('SB ' + r.status)
  return r.text()
}

function extractVueProducts(html: string): string | null {
  const m = html.match(/<div id="__aimee_products__"[^>]*>([^<]+)<\/div>/)
  if (!m) return null
  try {
    const products = JSON.parse(m[1])
    if (products.length > 0) return '[VUE_PRODUCTS]\n' + JSON.stringify(products)
  } catch {}
  return null
}

interface Product { name: string; price: number; category: string; description: string; sizes: string[]; colors: string[]; image_emoji: string; image_url?: string }
interface ParseResult { products?: Product[] }

async function parseHtml(html: string, url: string, base: string): Promise<ParseResult> {
  const rich = [extractVueProducts(html), extractDL(html), extractLD(html), extractSSR(html)].filter((x): x is string => x !== null)
  const imgs = extractImgs(html, base)
  const parts: string[] = ['URL: ' + url]
  if (rich.length) { parts.push('=== ДАННЫЕ ==='); rich.forEach(d => parts.push(d)) }
  if (imgs.length) { parts.push('=== ФОТО ==='); parts.push(imgs.join('\n')) }
  if (!rich.length) { parts.push('=== ТЕКСТ ==='); parts.push(extractTxt(html)) }
  parts.push('Извлеки до 20 товаров с image_url.')
  const msg = await client.messages.create({ model: 'claude-sonnet-4-20250514', max_tokens: 2000, system: SYS, messages: [{ role: 'user', content: parts.join('\n') }] })
  const t = msg.content[0]
  if (t.type !== 'text') throw new Error('bad type')
  try { return JSON.parse(t.text) } catch { const m = t.text.match(/\{[\s\S]*\}/); if (m) return JSON.parse(m[0]); throw new Error('no json') }
}

export async function POST(request: NextRequest) {
  try {
    const { url, seller_id } = await request.json()
    if (!url) return NextResponse.json({ error: 'URL обязателен' }, { status: 400 })
    const base = getBase(url)
    let html = ''
    let method = 'none'


    // noconcept.ru и n-r.store — Vue SPA, direct fetch не работает
    const alwaysSB = ['noconcept.ru', 'n-r.store', 'varvara-fashion.com'].some(d => url.includes(d))
    if (!alwaysSB) {
      try { html = await fetchD(url); method = 'direct' } catch {}
    }

    // Known SPA/Vue sites that require JS rendering
    const knownSPA = ['noconcept.ru', 'n-r.store', 'varvara-fashion.com', '12storeez.com', 'zara.com', 'hm.com', 'lamoda.ru'].some(d => url.includes(d))
    const isSPA = knownSPA
      || html.includes('{{item.') || html.includes('v-for=') || html.includes('data-v-')  // Vue
      || html.includes('ng-repeat') || html.includes('ng-for') || html.includes('angular') // Angular
      || html.includes('__nuxt') || html.includes('data-n-head')                           // Nuxt
      || html.includes('data-svelte') || html.includes('svelte')                           // Svelte
      || (html.includes('React') && html.length < 5000)                                    // React SSR empty
    const isBlocked = html.length < 2000 || html.includes('captcha') || html.includes('Cloudflare') || html.includes('cf-browser-verification')

    if (!html || isBlocked || isSPA) { try { html = await fetchSB(url, true, true); method = 'sb_js' } catch {} }

    let parsed = await parseHtml(html, url, base)

    // no retry - single ScrapingBee call to avoid timeout

    if (!parsed.products?.length) return NextResponse.json({ error: 'Товары не найдены — укажите страницу категории' }, { status: 400 })

    const { data: existing } = await supabase.from('products').select('name').eq('seller_id', seller_id)
    const existingNames = new Set((existing || []).map((p: { name: string }) => p.name))
    const isValidImageUrl = (url: string) => {
      if (!url) return false
      if (!url.startsWith('http')) return false
      // проверяем что URL реально существует на сайте (не выдуман Claude)
      const fakePatterns = ['/images/', '/img/', '/photos/']
      const realPatterns = ['/upload/', '/uploads/', '/thumbs/', '/catalog/', '/iblock/', '/files/', '/media/', '/storage/', '.myshopify.', 'cdn.', 'static.']
      const hasFake = fakePatterns.some(p => url.includes(p)) && !realPatterns.some(p => url.includes(p))
      return !hasFake
    }

    const rows = parsed.products
      .filter(p => !existingNames.has(p.name))
      .filter(p => p.name && p.name.length > 2) // убираем мусор
      .map(p => ({
        seller_id,
        name: p.name,
        price: p.price || 0,
        category: p.category || 'Другое',
        description: p.description || '',
        sizes: p.sizes || [],
        colors: p.colors || [],
        image_emoji: p.image_emoji || '👗',
        images: p.image_url && isValidImageUrl(p.image_url) ? [p.image_url] : [],
        is_active: true
      }))

    if (rows.length > 0) await supabase.from('products').insert(rows)
    const noPrice = rows.filter(r => r.price === 0).length
    const noImages = rows.filter(r => r.images.length === 0).length
    return NextResponse.json({
      success: true,
      saved: rows.length,
      total: parsed.products.length,
      source: method,
      warnings: {
        no_price: noPrice > 0 ? `${noPrice} товаров без цены — добавьте вручную` : null,
        no_images: noImages > 0 ? `${noImages} товаров без фото — добавьте вручную` : null,
      }
    })
  } catch (e) {
    return NextResponse.json({ error: 'Ошибка импорта', details: String(e) }, { status: 500 })
  }
}
