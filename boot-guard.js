(()=>{
'use strict';
const KEY_PREFIX='nv_';
const JSON_KEYS=['nv_plants','nv_recs','nv_tasks','nv_inventory'];
const bootEl=()=>document.querySelector('#app .boot');
function repairLocalStorage(){
  for(const key of JSON_KEYS){
    try{
      const raw=localStorage.getItem(key);
      if(raw==null||raw==='')continue;
      JSON.parse(raw);
    }catch{
      try{localStorage.removeItem(key)}catch{}
    }
  }
}
function showError(message){
  const app=document.getElementById('app');
  if(!app)return;
  app.innerHTML=`<div style="min-height:100vh;display:grid;place-items:center;padding:24px;background:#f5f7fb;font-family:system-ui,-apple-system,sans-serif"><div style="width:min(520px,100%);background:#fff;border:1px solid #e3e5ea;border-radius:22px;padding:24px;box-shadow:0 12px 40px rgba(0,0,0,.08)"><div style="font-size:28px;font-weight:900">Nông Vụ AI</div><div style="margin-top:8px;color:#b42318;font-weight:800">Không thể khởi động ứng dụng</div><div style="margin-top:8px;color:#666;font-size:13px;line-height:1.5;word-break:break-word">${String(message||'Lỗi JavaScript').replace(/[&<>\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[m]))}</div><button id="boot-reload" style="margin-top:16px;border:0;border-radius:14px;padding:12px 16px;background:#147b50;color:#fff;font-weight:800">Tải lại sạch</button></div></div>`;
  document.getElementById('boot-reload')?.addEventListener('click',async()=>{
    try{const regs=await navigator.serviceWorker?.getRegistrations?.()||[];for(const r of regs)await r.unregister();}catch{}
    try{const keys=await caches?.keys?.()||[];for(const k of keys)await caches.delete(k);}catch{}
    location.href=location.pathname+'?clean='+Date.now()+location.hash;
  });
}
repairLocalStorage();
let bootFinished=false;
window.addEventListener('nv:boot-ready',()=>{bootFinished=true},{once:true});
window.addEventListener('error',e=>{if(!bootFinished&&bootEl())showError(e.error?.message||e.message||'JavaScript error')});
window.addEventListener('unhandledrejection',e=>{if(!bootFinished&&bootEl())showError(e.reason?.message||String(e.reason||'Promise rejection'))});
setTimeout(()=>{if(!bootFinished&&bootEl())showError('Ứng dụng không hoàn tất khởi động trong thời gian cho phép.')},8000);
})();
