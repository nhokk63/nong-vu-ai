const corsHeaders = (origin='*') => ({'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers':'Content-Type, X-App-Token, Authorization', 'Access-Control-Allow-Methods':'GET,POST,DELETE,OPTIONS'});
const json = (data, status=200, extra={}) => new Response(JSON.stringify(data), {status, headers:{'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', ...corsHeaders('*'), ...extra}});
const text = (data, status=200, extra={}) => new Response(data,{status,headers:{'Content-Type':'text/plain; charset=utf-8',...extra}});

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
  if(typeof s!=='string') return null;
  try{return JSON.parse(s)}catch{}
  const m=s.match(/\{[\s\S]*\}/); if(m){try{return JSON.parse(m[0])}catch{}}
  return null;
}

async function callChatProvider(env, system, user, image){
  const messages=[{role:'system',content:system}];
  const isImage=!!(image && typeof image==='string' && image.startsWith('data:image/'));
  const userContent=isImage
    ? [{type:'text',text:user},{type:'image_url',image_url:{url:image}}]
    : user;
  messages.push({role:'user',content:userContent});

  const errors=[];

  // Groq is primary. Model IDs are explicit so a stale Cloudflare variable cannot force a retired model.
  if(env.GROQ_API_KEY){
    const models=isImage
      ? ['qwen/qwen3.6-27b']
      : ['openai/gpt-oss-120b','openai/gpt-oss-20b'];

    for(const model of models){
      try{
        const payload={
          model,
          messages,
          temperature:isImage?0.1:0.15,
          max_completion_tokens:1200,
          response_format:{type:'json_object'}
        };
        if(model.startsWith('openai/gpt-oss-')) payload.reasoning_effort='low';

        const ctrl=new AbortController();
        const timer=setTimeout(()=>ctrl.abort(),45000);
        let r;
        try{
          r=await fetch('https://api.groq.com/openai/v1/chat/completions',{
            method:'POST',
            headers:{'Content-Type':'application/json','Authorization':`Bearer ${env.GROQ_API_KEY}`},
            body:JSON.stringify(payload),
            signal:ctrl.signal
          });
        } finally { clearTimeout(timer); }

        const d=await r.json().catch(()=>({}));
        if(!r.ok){
          errors.push(`Groq ${model}: ${d?.error?.message||`HTTP ${r.status}`}`);
          continue;
        }
        const out=d?.choices?.[0]?.message?.content||'';
        const parsed=extractJson(out);
        if(parsed) return parsed;
        errors.push(`Groq ${model}: JSON không hợp lệ`);
      }catch(e){
        errors.push(`Groq ${model}: ${e?.name==='AbortError'?'timeout':(e?.message||String(e))}`);
      }
    }
  }else{
    errors.push('Groq: thiếu GROQ_API_KEY');
  }

  // OpenRouter final fallback. It is still allowed to be slow.
  if(env.OPENROUTER_API_KEY){
    try{
      const model=isImage
        ? (env.OPENROUTER_VISION_MODEL||'openrouter/free')
        : (env.OPENROUTER_MODEL||'openrouter/free');
      const payload={model,messages,temperature:0.15,max_tokens:1200};
      const ctrl=new AbortController();
      const timer=setTimeout(()=>ctrl.abort(),90000);
      let r;
      try{
        r=await fetch('https://openrouter.ai/api/v1/chat/completions',{
          method:'POST',
          headers:{
            'Content-Type':'application/json',
            'Authorization':`Bearer ${env.OPENROUTER_API_KEY}`,
            'HTTP-Referer':env.APP_BASE_URL||'https://nhokk63.github.io/nong-vu-ai/',
            'X-Title':'Nong Vu AI'
          },
          body:JSON.stringify(payload),
          signal:ctrl.signal
        });
      } finally { clearTimeout(timer); }
      const d=await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(d?.error?.message||`HTTP ${r.status}`);
      const out=d?.choices?.[0]?.message?.content||'';
      const parsed=extractJson(out);
      if(parsed) return parsed;
      throw new Error('JSON không hợp lệ');
    }catch(e){
      errors.push(`OpenRouter: ${e?.name==='AbortError'?'timeout':(e?.message||String(e))}`);
    }
  }else{
    errors.push('OpenRouter: thiếu OPENROUTER_API_KEY');
  }

  throw new Error(`${isImage?'AI vision':'AI cloud'} lỗi provider: ${errors.join(' | ')}`);
}

function adviceSystem(){
  return `Bạn là AI trợ lý nông vụ cho cà phê, hồ tiêu và cau tại Việt Nam. Mục tiêu là quản lý mùa vụ theo trạng thái thực tế, ưu tiên IPM và biện pháp không hóa học trước. Không được tự bịa tên thuốc, hoạt chất, liều hoặc PHI. Chỉ đưa sản phẩm/liều/PHI cụ thể khi inventory có label_verified=1 và thông tin đó phù hợp với cây/đối tượng. Nếu chưa đủ dữ liệu, nói rõ chưa đủ dữ liệu. Không biến lịch phun thành lịch cứng: mỗi xử lý phải có mốc đánh giá lại. Luôn đưa nextSteps để người dùng có thể duyệt thành lịch. Chỉ trả về JSON thuần, KHÔNG trả lời bằng markdown, KHÔNG in suy luận nội bộ, KHÔNG mô tả cách bạn tạo JSON và KHÔNG đưa ra chuỗi suy nghĩ. Chỉ dùng các trường: title, summary, assessment, risks[], checks[], nonChemical[], chemical[], weatherWindow, precautions[], confidence, nextSteps[]. chemical[] có product,active,dose,phi,why và chỉ có khi đủ dữ liệu xác minh. nextSteps[] có daysFromNow,kind,title,notes. Không chẩn đoán chắc chắn khi thiếu ảnh/triệu chứng.`;
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
function dailySystem(){return `Bạn là hệ thống điều phối Nông Vụ AI hằng ngày tại Việt Nam. Hãy đánh giá từng cây dựa trên giai đoạn, thời tiết hiện tại/dự báo, quan sát, lịch sử và vật tư đã đối chiếu. Ưu tiên IPM và biện pháp không hóa học. Không tự bịa tên thuốc/hoạt chất/liều/PHI; chỉ dùng chemical[] khi inventory label_verified=1 và phù hợp cây/đối tượng. Không tự tạo lịch cứng cho hóa chất; mọi bước phải có mốc kiểm tra lại. Chỉ trả JSON thuần, không markdown, không suy luận nội bộ. Schema: {dailySummary:string, alerts:[{plantId,level,title,message}], recommendations:[{plantId,title,summary,assessment,risks,checks,nonChemical,chemical,weatherWindow,precautions,confidence,nextSteps}]}. nextSteps[] gồm {daysFromNow,kind,title,notes}.`}
async function saveKv(env,k,v){if(!env.DB)return;await env.DB.prepare('INSERT OR REPLACE INTO kv(k,v) VALUES(?,?)').bind(k,String(v)).run()}
async function getKv(env,k){if(!env.DB)return null;const r=await env.DB.prepare('SELECT v FROM kv WHERE k=?').bind(k).first();return r?.v??null}
async function telegramSend(env,chatId,message,replyMarkup=null){if(!env.TELEGRAM_BOT_TOKEN)return {ok:false};const payload={chat_id:chatId||env.TELEGRAM_CHAT_ID,text:message,disable_web_page_preview:true};if(replyMarkup)payload.reply_markup=replyMarkup;const r=await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const d=await r.json().catch(()=>({}));if(!r.ok||!d.ok)throw new Error(d.description||`Telegram ${r.status}`);return d}
async function telegramAnswer(env,callbackId,text){if(!env.TELEGRAM_BOT_TOKEN)return;await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({callback_query_id:callbackId,text,show_alert:false})}).catch(()=>{})}
async function telegramEdit(env,chatId,messageId,text){if(!env.TELEGRAM_BOT_TOKEN)return;await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/editMessageText`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:chatId,message_id:messageId,text,disable_web_page_preview:true})}).catch(()=>{})}
async function approveRecommendation(env,recId){if(!env.DB)throw new Error('D1 chưa được binding');const rec=await env.DB.prepare('SELECT * FROM recommendations WHERE id=?').bind(recId).first();if(!rec)throw new Error('Không tìm thấy khuyến cáo');if(rec.status!=='PENDING')return {ok:true,already:true};const meta=parseJson(rec.payload,{});const steps=Array.isArray(meta.nextSteps)&&meta.nextSteps.length?meta.nextSteps:[{daysFromNow:1,kind:'FOLLOW_UP',title:rec.title,notes:rec.body}];const nowMs=Date.now();const stm=[env.DB.prepare("UPDATE recommendations SET status='APPROVED', updated_at=? WHERE id=?").bind(iso(),recId)];const created=[];for(const step of steps.slice(0,8)){const days=Math.max(0,Number(step.daysFromNow)||0);const tid=crypto.randomUUID();const scheduled=new Date(nowMs+days*86400000).toISOString();created.push({id:tid,scheduled_at:scheduled,title:step.title||rec.title});stm.push(env.DB.prepare(`INSERT OR REPLACE INTO tasks(id,plant_id,rec_id,kind,title,scheduled_at,status,notes,meta,completed_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).bind(tid,rec.plant_id,recId,step.kind||'FOLLOW_UP',step.title||rec.title,scheduled,'PLANNED',step.notes||rec.body,JSON.stringify(step),null,iso()))}await dbBatch(env,stm);return {ok:true,created}}
async function rejectRecommendation(env,recId){if(!env.DB)throw new Error('D1 chưa được binding');await env.DB.prepare('DELETE FROM recommendations WHERE id=?').bind(recId).run();await env.DB.prepare("DELETE FROM tasks WHERE rec_id=? AND status!='DONE'").bind(recId).run();return {ok:true}}
async function pollTelegram(env){if(!env.TELEGRAM_BOT_TOKEN||!env.TELEGRAM_CHAT_ID||!env.DB)return {processed:0};const offset=Number(await getKv(env,'telegram_update_offset')||0);const u=`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getUpdates?timeout=0&allowed_updates=${encodeURIComponent(JSON.stringify(['callback_query','message']))}${offset?`&offset=${offset}`:''}`;const r=await fetch(u);const d=await r.json().catch(()=>({}));if(!r.ok||!d.ok)return {processed:0};let processed=0,next=offset;for(const upd of d.result||[]){next=Math.max(next,Number(upd.update_id)+1);processed++;const cb=upd.callback_query;if(cb){const chatId=String(cb.message?.chat?.id||'');if(chatId!==String(env.TELEGRAM_CHAT_ID))continue;const data=String(cb.data||'');try{if(data.startsWith('approve:')){const id=data.slice(8);const out=await approveRecommendation(env,id);await telegramAnswer(env,cb.id,out.already?'Đã xử lý trước đó':'Đã duyệt và tạo lịch');await telegramEdit(env,chatId,cb.message.message_id,`✅ ĐÃ DUYỆT\n\n${cb.message.text||'Khuyến cáo'}\n\n${out.created?.length||0} mốc lịch đã được tạo. Hãy xem Lịch trong Nông Vụ AI và cập nhật cây sau mỗi lần thực hiện.`)}else if(data.startsWith('reject:')){const id=data.slice(7);await rejectRecommendation(env,id);await telegramAnswer(env,cb.id,'Đã từ chối và xóa khuyến cáo');await telegramEdit(env,chatId,cb.message.message_id,`❌ ĐÃ TỪ CHỐI\n\n${cb.message.text||'Khuyến cáo'}\n\nKhuyến cáo và các task chưa hoàn thành liên quan đã được xóa.`)}}catch(e){await telegramAnswer(env,cb.id,e.message||'Không xử lý được')}continue}}if(next>offset)await saveKv(env,'telegram_update_offset',next);return {processed}}

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
  const due=data.tasks.filter(t=>t.status==='PLANNED'&&t.scheduled_at && new Date(t.scheduled_at).getTime()<=nowMs+6*3600000 && new Date(t.scheduled_at).getTime()>=nowMs-3600000);
  for(const t of due){const p=data.plants.find(p=>p.id===t.plant_id);const fp=`task-due:${t.id}:${t.scheduled_at}`;const msg=`🔔 ĐẾN LỊCH THỰC HIỆN\n\n${taskText(t,p)}\n\nHãy mở Nông Vụ AI để xem yêu cầu chi tiết. Sau khi thực hiện, cập nhật tình trạng cây để AI ghi nhớ kết quả.`; if(await notifyOnce(env,fp,msg)) notifications++;}
  const overdue=data.tasks.filter(t=>t.status==='PLANNED'&&t.scheduled_at&&new Date(t.scheduled_at).getTime()<nowMs-3600000);
  for(const t of overdue.slice(0,12)){const p=data.plants.find(p=>p.id===t.plant_id);const day=new Date().toISOString().slice(0,10);const fp=`task-overdue:${t.id}:${day}`;const msg=`🚨 VIỆC QUÁ HẠN\n\n${taskText(t,p)}\n\nNếu đã thực hiện, hãy cập nhật trạng thái và tình hình cây. Nếu chưa, kiểm tra thời tiết/điều kiện trước khi xử lý.`; if(await notifyOnce(env,fp,msg)) notifications++;}
  return {created:0,notifications};
}

async function runDaily(env,forceDaily=false){if(!env.DB)return {created:0,notifications:0,reason:'no-db'};const day=new Date().toISOString().slice(0,10);const guard=await getKv(env,'daily_ai_run_date');if(!forceDaily&&guard===day)return {created:0,notifications:0,skipped:true};const data=await readAll(env);let created=0,notifications=0;const plants=[];for(const p of data.plants){if(!p.lat||!p.lon)continue;try{const w=await fetchWeather(p.lat,p.lon);plants.push({plant:p,weather:w,history:{recs:data.recs.filter(r=>r.plant_id===p.id).slice(-8),tasks:data.tasks.filter(t=>t.plant_id===p.id).slice(-8),observations:data.observations.filter(o=>o.plant_id===p.id).slice(-5)}})}catch{plants.push({plant:p,weather:null,history:{recs:[],tasks:[],observations:[]}})}}if(!plants.length||!(env.GROQ_API_KEY||env.OPENROUTER_API_KEY))return {created:0,notifications:0,reason:'no-plants-or-ai'};const prompt={date:new Date().toISOString(),plants,inventory:data.inventory.filter(x=>Number(x.label_verified)===1)};try{const out=await callChatProvider(env,dailySystem(),`Tạo đánh giá hằng ngày cho dữ liệu sau. Chỉ trả JSON: ${JSON.stringify(prompt)}`);for(const a of out.alerts||[]){const fp=`ai-alert:${a.plantId}:${day}:${a.title}`;const p=data.plants.find(x=>x.id===a.plantId);const msg=`${a.level==='red'?'🚨':a.level==='orange'?'⚠️':'🌱'} ${a.title}\n${p?.name||cropName(p?.crop)}\n\n${a.message}`;if(await notifyOnce(env,fp,msg))notifications++}for(const a of out.recommendations||[]){if(!a.plantId)continue;const rec={id:crypto.randomUUID(),plant_id:a.plantId,title:a.title||'Khuyến cáo AI hằng ngày',body:a.summary||'',payload:JSON.stringify(a),status:'PENDING',source:'AI DAILY',created_at:iso(),updated_at:iso()};await saveRecommendation(env,rec);created++;if(env.TELEGRAM_BOT_TOKEN&&env.TELEGRAM_CHAT_ID){const p=data.plants.find(x=>x.id===a.plantId);const lines=[`🤖 KHUYẾN CÁO MỚI — ${p?.name||cropName(p?.crop)}`,'',rec.title,'',a.summary||'','',`⚠️ Đây là đề xuất chờ mày xác nhận. Chưa tạo lịch và chưa coi là lệnh xử lý.`].join('\n');const kb={inline_keyboard:[[{text:'✅ DUYỆT → LÊN LỊCH',callback_data:`approve:${rec.id}`},{text:'❌ TỪ CHỐI → XÓA',callback_data:`reject:${rec.id}`}]]};await telegramSend(env,env.TELEGRAM_CHAT_ID,lines,kb)}}if(out.dailySummary&&env.TELEGRAM_BOT_TOKEN&&env.TELEGRAM_CHAT_ID){const fp=`digest:${day}`;if(await notifyOnce(env,fp,`🌱 NÔNG VỤ AI — TỔNG HỢP HÔM NAY\n\n${out.dailySummary}`))notifications++}await saveKv(env,'daily_ai_run_date',day)}catch(err){const fp=`ai-error:${day}`;if(await notifyOnce(env,fp,`⚠️ Nông Vụ AI\nAI tự động hôm nay chưa chạy được: ${err.message}`))notifications++}return {created,notifications}}

async function route(request, env){
  const url=new URL(request.url);
  const auth=needAuth(request,env); if(auth) return auth;
  if(request.method==='OPTIONS') return new Response(null,{status:204,headers:corsHeaders(request.headers.get('Origin')||'*')});
  if(url.pathname==='/api/health' && request.method==='GET') return json({ok:true,db:!!env.DB,ai:!!(env.OPENROUTER_API_KEY||env.GROQ_API_KEY),providers:{groq:!!env.GROQ_API_KEY,openrouter:!!env.OPENROUTER_API_KEY},primary:env.GROQ_API_KEY?'groq':'openrouter',telegram:!!(env.TELEGRAM_BOT_TOKEN&&env.TELEGRAM_CHAT_ID),models:{text:env.GROQ_MODEL||'openai/gpt-oss-120b',vision:env.GROQ_API_KEY?'qwen/qwen3.6-27b':(env.OPENROUTER_VISION_MODEL||'openrouter/free'),fallback:env.OPENROUTER_MODEL||'openrouter/free'}});
  if(url.pathname==='/api/automation/status' && request.method==='GET') return json({enabled:!!env.DB,telegram:!!(env.TELEGRAM_BOT_TOKEN&&env.TELEGRAM_CHAT_ID),ai:!!(env.OPENROUTER_API_KEY||env.GROQ_API_KEY),crons:['*/5 * * * *','0 22 * * *']});
  if(url.pathname==='/api/data' && request.method==='DELETE'){
    if(!env.DB) return json({ok:false,local:true});
    const stm=['DELETE FROM notification_log','DELETE FROM weather_snapshots','DELETE FROM observations','DELETE FROM tasks','DELETE FROM recommendations','DELETE FROM inventory','DELETE FROM plants','DELETE FROM kv'].map(sql=>env.DB.prepare(sql));
    await env.DB.batch(stm); return json({ok:true,cleared:['plants','inventory','recommendations','tasks','observations','weather_snapshots','notification_log','kv']});
  }
  if(url.pathname==='/api/data/plans' && request.method==='DELETE'){
    if(!env.DB) return json({ok:false,local:true});
    await env.DB.batch([env.DB.prepare('DELETE FROM tasks'),env.DB.prepare('DELETE FROM recommendations')]); return json({ok:true,cleared:['tasks','recommendations']});
  }
  if(url.pathname==='/api/data' && request.method==='GET') return json(await readAll(env));
  if(url.pathname==='/api/weather' && request.method==='GET'){const lat=Number(url.searchParams.get('lat')),lon=Number(url.searchParams.get('lon')); if(!Number.isFinite(lat)||!Number.isFinite(lon)) return json({error:'Thiếu lat/lon'},400); const w=await fetchWeather(lat,lon); return json(w);}
  if(url.pathname==='/api/advice' && request.method==='POST'){const b=await request.json(); try{return json(await generateAdvice(env,b));}catch(e){return json({error:e.message},503)}}
  if(url.pathname.startsWith('/api/recommendations/') && request.method==='DELETE'){const rid=decodeURIComponent(url.pathname.split('/').pop()); if(!env.DB) return json({ok:false,local:true}); await env.DB.prepare(`DELETE FROM recommendations WHERE id=?`).bind(rid).run(); return json({ok:true});}
  if(url.pathname.startsWith('/api/task-status/') && request.method==='POST'){const tid=decodeURIComponent(url.pathname.split('/').pop()); const b=await request.json().catch(()=>({})); if(!env.DB) return json({ok:false,local:true}); if(b.offsetDays){const row=await env.DB.prepare(`SELECT scheduled_at FROM tasks WHERE id=?`).bind(tid).first(); if(!row?.scheduled_at)return json({error:'Task chưa có thời gian'},400); const next=new Date(new Date(row.scheduled_at).getTime()+Number(b.offsetDays)*86400000).toISOString(); await env.DB.prepare(`UPDATE tasks SET scheduled_at=?,status=? WHERE id=?`).bind(next,b.status||'PLANNED',tid).run();}else{await env.DB.prepare(`UPDATE tasks SET status=?,completed_at=? WHERE id=?`).bind(b.status||'PLANNED',b.status==='DONE'?iso():null,tid).run();} return json({ok:true});}
  if(url.pathname==='/api/recommendations' && request.method==='POST'){const rec=await request.json(); await saveRecommendation(env,rec); return json({ok:true});}
  if(url.pathname.startsWith('/api/plants/') && request.method==='DELETE'){
    const id=decodeURIComponent(url.pathname.split('/').pop()||''); if(!id) return json({error:'Thiếu plant id'},400); if(!env.DB) return json({ok:false,local:true});
    await env.DB.batch([env.DB.prepare('DELETE FROM tasks WHERE plant_id=?').bind(id),env.DB.prepare('DELETE FROM recommendations WHERE plant_id=?').bind(id),env.DB.prepare('DELETE FROM observations WHERE plant_id=?').bind(id),env.DB.prepare('DELETE FROM weather_snapshots WHERE plant_id=?').bind(id),env.DB.prepare('DELETE FROM plants WHERE id=?').bind(id)]); return json({ok:true,deleted:id});
  }
  if(url.pathname==='/api/plants' && request.method==='POST'){const p=await request.json(); if(!env.DB) return json({ok:false,local:true}); await env.DB.prepare(`INSERT OR REPLACE INTO plants(id,crop,name,count,area,stage,season,lat,lon,last_check_at,last_observation,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(p.id,p.crop,p.name||cropName(p.crop),p.count||0,p.area||0,p.stage||'',p.season||'',p.lat||null,p.lon||null,p.last_check_at||null,p.last_observation||null,p.created_at||iso(),p.updated_at||iso()).run(); return json({ok:true});}
  if(url.pathname.startsWith('/api/inventory/') && request.method==='DELETE'){
    const id=decodeURIComponent(url.pathname.split('/').pop()||''); if(!id) return json({error:'Thiếu inventory id'},400); if(!env.DB) return json({ok:false,local:true}); await env.DB.prepare('DELETE FROM inventory WHERE id=?').bind(id).run(); return json({ok:true,deleted:id});
  }
  if(url.pathname==='/api/sync' && request.method==='POST'){const b=await request.json(); if(!env.DB) return json({ok:false,local:true}); const stm=[]; for(const p of b.plants||[]) stm.push(env.DB.prepare(`INSERT OR REPLACE INTO plants(id,crop,name,count,area,stage,season,lat,lon,last_check_at,last_observation,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(p.id,p.crop,p.name||cropName(p.crop),p.count||0,p.area||0,p.stage||'',p.season||'',p.lat||null,p.lon||null,p.last_check_at||null,p.last_observation||null,p.created_at||iso(),p.updated_at||iso())); for(const i of b.inventory||[]) stm.push(env.DB.prepare(`INSERT OR REPLACE INTO inventory(id,name,active,crop,targets,label_verified,dose,phi,stock,unit,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).bind(i.id,i.name||'',i.active||'',i.crop||'',i.targets||'',i.label_verified?1:0,i.dose||'',i.phi||'',i.stock||0,i.unit||'đv',i.created_at||iso())); for(const r of b.recs||[]) stm.push(env.DB.prepare(`INSERT OR REPLACE INTO recommendations(id,plant_id,title,body,payload,status,source,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)`).bind(r.id,r.plant_id,r.title||'',r.body||'',r.payload||'',r.status||'PENDING',r.source||'LOCAL',r.created_at||iso(),iso())); for(const t of b.tasks||[]) stm.push(env.DB.prepare(`INSERT OR REPLACE INTO tasks(id,plant_id,rec_id,kind,title,scheduled_at,status,notes,meta,completed_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).bind(t.id,t.plant_id||null,t.rec_id||null,t.kind||'',t.title||'',t.scheduled_at||null,t.status||'PLANNED',t.notes||'',t.meta||'',t.completed_at||null,t.created_at||iso())); await dbBatch(env,stm); return json({ok:true});}
  if(url.pathname==='/api/automation/run' && request.method==='POST'){const h=await runHourly(env); const d=await runDaily(env); return json({ok:true,created:(h.created||0)+(d.created||0),notifications:(h.notifications||0)+(d.notifications||0),status:{enabled:!!env.DB,telegram:!!(env.TELEGRAM_BOT_TOKEN&&env.TELEGRAM_CHAT_ID),ai:!!(env.OPENROUTER_API_KEY||env.GROQ_API_KEY)}});}
  if(url.pathname.startsWith('/api/recommendations/') && request.method==='DELETE'){const id=decodeURIComponent(url.pathname.split('/').pop()||''); if(!id) return json({error:'Thiếu recommendation id'},400); if(env.DB) await env.DB.prepare('DELETE FROM recommendations WHERE id=?').bind(id).run(); return json({ok:true});}
  if(url.pathname.startsWith('/api/task-status/') && request.method==='POST'){
    const id=decodeURIComponent(url.pathname.split('/').pop()||''); const b=await request.json().catch(()=>({})); if(!id) return json({error:'Thiếu task id'},400); if(!env.DB) return json({ok:false,local:true});
    if(b.offsetDays){await env.DB.prepare('UPDATE tasks SET scheduled_at=?, status=?, completed_at=NULL WHERE id=?').bind(new Date(Date.now()+Number(b.offsetDays)*86400000).toISOString(), b.status||'PLANNED', id).run();} else {await env.DB.prepare('UPDATE tasks SET status=?, completed_at=? WHERE id=?').bind(b.status||'PLANNED', b.status==='DONE'?iso():null, id).run();}
    return json({ok:true});
  }
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
      await pollTelegram(env);
      if(controller.cron==='0 22 * * *') await runDaily(env);
      else await runHourly(env);
    }catch(e){console.error('scheduled error',e);}
  }
};
