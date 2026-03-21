import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Parse WB Excel export (CSV format)
function parseWBCsv(text: string): any[] {
  const lines = text.split('\n').filter(l => l.trim())
  if (lines.length < 2) return []

  // Detect delimiter
  const delimiter = lines[0].includes('\t') ? '\t' : ';'

  const headers = lines[0].split(delimiter).map(h =>
    h.trim().replace(/^["']|["']$/g, '').toLowerCase()
  )

  const products = []
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(delimiter).map(v =>
      v.trim().replace(/^["']|["']$/g, '')
    )
    if (values.length < 2) continue

    const row: Record<string, string> = {}
    headers.forEach((h, idx) => { row[h] = values[idx] || '' })
    products.push(row)
  }
  return products
}

// Map WB column names to our schema
function mapWBRow(row: Record<string, string>) {
  // WB exports use different column names depending on the report type
  const name =
    row['наименование'] || row['название'] || row['предмет'] ||
    row['name'] || row['title'] || ''

  const price = parseFloat(
    (row['цена'] || row['розничная цена'] || row['цена розничная'] ||
     row['price'] || row['розн. цена'] || '0').replace(/[^\d.]/g, '')
  ) || 0

  const article =
    row['артикул'] || row['артикул продавца'] || row['vendor code'] ||
    row['sku'] || row['article'] || ''

  const category =
    row['предмет'] || row['категория'] || row['подкатегория'] ||
    row['category'] || row['subject'] || ''

  const description = row['описание'] || row['description'] || ''

  const sizesRaw = row['размер'] || row['размеры'] || row['size'] || ''
  const sizes = sizesRaw ? sizesRaw.split(/[,;/]/).map(s => s.trim()).filter(Boolean) : []

  const colorsRaw = row['цвет'] || row['цвета'] || row['color'] || ''
  const colors = colorsRaw ? colorsRaw.split(/[,;/]/).map(s => s.trim()).filter(Boolean) : []

  const imageUrl = row['фото'] || row['фотография'] || row['image'] || row['photo'] || ''

  return { name, price, article, category, description, sizes, colors, imageUrl }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const seller_id = formData.get('seller_id') as string | null

    if (!file) {
      return NextResponse.json({ error: 'Файл обязателен' }, { status: 400 })
    }

    const fileName = file.name.toLowerCase()
    if (!fileName.endsWith('.csv') && !fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
      return NextResponse.json({ error: 'Поддерживаются только CSV и Excel файлы' }, { status: 400 })
    }

    // Read file content
    const buffer = await file.arrayBuffer()
    let rows: any[] = []

    if (fileName.endsWith('.csv')) {
      const text = new TextDecoder('utf-8').decode(buffer)
      rows = parseWBCsv(text)
    } else {
      // For Excel files — try UTF-8 decode of CSV-like content
      // Real Excel parsing would need xlsx library
      const text = new TextDecoder('cp1251').decode(buffer)
      rows = parseWBCsv(text)
    }

    if (!rows.length) {
      return NextResponse.json({ error: 'Не удалось прочитать данные из файла' }, { status: 400 })
    }

    // Deduplicate by name + price
    const seen = new Set<string>()
    const unique = rows.filter(row => {
      const mapped = mapWBRow(row)
      if (!mapped.name) return false
      const key = `${mapped.name.toLowerCase()}_${mapped.price}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    const saved = [], failed = []

    for (const row of unique) {
      const { name, price, article, category, description, sizes, colors, imageUrl } = mapWBRow(row)
      if (!name) continue

      try {
        const { data: inserted, error: insertError } = await supabase
          .from('products')
          .insert({
            seller_id: seller_id || null,
            name,
            price,
            article: article || null,
            category: category || null,
            description: description || null,
            sizes,
            colors,
            source_url: 'excel-import',
            is_active: true,
          })
          .select('id')
          .single()

        if (insertError || !inserted) { failed.push(name); continue }

        // Try to upload image if URL provided
        const images: string[] = []
        if (imageUrl && imageUrl.startsWith('http')) {
          try {
            const imgRes = await fetch(imageUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } })
            if (imgRes.ok) {
              const imgBuffer = await imgRes.arrayBuffer()
              const contentType = imgRes.headers.get('content-type') || 'image/jpeg'
              const ext = contentType.includes('png') ? 'png' : 'jpg'
              const path = `${inserted.id}/0.${ext}`
              const { error: uploadError } = await supabase.storage
                .from('product-images')
                .upload(path, imgBuffer, { contentType, upsert: true })
              if (!uploadError) {
                const { data } = supabase.storage.from('product-images').getPublicUrl(path)
                images.push(data.publicUrl)
              }
            }
          } catch {}
        }

        if (images.length) {
          await supabase.from('products').update({ images }).eq('id', inserted.id)
        }

        saved.push({ id: inserted.id, name, price, category, images })
      } catch { failed.push(name) }
    }

    return NextResponse.json({
      ok: true,
      total: unique.length,
      saved: saved.length,
      failed: failed.length,
      products: saved,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
