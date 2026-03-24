import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Public endpoint — no auth, called by SDK from brand's website
// CORS must be open — any origin can fetch this

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  req: NextRequest,
  { params }: { params: { brandId: string } }
) {
  const { brandId } = params

  // CORS headers — SDK is loaded on external sites
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-aimee-version',
    'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
  }

  if (!brandId) {
    return NextResponse.json({ error: 'brandId required' }, { status: 400, headers: corsHeaders })
  }

  try {
    // Get seller
    const { data: seller, error } = await supabase
      .from('sellers')
      .select('seller_id, brand_name, plan, is_active')
      .eq('seller_id', brandId)
      .single()

    if (error || !seller) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404, headers: corsHeaders })
    }

    if (!seller.is_active) {
      return NextResponse.json({ error: 'Brand inactive' }, { status: 403, headers: corsHeaders })
    }

    // Get connector config for allowed_domains and SDK settings
    const { data: connectorsRaw } = await supabase
      .from('brand_connectors')
      .select('type, status, config')
      .eq('seller_id', brandId)
      .eq('status', 'active')

    const connectors: { type: string; status: string; config: any }[] = connectorsRaw || []

    // Build SDK config response
    const sdkConfig = {
      brandId: seller.seller_id,
      brandName: seller.brand_name,
      plan: seller.plan,
      features: {
        tryon:           true,
        stylist:         true,
        recommendations: true,
        analytics:       true,
        a2a:             seller.plan === 'enterprise',
        salesAgent:      ['pro', 'enterprise'].includes(seller.plan),
      },
      // Allowed domains from connector config
      allowed_domains: extractAllowedDomains(connectors),
      // Active integrations
      integrations: {
        metrika:  extractConfig(connectors, 'metrika', 'counter_id'),
        roistat:  extractConfig(connectors, 'roistat', 'project_id'),
        telegram: !!extractConfig(connectors, 'telegram', 'chat_id'),
      },
      // Default selectors (can be overridden per brand)
      selectors: {
        productCard:  '.product-card, .product-item, [data-aimee-product]',
        productImage: 'img.main, img:first-child, img',
        productPrice: '.price, [class*="price"]',
        addToCartBtn: '.add-to-cart, [class*="add-to-cart"]',
      },
    }

    return NextResponse.json(sdkConfig, { headers: corsHeaders })

  } catch (e) {
    console.error('[SDK Config]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500, headers: corsHeaders })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-aimee-version',
    },
  })
}

function extractAllowedDomains(connectors: any[]): string[] {
  const domains: string[] = []
  connectors.forEach(c => {
    if (c.config?.allowed_domains) {
      domains.push(...c.config.allowed_domains)
    }
  })
  return Array.from(new Set(domains))
}

function extractConfig(connectors: any[], type: string, key: string): string | null {
  const conn = connectors.find(c => c.type === type)
  return conn?.config?.[key] || null
}
