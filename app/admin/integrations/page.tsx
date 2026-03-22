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

const CATALOG = [
  { type:'cdek', category:'logistics', name:'СДЭК', icon:'📦', badge:'Популярный', badgeColor:'#16A34A',
    description:'Доставка по всей России. Автосоздание накладных, трекинг в реальном времени.',
    pricing:'От 199₽ за отправление', docs:'https://www.cdek.ru/ru/integration/',
    fields:[{key:'client_id',label:'Client ID',ph:'из ЛК СДЭК'},{key:'secret',label:'Client Secret',ph:'секретный ключ'}] },
  { type:'yandex_delivery', category:'logistics', name:'Яндекс Доставка', icon:'🚀', badge:'Быстро', badgeColor:'#F59E0B',
    description:'Быстрая доставка в Москве и СПб. API для создания заказов и трекинга.',
    pricing:'От 299₽ за доставку', docs:'https://yandex.ru/dev/logistics/',
    fields:[{key:'oauth_token',label:'OAuth Token',ph:'ya29.xxx...'}] },
  { type:'tinkoff', category:'payments', name:'Тинькофф Касса', icon:'💳', badge:'Рекомендуем', badgeColor:'#0FBCCE',
    description:'Приём оплаты картой, СБП, рассрочка. Комиссия 1.2-2.9%.',
    pricing:'1.2% от оборота', docs:'https://www.tinkoff.ru/kassa/develop/',
    fields:[{key:'terminal_key',label:'TerminalKey',ph:'TinkoffBankTest'},{key:'secret_key',label:'SecretKey',ph:'секрет'}] },
  { type:'vtb', category:'banking', name:'ВТБ Эквайринг', icon:'🏦', badge:'Корпоративный', badgeColor:'#8B5CF6',
    description:'Корпоративный эквайринг ВТБ. Низкие ставки от 1.1%, выплаты на следующий день.',
    pricing:'От 1.1% от оборота', docs:'https://ekvairinig.vtb.ru/',
    fields:[{key:'merchant_id',label:'Merchant ID',ph:'merchant_xxx'},{key:'api_key',label:'API Key',ph:'vtb_live_xxx'}] },
  { type:'yandex_pay', category:'payments', name:'Яндекс Pay', icon:'⚡', badge:'Легко подключить', badgeColor:'#16A34A',
    description:'Оплата одним нажатием. Конверсия +15-25% для пользователей Яндекса.',
    pricing:'2.5% от оборота', docs:'https://pay.yandex.ru/docs/',
    fields:[{key:'merchant_id',label:'Merchant ID',ph:'из Яндекс Бизнес'}] },
]

const CATEGORIES = [
  {key:'logistics', label:'📦 Логистика'},
  {key:'payments', label:'💳 Оплата'},
  {key:'banking', label:'🏦 Банки'},
]

export default function AdminIntegrationsPage() {
  const [integrations, setIntegrations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState<string|null>(null)
  const [formData, setFormData] = useState<Record<string,string>>({})
  const [saved, setSaved] = useState<string|null>(null)

  useEffect(() => { loadIntegrations() }, [])

  const loadIntegrations = async () => {
    setLoading(true)
    const { data } = await supabase.from('integrations').select('*').is('seller_id', null)
    setIntegrations(data || [])
    setLoading(false)
  }

  const getStatus = (type: string) => integrations.find(i => i.type === type)?.status || 'inactive'

  const connect = async (type: string) => {
    const cat = CATALOG.find(i => i.type === type)
    if (!cat) return
    await supabase.from('integrations').upsert({
      seller_id: null, type, category: cat.category, name: cat.name,
      status: 'active', config: formData, connected_at: new Date().toISOString(),
    }, { onConflict: 'type' })
    setSaved(type); setConnecting(null); setFormData({})
    setTimeout(() => setSaved(null), 3000)
    loadIntegrations()
  }

  const disconnect = async (type: string) => {
    if (!confirm('Отключить интеграцию?')) return
    await supabase.from('integrations').update({ status: 'inactive', config: {} }).eq('type', type).is('seller_id', null)
    loadIntegrations()
  }

  if (loading) return (
    <div style={{minHeight:'100vh',background:C.bg,display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{width:32,height:32,border:`2px solid ${C.accent}`,borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite'}} />
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  )

  return (
    <div style={{minHeight:'100vh',background:C.bg,padding:24}}>
      <div style={{maxWidth:900,margin:'0 auto'}}>
        <div style={{marginBottom:28}}>
          <h1 style={{fontSize:24,fontWeight:800,color:C.text}}>Интеграции</h1>
          <p style={{fontSize:13,color:C.muted,marginTop:4}}>Логисты, платёжные системы, банки</p>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:28}}>
          {CATEGORIES.map(cat => {
            const items = CATALOG.filter(i => i.category === cat.key)
            const active = items.filter(i => getStatus(i.type) === 'active').length
            return (
              <div key={cat.key} style={{background:C.surface,borderRadius:14,border:`1px solid ${C.border}`,padding:16}}>
                <p style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:4}}>{cat.label}</p>
                <p style={{fontSize:22,fontWeight:800,color:active>0?C.ok:C.muted}}>{active}/{items.length}</p>
                <p style={{fontSize:11,color:C.muted}}>подключено</p>
              </div>
            )
          })}
        </div>

        {CATEGORIES.map(cat => (
          <div key={cat.key} style={{marginBottom:28}}>
            <h2 style={{fontSize:16,fontWeight:700,color:C.text,marginBottom:14}}>{cat.label}</h2>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              {CATALOG.filter(i => i.category === cat.key).map(item => {
                const isActive = getStatus(item.type) === 'active'
                const isConnecting = connecting === item.type
                return (
                  <div key={item.type} style={{background:C.surface,borderRadius:16,border:`1px solid ${isActive?'#bbf7d0':C.border}`,padding:20,boxShadow:'0 1px 3px rgba(0,0,0,0.05)'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                      <div style={{display:'flex',gap:14,flex:1}}>
                        <div style={{width:48,height:48,borderRadius:12,background:isActive?'#f0fdf4':C.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,flexShrink:0}}>{item.icon}</div>
                        <div style={{flex:1}}>
                          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                            <span style={{fontSize:15,fontWeight:700,color:C.text}}>{item.name}</span>
                            <span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:99,background:item.badgeColor+'20',color:item.badgeColor}}>{item.badge}</span>
                            {isActive&&<span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:99,background:'#f0fdf4',color:C.ok}}>✓ Активно</span>}
                          </div>
                          <p style={{fontSize:13,color:C.muted,marginBottom:8,lineHeight:1.5}}>{item.description}</p>
                          <div style={{display:'flex',gap:16}}>
                            <span style={{fontSize:12,color:C.muted}}>💰 {item.pricing}</span>
                            <a href={item.docs} target="_blank" style={{fontSize:12,color:C.accent,textDecoration:'none'}}>📖 Документация →</a>
                          </div>
                        </div>
                      </div>
                      <div style={{flexShrink:0,marginLeft:16}}>
                        {isActive ? (
                          <button onClick={()=>disconnect(item.type)} style={{padding:'8px 16px',borderRadius:10,background:'#fef2f2',border:'1px solid #fecaca',color:C.red,fontSize:12,fontWeight:600,cursor:'pointer'}}>Отключить</button>
                        ) : (
                          <button onClick={()=>setConnecting(isConnecting?null:item.type)} style={{padding:'8px 20px',borderRadius:10,background:C.accent,border:'none',color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer'}}>Подключить</button>
                        )}
                      </div>
                    </div>

                    {isConnecting && (
                      <div style={{marginTop:16,padding:16,background:C.bg,borderRadius:12,border:`1px solid ${C.accent}30`}}>
                        <p style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:12}}>Данные для подключения</p>
                        {item.fields.map(field => (
                          <div key={field.key} style={{marginBottom:10}}>
                            <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:4,fontWeight:600}}>{field.label}</label>
                            <input type="password" placeholder={field.ph} value={formData[field.key]||''}
                              onChange={e=>setFormData(p=>({...p,[field.key]:e.target.value}))}
                              style={{width:'100%',padding:'10px 12px',borderRadius:8,border:`1px solid ${C.border}`,fontSize:13,boxSizing:'border-box' as const}} />
                          </div>
                        ))}
                        <div style={{display:'flex',gap:8,marginTop:8}}>
                          <button onClick={()=>connect(item.type)} style={{padding:'10px 24px',background:C.ok,color:'#fff',borderRadius:10,border:'none',fontSize:13,fontWeight:700,cursor:'pointer'}}>
                            {saved===item.type?'✅ Сохранено!':'Сохранить и подключить'}
                          </button>
                          <button onClick={()=>{setConnecting(null);setFormData({})}} style={{padding:'10px 16px',background:C.card,color:C.muted,borderRadius:10,border:`1px solid ${C.border}`,fontSize:13,cursor:'pointer'}}>Отмена</button>
                        </div>
                        <p style={{fontSize:11,color:C.muted,marginTop:8}}>🔒 Ключи хранятся в Supabase и не передаются третьим лицам</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        <div style={{background:C.surface,borderRadius:16,border:`1px solid ${C.border}`,padding:20}}>
          <h2 style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:14}}>🗺️ В разработке</h2>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
            {[
              {name:'МойСклад',icon:'🏭',desc:'Синхронизация остатков'},
              {name:'Boxberry',icon:'📮',desc:'Доставка в ПВЗ'},
              {name:'Почта России',icon:'✉️',desc:'Отправления по РФ'},
              {name:'СберПэй',icon:'💚',desc:'Оплата через Сбер'},
              {name:'ЮKassa',icon:'🟡',desc:'Яндекс платежи'},
              {name:'WhatsApp API',icon:'💬',desc:'Уведомления покупателям'},
            ].map((r,i)=>(
              <div key={i} style={{padding:'12px 14px',background:C.bg,borderRadius:10,border:`1px solid ${C.border}`,display:'flex',gap:10,alignItems:'center'}}>
                <span style={{fontSize:20}}>{r.icon}</span>
                <div><p style={{fontSize:12,fontWeight:600,color:C.text}}>{r.name}</p><p style={{fontSize:11,color:C.muted}}>{r.desc}</p></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
