'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const C = {
  bg:'#F8F9FA', surface:'#FFFFFF', card:'#F3F4F6', border:'#E5E7EB',
  text:'#111827', muted:'#6B7280', accent:'#0FBCCE', ok:'#16A34A',
  orange:'#F59E0B', red:'#EF4444', purple:'#8B5CF6',
}

const AIMEE_FEE = 0.065
const INFRA_MONTHLY = 8500

export default function AdminFinancePage() {
  const [orders, setOrders] = useState<any[]>([])
  const [activity, setActivity] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'today'|'week'|'month'|'all'>('month')

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const [ordersRes, activityRes] = await Promise.all([
      supabase.from('orders').select('*').order('created_at', { ascending: false }),
      supabase.from('buyer_activity').select('type, created_at, data'),
    ])
    setOrders(ordersRes.data || [])
    setActivity(activityRes.data || [])
    setLoading(false)
  }

  const filterByPeriod = (items: any[]) => {
    const now = new Date()
    const cutoff: Record<string, Date> = {
      today: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
      week: new Date(now.getTime() - 7 * 86400000),
      month: new Date(now.getTime() - 30 * 86400000),
      all: new Date(0),
    }
    return items.filter(i => new Date(i.created_at) >= cutoff[period])
  }

  const filteredOrders = filterByPeriod(orders)
  const activeOrders = filteredOrders.filter(o => !['returned'].includes(o.status))
  const returnedOrders = filteredOrders.filter(o => ['returned','return_requested'].includes(o.status))

  const gmv = activeOrders.reduce((s, o) => s + (o.total_price || 0), 0)
  const aimeeRevenue = Math.round(gmv * AIMEE_FEE)
  const returnsLoss = returnedOrders.reduce((s, o) => s + (o.total_price || 0), 0)
  const infraCost = period === 'today' ? Math.round(INFRA_MONTHLY/30) : period === 'week' ? Math.round(INFRA_MONTHLY/4) : period === 'month' ? INFRA_MONTHLY : INFRA_MONTHLY * 3
  const claudeCost = Math.round(filteredOrders.length * 0.05 * 90)
  const totalCosts = infraCost + claudeCost
  const netProfit = aimeeRevenue - totalCosts
  const sellerSaving = Math.round(gmv * (0.35 - AIMEE_FEE))

  const views = filterByPeriod(activity).filter(a => a.type === 'view').length
  const carts = filterByPeriod(activity).filter(a => a.type === 'add_to_cart').length
  const conversion = views ? ((activeOrders.length / views) * 100).toFixed(1) : '0'

  const sellerNames: Record<string,string> = { 'demo':'DEMO', '-a4dc':'ВЕЧЕР', '-3da9':'ПРИВЕТ', '-f0e9':'ПОКА' }
  const sellerBreakdown = Object.entries(sellerNames).map(([sid, name]) => {
    const so = activeOrders.filter(o => o.seller_id === sid)
    const sgmv = so.reduce((s, o) => s + (o.total_price || 0), 0)
    return { seller: name, orders: so.length, gmv: sgmv, fee: Math.round(sgmv * AIMEE_FEE) }
  }).filter(s => s.orders > 0).sort((a, b) => b.gmv - a.gmv)

  if (loading) return (
    <div style={{minHeight:'100vh',background:C.bg,display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{width:32,height:32,border:`2px solid ${C.accent}`,borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite'}} />
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  )

  return (
    <div style={{minHeight:'100vh',background:C.bg,padding:24}}>
      <div style={{maxWidth:1100,margin:'0 auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
          <div>
            <h1 style={{fontSize:24,fontWeight:800,color:C.text}}>Финансы платформы</h1>
            <p style={{fontSize:13,color:C.muted,marginTop:4}}>Доходность AIMEE · комиссия {(AIMEE_FEE*100).toFixed(1)}%</p>
          </div>
          <div style={{display:'flex',gap:8}}>
            {(['today','week','month','all'] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)} style={{
                padding:'8px 16px',borderRadius:10,fontSize:12,fontWeight:600,cursor:'pointer',
                background:period===p?C.accent:C.surface,color:period===p?'#fff':C.muted,
                border:`1px solid ${period===p?C.accent:C.border}`,
              }}>{{today:'Сегодня',week:'7 дней',month:'30 дней',all:'Всё время'}[p]}</button>
            ))}
          </div>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16,marginBottom:24}}>
          {[
            {label:'GMV (оборот)',value:`₽${(gmv/1000).toFixed(1)}K`,sub:`${activeOrders.length} заказов`,color:C.text,icon:'📊'},
            {label:'Выручка AIMEE',value:`₽${(aimeeRevenue/1000).toFixed(1)}K`,sub:`${(AIMEE_FEE*100).toFixed(1)}% от GMV`,color:C.accent,icon:'💰'},
            {label:'Расходы',value:`₽${(totalCosts/1000).toFixed(1)}K`,sub:'инфра + Claude API',color:C.orange,icon:'📉'},
            {label:'Чистая прибыль',value:`₽${(netProfit/1000).toFixed(1)}K`,sub:netProfit>0?'🟢 В плюсе':'🔴 В минусе',color:netProfit>0?C.ok:C.red,icon:'🏆'},
          ].map((m,i)=>(
            <div key={i} style={{background:C.surface,borderRadius:16,border:`1px solid ${C.border}`,padding:20,boxShadow:'0 1px 3px rgba(0,0,0,0.05)'}}>
              <div style={{fontSize:24,marginBottom:8}}>{m.icon}</div>
              <div style={{fontSize:26,fontWeight:800,color:m.color}}>{m.value}</div>
              <div style={{fontSize:12,fontWeight:600,color:C.text,marginTop:4}}>{m.label}</div>
              <div style={{fontSize:11,color:C.muted}}>{m.sub}</div>
            </div>
          ))}
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
          <div style={{background:C.surface,borderRadius:16,border:`1px solid ${C.border}`,padding:20,boxShadow:'0 1px 3px rgba(0,0,0,0.05)'}}>
            <h2 style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:16}}>P&L AIMEE</h2>
            {[
              {label:'GMV платформы',value:gmv,sub:`${activeOrders.length} заказов`},
              {label:`Комиссия AIMEE (${(AIMEE_FEE*100).toFixed(1)}%)`,value:aimeeRevenue,sub:'наша выручка'},
              {label:'Инфраструктура',value:-infraCost,sub:'Vercel + Supabase + Railway'},
              {label:'Claude API',value:-claudeCost,sub:`~₽${Math.round(claudeCost/Math.max(activeOrders.length,1))}/заказ`},
              {label:'Возвраты',value:-returnsLoss,sub:`${returnedOrders.length} возвратов`},
              {label:'Чистая прибыль',value:netProfit,bold:true,sub:''},
            ].map((item,i)=>(
              <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:i<5?`1px solid ${C.card}`:'none',borderTop:(item as any).bold?`2px solid ${C.border}`:'none'}}>
                <div>
                  <span style={{fontSize:13,color:(item as any).bold?C.text:C.muted,fontWeight:(item as any).bold?700:400}}>{item.label}</span>
                  {item.sub&&<p style={{fontSize:11,color:C.muted}}>{item.sub}</p>}
                </div>
                <span style={{fontSize:14,fontWeight:(item as any).bold?800:600,color:item.value>=0?((item as any).bold?C.ok:C.text):C.red}}>
                  {item.value>=0?'+':''}{'₽'}{Math.abs(item.value).toLocaleString('ru')}
                </span>
              </div>
            ))}
            <div style={{marginTop:16,padding:12,background:'#f0fdf4',borderRadius:10,border:'1px solid #bbf7d0'}}>
              <p style={{fontSize:12,fontWeight:700,color:C.ok,marginBottom:4}}>💚 Выгода селлеров vs WB/Ozon (35%)</p>
              <p style={{fontSize:22,fontWeight:800,color:C.ok}}>+₽{sellerSaving.toLocaleString('ru')}</p>
              <p style={{fontSize:11,color:'#16a34a'}}>сэкономлено на комиссиях</p>
            </div>
          </div>

          <div style={{background:C.surface,borderRadius:16,border:`1px solid ${C.border}`,padding:20,boxShadow:'0 1px 3px rgba(0,0,0,0.05)'}}>
            <h2 style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:16}}>Выручка по селлерам</h2>
            <div style={{display:'flex',flexDirection:'column',gap:12,marginBottom:20}}>
              {sellerBreakdown.length===0?<p style={{color:C.muted,fontSize:13,textAlign:'center',padding:'24px 0'}}>Нет данных</p>:
              sellerBreakdown.map((s,i)=>{
                const pct = gmv?(s.gmv/gmv)*100:0
                return (
                  <div key={i}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                      <span style={{fontSize:13,fontWeight:600,color:C.text}}>{s.seller}</span>
                      <div style={{display:'flex',gap:12}}>
                        <span style={{fontSize:12,color:C.muted}}>{s.orders} зак.</span>
                        <span style={{fontSize:12,fontWeight:700,color:C.text}}>₽{s.gmv.toLocaleString('ru')}</span>
                        <span style={{fontSize:12,fontWeight:700,color:C.accent}}>→₽{s.fee.toLocaleString('ru')}</span>
                      </div>
                    </div>
                    <div style={{height:6,background:C.card,borderRadius:3}}>
                      <div style={{height:'100%',width:`${pct}%`,background:C.accent,borderRadius:3,transition:'width 0.5s'}} />
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{paddingTop:16,borderTop:`1px solid ${C.border}`}}>
              <h3 style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:12}}>Воронка платформы</h3>
              {[
                {label:'Просмотры',value:views,bar:'#0ea5e9'},
                {label:'В корзину',value:carts,bar:'#22c55e'},
                {label:'Заказы',value:activeOrders.length,bar:'#eab308'},
              ].map((f,i)=>(
                <div key={i} style={{marginBottom:8}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                    <span style={{fontSize:12,color:C.muted}}>{f.label}</span>
                    <span style={{fontSize:12,fontWeight:700,color:C.text}}>{f.value}</span>
                  </div>
                  <div style={{height:6,background:C.card,borderRadius:3}}>
                    <div style={{height:'100%',width:`${views?Math.max((f.value/views)*100,f.value>0?5:0):0}%`,background:f.bar,borderRadius:3}} />
                  </div>
                </div>
              ))}
              <p style={{fontSize:12,color:C.muted,marginTop:8}}>Конверсия: <strong style={{color:C.text}}>{conversion}%</strong></p>
            </div>
          </div>
        </div>

        <div style={{background:C.surface,borderRadius:16,border:`1px solid ${C.border}`,padding:20,boxShadow:'0 1px 3px rgba(0,0,0,0.05)'}}>
          <h2 style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:16}}>Структура расходов</h2>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
            {[
              {label:'Vercel',value:Math.round(infraCost*0.3),sub:'Hosting + CDN',icon:'▲'},
              {label:'Supabase',value:Math.round(infraCost*0.3),sub:'БД + Realtime',icon:'⚡'},
              {label:'Railway',value:Math.round(infraCost*0.15),sub:'AI Simulator',icon:'🚂'},
              {label:'Claude API',value:claudeCost,sub:`${activeOrders.length} вызовов`,icon:'🤖'},
            ].map((item,i)=>(
              <div key={i} style={{background:C.bg,borderRadius:12,padding:16,border:`1px solid ${C.border}`}}>
                <div style={{fontSize:20,marginBottom:6}}>{item.icon}</div>
                <div style={{fontSize:18,fontWeight:800,color:C.red}}>₽{item.value.toLocaleString('ru')}</div>
                <div style={{fontSize:12,fontWeight:600,color:C.text,marginTop:4}}>{item.label}</div>
                <div style={{fontSize:11,color:C.muted}}>{item.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
