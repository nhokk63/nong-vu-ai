const json = (data, status=200, extra={}) => new Response(JSON.stringify(data), {status, headers:{'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', ...extra}});
const text = (data, status=200, extra={}) => new Response(data,{status,headers:{'Content-Type':'text/plain; charset=utf-8',...extra}});

function corsHeaders(origin='*'){
  return {'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'Content-Type, X-App-Token, Authorization','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};
}
function authOk(request, env){
  if(!env.APP_TOKEN) return true;
  const token=request.headers.get('X-App-Token') || request.headers.get('Authorization')?.replace(/^Bearer\s+/i,'');
  return token && token===env.APP_TOKEN;
}
function needAuth(request, env){
  if(authOk(request, env)) return null;
  return json({error:'Unauthorized. Add your APP_TOKEN in Settings.'},401);
}
async function dbBatch(env, statements){ if(!env.DB) throw new Error('D1 chưa được binding'); return env.DB.batch(statements); }
function iso(){return new Date().toISOString();}
function parseJson(x, fallback={}){try{return x?JSON.parse(x):fallback}catch{return fallback}}
function cropName(c){return ({coffee:'Cà phê',pepper:'Hồ tiêu',areca:'Cau'}[c]||c||'Cây trồng');}
function stageName(c,s){const m={coffee:{postharvest:'Sau thu hoạch',shoot:'Phục hồi – phát triển cành lá',floral:'Phân hóa mầm hoa',flower:'Ra hoa',fruitset:'Đậu quả',fruit:'Nuôi quả',ripening:'Quả phát triển – chín',preharvest:'Chuẩn bị thu hoạch'},pepper:{recovery:'Sau thu hoạch – phục hồi',canopy:'Phát triển thân – cành',flower:'Ra hoa',fruitset:'Đậu trái',fruit:'Nuôi trái',preharvest:'Trước thu hoạch',harvest:'Thu hoạch',post:'Sau thu hoạch'},areca:{seedling:'Cây con',juvenile:'Kiến thiết cơ bản',mature:'Cây trưởng thành',fruit:'Mang buồng – nuôi trái',harvest:'Thu hoạch'}};return m[c]?.[s]||s||'Chưa chọn';}

async function fetchWeather(lat, lon){
  const u=`https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&current=temperature_2m,relative_humidity_2m,precipitation,rain,wind_speed_10m,wind_gusts_10m,weather_code,is_day&hourly=precipitation_probability,precipitation,wind_speed_10m,relative_humidity_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max&forecast_days=5&timezone=auto`;
  const r=await fetch(u); if(!r.ok) throw new Error(`Weather ${r.status}`); return r.json();
}
async function reverseGeocode(lat,lon){
  try{const u=`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&localityLanguage=vi`; const r=await fetch(u); if(!r.ok) return ''; const d=await r.json(); return [d.locality,d.city,d.principalSubdivision,d.countryName].filter(Boolean).slice(0,3).join(', ');}catch{return '';}
}

async function rows(env,table){
  if(!env.DB) return [];
  const r=await env.DB.prepare(`SELECT * FROM ${table}`).all(); return r.results||[];
}
async function readAll(env){
  if(!env.DB) return {plants:[],inventory:[],recs:[],tasks:[],observations:[]};
  const [plants,inventory,recs,tasks,observations]=await Promise.all([rows(env,'plants'),rows(env,'inventory'),rows(env,'recommendations'),rows(env,'tasks'),rows(env,'observations')]);
  return {plants,inventory,recs,tasks,observations};
}

function openaiContentText(body){
  const txt=body?.output?.map?.(x=>x?.content||[]).flat?.().map?.(x=>x?.text||'').filter(Boolean).join('\n') || body?.output_text || '';
  return txt;
}
function extractJson(s){
  try{return JSON.parse(s)}catch{}
  const m=s.match(/\{[\s\S]*\}/); if(m){try{return JSON.parse(m[0])}catch{}}
  return null;
}

async function callChatProvider(env, system, user, image){
  const messages=[{role:'system',content:system}];
  let userContent;
  if(image && typeof image==='string' && image.startsWith('data:image/')){
    userContent=[{type:'text',text:user},{type:'image_url',image_url:{url:image}}];
  } else {
    userContent=user;
  }
  messages.push({role:'user',content:userContent});

  const openRouterKey=env.OPENROUTER_API_KEY;
  if(openRouterKey){
    const model=(image && typeof image==='string' && image.startsWith('data:image/'))
      ? (env.OPENROUTER_VISION_MODEL||'openrouter/free')
      : (env.OPENROUTER_MODEL||'meta-llama/llama-3.3-70b-instruct:free');
    const payload={model,messages,temperature:0.2};
    const headers={
      'Content-Type':'application/json',
      'Authorization':`Bearer ${openRouterKey}`,
      'HTTP-Referer':env.APP_BASE_URL||'https://nong-vu-ai.pages.dev',
      'X-Title':'Nong Vu AI'
    };
    const r=await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers,body:JSON.stringify(payload)});
    const d=await r.json();
    if(r.ok){
      const out=d?.choices?.[0]?.message?.content||'';
      const parsed=extractJson(out); if(parsed) return parsed;
      throw new Error('OpenRouter trả về dữ liệu không đúng JSON');
    }
    throw new Error(d?.error?.message||`OpenRouter ${r.status}`);
  }

  if(env.GROQ_API_KEY && !(image && typeof image==='string' && image.startsWith('data:image/'))){
    const model=env.GROQ_MODEL||'llama-3.3-70b-versatile';
    const payload={model,messages,temperature:0.2,response_format:{type:'json_object'}};
    const r=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${env.GROQ_API_KEY}`},body:JSON.stringify(payload)});
    const d=await r.json();
    if(r.ok){
      const out=d?.choices?.[0]?.message?.content||'';
      const parsed=extractJson(out); if(parsed) return parsed;
      throw new Error('Groq trả về dữ liệu không đúng JSON');
    }
    throw new Error(d?.error?.message||`Groq ${r.status}`);
  }

  if(image && typeof image==='string' && image.startsWith('data:image/')) throw new Error('Chưa có AI vision miễn phí khả dụng');
  throw new Error('Chưa cấu hình OPENROUTER_API_KEY hoặc GROQ_API_KEY');
}

function adviceSystem(){
  return `Bạn là AI trợ lý nông vụ cho cà phê, hồ tiêu và cau tại Việt Nam. Mục tiêu là quản lý mùa vụ theo trạng thái thực tế, ưu tiên IPM và biện pháp không hóa học trước. Không được tự bịa tên thuốc, hoạt chất, liều hoặc PHI. Chỉ đưa sản phẩm/liều/PHI cụ thể khi inventory có label_verified=1 và thông tin đó phù hợp với cây/đối tượng. Nếu chưa đủ dữ liệu, nói rõ chưa đủ dữ liệu. Không biến lịch phun thành lịch cứng: mỗi xử lý phải có mốc đánh giá lại. Luôn đưa nextSteps để người dùng có thể duyệt thành lịch. Trả JSON thuần với các trường: title, summary, assessment, risks[], checks[], nonChemical[], chemical[], weatherWindow, precautions[], confidence, nextSteps[]. chemical[] có product,active,dose,phi,why và chỉ có khi đủ dữ liệu xác minh. nextSteps[] có daysFromNow,kind,title,notes. Không chẩn đoán chắc chắn khi thiếu ảnh/triệu chứng.`;
}
async function generateAdvice(env, body){
  const p=body.plant||{}; const prompt={plant:{...p,crop_name:cropName(p.crop),stage_name:stageName(p.crop,p.stage)},observation:body.observation||'',weather:body.weather||{},inventory:(body.inventory||[]).filter(x=>Number(x.label_verified)===1),history:body.history||{},knowledge:body.knowledge||{}};
  return callChatProvider(env,adviceSystem(),`Phân tích trường hợp sau và trả JSON theo schema mô tả. Đây là tư vấn có người duyệt cuối cùng. Dữ liệu: ${JSON.stringify(prompt)}`,body.image);
}

async function saveRecommendation(env, rec){
  if(!env.DB) return;
  await env.DB.prepare(`INSERT OR REPLACE INTO recommendations(id,plant_id,title,body,payload,status,source,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)`).bind(rec.id,rec.plant_id,rec.title,rec.body,rec.payload,rec.status,rec.source||'AI CLOUD',rec.created_at||iso(),iso()).run();
}
async function notifyTelegram(env, message){
  if(!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return {ok:false,reason:'Telegram chưa cấu hình'};
  const r=await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:env.TELEGRAM_CHAT_ID,text:message,disable_web_page_preview:true})});
  const d=await r.json(); if(!r.ok || !d.ok) throw new Error(d.description||`Telegram ${r.status}`); return {ok:true};
}
async function notifyOnce(env,fingerprint,message){
  if(!env.DB) return false;
  const exists=await env.DB.prepare(`SELECT fingerprint FROM notification_log WHERE fingerprint=?`).bind(fingerprint).first();
  if(exists) return false;
  const tg=await notifyTelegram(env,message); if(tg.ok) await env.DB.prepare(`INSERT INTO notification_log(fingerprint,sent_at,channel,message) VALUES(?,?,?,?)`).bind(fingerprint,iso(),'telegram',message).run();
  return tg.ok;
}

function taskText(t, p){
  const when=t.scheduled_at?new Date(t.scheduled_at).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'';
  return `• ${p?.name||cropName(p?.crop)} — ${t.title||t.kind} — ${when}`;
}
async function runHourly(env){
  if(!env.DB) return {created:0,notifications:0,reason:'no-db'};
  const data=await readAll(env); let notifications=0;
  const nowMs=Date.now();
  for(const p of data.plants){
    if(!p.lat || !p.lon) continue;
    try{
      const w=await fetchWeather(p.lat,p.lon);
      await env.DB.prepare(`INSERT OR REPLACE INTO weather_snapshots(plant_id,captured_at,payload) VALUES(?,?,?)`).bind(p.id,iso(),JSON.stringify(w)).run();
      const current=w.current||{}; const hourly=w.hourly||{};
      const prob=Math.max(...(hourly.precipitation_probability||[]).slice(0,6).map(Number),0);
      const rain=Number(current.precipitation||0); const hum=Number(current.relative_humidity_2m||0);
      if(prob>=80 || rain>=5){
        const fp=`weather:${p.id}:${new Date().toISOString().slice(0,13)}`;
        const msg=`⚠️ NÔNG VỤ AI\n${p.name||cropName(p.crop)} · ${stageName(p.crop,p.stage)}\n\nThời tiết đang bất lợi: xác suất mưa trong vài giờ tới khoảng ${Math.round(prob)}%, mưa hiện tại ${rain.toFixed(1)} mm, độ ẩm ${Math.round(hum)}%.\n\nKiểm tra các việc phun/xử lý sắp làm; không thực hiện chỉ vì lịch cũ nếu thời tiết không phù hợp.`;
        if(await notifyOnce(env,fp,msg)) notifications++;
      }
      const stale=!p.last_check_at || nowMs-Date.parse(p.last_check_at)>4*86400000;
      if(stale){
        const fp=`stale:${p.id}:${new Date().toISOString().slice(0,10)}`;
        const age=p.last_check_at?Math.floor((nowMs-Date.parse(p.last_check_at))/86400000):999;
        const msg=`📸 CẬP NHẬT CÂY\n${p.name||cropName(p.crop)} · ${stageName(p.crop,p.stage)}\n\nĐã ${age>=999?'lâu ngày':age+' ngày'} chưa cập nhật trạng thái. Hãy mở app, chụp ảnh/ghi chú tình trạng thực tế để AI cập nhật hồ sơ cây.`;
        if(await notifyOnce(env,fp,msg)) notifications++;
      }
    }catch{}
  }
  const soon=data.tasks.filter(t=>t.status==='PLANNED'&&t.scheduled_at && new Date(t.scheduled_at).getTime()<=nowMs+6*3600000 && new Date(t.scheduled_at).getTime()>=nowMs-3600000);
  if(soon.length){
    const lines=soon.slice(0,10).map(t=>taskText(t,data.plants.find(p=>p.id===t.plant_id))).join('\n');
    const fp=`tasks:${new Date().toISOString().slice(0,13)}`;
    if(await notifyOnce(env,fp,`🔔 VIỆC SẮP ĐẾN\n\n${lines}`)) notifications++;
  }
  return {created:0,notifications};
}

async function runDaily(env){
  if(!env.DB) return {created:0,notifications:0,reason:'no-db'};
  const data=await readAll(env); let created=0, notifications=0;
  const plants=[];
  for(const p of data.plants){
    if(!p.lat || !p.lon) continue;
    try{
      const w=await fetchWeather(p.lat,p.lon);
      plants.push({plant:p,weather:w,history:{recs:data.recs.filter(r=>r.plant_id===p.id).slice(-8),tasks:data.tasks.filter(t=>t.plant_id===p.id).slice(-8),observations:data.observations.filter(o=>o.plant_id===p.id).slice(-5)}});
    }catch{plants.push({plant:p,weather:null,history:{recs:[],tasks:[],observations:[]}})}
  }
  if((env.OPENROUTER_API_KEY || env.GROQ_API_KEY) && plants.length){
    const prompt={date:new Date().toISOString(),plants,inventory:data.inventory.filter(x=>Number(x.label_verified)===1)};
    const system=`Bạn là hệ thống điều phối nông vụ hằng ngày. Dựa trên từng cây, giai đoạn, thời tiết, lịch sử và vật tư đã đối chiếu. Không tự kê thuốc chưa xác minh. Trả JSON: {dailySummary:string, alerts:[{plantId,level,title,message}], recommendations:[{plantId,title,summary,risks,checks,nonChemical,chemical,weatherWindow,precautions,confidence,nextSteps}]}. recommendations là khuyến cáo chờ người dùng duyệt, không phải lệnh.`;
    try{
      const out=await callOpenAI(env,system,`Tạo đánh giá hằng ngày cho dữ liệu sau: ${JSON.stringify(prompt)}`);
      for(const a of out.alerts||[]){
        const fp=`ai-alert:${a.plantId}:${new Date().toISOString().slice(0,10)}:${a.title}`;
        const p=data.plants.find(x=>x.id===a.plantId); const msg=`${a.level==='red'?'🚨':a.level==='orange'?'⚠️':'🌱'} ${a.title}\n${p?.name||cropName(p?.crop)}\n\n${a.message}`;
        if(await notifyOnce(env,fp,msg)) notifications++;
      }
      for(const a of out.recommendations||[]){
        const rec={id:crypto.randomUUID(),plant_id:a.plantId,title:a.title||'Khuyến cáo AI hằng ngày',body:a.summary||'',payload:JSON.stringify(a),status:'PENDING',source:'AI DAILY',created_at:iso(),updated_at:iso()};
        await saveRecommendation(env,rec); created++;
      }
      if(out.dailySummary){const fp=`digest:${new Date().toISOString().slice(0,10)}`; if(await notifyOnce(env,fp,`🌱 NÔNG VỤ AI — TỔNG HỢP HÔM NAY\n\n${out.dailySummary}`)) notifications++;}
    }catch(err){
      const fp=`ai-error:${new Date().toISOString().slice(0,10)}`; if(await notifyOnce(env,fp,`⚠️ Nông Vụ AI\nAI tự động hôm nay chưa chạy được: ${err.message}`)) notifications++;
    }
  }
  return {created,notifications};
}

async function route(request, env){
  const url=new URL(request.url);
  const auth=needAuth(request,env); if(auth) return auth;
  if(request.method==='OPTIONS') return new Response(null,{status:204,headers:corsHeaders(request.headers.get('Origin')||'*')});
  if(url.pathname==='/api/health' && request.method==='GET') return json({ok:true,db:!!env.DB,ai:!!(env.OPENROUTER_API_KEY||env.GROQ_API_KEY),telegram:!!(env.TELEGRAM_BOT_TOKEN&&env.TELEGRAM_CHAT_ID),models:{text:env.OPENROUTER_MODEL||'meta-llama/llama-3.3-70b-instruct:free',vision:env.OPENROUTER_VISION_MODEL||'openrouter/free',fallback:env.GROQ_MODEL||'llama-3.3-70b-versatile'}});
  if(url.pathname==='/api/automation/status' && request.method==='GET') return json({enabled:!!env.DB,telegram:!!(env.TELEGRAM_BOT_TOKEN&&env.TELEGRAM_CHAT_ID),ai:!!(env.OPENROUTER_API_KEY||env.GROQ_API_KEY),crons:['0 * * * *','0 22 * * *']});
  if(url.pathname==='/api/data' && request.method==='GET') return json(await readAll(env));
  if(url.pathname==='/api/weather' && request.method==='GET'){const lat=Number(url.searchParams.get('lat')),lon=Number(url.searchParams.get('lon')); if(!Number.isFinite(lat)||!Number.isFinite(lon)) return json({error:'Thiếu lat/lon'},400); const w=await fetchWeather(lat,lon); return json(w);}
  if(url.pathname==='/api/advice' && request.method==='POST'){const b=await request.json(); try{return json(await generateAdvice(env,b));}catch(e){return json({error:e.message},503)}}
  if(url.pathname==='/api/recommendations' && request.method==='POST'){const rec=await request.json(); await saveRecommendation(env,rec); return json({ok:true});}
  if(url.pathname==='/api/plants' && request.method==='POST'){const p=await request.json(); if(!env.DB) return json({ok:false,local:true}); await env.DB.prepare(`INSERT OR REPLACE INTO plants(id,crop,name,count,area,stage,season,lat,lon,last_check_at,last_observation,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(p.id,p.crop,p.name||cropName(p.crop),p.count||0,p.area||0,p.stage||'',p.season||'',p.lat||null,p.lon||null,p.last_check_at||null,p.last_observation||null,p.created_at||iso(),p.updated_at||iso()).run(); return json({ok:true});}
  if(url.pathname==='/api/sync' && request.method==='POST'){const b=await request.json(); if(!env.DB) return json({ok:false,local:true}); const stm=[]; for(const p of b.plants||[]) stm.push(env.DB.prepare(`INSERT OR REPLACE INTO plants(id,crop,name,count,area,stage,season,lat,lon,last_check_at,last_observation,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(p.id,p.crop,p.name||cropName(p.crop),p.count||0,p.area||0,p.stage||'',p.season||'',p.lat||null,p.lon||null,p.last_check_at||null,p.last_observation||null,p.created_at||iso(),p.updated_at||iso())); for(const i of b.inventory||[]) stm.push(env.DB.prepare(`INSERT OR REPLACE INTO inventory(id,name,active,crop,targets,label_verified,dose,phi,stock,unit,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).bind(i.id,i.name||'',i.active||'',i.crop||'',i.targets||'',i.label_verified?1:0,i.dose||'',i.phi||'',i.stock||0,i.unit||'đv',i.created_at||iso())); for(const r of b.recs||[]) stm.push(env.DB.prepare(`INSERT OR REPLACE INTO recommendations(id,plant_id,title,body,payload,status,source,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)`).bind(r.id,r.plant_id,r.title||'',r.body||'',r.payload||'',r.status||'PENDING',r.source||'LOCAL',r.created_at||iso(),iso())); for(const t of b.tasks||[]) stm.push(env.DB.prepare(`INSERT OR REPLACE INTO tasks(id,plant_id,rec_id,kind,title,scheduled_at,status,notes,meta,completed_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).bind(t.id,t.plant_id||null,t.rec_id||null,t.kind||'',t.title||'',t.scheduled_at||null,t.status||'PLANNED',t.notes||'',t.meta||'',t.completed_at||null,t.created_at||iso())); await dbBatch(env,stm); return json({ok:true});}
  if(url.pathname==='/api/automation/run' && request.method==='POST'){const h=await runHourly(env); const d=await runDaily(env); return json({ok:true,created:(h.created||0)+(d.created||0),notifications:(h.notifications||0)+(d.notifications||0),status:{enabled:!!env.DB,telegram:!!(env.TELEGRAM_BOT_TOKEN&&env.TELEGRAM_CHAT_ID),ai:!!(env.OPENROUTER_API_KEY||env.GROQ_API_KEY)}});}
  if(url.pathname==='/api/notify/test' && request.method==='POST'){const r=await notifyTelegram(env,'🌱 Nông Vụ AI\nTelegram đã kết nối thành công.'); return json(r);}
  if(url.pathname==='/api/location' && request.method==='GET'){const lat=Number(url.searchParams.get('lat')),lon=Number(url.searchParams.get('lon')); if(!Number.isFinite(lat)||!Number.isFinite(lon)) return json({error:'Thiếu lat/lon'},400); return json({name:await reverseGeocode(lat,lon)});}
  return null;
}

export default {
  async fetch(request, env){
    const url=new URL(request.url);
    if(url.pathname.startsWith('/api/')){ try{const r=await route(request,env); return r||json({error:'Not found'},404);}catch(e){return json({error:e.message||'Server error'},500);} }
    return env.ASSETS.fetch(request);
  },
  async scheduled(controller, env, ctx){
    try{
      if(controller.cron==='0 22 * * *') await runDaily(env);
      else await runHourly(env);
    }catch(e){console.error('scheduled error',e);}
  }
};
