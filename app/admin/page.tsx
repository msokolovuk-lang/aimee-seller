'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Seller {
  seller_id: string; name: string; brand_name: string
  email: string; plan: string; is_active: boolean
  created_at: string; last_login: string | null; password_hash?: string
}
interface SellerStats { products: number; orders: number; revenue: number; activity: number }
interface SimConfig { is_active: boolean; agents_per_wave: number; interval_minutes: number; updated_at?: string }
interface ActionLog { time: string; action: string; seller?: string; result?: string; type: 'info'|'success'|'error'|'sim' }

const PLANS = ['pilot','pro','demo','enterprise']
const C = {
  bg:'#F8F9FA', surface:'#FFFFFF', card:'#F3F4F6', border:'#E5E7EB',
  text:'#111827', muted:'#6B7280', accent:'#0FBCCE', ok:'#16A34A',
  orange:'#F59E0B', red:'#EF4444', purple:'#8B5CF6',
}

export default function AdminPage() {
  const [secret, setSecret] = useState('')
  const [authed, setAuthed] = useState(false)
  const [sellers, setSellers] = useState<Seller[]>([])
  const [sellerStats, setSellerStats] = useState<Record<string,SellerStats>>({})
  const [simConfigs, setSimConfigs] = useState<Record<string,SimConfig>>({})
  const [loading, setLoading] = useState(false)
  const [logs, setLogs] = useState<ActionLog[]>([])
  const [platformStats, setPlatformStats] = useState({ totalOrders:0, totalRevenue:0, totalProducts:0, totalActivity:0, activeSims:0, newOrdersToday:0 })
  const [newSeller, setNewSeller] = useState({ brand_name:'', name:'', email:'', plan:'pilot' })
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState<{seller_id:string;password:string}|null>(null)
  const [editingSeller, setEditingSeller] = useState<string|null>(null)
  const [editForm, setEditForm] = useState({ name:'', email:'', plan:'' })
  const [simSellerId, setSimSellerId] = useState('')
  const [simCount, setSimCount] = useState(3)
  const [simRunning, setSimRunning] = useState(false)
  const [simResult, setSimResult] = useState<any>(null)

  const addLog = (action:string, type:ActionLog['type']='info', seller?:string, result?:string) => {
    setLogs(prev => [{ time: new Date().toLocaleTimeString('ru',{hour:'2-digit',minute:'2-digit',second:'2-digit'}), action, type, seller, result }, ...prev].slice(0,50))
  }

  const load = async (s=secret) => {
    setLoading(true)
    const res = await fetch('/api/admin/sellers', { headers: { 'x-admin-secret': s } })
    if (res.ok) {
      const data = await res.json()
      setSellers(data.sellers)
      setAuthed(true)
      addLog('Вход в систему', 'success')
      loadPlatformData(data.sellers)
    } else { alert('Неверный секрет') }
    setLoading(false)
  }

  const loadPlatformData = async (sellersList:Seller[]) => {
    try {
      const [ordersRes, activityRes, productsRes, simRes] = await Promise.all([
        supabase.from('orders').select('seller_id,total_price,status,created_at'),
        supabase.from('buyer_activity').select('seller_id,type'),
        supabase.from('products').select('seller_id,is_active'),
        supabase.from('simulation_config').select('*'),
      ])
      const orders = ordersRes.data||[]; const activity = activityRes.data||[]
      const products = productsRes.data||[]; const sims = simRes.data||[]
      const today = new Date().toISOString().slice(0,10)
      const activeOrders = orders.filter((o:any)=>!['returned'].includes(o.status))
      setPlatformStats({
        totalOrders: activeOrders.length,
        totalRevenue: activeOrders.reduce((s:number,o:any)=>s+(o.total_price||0),0),
        totalProducts: products.filter((p:any)=>p.is_active).length,
        totalActivity: activity.length,
        activeSims: sims.filter((s:any)=>s.is_active).length,
        newOrdersToday: orders.filter((o:any)=>o.created_at?.startsWith(today)).length,
      })
      const stats:Record<string,SellerStats> = {}
      sellersList.forEach(s => {
        const sid = s.seller_id
        const so = activeOrders.filter((o:any)=>o.seller_id===sid)
        stats[sid] = {
          products: products.filter((p:any)=>p.seller_id===sid&&p.is_active).length,
          orders: so.length,
          revenue: so.reduce((sum:number,o:any)=>sum+(o.total_price||0),0),
          activity: activity.filter((a:any)=>a.seller_id===sid).length,
        }
      })
      setSellerStats(stats)
      const simMap:Record<string,SimConfig> = {}
      sims.forEach((s:any)=>{ simMap[s.seller_id]=s })
      setSimConfigs(simMap)
    } catch(e) { console.error(e) }
  }

  const createSeller = async () => {
    if (!newSeller.brand_name||!newSeller.name) return
    setCreating(true)
    const res = await fetch('/api/admin/sellers', { method:'POST', headers:{'x-admin-secret':secret,'Content-Type':'application/json'}, body:JSON.stringify(newSeller) })
    const data = await res.json()
    if (res.ok) { setCreated(data); setNewSeller({brand_name:'',name:'',email:'',plan:'pilot'}); addLog(`Создан ${newSeller.brand_name}`,'success',newSeller.brand_name); load() }
    else { alert(data.error); addLog(`Ошибка создания`,'error') }
    setCreating(false)
  }

  const deleteSeller = async (seller_id:string, brand_name:string) => {
    if (!confirm(`Удалить "${brand_name}"?`)) return
    await fetch('/api/admin/sellers', { method:'DELETE', headers:{'x-admin-secret':secret,'Content-Type':'application/json'}, body:JSON.stringify({seller_id}) })
    addLog(`Удалён ${brand_name}`,'error',brand_name); load()
  }

  const toggleActive = async (seller_id:string, is_active:boolean, brand_name:string) => {
    await fetch('/api/admin/sellers', { method:'PATCH', headers:{'x-admin-secret':secret,'Content-Type':'application/json'}, body:JSON.stringify({seller_id,is_active:!is_active}) })
    addLog(`${is_active?'Деактивирован':'Активирован'} ${brand_name}`, is_active?'error':'success', brand_name); load()
  }

  const saveEdit = async (seller_id:string, brand_name:string) => {
    await fetch('/api/admin/sellers', { method:'PATCH', headers:{'x-admin-secret':secret,'Content-Type':'application/json'}, body:JSON.stringify({seller_id,...editForm}) })
    addLog(`Обновлены данные ${brand_name}`,'success',brand_name); setEditingSeller(null); load()
  }

  const loginAsSeller = (seller:Seller) => {
    const password = seller.password_hash?.replace('PLAIN:','') || ''
    window.open(`https://seller.getaimee.ru/login?prefill_login=${seller.seller_id}&prefill_pass=${password}`,'_blank')
    addLog(`Вход как ${seller.brand_name}`,'info',seller.brand_name)
  }

  const toggleSim = async (seller_id:string, brand_name:string, currentActive:boolean) => {
    const newActive = !currentActive
    await supabase.from('simulation_config').upsert({ seller_id, is_active:newActive, agents_per_wave:simConfigs[seller_id]?.agents_per_wave||3, interval_minutes:simConfigs[seller_id]?.interval_minutes||30, updated_at:new Date().toISOString() }, {onConflict:'seller_id'})
    setSimConfigs(prev=>({...prev,[seller_id]:{...prev[seller_id],is_active:newActive}}))
    addLog(`Симуляция ${newActive?'включена':'выключена'} для ${brand_name}`,'sim',brand_name)
    setPlatformStats(prev=>({...prev,activeSims:prev.activeSims+(newActive?1:-1)}))
  }

  const runSimulation = async () => {
    if (!simSellerId) return alert('Выберите селлера')
    setSimRunning(true); setSimResult(null)
    const sellerName = sellers.find(s=>s.seller_id===simSellerId)?.brand_name||simSellerId
    addLog(`Запуск симуляции ${simCount} агентов для ${sellerName}`,'sim',sellerName)
    const res = await fetch('/api/admin/simulate', { method:'POST', headers:{'x-admin-secret':secret,'Content-Type':'application/json'}, body:JSON.stringify({seller_id:simSellerId,agent_count:simCount}) })
    const data = await res.json()
    setSimResult(data)
    addLog(`Симуляция завершена: ${data.orders_created}/${data.agents_run} заказов`,'success',sellerName,`${data.orders_created} заказов`)
    setSimRunning(false)
  }

  const copyCredentials = (seller:Seller) => {
    const password = seller.password_hash?.replace('PLAIN:','') || ''
    navigator.clipboard.writeText(`AIMEE · ${seller.brand_name}\nURL: https://seller.getaimee.ru\nЛогин: ${seller.seller_id}\nПароль: ${password}`)
    addLog(`Скопированы данные ${seller.brand_name}`,'info',seller.brand_name)
  }

  if (!authed) return (
    <div style={{minHeight:'100vh',background:C.bg,display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{width:380,background:C.surface,border:`1px solid ${C.border}`,borderRadius:20,padding:36,boxShadow:'0 4px 24px rgba(0,0,0,0.08)'}}>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:24}}>
          <div style={{width:40,height:40,borderRadius:12,background:C.accent,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,fontWeight:900,color:'#fff'}}>A</div>
          <div><p style={{fontSize:20,fontWeight:800,color:C.text}}>AIMEE Admin</p><p style={{fontSize:12,color:C.muted}}>Панель управления платформой</p></div>
        </div>
        <input type="password" placeholder="Admin secret" value={secret} onChange={e=>setSecret(e.target.value)} onKeyDown={e=>e.key==='Enter'&&load()}
          style={{width:'100%',background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:'12px 14px',fontSize:15,color:C.text,outline:'none',marginBottom:12,boxSizing:'border-box' as const}} />
        <button onClick={()=>load()} disabled={loading} style={{width:'100%',padding:14,borderRadius:12,background:C.accent,color:'#fff',border:'none',fontWeight:800,fontSize:15,cursor:'pointer'}}>
          {loading?'Входим...':'Войти'}
        </button>
      </div>
    </div>
  )

  return (
    <div style={{minHeight:'100vh',background:C.bg,padding:24}}>
      <div style={{maxWidth:1200,margin:'0 auto'}}>

        {/* Header */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <div style={{width:36,height:36,borderRadius:10,background:C.accent,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,fontWeight:900,color:'#fff'}}>A</div>
            <div><p style={{fontSize:20,fontWeight:800,color:C.text}}>AIMEE Admin</p><p style={{fontSize:12,color:C.muted}}>{sellers.length} селлеров · {new Date().toLocaleDateString('ru')}</p></div>
          </div>
          <div style={{display:'flex',gap:8}}>
            <a href="https://seller.getaimee.ru" target="_blank" style={{padding:'8px 14px',borderRadius:10,background:C.card,border:`1px solid ${C.border}`,color:C.muted,fontSize:12,textDecoration:'none',fontWeight:600}}>↗ Seller</a>
            <a href="https://buyer.getaimee.ru" target="_blank" style={{padding:'8px 14px',borderRadius:10,background:C.card,border:`1px solid ${C.border}`,color:C.muted,fontSize:12,textDecoration:'none',fontWeight:600}}>↗ Buyer</a>
            <button onClick={()=>load()} style={{padding:'8px 16px',borderRadius:10,background:C.accent,color:'#fff',border:'none',fontSize:12,fontWeight:600,cursor:'pointer'}}>↻ Обновить</button>
          </div>
        </div>

        {/* Platform Pulse — 6 метрик */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:12,marginBottom:24}}>
          {[
            {label:'Заказов всего',value:platformStats.totalOrders,icon:'📦',color:C.accent},
            {label:'Выручка',value:`₽${(platformStats.totalRevenue/1000).toFixed(1)}K`,icon:'💰',color:C.ok},
            {label:'Активных SKU',value:platformStats.totalProducts,icon:'🏷️',color:C.purple},
            {label:'Событий',value:platformStats.totalActivity,icon:'⚡',color:C.orange},
            {label:'Симуляций',value:platformStats.activeSims,icon:'🤖',color:platformStats.activeSims>0?C.ok:C.muted},
            {label:'Заказов сегодня',value:platformStats.newOrdersToday,icon:'🎉',color:C.accent},
          ].map((m,i)=>(
            <div key={i} style={{background:C.surface,borderRadius:14,border:`1px solid ${C.border}`,padding:'14px 16px',boxShadow:'0 1px 3px rgba(0,0,0,0.05)'}}>
              <div style={{fontSize:20,marginBottom:6}}>{m.icon}</div>
              <div style={{fontSize:22,fontWeight:800,color:m.color}}>{m.value}</div>
              <div style={{fontSize:11,color:C.muted,marginTop:2}}>{m.label}</div>
            </div>
          ))}
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 320px',gap:20}}>
          <div style={{display:'flex',flexDirection:'column',gap:16}}>

            {/* Sellers table */}
            <div style={{background:C.surface,borderRadius:16,border:`1px solid ${C.border}`,overflow:'hidden',boxShadow:'0 1px 3px rgba(0,0,0,0.05)'}}>
              <div style={{padding:'16px 20px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:15,fontWeight:700,color:C.text}}>Селлеры платформы</span>
                <span style={{fontSize:12,color:C.muted}}>{sellers.length} аккаунтов</span>
              </div>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead>
                    <tr style={{background:C.bg}}>
                      {['Бренд / контакт','ID','Товары','Заказы','Выручка','События','Вход','План','Статус','Действия'].map(h=>(
                        <th key={h} style={{padding:'10px 12px',textAlign:'left',fontSize:10,fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:0.5,whiteSpace:'nowrap'}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sellers.map(s=>{
                      const stats = sellerStats[s.seller_id]||{products:0,orders:0,revenue:0,activity:0}
                      const isEditing = editingSeller===s.seller_id
                      const sim = simConfigs[s.seller_id]
                      return (
                        <tr key={s.seller_id} style={{borderTop:`1px solid ${C.border}`,background:isEditing?'#f0fdf4':'transparent'}}>
                          <td style={{padding:'12px 12px'}}>
                            {isEditing ? (
                              <div style={{display:'flex',flexDirection:'column',gap:4}}>
                                <input value={editForm.name} onChange={e=>setEditForm(p=>({...p,name:e.target.value}))} placeholder="Имя"
                                  style={{width:130,padding:'4px 8px',borderRadius:6,border:`1px solid ${C.border}`,fontSize:12}} />
                                <input value={editForm.email} onChange={e=>setEditForm(p=>({...p,email:e.target.value}))} placeholder="Email"
                                  style={{width:130,padding:'4px 8px',borderRadius:6,border:`1px solid ${C.border}`,fontSize:12}} />
                              </div>
                            ) : (
                              <div>
                                <p style={{fontSize:13,fontWeight:700,color:C.text}}>{s.brand_name}</p>
                                <p style={{fontSize:11,color:C.muted}}>{s.name||'—'}</p>
                                {s.email&&<p style={{fontSize:10,color:C.muted}}>{s.email}</p>}
                                {sim?.is_active&&<span style={{fontSize:9,fontWeight:700,color:C.ok}}>🤖 SIM ON</span>}
                              </div>
                            )}
                          </td>
                          <td style={{padding:'12px 8px'}}>
                          <code style={{fontSize:10,color:C.muted,background:C.card,padding:'2px 4px',borderRadius:4,display:'block',marginBottom:2}}>{s.seller_id}</code>
                          <code style={{fontSize:10,color:'#059669',background:'#f0fdf4',padding:'2px 4px',borderRadius:4,display:'block'}}>{s.password_hash?.replace('PLAIN:','') || '—'}</code>
                        </td>
                          <td style={{padding:'12px 8px',fontSize:13,fontWeight:700,color:stats.products>0?C.text:C.red,textAlign:'center'}}>{stats.products}</td>
                          <td style={{padding:'12px 8px',fontSize:13,fontWeight:700,color:stats.orders>0?C.ok:C.muted,textAlign:'center'}}>{stats.orders}</td>
                          <td style={{padding:'12px 8px',fontSize:12,fontWeight:700,color:C.accent,whiteSpace:'nowrap'}}>₽{(stats.revenue/1000).toFixed(1)}K</td>
                          <td style={{padding:'12px 8px',fontSize:12,color:C.muted,textAlign:'center'}}>{stats.activity}</td>
                          <td style={{padding:'12px 8px',fontSize:11,color:C.muted,whiteSpace:'nowrap'}}>
                            {s.last_login?new Date(s.last_login).toLocaleDateString('ru',{day:'numeric',month:'short'}):'—'}
                          </td>
                          <td style={{padding:'12px 8px'}}>
                            {isEditing ? (
                              <select value={editForm.plan} onChange={e=>setEditForm(p=>({...p,plan:e.target.value}))}
                                style={{padding:'4px 6px',borderRadius:6,border:`1px solid ${C.border}`,fontSize:11}}>
                                {PLANS.map(p=><option key={p} value={p}>{p}</option>)}
                              </select>
                            ) : (
                              <span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:99,background:s.plan==='pilot'?'#f0fdf4':s.plan==='pro'?'#eff6ff':'#f9fafb',color:s.plan==='pilot'?C.ok:s.plan==='pro'?'#3b82f6':C.muted}}>
                                {s.plan}
                              </span>
                            )}
                          </td>
                          <td style={{padding:'12px 8px'}}>
                            <span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:99,background:s.is_active?'#f0fdf4':'#fef2f2',color:s.is_active?C.ok:C.red}}>
                              {s.is_active?'Активен':'Откл'}
                            </span>
                          </td>
                          <td style={{padding:'12px 8px'}}>
                            <div style={{display:'flex',gap:4,flexWrap:'wrap' as const}}>
                              {isEditing ? (
                                <>
                                  <button onClick={()=>saveEdit(s.seller_id,s.brand_name)} style={{padding:'4px 10px',borderRadius:6,background:C.ok,color:'#fff',border:'none',fontSize:11,fontWeight:600,cursor:'pointer'}}>✓</button>
                                  <button onClick={()=>setEditingSeller(null)} style={{padding:'4px 8px',borderRadius:6,background:C.card,color:C.muted,border:`1px solid ${C.border}`,fontSize:11,cursor:'pointer'}}>✕</button>
                                </>
                              ) : (
                                <>
                                  <button onClick={()=>{setEditingSeller(s.seller_id);setEditForm({name:s.name,email:s.email,plan:s.plan})}} title="Редактировать"
                                    style={{padding:'4px 7px',borderRadius:6,background:C.card,border:`1px solid ${C.border}`,fontSize:12,cursor:'pointer'}}>✏️</button>
                                  <button onClick={()=>loginAsSeller(s)} title="Войти как селлер"
                                    style={{padding:'4px 7px',borderRadius:6,background:'#eff6ff',border:'1px solid #bfdbfe',fontSize:12,cursor:'pointer'}}>↗</button>
                                  <button onClick={()=>copyCredentials(s)} title="Скопировать данные"
                                    style={{padding:'4px 7px',borderRadius:6,background:C.card,border:`1px solid ${C.border}`,fontSize:12,cursor:'pointer'}}>📋</button>
                                  <button onClick={()=>toggleActive(s.seller_id,s.is_active,s.brand_name)}
                                    style={{padding:'4px 7px',borderRadius:6,background:s.is_active?'#fef2f2':'#f0fdf4',border:`1px solid ${s.is_active?'#fecaca':'#bbf7d0'}`,fontSize:11,cursor:'pointer',color:s.is_active?C.red:C.ok,fontWeight:600}}>
                                    {s.is_active?'Откл':'Вкл'}
                                  </button>
                                  <button onClick={()=>deleteSeller(s.seller_id,s.brand_name)}
                                    style={{padding:'4px 7px',borderRadius:6,background:'#fef2f2',border:'1px solid #fecaca',fontSize:12,cursor:'pointer'}}>🗑</button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Simulation */}
            <div style={{background:C.surface,borderRadius:16,border:`1px solid ${C.border}`,padding:20,boxShadow:'0 1px 3px rgba(0,0,0,0.05)'}}>
              <p style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:16}}>🤖 Управление симуляцией</p>
              <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:16}}>
                {sellers.map(s=>{
                  const sim = simConfigs[s.seller_id]; const active = sim?.is_active||false
                  const updatedAt = sim?.updated_at?new Date(sim.updated_at).toLocaleTimeString('ru',{hour:'2-digit',minute:'2-digit'}):null
                  return (
                    <div key={s.seller_id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 14px',background:active?'#f0fdf4':C.bg,borderRadius:10,border:`1px solid ${active?'#bbf7d0':C.border}`}}>
                      <div>
                        <p style={{fontSize:13,fontWeight:600,color:C.text}}>{s.brand_name}</p>
                        <p style={{fontSize:11,color:active?C.ok:C.muted}}>
                          {active?`🟢 ${sim?.agents_per_wave||3} агента каждые ${sim?.interval_minutes||30} мин`:'⚪ Выключена'}
                          {updatedAt&&<span style={{marginLeft:8,color:C.muted}}>· {updatedAt}</span>}
                        </p>
                      </div>
                      <button onClick={()=>toggleSim(s.seller_id,s.brand_name,active)}
                        style={{padding:'6px 16px',borderRadius:8,border:'none',fontSize:12,fontWeight:700,cursor:'pointer',background:active?C.red:C.ok,color:'#fff'}}>
                        {active?'Выключить':'Включить'}
                      </button>
                    </div>
                  )
                })}
              </div>
              <div style={{borderTop:`1px solid ${C.border}`,paddingTop:16}}>
                <p style={{fontSize:12,fontWeight:600,color:C.muted,marginBottom:10}}>Разовый запуск</p>
                <div style={{display:'flex',gap:10,alignItems:'flex-end',flexWrap:'wrap' as const}}>
                  <div>
                    <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:4}}>Селлер</label>
                    <select value={simSellerId} onChange={e=>setSimSellerId(e.target.value)}
                      style={{padding:'8px 12px',borderRadius:8,border:`1px solid ${C.border}`,fontSize:13,minWidth:170}}>
                      <option value="">— выберите —</option>
                      {sellers.map(s=><option key={s.seller_id} value={s.seller_id}>{s.brand_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:4}}>Агентов</label>
                    <input type="number" min={1} max={20} value={simCount} onChange={e=>setSimCount(Number(e.target.value))}
                      style={{padding:'8px 10px',borderRadius:8,border:`1px solid ${C.border}`,fontSize:13,width:65}} />
                  </div>
                  <button onClick={runSimulation} disabled={simRunning||!simSellerId}
                    style={{padding:'8px 20px',background:simRunning?C.muted:C.ok,color:'#fff',borderRadius:8,border:'none',fontSize:13,fontWeight:700,cursor:simRunning?'not-allowed':'pointer'}}>
                    {simRunning?'Запускаем...':'Запустить'}
                  </button>
                </div>
                {simResult&&(
                  <div style={{marginTop:12,padding:12,background:'#f0fdf4',borderRadius:8,border:'1px solid #bbf7d0'}}>
                    <p style={{fontSize:13,fontWeight:700,color:C.ok}}>✅ {simResult.agents_run} агентов · {simResult.orders_created} заказов</p>
                    <div style={{display:'flex',flexWrap:'wrap' as const,gap:4,marginTop:6}}>
                      {(simResult.summary||[]).map((r:any,i:number)=>(
                        <span key={i} style={{fontSize:11,padding:'2px 8px',borderRadius:99,background:r.ordered?'#dcfce7':'#f3f4f6',color:r.ordered?C.ok:C.muted}}>
                          {r.ordered?'✓':'✗'} {r.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Create seller */}
            <div style={{background:C.surface,borderRadius:16,border:`1px solid ${C.accent}30`,padding:20,boxShadow:'0 1px 3px rgba(0,0,0,0.05)'}}>
              <p style={{fontSize:15,fontWeight:700,color:C.accent,marginBottom:16}}>✦ Создать аккаунт селлера</p>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
                {[{key:'brand_name',label:'Название бренда *',placeholder:'Varvara Fashion'},{key:'name',label:'Имя контакта *',placeholder:'Анна Иванова'},{key:'email',label:'Email',placeholder:'anna@brand.ru'}].map(f=>(
                  <div key={f.key}>
                    <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:4,fontWeight:600}}>{f.label}</label>
                    <input placeholder={f.placeholder} value={(newSeller as any)[f.key]} onChange={e=>setNewSeller(p=>({...p,[f.key]:e.target.value}))}
                      style={{width:'100%',padding:'9px 12px',borderRadius:8,border:`1px solid ${C.border}`,fontSize:13,boxSizing:'border-box' as const}} />
                  </div>
                ))}
                <div>
                  <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:4,fontWeight:600}}>План</label>
                  <select value={newSeller.plan} onChange={e=>setNewSeller(p=>({...p,plan:e.target.value}))}
                    style={{width:'100%',padding:'9px 12px',borderRadius:8,border:`1px solid ${C.border}`,fontSize:13}}>
                    {PLANS.map(p=><option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <button onClick={createSeller} disabled={creating||!newSeller.brand_name}
                style={{padding:'10px 24px',background:C.accent,color:'#fff',borderRadius:10,border:'none',fontSize:13,fontWeight:700,cursor:'pointer'}}>
                {creating?'Создаём...':'+ Создать аккаунт'}
              </button>
              {created&&(
                <div style={{marginTop:14,padding:14,background:'#f0fdf4',borderRadius:10,border:'1px solid #bbf7d0'}}>
                  <p style={{fontSize:13,fontWeight:700,color:C.ok,marginBottom:8}}>✅ Аккаунт создан</p>
                  <p style={{fontSize:12,color:C.text,fontFamily:'monospace'}}>Логин: {created.seller_id}</p>
                  <p style={{fontSize:12,color:C.text,fontFamily:'monospace'}}>Пароль: {created.password}</p>
                  <button onClick={()=>navigator.clipboard.writeText(`Логин: ${created.seller_id}\nПароль: ${created.password}\nURL: https://seller.getaimee.ru`)}
                    style={{marginTop:8,padding:'6px 14px',borderRadius:8,background:C.ok,color:'#fff',border:'none',fontSize:12,fontWeight:600,cursor:'pointer'}}>
                    📋 Скопировать
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right column */}
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            {/* Action log */}
            <div style={{background:C.surface,borderRadius:16,border:`1px solid ${C.border}`,padding:20,boxShadow:'0 1px 3px rgba(0,0,0,0.05)'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
                <p style={{fontSize:15,fontWeight:700,color:C.text}}>📋 Лог действий</p>
                <button onClick={()=>setLogs([])} style={{fontSize:11,color:C.muted,background:'none',border:'none',cursor:'pointer'}}>Очистить</button>
              </div>
              {logs.length===0 ? (
                <p style={{fontSize:13,color:C.muted,textAlign:'center',padding:'20px 0'}}>Нет действий</p>
              ) : (
                <div style={{display:'flex',flexDirection:'column',gap:6,maxHeight:300,overflowY:'auto'}}>
                  {logs.map((log,i)=>{
                    const colors = {info:C.muted,success:C.ok,error:C.red,sim:C.purple}
                    const icons = {info:'ℹ️',success:'✅',error:'❌',sim:'🤖'}
                    return (
                      <div key={i} style={{display:'flex',gap:8,alignItems:'flex-start',padding:'6px 8px',background:C.bg,borderRadius:8,borderLeft:`3px solid ${colors[log.type]}`}}>
                        <span style={{fontSize:12}}>{icons[log.type]}</span>
                        <div style={{flex:1,minWidth:0}}>
                          <p style={{fontSize:12,color:C.text,fontWeight:500}}>{log.action}</p>
                          {log.result&&<p style={{fontSize:11,color:C.muted}}>{log.result}</p>}
                        </div>
                        <span style={{fontSize:10,color:C.muted,flexShrink:0}}>{log.time}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Quick links */}
            <div style={{background:C.surface,borderRadius:16,border:`1px solid ${C.border}`,padding:20,boxShadow:'0 1px 3px rgba(0,0,0,0.05)'}}>
              <p style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:14}}>🔗 Быстрые ссылки</p>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {[
                  {label:'💰 Финансы платформы',url:'/admin/finance'},
                  {label:'🔗 Интеграции',url:'/admin/integrations'},
                  {label:'🚀 Онбординг',url:'https://seller.getaimee.ru/onboarding'},
                  {label:'🏪 Seller MVP (прод)',url:'https://seller.getaimee.ru'},
                  {label:'🛍️ Buyer PWA (прод)',url:'https://buyer.getaimee.ru'},
                  {label:'🧪 Seller (тест)',url:'https://aimee-seller.vercel.app'},
                  {label:'🧪 Buyer (тест)',url:'https://aimee-buyer.vercel.app'},
                  {label:'🗄️ Supabase',url:'https://supabase.com/dashboard/project/pmoupdeclmgffslnjzpm'},
                  {label:'🚂 Railway Simulator',url:'https://railway.com/project/01c7cd54-1a45-4b40-8595-741cfc969220'},
                  {label:'📦 GitHub seller',url:'https://github.com/msokolovuk-lang/aimee-seller'},
                  {label:'📦 GitHub buyer',url:'https://github.com/msokolovuk-lang/aimee-buyer'},
                ].map((link,i)=>(
                  <a key={i} href={link.url} target="_blank" style={{fontSize:12,color:C.accent,textDecoration:'none',padding:'6px 10px',borderRadius:8,background:C.bg,display:'block'}}>
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
