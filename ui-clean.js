(()=>{
  'use strict';
  const API='https://nong-vu-ai.draculacom1.workers.dev';
  const TOAST=(msg,type='info')=>{
    if(typeof window.toast==='function') return window.toast(msg,type);
    const e=document.createElement('div');
    e.textContent=msg;
    e.style='position:fixed;left:50%;bottom:90px;transform:translateX(-50%);z-index:99999;background:'+(type==='error'?'#c52a22':'#111')+';color:#fff;padding:11px 14px;border-radius:13px;font-weight:700;max-width:90%;text-align:center';
    document.body.appendChild(e); setTimeout(()=>e.remove(),2800);
  };
  const removeLegacy=()=>{
    document.querySelectorAll('#nv-regimen-tab,#nv-chemical-tab,#nv-regimen-overlay,#nv-chemical-overlay,#nv-kho-pro-btn,#nvx-launch,#nv-clean-tool').forEach(e=>e.remove());
    document.querySelectorAll('.nv-regimen-tab,.nv-chemical-tab').forEach(e=>e.remove());
  };
  const addNeedButton=()=>{
    removeLegacy();
    const actions=document.querySelector('.nav-actions');
    if(!actions || actions.querySelector('[data-open-needs]')) return;
    const b=document.createElement('button');
    b.className='icon-btn';
    b.type='button';
    b.setAttribute('aria-label','Nhu cầu & vật tư');
    b.dataset.openNeeds='1';
    b.innerHTML='🧰';
    b.style.fontSize='18px';
    b.addEventListener('click',()=>{
      if(window.NVNeed?.open) window.NVNeed.open();
      else TOAST('Nhu cầu & vật tư đang khởi tạo, thử lại sau ít giây','info');
    });
    actions.appendChild(b);
  };
  const safeJson=async(res)=>{const t=await res.text();let d={};try{d=t?JSON.parse(t):{}}catch{d={raw:t}};if(!res.ok)throw new Error(d.error||`HTTP ${res.status}`);return d;};

  document.addEventListener('click',async ev=>{
    const btn=ev.target.closest('[data-action="delete-inventory"]');
    if(!btn) return;
    ev.preventDefault(); ev.stopImmediatePropagation();
    const id=btn.dataset.id;
    if(!id) return;
    if(!confirm('Xóa vật tư này khỏi danh sách?')) return;
    btn.disabled=true;
    try{
      const d=await safeJson(await fetch(API+'/api/data',{cache:'no-store'}));
      const inventory=(d.inventory||[]).filter(x=>String(x.id)!==String(id));
      if(inventory.length===(d.inventory||[]).length) throw new Error('Không tìm thấy vật tư cần xóa');
      await safeJson(await fetch(API+'/api/sync',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({plants:d.plants||[],recs:d.recs||[],tasks:d.tasks||[],inventory})
      }));
      localStorage.setItem('nv_inventory',JSON.stringify(inventory));
      TOAST('Đã xóa vật tư','success');
      setTimeout(()=>location.reload(),220);
    }catch(err){
      btn.disabled=false;
      TOAST(`Không xóa được vật tư: ${err.message}`,'error');
    }
  },true);

  const mo=new MutationObserver(()=>{
    removeLegacy();
    addNeedButton();
  });
  const start=()=>{
    removeLegacy();
    addNeedButton();
    mo.observe(document.body,{childList:true,subtree:true});
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
})();