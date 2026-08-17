const json = (x, status=200) => new Response(JSON.stringify(x), {
  status,
  headers: {'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*'}
});
const guard = (request, env) => {
  const expected = env.APP_TOKEN;
  if (!expected) return null;
  const got = request.headers.get('X-App-Token') || '';
  return got === expected ? null : json({error:'Unauthorized'},401);
};

async function aiAdvice(request, env) {
  const g=guard(request,env); if(g) return g;
  if(!env.OPENAI_API_KEY) return json({error:'OPENAI_API_KEY chưa cấu hình'},503);
  const b=await request.json();
  const p=b.plant||{};
  const crop=b.knowledge?.crops?.[p.crop];
  const stage=crop?.stages?.find(s=>s.id===p.stage);
  const context={plant:p,stage,weather:b.weather,observation:b.observation||'',inventory:b.inventory||[],history:b.history||{},sources:b.knowledge?.sources||[]};
  const system=`Bạn là AI trợ lý nông vụ cho cà phê, hồ tiêu và cau ở Việt Nam. Ưu tiên IPM, kiểm tra thực tế và biện pháp canh tác. Chỉ khuyến cáo thuốc/sản phẩm cụ thể khi inventory có cây đăng ký, đối tượng, nhãn đã đối chiếu (label_verified=1) và có dose/phi. Nếu thiếu dữ liệu, không bịa. Tách rõ đánh giá, nguy cơ, kiểm tra, không hóa chất, hóa học, thời tiết, cảnh báo, độ tin cậy và nguồn. Ảnh chỉ cho nhận định xác suất.`;
  const user=`Hãy tư vấn cho dữ liệu sau. Trả JSON thuần với các key: title,summary,assessment,risks,checks,nonChemical,chemical,weatherWindow,precautions,confidence,sources. chemical là mảng; mỗi item gồm product,active,why,dose,phi,evidence. Nếu không đủ dữ liệu, chemical=[] và nói rõ trong summary. Không tự invent liều.\n\n${JSON.stringify(context)}`;
  let content=[{type:'input_text',text:user}];
  if(typeof b.image==='string'&&b.image.startsWith('data:image/')) content.push({type:'input_image',image_url:b.image});
  const payload={model:env.OPENAI_MODEL||'gpt-5.6',input:[{role:'system',content:[{type:'input_text',text:system}]},{role:'user',content}],temperature:0.2};
  const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${env.OPENAI_API_KEY}`},body:JSON.stringify(payload)});
  const d=await r.json(); if(!r.ok) return json({error:d?.error?.message||'OpenAI error'},502);
  const text=d.output_text||d.output?.flatMap(x=>x.content||[]).map(x=>x.text||'').join('')||'';
  let out; try{out=JSON.parse(text)}catch{out={title:'Khuyến cáo AI',summary:text,assessment:'',risks:[],checks:[],nonChemical:[],chemical:[],weatherWindow:'',precautions:[],confidence:null,sources:[]}};
  return json({...out,model:env.OPENAI_MODEL||'gpt-5.6'});
}

async function weather(request) {
  const u=new URL(request.url); const lat=Number(u.searchParams.get('lat')), lon=Number(u.searchParams.get('lon'));
  if(!Number.isFinite(lat)||!Number.isFinite(lon)) return json({error:'lat/lon required'},400);
  const url=`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,rain,wind_speed_10m,wind_gusts_10m,weather_code,is_day&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,wind_speed_10m,wind_gusts_10m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max&forecast_days=5&timezone=auto`;
  const r=await fetch(url); if(!r.ok) return json({error:'weather provider error'},502); const d=await r.json(); return json({current:d.current,hourly:d.hourly,daily:d.daily,timezone:d.timezone});
}

async function api(request, env) {
  const url=new URL(request.url); const path=url.pathname;
  try {
    if(path==='/api/health') { const g=guard(request,env); if(g)return g; return json({ok:true,time:new Date().toISOString(),ai:!!env.OPENAI_API_KEY,db:!!env.DB}); }
    if(path==='/api/weather') return await weather(request);
    if(path==='/api/advice' && request.method==='POST') return await aiAdvice(request,env);
    const g=guard(request,env); if(g)return g;
    if(path==='/api/data' && request.method==='GET') {
      if(!env.DB) return json({plants:[],recs:[],tasks:[],inventory:[]});
      const [plants,recs,tasks,inventory]=await Promise.all([
        env.DB.prepare('SELECT * FROM plants ORDER BY created_at DESC').all(),
        env.DB.prepare('SELECT * FROM recommendations ORDER BY created_at DESC').all(),
        env.DB.prepare('SELECT * FROM tasks ORDER BY scheduled_at ASC').all(),
        env.DB.prepare('SELECT * FROM inventory ORDER BY created_at DESC').all()
      ]);
      return json({plants:plants.results,recs:recs.results,tasks:tasks.results,inventory:inventory.results});
    }
    if(path==='/api/plants' && request.method==='POST') {
      if(!env.DB) return json({ok:false},503); const p=await request.json();
      await env.DB.prepare(`INSERT OR REPLACE INTO plants(id,crop,name,count,area,stage,season,lat,lon,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).bind(p.id,p.crop,p.name,p.count||0,p.area||0,p.stage||'',p.season||'',p.lat??null,p.lon??null,p.created_at||new Date().toISOString(),p.updated_at||new Date().toISOString()).run();
      return json({ok:true});
    }
    if(path==='/api/recommendations' && request.method==='POST') {
      if(!env.DB) return json({ok:false},503); const r=await request.json();
      await env.DB.prepare(`INSERT OR REPLACE INTO recommendations(id,plant_id,title,body,payload,status,created_at) VALUES(?,?,?,?,?,?,?)`).bind(r.id,r.plant_id,r.title||'',r.body||'',r.payload||'',r.status||'PENDING',r.created_at||new Date().toISOString()).run();
      return json({ok:true});
    }
    if(path==='/api/sync' && request.method==='POST') {
      if(!env.DB) return json({ok:false,error:'D1 not configured'},503); const body=await request.json(); const tx=[];
      if(Array.isArray(body.plants))for(const p of body.plants)tx.push(env.DB.prepare(`INSERT OR REPLACE INTO plants(id,crop,name,count,area,stage,season,lat,lon,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).bind(p.id,p.crop,p.name,p.count||0,p.area||0,p.stage||'',p.season||'',p.lat??null,p.lon??null,p.created_at||new Date().toISOString(),p.updated_at||new Date().toISOString()));
      if(Array.isArray(body.inventory))for(const x of body.inventory)tx.push(env.DB.prepare(`INSERT OR REPLACE INTO inventory(id,name,active,crop,targets,label_verified,dose,phi,stock,unit,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).bind(x.id,x.name,x.active||'',x.crop||'',x.targets||'',x.label_verified?1:0,x.dose||'',x.phi||'',x.stock||0,x.unit||'đv',x.created_at||new Date().toISOString()));
      if(Array.isArray(body.recs))for(const x of body.recs)tx.push(env.DB.prepare(`INSERT OR REPLACE INTO recommendations(id,plant_id,title,body,payload,status,created_at) VALUES(?,?,?,?,?,?,?)`).bind(x.id,x.plant_id,x.title||'',x.body||'',x.payload||'',x.status||'PENDING',x.created_at||new Date().toISOString()));
      if(Array.isArray(body.tasks))for(const x of body.tasks)tx.push(env.DB.prepare(`INSERT OR REPLACE INTO tasks(id,plant_id,rec_id,kind,title,scheduled_at,status,notes,created_at) VALUES(?,?,?,?,?,?,?,?,?)`).bind(x.id,x.plant_id||null,x.rec_id||null,x.kind||'',x.title||'',x.scheduled_at||null,x.status||'PLANNED',x.notes||'',x.created_at||new Date().toISOString()));
      if(tx.length)await env.DB.batch(tx); return json({ok:true,count:tx.length});
    }
    return null;
  } catch(e) { return json({error:e?.message||'server error'},500); }
}

export default {
  async fetch(request, env, ctx) {
    const apiRes = await api(request,env);
    if(apiRes) return apiRes;
    if(env.ASSETS) return env.ASSETS.fetch(request);
    return new Response('Nông Vụ AI',{status:200,headers:{'content-type':'text/plain; charset=utf-8'}});
  }
};
