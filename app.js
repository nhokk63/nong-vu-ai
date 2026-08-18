const BASE_URL = new URL('./', document.baseURI);
const FALLBACK_KNOWLEDGE = {
  crops: {
    coffee:{name:'Cà phê',stages:[{id:'postharvest',name:'Sau thu hoạch',goals:['Phục hồi cây','vệ sinh vườn'],monitor:['sâu bệnh còn tồn lưu','cành khô']},{id:'shoot',name:'Phục hồi – phát triển cành lá',goals:['Tạo cành hữu hiệu','duy trì bộ lá'],monitor:['rệp','sâu ăn lá','nấm lá']},{id:'floral',name:'Phân hóa mầm hoa',goals:['Chuẩn bị ra hoa'],monitor:['sức cây','ẩm đất']},{id:'flower',name:'Tưới – ra hoa',goals:['Đồng đều ra hoa'],monitor:['mưa trái mùa','bệnh hoa']},{id:'fruitset',name:'Đậu quả',goals:['Giữ quả non'],monitor:['sâu chích hút','bệnh lá/quả']},{id:'fruit',name:'Nuôi quả',goals:['Nuôi quả','duy trì tán lá'],monitor:['gỉ sắt','thán thư','rệp sáp']},{id:'ripening',name:'Quả phát triển – chín',goals:['Chất lượng quả'],monitor:['bệnh quả','sâu chích hút']},{id:'preharvest',name:'Chuẩn bị thu hoạch',goals:['An toàn thực phẩm'],monitor:['PHI','tồn dư']}],riskTargets:['gỉ sắt','thán thư','nấm hồng','rệp sáp','sâu đục cành','tuyến trùng']},
    pepper:{name:'Hồ tiêu',stages:[{id:'recovery',name:'Sau thu hoạch – phục hồi',goals:['Phục hồi dây','quản lý rễ'],monitor:['Phytophthora','tuyến trùng','rệp sáp']},{id:'canopy',name:'Phát triển thân – cành',goals:['Tán khỏe'],monitor:['rệp sáp','bệnh lá']},{id:'flower',name:'Ra hoa',goals:['Đồng đều ra hoa'],monitor:['ẩm đất','mưa bất thường']},{id:'fruitset',name:'Đậu trái',goals:['Giữ trái non'],monitor:['rệp sáp','bệnh lá']},{id:'fruit',name:'Nuôi trái',goals:['Nuôi chùm'],monitor:['chết nhanh','thối rễ','rệp sáp','tuyến trùng']},{id:'preharvest',name:'Trước thu hoạch',goals:['An toàn thực phẩm'],monitor:['PHI']},{id:'harvest',name:'Thu hoạch',goals:['Thu hái đúng độ chín'],monitor:[]},{id:'post',name:'Sau thu hoạch',goals:['Vệ sinh và chuẩn bị vụ sau'],monitor:[]}],riskTargets:['chết nhanh Phytophthora','chết chậm','thối rễ','tuyến trùng','rệp sáp']},
    areca:{name:'Cau',stages:[{id:'seedling',name:'Cây con',goals:['Rễ khỏe','ổn định tán'],monitor:['sâu ăn lá','thối rễ']},{id:'juvenile',name:'Kiến thiết cơ bản',goals:['Tăng trưởng thân lá'],monitor:['sâu bệnh lá','rễ']},{id:'mature',name:'Cây trưởng thành',goals:['Duy trì tán','nuôi buồng'],monitor:['sâu bệnh lá','rễ']},{id:'fruit',name:'Mang buồng – nuôi trái',goals:['Nuôi buồng','giảm rụng'],monitor:['sâu bệnh theo quan sát']},{id:'harvest',name:'Thu hoạch',goals:['Thu hái đúng thời điểm'],monitor:['an toàn']}],riskTargets:['sâu ăn lá','thối rễ','đốm lá']}
  },
  rules:[],
  sources:[]
};

const state = {
  tab: location.hash.replace(/^#/,'') || 'home',
  plants: [], recs: [], tasks: [], inventory: [], weather: null,
  token: localStorage.getItem('appToken') || '',
  apiBase: localStorage.getItem('apiBase') || '',
  knowledge: FALLBACK_KNOWLEDGE,
  backend: 'local', automation: null,
};

const $ = (s,root=document)=>root.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const now = () => new Date().toISOString();
const id = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const cropName = c => state.knowledge?.crops?.[c]?.name || ({coffee:'Cà phê',pepper:'Hồ tiêu',areca:'Cau'}[c] || c);
const stageName = (c,s) => state.knowledge?.crops?.[c]?.stages?.find(x=>x.id===s)?.name || s || 'Chưa chọn';
const appPath = p => new URL(p.replace(/^\//,''), BASE_URL).href;

function toast(text, type='info') {
  const e=document.createElement('div'); e.className=`toast ${type}`; e.textContent=text;
  document.body.appendChild(e); setTimeout(()=>e.remove(),2600);
}

function localLoad(){
  state.plants=JSON.parse(localStorage.getItem('nv_plants')||'[]');
  state.recs=JSON.parse(localStorage.getItem('nv_recs')||'[]');
  state.tasks=JSON.parse(localStorage.getItem('nv_tasks')||'[]');
  state.inventory=JSON.parse(localStorage.getItem('nv_inventory')||'[]');
}
function persistLocal(){
  localStorage.setItem('nv_plants',JSON.stringify(state.plants));
  localStorage.setItem('nv_recs',JSON.stringify(state.recs));
  localStorage.setItem('nv_tasks',JSON.stringify(state.tasks));
  localStorage.setItem('nv_inventory',JSON.stringify(state.inventory));
}

async function jsonFetch(url,opts={}){
  const res=await fetch(url,opts);
  const text=await res.text();
  let data={}; try{data=text?JSON.parse(text):{}}catch{data={raw:text};}
  if(!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function apiUrl(path){
  if(state.apiBase) return state.apiBase.replace(/\/$/,'') + '/' + path.replace(/^\//,'');
  return appPath(path);
}

async function api(path,opts={}){
  const headers={'Content-Type':'application/json',...(opts.headers||{})};
  if(state.token) headers['X-App-Token']=state.token;
  return jsonFetch(apiUrl(path),{...opts,headers});
}

async function loadKnowledge(){
  try { state.knowledge=await jsonFetch(appPath('knowledge.json')); }
  catch { state.knowledge=FALLBACK_KNOWLEDGE; }
}

async function loadData(){
  localLoad();
  try{
    const d=await api('/api/data');
    state.plants=d.plants||[]; state.recs=d.recs||[]; state.tasks=d.tasks||[]; state.inventory=d.inventory||[];
    state.backend='cloud';
  }catch{ state.backend='local'; }
}

async function boot(){
  await loadKnowledge();
  await loadData();
  await loadAutomationStatus();
  try{ await registerSW(); }catch{}
  render();
  try{
    const p=state.plants.find(x=>Number.isFinite(Number(x.lat))&&Number.isFinite(Number(x.lon)));
    if(p){
      const [w,name]=await Promise.all([fetchWeatherForPlant(p),reverseGeocode(p.lat,p.lon)]);
      state.weather={...w,location:{lat:Number(p.lat),lon:Number(p.lon),name}};
      if(state.tab==='home') render();
    }
  }catch{}
}

async function registerSW(){
  if(!('serviceWorker' in navigator)) return;
  const sw=appPath('sw.js');
  await navigator.serviceWorker.register(sw,{scope:BASE_URL.pathname});
}

async function loadAutomationStatus(){
  try{ state.automation=await api('/api/automation/status'); }catch{ state.automation=null; }
}

function svg(name){
 const a={
  home:'<svg viewBox="0 0 24 24"><path d="M3 10.8 12 3l9 7.8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
  plant:'<svg viewBox="0 0 24 24"><path d="M12 21V9"/><path d="M12 12c-4.3 0-7-2.5-7-6 4.2-.2 7 1.8 7 6Z"/><path d="M12 8c.2-3.7 2.7-6 6.5-6 .2 3.7-1.8 6.2-6.5 6Z"/></svg>',
  ai:'<svg viewBox="0 0 24 24"><path d="M12 3v4"/><path d="M12 17v4"/><path d="m5.6 5.6 2.8 2.8"/><path d="m15.6 15.6 2.8 2.8"/><path d="M3 12h4"/><path d="M17 12h4"/><path d="m5.6 18.4 2.8-2.8"/><path d="m15.6 8.4 2.8-2.8"/><circle cx="12" cy="12" r="3.3"/></svg>',
  calendar:'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/></svg>',
  settings:'<svg viewBox="0 0 24 24"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"/><path d="m19.4 15 .2.3-1.7 3-1-.2c-.6-.1-1.1 0-1.6.3l-.8.5-.2 1h-3.5l-.2-1-.8-.5c-.5-.3-1-.4-1.6-.3l-1 .2-1.7-3 .8-.7c.4-.4.6-.8.6-1.4v-.7c0-.6-.2-1-.6-1.4l-.8-.7 1.7-3 1 .2c.6.1 1.1 0 1.6-.3l.8-.5.2-1h3.5l.2 1 .8.5c.5.3 1 .4 1.6.3l1-.2 1.7 3-.8.7c-.4.4-.6.8-.6 1.4v.7c0 .6.2 1 .6 1.4Z"/></svg>',
  plus:'<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  back:'<svg viewBox="0 0 24 24"><path d="m14.5 5-7 7 7 7"/><path d="M8 12h11"/></svg>',
  pin:'<svg viewBox="0 0 24 24"><path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z"/><circle cx="12" cy="10" r="2"/></svg>'
 };
 return a[name]||'';
}

function weatherInfo(code,isDay=1){
  const c=Number(code);
  if([95,96,99].includes(c)) return {key:'storm',label:'Dông',accent:'red',icon:'storm'};
  if([61,63,65,66,67,80,81,82].includes(c)) return {key:'rain',label:'Mưa',accent:'blue',icon:'rain'};
  if([45,48].includes(c)) return {key:'fog',label:'Sương mù',accent:'gray',icon:'fog'};
  if([1,2,3].includes(c)) return {key:'cloud',label:c===1?'Ít mây':'Nhiều mây',accent:'blue',icon:'cloud'};
  return isDay?{key:'sun',label:'Trời quang',accent:'orange',icon:'sun'}:{key:'night',label:'Trời quang',accent:'blue',icon:'moon'};
}
function weatherIcon(kind){
  const base='viewBox="0 0 64 64"';
  if(kind==='sun') return `<svg ${base} class="wsvg"><circle cx="32" cy="32" r="11"></circle><path d="M32 7v7M32 50v7M7 32h7M50 32h7M14 14l5 5M45 45l5 5M50 14l-5 5M19 45l-5 5"></path></svg>`;
  if(kind==='moon') return `<svg ${base} class="wsvg"><path d="M41 8c-2 11 4 20 14 23-4 13-16 22-29 20-13-2-22-12-22-25C4 13 17 3 30 4c4 0 8 1 11 4Z"></path></svg>`;
  if(kind==='cloud') return `<svg ${base} class="wsvg"><path d="M19 45h28a9 9 0 0 0 1-18c-1-9-12-15-21-10-6 3-8 8-8 13h-1a8 8 0 0 0 1 15Z"></path></svg>`;
  if(kind==='rain') return `<svg ${base} class="wsvg"><path d="M18 39h28a9 9 0 0 0 1-18c-1-9-12-15-21-10-6 3-8 8-8 13h-1a8 8 0 0 0 1 15Z"></path><path d="M21 47l-3 7M33 47l-3 7M45 47l-3 7"></path></svg>`;
  if(kind==='storm') return `<svg ${base} class="wsvg"><path d="M18 35h27a9 9 0 0 0 1-18c-1-8-11-13-19-9-5 2-8 7-8 12h-1a7 7 0 0 0 0 15Z"></path><path d="m33 33-6 11h7l-5 12 12-17h-7l6-6Z"></path></svg>`;
  return `<svg ${base} class="wsvg"><path d="M16 43h31a8 8 0 0 0 1-16c-1-8-11-13-19-9-5 2-8 7-8 11h-1a7 7 0 0 0-4 14Z"></path><path d="M10 51h44M18 56h28"></path></svg>`;
}
function formatCoord(v,lat=true){ return Number.isFinite(Number(v)) ? `${Math.abs(Number(v)).toFixed(4)}° ${lat?(Number(v)>=0?'B':'N'):(Number(v)>=0?'Đ':'T')}` : '--'; }
function weatherLocationLine(){
  const p=state.weather?.location;
  if(!p) return 'Chưa có vị trí';
  return p.name ? `${esc(p.name)} • ${formatCoord(p.lat,true)}, ${formatCoord(p.lon,false)}` : `${formatCoord(p.lat,true)}, ${formatCoord(p.lon,false)}`;
}
function dayLabel(dateStr){
  const d=new Date(dateStr+'T12:00:00'); return new Intl.DateTimeFormat('vi-VN',{weekday:'short'}).format(d).replace('.', '');
}
function weatherCodeFromHourly(h,idx){return h?.weather_code?.[idx] ?? 0;}
function compactPlace(name='') {
  const parts=String(name).split(',').map(s=>s.trim()).filter(Boolean);
  if(!parts.length) return 'Vị trí hiện tại';
  const uniq=[]; for(const part of parts){ if(!uniq.includes(part)) uniq.push(part); }
  return uniq.slice(-2).join(', ');
}
function weatherCard(){
  const w=state.weather?.current;
  if(!w) return `<section class="section"><div class="weather-empty card"><div class="weather-empty-icon">${svg('pin')}</div><div class="weather-empty-copy"><div class="section-title">Thời tiết</div><div class="note">Bật định vị để xem thời tiết hiện tại.</div></div><button class="btn primary" data-action="refresh-weather">Định vị</button></div></section>`;
  const wi=weatherInfo(w.weather_code,w.is_day);
  const loc=state.weather.location||{};
  const rain=Number(w.precipitation||0), hum=Number(w.relative_humidity_2m||0), wind=Number(w.wind_speed_10m||0);
  const daily=state.weather.daily||{};
  const forecasts=(daily.time||[]).slice(0,5).map((date,i)=>{const q=weatherInfo(daily.weather_code?.[i] ?? 0,1); return `<div class="forecast-cell"><div class="forecast-day">${esc(dayLabel(date))}</div><div class="forecast-icon">${weatherIcon(q.icon)}</div><div class="forecast-temp">${Math.round(daily.temperature_2m_max?.[i]??0)}°</div><div class="forecast-low">${Math.round(daily.temperature_2m_min?.[i]??0)}°</div><div class="forecast-rain">${Math.round(daily.precipitation_probability_max?.[i]??0)}%</div></div>`}).join('');
  return `<section class="section weather-section"><div class="weather-card weather-compact ${wi.key}">
    <div class="weather-top"><div class="weather-location-wrap"><div class="weather-kicker">THỜI TIẾT HIỆN TẠI</div><div class="weather-place">${esc(compactPlace(loc.name))}</div></div><button class="weather-locate" data-action="refresh-weather" aria-label="Cập nhật vị trí">${svg('pin')}</button></div>
    <div class="weather-mainline"><div class="weather-art">${weatherIcon(wi.icon)}</div><div class="weather-reading"><div class="weather-temp-xl">${Math.round(Number(w.temperature_2m||0))}°</div><div class="weather-condition">${wi.label}</div></div></div>
    <div class="weather-metrics compact"><div><span>Độ ẩm</span><strong>${hum}%</strong></div><div><span>Mưa</span><strong>${rain.toFixed(1)} mm</strong></div><div><span>Gió</span><strong>${Math.round(wind)} km/h</strong></div></div>
    <div class="forecast-row compact">${forecasts || '<div class="note">Chưa có dự báo.</div>'}</div>
  </div></section>`;
}
async function reverseGeocode(lat,lon){
  try{
    const u=`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&localityLanguage=vi`;
    const d=await jsonFetch(u);
    const parts=[d.locality,d.city,d.principalSubdivision,d.countryName].filter(Boolean);
    return parts.slice(0,3).join(', ');
  }catch{return ''}
}
async function refreshWeather(){
  try{
    toast('Đang lấy vị trí…');
    const pos=await new Promise((res,rej)=>{ if(!navigator.geolocation) return rej(new Error('Trình duyệt không hỗ trợ GPS')); navigator.geolocation.getCurrentPosition(res,rej,{enableHighAccuracy:true,timeout:12000,maximumAge:30000}); });
    const lat=pos.coords.latitude, lon=pos.coords.longitude;
    const [w,name]=await Promise.all([fetchWeatherForPlant({lat,lon}),reverseGeocode(lat,lon)]);
    state.weather={...w,location:{lat,lon,name}};
    render(); toast('Đã cập nhật thời tiết và vị trí','success');
  }catch(err){toast(`Không lấy được vị trí/thời tiết: ${err.message}`,'error');}
}

function header(title,sub,action=''){
 return `<div class="nav"><div class="nav-row"><div><div class="title">${esc(title)}</div><div class="subtitle">${esc(sub||'')}</div></div><div class="nav-actions">${action}</div></div></div>`;
}
function nav(){
 return `<div class="bottom">${[['home','Tổng quan'],['plant','Cây trồng'],['ai','AI tư vấn'],['calendar','Lịch']].map(([x,t])=>`<button class="tab ${state.tab===x?'active':''}" data-tab="${x}">${svg(x)}<span>${t}</span></button>`).join('')}</div>`;
}
function render(){
 const app=$('#app'); if(!app)return;
 const gear=`<button class="icon-btn" aria-label="Cài đặt" data-action="open-settings">${svg('settings')}</button>`;
 const plus=`<button class="icon-btn" aria-label="Thêm" data-action="add-plant">${svg('plus')}</button>`;
 let main='';
 if(state.tab==='home') main=header('Nông Vụ AI','Trợ lý chăm sóc cây',`${plus}${gear}`)+`<main class="shell"><div class="content">${homeView()}</div></main>`;
 else if(state.tab==='plant') main=header('Cây trồng','Cà phê • Hồ tiêu • Cau',`${plus}${gear}`)+`<main class="shell"><div class="content">${plantsView()}</div></main>`;
 else if(state.tab==='ai') main=header('AI tư vấn','Theo giai đoạn • thời tiết • lịch sử',gear)+`<main class="shell"><div class="content">${aiView()}</div></main>`;
 else if(state.tab==='calendar') main=header('Lịch','Công việc đã duyệt',gear)+`<main class="shell"><div class="content">${calendarView()}</div></main>`;
 else main=header('Cài đặt','Kết nối và dữ liệu',`<button class="icon-btn" data-action="back-home">${svg('back')}</button>`)+`<main class="shell"><div class="content">${settingsView()}</div></main>`;
 app.innerHTML=main+(state.tab!=='settings'?nav():'');
}


function plantArt(crop){
  const c=String(crop);
  if(c==='coffee') return `<svg class="plant-art coffee-art" viewBox="0 0 120 120" aria-hidden="true">
    <defs><linearGradient id="cg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2c9b57"/><stop offset="1" stop-color="#15663a"/></linearGradient></defs>
    <path d="M58 106V52" stroke="url(#cg1)" stroke-width="7" stroke-linecap="round"/>
    <path d="M58 68C40 62 26 50 20 35c15-3 29 1 38 12M59 77c18-5 31-16 37-31-16-3-30 1-39 12M58 53C45 44 38 33 37 21c13 1 23 8 27 20M61 57c13-10 22-21 23-34-13 1-23 8-28 20" fill="none" stroke="url(#cg1)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="40" cy="40" r="5" fill="#d86642"/><circle cx="78" cy="47" r="5" fill="#d86642"/><circle cx="49" cy="72" r="4.5" fill="#d86642"/>
  </svg>`;
  if(c==='pepper') return `<svg class="plant-art pepper-art" viewBox="0 0 120 120" aria-hidden="true">
    <defs><linearGradient id="pg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#41b96d"/><stop offset="1" stop-color="#197746"/></linearGradient></defs>
    <path d="M60 110C53 92 56 77 61 60c5-17 7-30 2-43" fill="none" stroke="url(#pg1)" stroke-width="7" stroke-linecap="round"/>
    <path d="M61 67c-18-6-28-18-31-34 13-2 26 5 33 17M61 76c20-8 29-20 31-37-14 0-27 7-34 19M64 47c13-5 21-15 22-28-11 0-20 4-26 13" fill="none" stroke="url(#pg1)" stroke-width="5.5" stroke-linecap="round"/>
    <path d="M79 76c8 4 12 10 12 17-8 3-15 0-19-7-3-6 0-10 7-10ZM83 92c7 3 10 8 10 14-7 3-13 1-17-5-3-5 0-8 7-9Z" fill="#d2a74d" opacity=".92"/>
  </svg>`;
  return `<svg class="plant-art areca-art" viewBox="0 0 120 120" aria-hidden="true">
    <defs><linearGradient id="ag1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#58b76f"/><stop offset="1" stop-color="#1b7546"/></linearGradient></defs>
    <path d="M60 110V57" stroke="url(#ag1)" stroke-width="8" stroke-linecap="round"/>
    <path d="M59 60C42 48 25 41 14 41M61 60c15-11 30-18 45-18M59 55C50 38 47 24 50 12M62 55c7-17 14-28 25-37" fill="none" stroke="url(#ag1)" stroke-width="5.5" stroke-linecap="round"/>
    <path d="M14 41c12-8 24-9 34-5-7 9-18 13-34 5ZM106 42c-12-8-24-9-34-5 7 9 18 13 34 5ZM50 12c8 7 12 17 11 29-9-5-14-14-11-29ZM87 18c-7 7-10 17-8 27 9-5 12-14 8-27Z" fill="url(#ag1)" opacity=".96"/>
    <circle cx="80" cy="77" r="5" fill="#e0b85a"/><circle cx="87" cy="84" r="4.5" fill="#e0b85a"/><circle cx="73" cy="86" r="4" fill="#e0b85a"/>
  </svg>`;
}
function plantTone(crop){ return crop==='coffee'?'coffee-tone':crop==='pepper'?'pepper-tone':'areca-tone'; }
function monitorSnapshot(){
  const nowMs=Date.now();
  const stale=state.plants.filter(p=>!p.last_check_at || nowMs-Date.parse(p.last_check_at)>4*86400000).length;
  const overdue=state.tasks.filter(t=>t.status!=='DONE' && t.scheduled_at && new Date(t.scheduled_at)<new Date()).length;
  const pending=state.recs.filter(r=>r.status==='PENDING').length;
  const weatherRisk=Number(state.weather?.current?.relative_humidity_2m||0)>=85 || Number(state.weather?.current?.precipitation||0)>=5;
  let level='green', label='Đang ổn';
  if(overdue||stale||pending){level=weatherRisk?'orange':'blue'; label=overdue?'Có việc quá hạn':stale?'Cần cập nhật cây':'Có khuyến cáo chờ duyệt';}
  if(weatherRisk && !overdue) {level='orange'; label='Thời tiết cần theo dõi';}
  return {stale,overdue,pending,level,label};
}
function plantStatus(p){
  const last=p.last_check_at?Date.parse(p.last_check_at):0;
  const stale=!last || Date.now()-last>4*86400000;
  const hasTask=state.tasks.some(t=>t.plant_id===p.id && t.status!=='DONE' && t.scheduled_at && new Date(t.scheduled_at)<new Date());
  if(hasTask) return {label:'Quá hạn',tone:'red'};
  if(stale) return {label:'Cần cập nhật',tone:'orange'};
  return {label:'Đang theo dõi',tone:'green'};
}

function homeView(){
 const pending=state.recs.filter(x=>x.status==='PENDING').length;
 const today=state.tasks.filter(x=>x.scheduled_at?.slice(0,10)===new Date().toISOString().slice(0,10)&&x.status!=='DONE').length;
 const totalPlants=state.plants.reduce((a,p)=>a+(Number(p.count)||0),0);
 const mon=monitorSnapshot();
 return `<div class="grid grid-3">
   <div class="card stat"><div class="stat-k">Loại cây</div><div class="stat-v">${state.plants.length}</div><div class="stat-s">đang quản lý</div></div>
   <div class="card stat"><div class="stat-k">Tổng cây</div><div class="stat-v">${totalPlants.toLocaleString('vi-VN')}</div><div class="stat-s">cây</div></div>
   <div class="card stat"><div class="stat-k">Hôm nay</div><div class="stat-v">${today}</div><div class="stat-s">việc cần làm</div></div>
 </div>
 ${weatherCard()}
 <div class="monitor-bar ${mon.level}">
   <div class="monitor-icon">${mon.level==='green'?'✓':mon.level==='orange'?'!':'•'}</div>
   <div class="monitor-copy"><b>AI đang theo dõi</b><span>${esc(mon.label)} · ${state.plants.length} loại cây · ${mon.stale} cây cần cập nhật · ${mon.pending} khuyến cáo</span></div>
   <button class="mini-link" data-action="quick-advice">Xem</button>
 </div>
 <div class="section"><div class="card hero"><div class="row"><div><span class="tag blue">AI NÔNG VỤ</span><div class="hero-title" style="margin-top:8px">Tư vấn đúng giai đoạn</div><div class="note" style="margin-top:4px">Gộp mùa vụ, thời tiết, quan sát và lịch sử để đề xuất. Mày duyệt trước khi vào lịch.</div></div><button class="btn primary" data-action="quick-advice">Tư vấn</button></div></div></div>
 <div class="section"><div class="section-head"><div class="section-title">Cây đang quản lý</div><button class="section-link" data-tab="plant">Xem tất cả</button></div>${plantCards(4)}</div>
 <div class="section"><div class="section-head"><div class="section-title">Khuyến cáo chờ duyệt</div><span class="tag ${pending?'orange':'green'}">${pending}</span></div>${pending?recCards(3):`<div class="card empty">Chưa có khuyến cáo cần duyệt.</div>`}</div>`;
}
function plantCards(n){
 const a=state.plants.slice(0,n); if(!a.length)return `<div class="card empty">Chưa có cây. Bấm ＋ để thêm.</div>`;
 return `<div class="plant-grid">${a.map(p=>{const st=plantStatus(p);return `<div class="plant-card ${plantTone(p.crop)}">
   <div class="plant-art-wrap">${plantArt(p.crop)}</div>
   <div class="plant-card-body">
     <div class="row"><div><div class="item-title">${esc(p.name||cropName(p.crop))}</div><div class="item-meta">${Number(p.count||0).toLocaleString('vi-VN')} cây • ${esc(p.area||0)} ha</div></div><span class="tag ${st.tone}">${st.label}</span></div>
     <div class="plant-stage">${esc(stageName(p.crop,p.stage))}</div>
     <div class="actions"><button class="btn secondary" data-action="consult" data-id="${esc(p.id)}">Tư vấn</button><button class="btn ghost" data-action="update-plant" data-id="${esc(p.id)}">Cập nhật</button></div>
   </div>
 </div>`}).join('')}</div>`;
}
function plantsView(){
 return `<div class="section"><div class="section-head"><div class="section-title">Danh sách cây</div><div class="muted small">GPS tự lấy</div></div>${plantCards(999)}</div>
 <div class="section"><div class="card add-plant-cta"><div class="section-title">Thêm loại cây</div><div class="note" style="margin-top:4px">Chọn cây, nhập số lượng + diện tích. Vị trí tự gắn khi lưu.</div><div class="actions"><button class="btn primary" data-action="add-plant">＋ Thêm cây</button></div></div></div>`;
}
function aiView(){
 return `<div class="section"><div class="card"><div class="section-title">Chọn cây để tư vấn</div><div class="note" style="margin-top:4px">AI sẽ lấy thời tiết theo GPS và kết hợp giai đoạn, lịch sử, vật tư đã đối chiếu.</div><div class="list" style="margin-top:10px">${state.plants.map(p=>`<div class="plant-chip"><span class="plant-dot"></span><div style="flex:1"><div class="item-title">${esc(p.name||cropName(p.crop))}</div><div class="item-meta">${esc(stageName(p.crop,p.stage))} • ${p.count} cây • ${p.area} ha</div></div><button class="btn primary" data-action="consult" data-id="${esc(p.id)}">Tư vấn</button></div>`).join('')||`<div class="empty">Thêm cây trước để bắt đầu.</div>`}</div></div></div>
 <div class="section"><div class="section-head"><div class="section-title">Khuyến cáo</div></div>${recCards(999)}</div>`;
}
function recCards(n){
 const a=state.recs.slice(0,n); if(!a.length)return `<div class="card empty">Chưa có khuyến cáo.</div>`;
 return `<div class="list">${a.map(r=>{const p=state.plants.find(x=>x.id===r.plant_id);return `<div class="item advice ${r.status==='PENDING'?'warning':''}"><div class="row"><div><div class="item-title">${esc(r.title||'Khuyến cáo AI')}</div><div class="item-meta">${p?esc(p.name||cropName(p.crop)):''}</div></div><span class="tag ${r.status==='APPROVED'?'green':r.status==='REJECTED'?'red':'orange'}">${esc(r.status)}</span></div><div class="small" style="margin-top:8px;white-space:pre-wrap;line-height:1.45">${esc(r.body||'')}</div>${r.status==='PENDING'?`<div class="actions"><button class="btn success" data-action="approve-rec" data-id="${esc(r.id)}">Duyệt → lịch</button><button class="btn secondary" data-action="postpone-rec" data-id="${esc(r.id)}">Hoãn</button><button class="btn danger" data-action="reject-rec" data-id="${esc(r.id)}">Từ chối</button></div>`:''}</div>`}).join('')}</div>`;
}
function calendarView(){
 const a=[...state.tasks].sort((x,y)=>(x.scheduled_at||'').localeCompare(y.scheduled_at||'')); if(!a.length)return `<div class="card empty">Chưa có việc. Duyệt một khuyến cáo để tạo lịch.</div>`;
 return `<div class="list">${a.map(t=>`<div class="item"><div class="row"><div><div class="item-title">${esc(t.title||t.kind)}</div><div class="item-meta">${new Date(t.scheduled_at||Date.now()).toLocaleString('vi-VN',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</div></div><span class="tag ${t.status==='DONE'?'green':t.status==='POSTPONED'?'orange':'blue'}">${esc(t.status)}</span></div><div class="actions">${t.status!=='DONE'?`<button class="btn success" data-action="done-task" data-id="${esc(t.id)}">Đã làm</button><button class="btn secondary" data-action="postpone-task" data-id="${esc(t.id)}">Hoãn</button>`:''}</div></div>`).join('')}</div>`;
}
function settingsView(){
 return `<div class="section"><div class="card"><div class="section-title">Theo dõi 24/7</div><div class="note" style="margin-top:4px">Worker sẽ kiểm tra thời tiết mỗi giờ, nhắc việc/cập nhật cây và chạy tổng hợp AI hằng ngày. Telegram được gửi từ secret server-side.</div><div class="status-line" style="margin-top:12px"><span class="status-dot ${state.automation?.enabled?'on':'off'}"></span><span>${state.automation?.enabled?'Đã kết nối automation':'Chưa kết nối automation'}</span><span class="muted">${state.automation?.telegram?'Telegram OK':'Telegram chưa nối'}</span></div><div class="actions"><button class="btn primary" data-action="run-automation">▶ Chạy kiểm tra ngay</button><button class="btn secondary" data-action="test-telegram">Gửi tin thử</button></div></div></div>
 <div class="section"><div class="card"><div class="section-title">Kết nối AI</div><div class="note" style="margin-top:4px">Để trống nếu API cùng domain. Không đặt secret OpenAI trong frontend.</div><div class="form" style="margin-top:10px"><input id="api-base" class="field" placeholder="https://ten-app.pages.dev" value="${esc(state.apiBase)}"><input id="app-token" class="field" type="password" placeholder="APP_TOKEN" value="${esc(state.token)}"><div class="actions"><button class="btn primary" data-action="save-token">Lưu</button><button class="btn secondary" data-action="test-ai">Kiểm tra</button></div></div></div></div>
 <div class="section"><div class="card"><div class="section-title">Vật tư đã đối chiếu</div><div class="note" style="margin-top:4px">Chỉ vật tư đã đối chiếu nhãn mới được AI dùng để đề xuất liều/PHI cụ thể.</div><div class="actions"><button class="btn primary" data-action="add-inventory">＋ Thêm vật tư</button></div>${inventoryList()}</div></div>
 <div class="section"><div class="card"><div class="section-title">Dữ liệu</div><div class="actions"><button class="btn secondary" data-action="seed">Dữ liệu mẫu</button><button class="btn secondary" data-action="export">Xuất JSON</button><button class="btn danger" data-action="clear">Xóa dữ liệu máy</button></div></div></div>`;
}
function inventoryList(){return state.inventory.length?`<div class="list" style="margin-top:10px">${state.inventory.slice(0,8).map(x=>`<div class="item"><div class="item-title">${esc(x.name)}</div><div class="item-meta">${esc(x.active||'')} • ${esc(x.crop||'')} • ${x.label_verified?'Đã đối chiếu':'Chưa đối chiếu'}</div></div>`).join('')}</div>`:`<div class="empty" style="margin-top:10px">Chưa có vật tư.</div>`;}

function modal(html){
 const e=document.createElement('div'); e.className='modal'; e.innerHTML=`<div class="sheet"><div class="handle"></div>${html}</div>`;
 e.addEventListener('click',x=>{if(x.target===e)e.remove();}); document.body.appendChild(e); return e;
}

function addPlantModal(){
 const e=modal(`<h2>Thêm cây trồng</h2><div class="muted small">GPS sẽ tự lấy vị trí khi lưu.</div><div class="form" style="margin-top:14px"><label class="label">Loại cây</label><select id="f-crop" class="field"><option value="coffee">Cà phê</option><option value="pepper">Hồ tiêu</option><option value="areca">Cau</option></select><label class="label">Tên hiển thị</label><input id="f-name" class="field" placeholder="VD: Cà phê 2026"><label class="label">Số lượng cây</label><input id="f-count" class="field" type="number" inputmode="numeric" value="1000"><label class="label">Diện tích (ha)</label><input id="f-area" class="field" type="number" step="0.01" value="1"><label class="label">Giai đoạn</label><select id="f-stage" class="field"></select><label class="label">Mùa vụ</label><input id="f-season" class="field" value="2026/2027"><div class="actions"><button class="btn secondary" data-close="1">Huỷ</button><button class="btn primary" data-save-plant="1">Lưu + lấy GPS</button></div></div>`);
 const cp=$('#f-crop',e), st=$('#f-stage',e); const fill=()=>{st.innerHTML=state.knowledge.crops[cp.value].stages.map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('');}; cp.addEventListener('change',fill); fill();
 e.addEventListener('click',async x=>{ if(x.target.closest('[data-close]'))return e.remove(); if(!x.target.closest('[data-save-plant]'))return; const btn=x.target.closest('[data-save-plant]'); btn.disabled=true; try{
  const pos=await new Promise((res,rej)=>navigator.geolocation ? navigator.geolocation.getCurrentPosition(res,rej,{enableHighAccuracy:true,timeout:10000,maximumAge:30000}) : rej(new Error('Trình duyệt không hỗ trợ GPS')));
  const p={id:id(),crop:cp.value,name:$('#f-name',e).value.trim()||cropName(cp.value),count:+$('#f-count',e).value||0,area:+$('#f-area',e).value||0,stage:st.value,season:$('#f-season',e).value.trim()||'',lat:pos.coords.latitude,lon:pos.coords.longitude,created_at:now(),updated_at:now()};
  state.plants.unshift(p); persistLocal(); try{await api('/api/plants',{method:'POST',body:JSON.stringify(p)});state.backend='cloud';}catch{state.backend='local';}
  e.remove(); render(); toast('Đã thêm cây và gắn GPS','success');
 }catch(err){btn.disabled=false; toast(`Không lấy được GPS: ${err.message}. Hãy cấp quyền vị trí cho trình duyệt.`,'error');}}
 );
}

async function fetchWeatherForPlant(p){
 const qs=`latitude=${encodeURIComponent(p.lat)}&longitude=${encodeURIComponent(p.lon)}&current=temperature_2m,relative_humidity_2m,precipitation,rain,wind_speed_10m,wind_gusts_10m,weather_code,is_day&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,wind_speed_10m,wind_gusts_10m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max&forecast_days=5&timezone=auto`;
 try{return await api(`/api/weather?lat=${encodeURIComponent(p.lat)}&lon=${encodeURIComponent(p.lon)}`);}catch{return await jsonFetch(`https://api.open-meteo.com/v1/forecast?${qs}`);}
}

function localAdvice(p,obs,w){
 const stage=state.knowledge.crops[p.crop]?.stages?.find(s=>s.id===p.stage)||{};
 const rain=Number(w?.current?.precipitation||0), hum=Number(w?.current?.relative_humidity_2m||0);
 const risks=[...(stage.monitor||[])];
 if(rain>15||hum>80) risks.push('Điều kiện ẩm/mưa đang cao');
 return {
   title:`Khuyến cáo sơ bộ – ${cropName(p.crop)} – ${stage.name||stageName(p.crop,p.stage)}`,
   summary:`Đây là đánh giá cục bộ khi chưa kết nối AI cloud (OpenRouter/Groq). Cần dùng quan sát thực tế trước khi quyết định xử lý hóa học.`,
   assessment:`Giai đoạn hiện tại: ${stage.name||stageName(p.crop,p.stage)}. ${obs?`Quan sát: ${obs}`:'Chưa có triệu chứng được nhập.'}`,
   risks,
   checks:stage.monitor||[],
   nonChemical:(stage.goals||[]).map(x=>`Tập trung ${x.toLowerCase()}`),
   chemical:[],
   weatherWindow:'Chưa tự động chốt cửa sổ phun trong chế độ local.',
   precautions:['Không tự suy ra thuốc/hoạt chất/liều khi chưa đối chiếu nhãn.'],
   confidence:55,
   sources:state.knowledge.sources||[],
 };
}

async function consult(idPlant){
 const p=state.plants.find(x=>x.id===idPlant); if(!p)return;
 const e=modal(`<h2>AI tư vấn: ${esc(p.name)}</h2><div class="muted small">${esc(cropName(p.crop))} • ${p.count} cây • ${p.area} ha • ${esc(stageName(p.crop,p.stage))}</div><div class="form" style="margin-top:14px"><label class="label">Triệu chứng / quan sát</label><textarea id="obs" class="field textarea" placeholder="VD: lá có đốm, khoảng 10% cây; rễ có dấu hiệu..."></textarea><label class="label">Ảnh hiện trường (không bắt buộc)</label><input id="img" class="field" type="file" accept="image/*"><div class="actions"><button class="btn secondary" data-close="1">Huỷ</button><button class="btn primary" data-run-ai="1">✨ Phân tích</button></div><div id="result"></div></div>`);
 e.addEventListener('click',async x=>{
  if(x.target.closest('[data-close]'))return e.remove();
  const btn=x.target.closest('[data-run-ai]'); if(!btn)return; btn.disabled=true;
  const out=$('#result',e); out.innerHTML='<div class="card" style="margin-top:12px">Đang lấy thời tiết và phân tích…</div>';
  try{
    const w=await fetchWeatherForPlant(p); state.weather=w;
    let image=null; const f=$('#img',e).files?.[0]; if(f) image=await new Promise((resolve,reject)=>{const rd=new FileReader();rd.onload=()=>resolve(rd.result);rd.onerror=reject;rd.readAsDataURL(f);});
    const body={plant:p,observation:$('#obs',e).value.trim(),inventory:state.inventory,weather:w,history:{recommendations:state.recs.filter(r=>r.plant_id===p.id).slice(0,10),tasks:state.tasks.filter(t=>t.plant_id===p.id).slice(0,10)},knowledge:state.knowledge,image};
    let r; let real=false;
    try{r=await api('/api/advice',{method:'POST',body:JSON.stringify(body)});real=true;}catch{r=localAdvice(p,body.observation,w);}
    const rec={id:id(),plant_id:p.id,title:r.title||'Khuyến cáo AI',body:r.body||formatAdvice(r),payload:JSON.stringify(r),status:'PENDING',created_at:now(),source:real?'AI cloud (OpenRouter/Groq)':'LOCAL FALLBACK'};
    state.recs.unshift(rec); persistLocal(); try{await api('/api/recommendations',{method:'POST',body:JSON.stringify(rec)});state.backend='cloud';}catch{state.backend='local';}
    out.innerHTML=`<div class="card advice" style="margin-top:12px"><div class="pill ${real?'green':'orange'}">${real?'AI CLOUD':'LOCAL FALLBACK'}</div><div class="item-title" style="margin-top:8px">${esc(rec.title)}</div><div class="small" style="white-space:pre-wrap;line-height:1.5;margin-top:8px">${esc(rec.body)}</div><div class="actions"><button class="btn success" data-action="approve-rec" data-id="${esc(rec.id)}">✓ Duyệt → lịch</button><button class="btn secondary" data-action="close-modal">Đóng</button></div></div>`;
    toast(real?'AI đã tạo khuyến cáo':'AI cloud (OpenRouter/Groq) chưa sẵn sàng — đã tạo đánh giá dự phòng','success');
  }catch(err){out.innerHTML=`<div class="card" style="margin-top:12px;color:#b22">${esc(err.message)}</div>`;} finally{btn.disabled=false;}
 });
}
function formatAdvice(o){const lines=[];if(o.summary)lines.push(`TỔNG QUAN\n${o.summary}`);if(o.assessment)lines.push(`ĐÁNH GIÁ\n${o.assessment}`);if(o.risks?.length)lines.push(`NGUY CƠ\n• ${o.risks.join('\n• ')}`);if(o.checks?.length)lines.push(`CẦN KIỂM TRA\n• ${o.checks.join('\n• ')}`);if(o.nonChemical?.length)lines.push(`ƯU TIÊN KHÔNG HÓA HỌC\n• ${o.nonChemical.join('\n• ')}`);if(o.chemical?.length)lines.push(`PHƯƠNG ÁN HÓA HỌC\n• ${o.chemical.map(x=>`${x.product||'Sản phẩm'} — ${x.active||''}; liều: ${x.dose||'theo nhãn'}; PHI: ${x.phi||'theo nhãn'}; ${x.why||''}`).join('\n• ')}`);else lines.push('PHƯƠNG ÁN HÓA HỌC\nChưa đủ dữ liệu để kê sản phẩm/liều cụ thể.');if(o.weatherWindow)lines.push(`THỜI TIẾT\n${o.weatherWindow}`);if(o.precautions?.length)lines.push(`CẢNH BÁO\n• ${o.precautions.join('\n• ')}`);if(o.confidence!=null)lines.push(`ĐỘ TIN CẬY: ${o.confidence}%`);return lines.join('\n\n');}

async function saveChanges(){
 persistLocal();
 try{await api('/api/sync',{method:'POST',body:JSON.stringify({plants:state.plants,inventory:state.inventory,recs:state.recs,tasks:state.tasks})});state.backend='cloud';}catch{state.backend='local';}
}
async function handleAction(action,ident){
 const r=state.recs.find(x=>x.id===ident);
 if(r){
  if(action==='approve-rec'){r.status='APPROVED'; let meta={}; try{meta=JSON.parse(r.payload||'{}')}catch{}; const steps=Array.isArray(meta.nextSteps)&&meta.nextSteps.length?meta.nextSteps:[{daysFromNow:1,title:r.title,kind:'FOLLOW_UP',notes:r.body}]; for(const step of steps.slice(0,8)){const days=Math.max(0,Number(step.daysFromNow)||0); state.tasks.unshift({id:id(),plant_id:r.plant_id,rec_id:r.id,kind:step.kind||'FOLLOW_UP',title:step.title||r.title,scheduled_at:new Date(Date.now()+days*86400000).toISOString(),status:'PLANNED',notes:step.notes||r.body,created_at:now(),meta:JSON.stringify(step)});} await saveChanges();render();toast(`Đã duyệt và tạo ${steps.slice(0,8).length} mốc lịch`,'success');}
  else if(action==='postpone-rec'){r.status='POSTPONED';await saveChanges();render();toast('Đã hoãn');}
  else if(action==='reject-rec'){r.status='REJECTED';await saveChanges();render();toast('Đã từ chối');}
 }
 const t=state.tasks.find(x=>x.id===ident);
 if(t){if(action==='done-task'){t.status='DONE'; t.completed_at=now();}else if(action==='postpone-task'){t.status='POSTPONED';} await saveChanges(); render(); toast(t.status==='DONE'?'Đã ghi nhận hoàn thành':'Đã hoãn');}
}
function seed(){const t=now();state.plants=[{id:id(),crop:'coffee',name:'Cà phê',count:1500,area:1.2,stage:'fruit',season:'2026/2027',lat:12.67,lon:108.04,last_check_at:new Date(Date.now()-2*86400000).toISOString(),created_at:t,updated_at:t},{id:id(),crop:'pepper',name:'Hồ tiêu',count:800,area:.6,stage:'fruit',season:'2026/2027',lat:12.67,lon:108.04,last_check_at:new Date(Date.now()-5*86400000).toISOString(),created_at:t,updated_at:t},{id:id(),crop:'areca',name:'Cau',count:300,area:.3,stage:'mature',season:'2026/2027',lat:12.67,lon:108.04,last_check_at:t,created_at:t,updated_at:t}];state.recs=[];state.tasks=[];persistLocal();}
function updatePlant(plantId){
 const p=state.plants.find(x=>x.id===plantId); if(!p)return;
 const e=modal(`<h2>Cập nhật ${esc(p.name||cropName(p.crop))}</h2><div class="muted small">${esc(stageName(p.crop,p.stage))}</div>
 <div class="form" style="margin-top:14px"><label class="label">Tình trạng hiện tại</label><textarea id="upd-note" class="field textarea" placeholder="Ví dụ: lá xanh, có 3 cây vàng lá, sâu thấy ít..."></textarea>
 <label class="label">Ảnh hiện trường</label><input id="upd-img" class="field" type="file" accept="image/*">
 <div class="actions"><button class="btn secondary" data-close="1">Hủy</button><button class="btn primary" data-save-update="1">Lưu cập nhật</button></div></div>`);
 e.addEventListener('click',async x=>{
   if(x.target.closest('[data-close]')) return e.remove();
   if(!x.target.closest('[data-save-update]')) return;
   p.last_check_at=now(); p.last_observation=$('#upd-note',e).value.trim(); p.updated_at=now();
   await saveChanges(); e.remove(); render(); toast('Đã cập nhật trạng thái cây','success');
 });
}

function inventoryModal(){
 const e=modal(`<h2>Thêm vật tư</h2><div class="form" style="margin-top:14px"><input id="i-name" class="field" placeholder="Tên thương mại"><input id="i-active" class="field" placeholder="Hoạt chất"><input id="i-crop" class="field" placeholder="Cây đăng ký"><input id="i-targets" class="field" placeholder="Đối tượng"><input id="i-dose" class="field" placeholder="Liều theo nhãn"><input id="i-phi" class="field" placeholder="PHI"><label><input id="i-verified" type="checkbox"> Tôi đã đối chiếu nhãn</label><div class="actions"><button class="btn secondary" data-close="1">Huỷ</button><button class="btn primary" data-save-inv="1">Lưu</button></div></div>`);
 e.addEventListener('click',async x=>{if(x.target.closest('[data-close]'))return e.remove();if(!x.target.closest('[data-save-inv]'))return;const i={id:id(),name:$('#i-name',e).value,active:$('#i-active',e).value,crop:$('#i-crop',e).value,targets:$('#i-targets',e).value,dose:$('#i-dose',e).value,phi:$('#i-phi',e).value,label_verified:$('#i-verified',e).checked?1:0,stock:0,unit:'đv',created_at:now()};state.inventory.unshift(i);await saveChanges();e.remove();render();toast('Đã thêm vật tư','success');});
}

$('#app').addEventListener('click',async e=>{
 const tab=e.target.closest('[data-tab]'); if(tab){location.hash=tab.dataset.tab;return;}
 const a=e.target.closest('[data-action]'); if(!a)return; const action=a.dataset.action;
 if(action==='add-plant')addPlantModal();
 else if(action==='open-settings'){state.tab='settings';location.hash='settings';render();}
 else if(action==='back-home'){state.tab='home';location.hash='home';render();}
 else if(action==='quick-advice'){state.tab='ai';location.hash='ai';render();}
 else if(action==='refresh-weather') refreshWeather();
 else if(action==='consult')consult(a.dataset.id);
 else if(action==='update-plant')updatePlant(a.dataset.id);
 else if(['approve-rec','postpone-rec','reject-rec','done-task','postpone-task'].includes(action))handleAction(action,a.dataset.id);
 else if(action==='save-token'){state.apiBase=$('#api-base').value.trim().replace(/\/$/,'');state.token=$('#app-token').value.trim();localStorage.setItem('apiBase',state.apiBase);localStorage.setItem('appToken',state.token);toast('Đã lưu kết nối');}
 else if(action==='test-ai'){try{const h=await api('/api/health');toast(`Backend OK • AI: ${h.ai?'sẵn sàng':'chưa cấu hình'} • DB: ${h.db?'OK':'chưa nối'}`,'success');}catch(err){toast(`Chưa kết nối backend: ${err.message}`,'error');}}
 else if(action==='run-automation'){try{toast('Đang chạy kiểm tra tự động…'); const r=await api('/api/automation/run',{method:'POST',body:JSON.stringify({})}); state.automation=r.status||state.automation; await loadData(); render(); toast(`Đã kiểm tra: ${r.created||0} khuyến cáo, ${r.notifications||0} thông báo`,'success');}catch(err){toast(`Automation chưa sẵn sàng: ${err.message}`,'error');}}
 else if(action==='test-telegram'){try{const r=await api('/api/notify/test',{method:'POST',body:JSON.stringify({})}); toast(r.ok?'Telegram đã gửi tin thử':'Telegram chưa cấu hình', r.ok?'success':'error');}catch(err){toast(`Telegram lỗi: ${err.message}`,'error');}}
 else if(action==='export'){const d={plants:state.plants,inventory:state.inventory,recs:state.recs,tasks:state.tasks};const u=URL.createObjectURL(new Blob([JSON.stringify(d,null,2)],{type:'application/json'}));const x=document.createElement('a');x.href=u;x.download='nong-vu-ai-backup.json';x.click();URL.revokeObjectURL(u);}
 else if(action==='seed'){seed();render();toast('Đã nạp dữ liệu mẫu','success');}
 else if(action==='clear'){if(confirm('Xoá dữ liệu local?')){state.plants=[];state.recs=[];state.tasks=[];state.inventory=[];persistLocal();render();toast('Đã xoá dữ liệu local');}}
 else if(action==='add-inventory')inventoryModal();
 else if(action==='close-modal')document.querySelector('.modal')?.remove();
});

window.addEventListener('hashchange',()=>{state.tab=location.hash.replace(/^#/,'')||'home';render();});
window.addEventListener('error',e=>{if(e.error)console.error(e.error);});
window.addEventListener('unhandledrejection',e=>{console.error(e.reason);});
function autoMonitor(){
  try{
    const mon=monitorSnapshot();
    const key=`nv_mon_${new Date().toISOString().slice(0,10)}`;
    if(mon.stale>0 && !localStorage.getItem(key)){
      localStorage.setItem(key,'1');
      toast(`Có ${mon.stale} cây đã quá 4 ngày chưa cập nhật`,'info');
    }
  }catch{}
}
setInterval(autoMonitor,15*60*1000);

boot().catch(err=>{localLoad();render();toast('Khởi động ở chế độ offline','info');console.error(err);});
