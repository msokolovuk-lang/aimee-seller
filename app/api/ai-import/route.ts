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
- price всегда число в рублях ("1 990 ₽" → 1990)
- если цены нет — поставь 0
- sizes: ["XS","S","M","L","XL"] или ["42","44","46"]
- image_url: полный URL фото товара
- description: 1-2 предложения
- Максимум 20 товаров. Только реальные товары.`

function getBase(url: string) { try { const u = new URL(url); return u.protocol + '//' + u.host } catch { return '' } }
function resolve(src: string, base: string) {
  if (!src || src.startsWith('data:')) return ''
  if (src.startsWith('http')) return src
  if (src.startsWith('//')) return 'https:' + src
  if (src.startsWith('/')) return base + src
  return src
}

// ── NOCONCEPT DIRECT ─────────────────────────────────────────────────────────
// noconcept.ru загружает каталог через Vue hydration — данные есть в HTML через
// серверный рендеринг начального состояния. Извлекаем напрямую из HTML структуры.
async function fetchNoconcept(url: string, html: string): Promise<string | null> {
  if (!url.includes('noconcept.ru')) return null
  const base = 'https://noconcept.ru'
  
  // Ищем ссылки на страницы товаров в HTML
  const productLinks = Array.from(new Set(
    Array.from(html.matchAll(/href="(\/shop\/(?:women|men)\/\d+)"/gi)).map(m => base + m[1])
  )).slice(0, 15)
  
  if (productLinks.length === 0) return null
  
  // Загружаем первые 10 страниц товаров параллельно
  const productPages = await Promise.allSettled(
    productLinks.slice(0, 10).map(async (link) => {
      try {
        const h = await fetchD(link)
        // Извлекаем название
        const nameMatch = h.match(/<h1[^>]*class="[^"]*product[^"]*"[^>]*>([^<]+)</)
          || h.match(/<h1[^>]*>([^<]{3,80})<\/h1>/)
        // Извлекаем цену
        const priceMatch = h.match(/class="[^"]*price[^"]*"[^>]*>([\d\s]+)/)
          || h.match(/(\d[\d\s]{3,6})₽/)
        // Извлекаем главное фото
        const imgMatch = h.match(/https?:\/\/noconcept\.ru\/uploads\/[^"'\s]+\.jpeg/)
        return {
          name: nameMatch?.[1]?.trim() || '',
          price: (priceMatch?.[1] || '0').replace(/\D/g, ''),
          image_url: imgMatch?.[0] || '',
          link
        }
      } catch { return null }
    })
  )
  
  const products = productPages
    .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled' && !!r.value?.name)
    .map(r => r.value)
    .filter(p => p.name.length > 2)
  
  if (!products.length) return null
  return '[NOCONCEPT]\n' + JSON.stringify(products)
}

// ── TILDA STORE ──────────────────────────────────────────────────────────────
function extractTilda(h: string, base: string): string | null {
  if (!h.includes('tildacdn') && !h.includes('t-store__card')) return null
  const names = Array.from(h.matchAll(/<div[^>]*t-store__card-title[^>]*>([^<]{3,80})<\/div>/gi)).map(m => m[1].trim())
  const prices = Array.from(h.matchAll(/(\d[\d\s]{2,6})(?:rub|₽|руб)/gi)).map(m => m[1].replace(/\s/g, ''))
  const imgs = Array.from(new Set(Array.from(h.matchAll(/https?:\/\/(?:thb|static)\.tildacdn\.com\/[^"'\s]+\.(?:jpg|jpeg|webp|png)/gi)).map(m => m[0]))).slice(0, 20)
  if (!names.length) return null
  const products = names.map((name, i) => ({ name, price: prices[i] || '0', image_url: imgs[i] || '' }))
  return '[TILDA]\n' + JSON.stringify(products).slice(0, 3000)
}

// ── VUE ITEMS JS сценарий (выполняется в браузере через ScrapingBee) ─────────
const VUE_SCRIPT = `(function(){try{
  var els=document.querySelectorAll('*'),items=null,base=location.origin;
  for(var i=0;i<els.length;i++){
    var v=els[i].__vue__;
    if(v&&v.$data&&Array.isArray(v.$data.items)&&v.$data.items.length>0){
      var f=v.$data.items[0];
      if(f.name&&(f.price||f.price===0)){items=v.$data.items.slice(0,20);break;}
    }
  }
  if(items){
    var p=items.map(function(x){
      var img='';
      if(x.image){img=x.image.jpeg||x.image.webp||'';if(img&&img.startsWith('/'))img=base+img;}
      var pr=String(x.price_special&&x.price_special!=='0'?x.price_special:x.price).replace(/\s/g,'');
      return{name:x.name,price:pr,image_url:img,link:x.link?base+x.link:''};
    });
    var el=document.createElement('div');el.id='__av__';el.style.display='none';
    el.textContent=JSON.stringify(p);document.body.appendChild(el);return;
  }
  var cards=document.querySelectorAll('[class*="ProductCard"]'),seen={},p2=[];
  cards.forEach(function(c){
    var pd=c.__vue__&&c.__vue__.$props&&c.__vue__.$props.productData;
    if(!pd||seen[pd.article])return;seen[pd.article]=1;
    var v=(pd.images&&pd.images[0]&&pd.images[0].variants)||[];
    var pv=v.filter(function(x){return x.name==="PRODUCT_PREVIEW";})[0]||v[0];
    p2.push({name:pd.ecommerce&&pd.ecommerce.name,price:pd.ecommerce&&pd.ecommerce.price,image_url:pv&&pv.url});
  });
  if(p2.length>0){
    var el2=document.createElement('div');el2.id='__av__';el2.style.display='none';
    el2.textContent=JSON.stringify(p2);document.body.appendChild(el2);
  }
}catch(e){}})();`

function extractVueItems(html: string): string | null {
  const m = html.match(/<div id="__av__"[^>]*>([^<]+)<\/div>/)
  if (!m) return null
  try { const p = JSON.parse(m[1]); if (p.length > 0) return '[VUE]\n' + JSON.stringify(p) } catch {}
  return null
}

function extractDL(h: string): string | null {
  const r: string[] = []
  let m: RegExpExecArray | null
  const p1 = /"impressions"\s*:\s*\[[\s\S]{50,}?\]/g
  const p2 = /"ecommerce"\s*:\s*\{[\s\S]{50,}?\}/g
  while ((m = p1.exec(h)) !== null) r.push(m[0])
  while ((m = p2.exec(h)) !== null) r.push(m[0])
  return r.length ? '[DL]\n' + r.join('\n').slice(0, 4000) : null
}

function extractLD(h: string): string | null {
  const parts = Array.from(h.matchAll(/<script[^>]*ld\+json[^>]*>([\s\S]*?)<\/script>/gi))
    .map(x => { try { return JSON.stringify(JSON.parse(x[1])).slice(0, 400) } catch { return '' } }).filter(Boolean).join('\n')
  return parts ? '[LD]\n' + parts.slice(0, 2000) : null
}

function extractSSR(h: string): string | null {
  const m = h.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  return m && m[1].length > 300 ? '[SSR]\n' + m[1].slice(0, 3000) : null
}

function extractImgs(h: string, base: string): string[] {
  const SKIP = ['logo','icon','banner','sprite','social','facebook','instagram','vk.com','pixel','analytics','favicon','arrow','button','placeholder','blank']
  const imgs: string[] = []
  const pat = /(?:src|data-src|data-lazy|data-original|content)=["']([^"']+\.(?:jpg|jpeg|webp|png)[^"'?]*)/gi
  let m: RegExpExecArray | null
  while ((m = pat.exec(h)) !== null) {
    const u = resolve(m[1], base)
    if (u && !imgs.includes(u) && !SKIP.some(s => u.toLowerCase().includes(s))) imgs.push(u)
  }
  const pri = ['product','catalog','upload','goods','item','tildacdn','foto','photo']
  imgs.sort((a, b) => {
    const ai = pri.findIndex(p => a.toLowerCase().includes(p))
    const bi = pri.findIndex(p => b.toLowerCase().includes(p))
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi)
  })
  return Array.from(new Set(imgs)).slice(0, 25)
}

function extractTxt(h: string): string {
  return h.replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<style[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,' ').replace(/\s{2,}/g,' ').trim().slice(0,4000)
}

async function fetchD(url: string): Promise<string> {
  const r = await fetch(url, { headers: {'User-Agent':'Mozilla/5.0 Chrome/121','Accept-Language':'ru-RU,ru;q=0.9'}, signal: AbortSignal.timeout(12000) })
  if (!r.ok) throw new Error('HTTP ' + r.status)
  return r.text()
}

async function fetchSB(url: string, js: boolean, longWait = false): Promise<string> {
  const k = process.env.SCRAPINGBEE_API_KEY
  if (!k) throw new Error('No SB key')
  // js_snippet выполняется ПОСЛЕ полного рендеринга страницы включая Vue/React
  // js_scenario.evaluate выполняется ДО — поэтому Vue данные ещё не загружены
  const encoded = Buffer.from(VUE_SCRIPT).toString('base64')
  const waitMs = longWait ? '8000' : '3000'
  const params = new URLSearchParams({
    api_key: k, url, render_js: String(js), block_ads: 'true',
    ...(js ? { wait: waitMs, js_snippet: encoded } : {})
  })
  const r = await fetch('https://app.scrapingbee.com/api/v1/?' + params.toString(), { signal: AbortSignal.timeout(55000) })
  if (!r.ok) throw new Error('SB ' + r.status)
  return r.text()
}

interface Product { name: string; price: number; category: string; description: string; sizes: string[]; colors: string[]; image_emoji: string; image_url?: string }

async function parseHtml(html: string, url: string, base: string): Promise<{ products?: Product[] }> {
  // Для noconcept — пробуем прямой AJAX вызов
  const noconceptData = await fetchNoconcept(url, html).catch(() => null)
  const rich = [noconceptData, extractVueItems(html), extractTilda(html, base), extractDL(html), extractLD(html), extractSSR(html)].filter((x): x is string => !!x)
  const imgs = extractImgs(html, base)
  const parts = ['URL: ' + url]
  if (rich.length) { parts.push('=== ДАННЫЕ ==='); rich.forEach(d => parts.push(d)) }
  if (imgs.length) { parts.push('=== ФОТО ==='); parts.push(imgs.join('\n')) }
  if (!rich.length) { parts.push('=== ТЕКСТ ==='); parts.push(extractTxt(html)) }
  parts.push('Извлеки до 20 товаров с image_url.')
  const msg = await client.messages.create({ model: 'claude-sonnet-4-20250514', max_tokens: 2000, system: SYS, messages: [{ role: 'user', content: parts.join('\n') }] })
  const t = msg.content[0]
  if (t.type !== 'text') throw new Error('bad type')
  // Надёжный парсинг — убираем control characters, пробуем несколько стратегий
  const clean = (s: string) => s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
  try { return JSON.parse(clean(t.text)) } catch {
    // Ищем JSON блок
    const m = t.text.match(/\{[\s\S]*\}/)
    if (m) {
      try { return JSON.parse(clean(m[0])) } catch {
        // Последний шанс — truncate до последней валидной }
        const s = clean(m[0])
        for (let i = s.length - 1; i > 0; i--) {
          if (s[i] === '}') {
            try { return JSON.parse(s.slice(0, i + 1)) } catch {}
          }
        }
      }
    }
    throw new Error('no json')
  }
}

function isValidImageUrl(url: string): boolean {
  if (!url || !url.startsWith('http')) return false
  const trusted = ['tildacdn.com','cdn.','static.','uploads/','upload/','.myshopify.','storage.','media.','files.','img.']
  if (trusted.some(p => url.includes(p))) return true
  const fake = ['example.com','placeholder','dummy','test.jpg','sample','/images/hoodie','/images/tshirt','/images/jeans']
  return !fake.some(p => url.toLowerCase().includes(p))
}

export async function POST(request: NextRequest) {
  try {
    const { url, seller_id } = await request.json()
    if (!url) return NextResponse.json({ error: 'URL обязателен' }, { status: 400 })
    const base = getBase(url)
    let html = '', method = 'none'

    const alwaysSB = ['noconcept.ru','n-r.store','varvara-fashion.com'].some(d => url.includes(d))
    if (!alwaysSB) { try { html = await fetchD(url); method = 'direct' } catch {} }

    const needsJS = alwaysSB
      || html.includes('{{item.') || html.includes('v-for=') || html.includes('data-v-')
      || html.includes('ng-repeat') || html.includes('__nuxt') || html.includes('data-svelte')
      || (html.includes('React') && html.length < 5000)
    const isBlocked = html.length < 2000 || html.includes('captcha') || html.includes('Cloudflare') || html.includes('cf-browser-verification')

    if (!html || isBlocked || needsJS) {
      const longWait = alwaysSB // для noconcept и подобных Vue сайтов ждём дольше
      try { html = await fetchSB(url, true, longWait); method = 'sb_js' } catch {
        if (!html) { try { html = await fetchSB(url, false); method = 'sb_static' } catch {} }
      }
    }
    
    // Для noconcept и Vue SPA — если __av__ не появился, извлекаем данные из DOM напрямую
    // через специальный ScrapingBee JS который читает Vue instance
    if (alwaysSB && !html.includes('__av__') && html.length > 10000) {
      // Данные уже в HTML через Vue SSR или hydration — парсим unit_preview карточки
      const unitNames = Array.from(html.matchAll(/class="unit_preview__name"[^>]*>\s*([^<]{3,80})</gi)).map(m => m[1].trim())
      const unitPrices = Array.from(html.matchAll(/class="unit_preview__price"[^>]*>([\d\s₽]+)</gi)).map(m => m[1].replace(/[^\d]/g, ''))
      const unitImgs = Array.from(html.matchAll(/class="unit_preview[^"]*"[\s\S]*?<img[^>]*src="([^"]+)"/gi)).map(m => m[1])
      if (unitNames.length > 0) {
        const syntheticData = {
          products: unitNames.map((name, i) => ({
            name,
            price: parseInt(unitPrices[i] || '0') || 0,
            category: 'Другое',
            description: '',
            sizes: ['XS', 'S', 'M', 'L', 'XL'],
            colors: [],
            image_emoji: '👗',
            image_url: unitImgs[i] ? (unitImgs[i].startsWith('/') ? getBase(url) + unitImgs[i] : unitImgs[i]) : ''
          }))
        }
        const { data: existing2 } = await supabase.from('products').select('name').eq('seller_id', seller_id)
        const existingNames2 = new Set((existing2 || []).map((p: { name: string }) => p.name))
        const rows2 = syntheticData.products
          .filter(p => !existingNames2.has(p.name) && p.name.length > 2)
          .map(p => ({
            seller_id, name: p.name, price: p.price, category: p.category,
            description: p.description, sizes: p.sizes, colors: p.colors,
            image_emoji: p.image_emoji,
            images: p.image_url && isValidImageUrl(p.image_url) ? [p.image_url] : [],
            is_active: true
          }))
        if (rows2.length > 0) {
          await supabase.from('products').insert(rows2)
          return NextResponse.json({ success: true, saved: rows2.length, total: syntheticData.products.length, source: 'dom_extract', warnings: { no_price: null, no_images: null } })
        }
      }
    }

    if (!html || html.length < 500) return NextResponse.json({ error: 'Не удалось загрузить сайт — проверьте URL' }, { status: 400 })

    const parsed = await parseHtml(html, url, base)
    if (!parsed.products?.length) return NextResponse.json({ error: 'Товары не найдены — укажите страницу категории' }, { status: 400 })

    const { data: existing } = await supabase.from('products').select('name').eq('seller_id', seller_id)
    const existingNames = new Set((existing || []).map((p: { name: string }) => p.name))
    const rows = parsed.products
      .filter(p => !existingNames.has(p.name) && p.name && p.name.length > 2)
      .map(p => ({
        seller_id, name: p.name, price: p.price || 0, category: p.category || 'Другое',
        description: p.description || '', sizes: p.sizes || [], colors: p.colors || [],
        image_emoji: p.image_emoji || '👗',
        images: p.image_url && isValidImageUrl(p.image_url) ? [p.image_url] : [],
        is_active: true
      }))

    if (rows.length > 0) await supabase.from('products').insert(rows)
    const noPrice = rows.filter(r => r.price === 0).length
    const noImages = rows.filter(r => r.images.length === 0).length
    return NextResponse.json({
      success: true, saved: rows.length, total: parsed.products.length, source: method,
      warnings: {
        no_price: noPrice > 0 ? `${noPrice} товаров без цены — добавьте вручную` : null,
        no_images: noImages > 0 ? `${noImages} товаров без фото — добавьте вручную` : null,
      }
    })
  } catch (e) {
    return NextResponse.json({ error: 'Ошибка импорта', details: String(e) }, { status: 500 })
  }
}
