// Nông Vụ AI v24 UI bridge.
(function(){
  if (typeof window.modal !== 'function') {
    window.modal = function modal(html){
      const old = document.querySelector('.modal');
      if (old) old.remove();
      const el = document.createElement('div');
      el.className = 'modal';
      el.innerHTML = `
        <div class="sheet" style="position:relative;max-height:88vh;overflow:auto;width:min(720px,100%);background:#fff;border-radius:24px 24px 0 0;padding:22px 18px 28px;box-shadow:0 -18px 46px rgba(0,0,0,.20)">
          <div style="width:46px;height:5px;border-radius:99px;background:#d8d8dc;margin:0 auto 14px"></div>
          <button type="button" data-modal-close aria-label="Đóng" style="position:absolute;right:14px;top:12px;width:38px;height:38px;border:0;border-radius:50%;background:#f1f1f3;font-size:22px;line-height:1">×</button>
          ${html}
        </div>`;
      const close=()=>el.remove();
      el.addEventListener('click',ev=>{if(ev.target===el||ev.target.closest('[data-modal-close]'))close();});
      document.body.appendChild(el);
      return el;
    };
  }

  const API='https://nong-vu-ai.draculacom1.workers.dev';
  const esc=s=>String(s??'').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));
  const money = v => String(v??'').replace(/[<>]/g,'');
  const css = `
  .nv-aiinv{margin-top:14px;border:1px solid #e8e8ee;border-radius:22px;background:linear-gradient(180deg,#fff 0%,#f7f7fa 100%);overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.06)}
  .nv-aiinv-head{padding:16px 16px 12px;display:flex;gap:12px;align-items:center;justify-content:space-between}
  .nv-aiinv-title{font-size:19px;font-weight:850;letter-spacing:-.02em}
  .nv-aiinv-sub{font-size:12px;color:#777;margin-top:3px;line-height:1.4}
  .nv-aiinv-pill{font-size:11px;padding:7px 10px;border-radius:999px;background:#111;color:#fff;white-space:nowrap}
  .nv-aiinv-tabs{display:flex;gap:8px;padding:0 16px 12px;overflow:auto}
  .nv-aiinv-tab{border:0;background:#ececf1;padding:9px 12px;border-radius:999px;font-weight:750;font-size:12px;white-space:nowrap}
  .nv-aiinv-tab.active{background:#111;color:#fff}
  .nv-aiinv-grid{display:grid;grid-template-columns:1fr;gap:10px;padding:0 16px 16px}
  .nv-aiinv-card{background:#fff;border:1px solid #e6e6eb;border-radius:18px;padding:13px;box-shadow:0 6px 18px rgba(0,0,0,.04)}
  .nv-aiinv-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
  .nv-aiinv-name{font-weight:850;font-size:16px;line-height:1.2}
  .nv-aiinv-badge{font-size:10px;padding:5px 8px;border-radius:999px;background:#fff4d7;color:#9b6a00;font-weight:800}
  .nv-aiinv-badge.ok{background:#e8f7ee;color:#1f7a46}
  .nv-aiinv-line{font-size:12px;line-height:1.45;color:#444;margin-top:7px}
  .nv-aiinv-label{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#8a8a93;font-weight:800;margin-right:5px}
  .nv-aiinv-foot{display:flex;gap:8px;align-items:center;margin-top:11px;padding-top:10px;border-top:1px solid #efeff3}
  .nv-aiinv-btn{border:0;background:#111;color:#fff;padding:9px 11px;border-radius:12px;font-size:11px;font-weight:800}
  .nv-aiinv-btn.alt{background:#ececf1;color:#111}
  .nv-aiinv-note{padding:0 16px 16px;font-size:11px;color:#777;line-height:1.45}
  .nv-aiinv-empty{padding:16px;color:#777;font-size:13px;text-align:center}
  `;
  const style=document.createElement('style');style.textContent=css;document.head.appendChild(style);

  async function jfetch(path,opts={}){
    const res=await fetch(API+path,{...opts,headers:{'Content-Type':'application/json',...(opts.headers||{})}});
    const txt=await res.text(); let data={}; try{data=txt?JSON.parse(txt):{}}catch{data={raw:txt};}
    if(!res.ok) throw new Error(data.error||`HTTP ${res.status}`);
    return data;
  }
  const toast=(msg,type='info')=>{if(typeof window.toast==='function')window.toast(msg,type);else{const x=document.createElement('div');x.textContent=msg;x.style='position:fixed;left:50%;bottom:90px;transform:translateX(-50%);z-index:99999;background:#111;color:#fff;padding:12px 16px;border-radius:14px;font-weight:700';document.body.appendChild(x);setTimeout(()=>x.remove(),2600);}};

  // Robust capture-phase handlers: they fire before the old module listener, so cached/older handlers cannot swallow clicks.
  document.addEventListener('click',async ev=>{
    const approve=ev.target.closest('[data-action="approve-rec"]');
    const reject=ev.target.closest('[data-action="reject-rec"]');
    if(!approve && !reject) return;
    ev.preventDefault(); ev.stopImmediatePropagation();
    const id=(approve||reject).dataset.id;
    const btn=approve||reject; btn.disabled=true; const old=btn.textContent; btn.textContent=approve?'Đang duyệt…':'Đang xóa…';
    try{
      if(approve){
        const d=await jfetch('/api/recommendations/approve',{method:'POST',body:JSON.stringify({id})});
        if(!d.ok) throw new Error('Server không xác nhận duyệt');
        toast(`Đã duyệt và tạo ${d.created?.length||0} mốc lịch`,'success');
      }else{
        const d=await jfetch('/api/recommendations/reject',{method:'POST',body:JSON.stringify({id})});
        if(!d.ok) throw new Error('Server không xác nhận xóa');
        toast('Đã từ chối và xóa khuyến cáo','success');
      }
      setTimeout(()=>location.reload(),220);
    }catch(err){
      btn.disabled=false; btn.textContent=old;
      toast(`${approve?'Không duyệt được':'Không xóa được khuyến cáo'}: ${err.message}`,'error');
    }
  },true);

  const CHEMICAL_CATALOG=[
    {product:'Amistar Top 325SC',active:'Azoxystrobin 200 g/L + Difenoconazole 125 g/L',targets:'Thán thư • Rỉ sắt',crop:'Cà phê • Hồ tiêu',effect:'Thuốc trừ bệnh; hỗ trợ quản lý bệnh nấm theo nhãn.',source:'Danh mục BVTV hiện hành; đối chiếu nhãn trước sử dụng.'},
    {product:'Autopro 360SC',active:'Azocyclotin 100 g/L + Flonicamid 260 g/L',targets:'Rệp sáp',crop:'Cà phê',effect:'Thuốc trừ sâu/rệp; dùng đúng đối tượng trên nhãn.',source:'Danh mục BVTV hiện hành; đối chiếu nhãn trước sử dụng.'},
    {product:'AU-Morax 60WG',active:'Cymoxanil 40% + Pyraclostrobin 20%',targets:'Rỉ sắt',crop:'Cà phê',effect:'Thuốc trừ bệnh; hỗ trợ quản lý bệnh nấm theo nhãn.',source:'Danh mục BVTV hiện hành; đối chiếu nhãn trước sử dụng.'}
  ];

  function chemicalFromRecs(recs){
    const out=[]; const seen=new Set();
    for(const r of recs||[]){
      let p={}; try{p=JSON.parse(r.payload||'{}')}catch{}
      for(const c of Array.isArray(p.chemical)?p.chemical:[]){
        const key=String(c.product||c.active||'').trim().toLowerCase(); if(!key||seen.has(key))continue; seen.add(key); out.push({...c,sourceRec:r.title||'AI'});
      }
    }
    return out;
  }
  async function syncChemicalCandidates(data){
    const candidates=chemicalFromRecs(data.recs||[]); if(!candidates.length)return {data,candidates:[]};
    const existing=new Set((data.inventory||[]).map(x=>String(x.name||'').trim().toLowerCase()));
    const add=[];
    for(const c of candidates){
      const name=String(c.product||c.active||'').trim(); if(!name||existing.has(name.toLowerCase()))continue;
      const item={id:crypto.randomUUID(),name,active:c.active||'',crop:c.crop||'',targets:c.target||'',label_verified:0,dose:c.dose||'Theo nhãn',phi:c.phi||'Theo nhãn',stock:0,unit:'đv',created_at:new Date().toISOString()};
      add.push(item); existing.add(name.toLowerCase());
    }
    if(add.length){ await jfetch('/api/sync',{method:'POST',body:JSON.stringify({inventory:add})}); data.inventory=[...(data.inventory||[]),...add]; }
    return {data,candidates};
  }
  function inventoryHTML(data,candidates,tab='ai'){
    const inv=data.inventory||[];
    const rows=[];
    for(const c of candidates) rows.push({kind:'ai',name:c.product||c.active,active:c.active||'',targets:c.target||'',crop:c.crop||'',effect:c.effect||'',dose:c.dose||'Theo nhãn',phi:c.phi||'Theo nhãn',verified:false,source:c.sourceRec||'AI'});
    for(const x of inv){rows.push({kind:'inv',name:x.name,active:x.active||'',targets:x.targets||'',crop:x.crop||'',effect:'Vật tư đã được AI ghi nhận từ khuyến cáo.',dose:x.dose||'Theo nhãn',phi:x.phi||'Theo nhãn',verified:Number(x.label_verified)===1,source:'D1'});}
    const filtered=rows.filter(x=>tab==='all'||(tab==='verified'?x.verified:tab==='ai'?x.kind==='ai':true));
    return `<div class="nv-aiinv"><div class="nv-aiinv-head"><div><div class="nv-aiinv-title">Kho vật tư AI</div><div class="nv-aiinv-sub">AI tự đưa ứng viên từ khuyến cáo sang đây. Mày chỉ cần xem, đối chiếu nhãn và quyết định mua.</div></div><div class="nv-aiinv-pill">${rows.length} mục</div></div><div class="nv-aiinv-tabs"><button class="nv-aiinv-tab ${tab==='ai'?'active':''}" data-inv-tab="ai">AI đề xuất</button><button class="nv-aiinv-tab ${tab==='verified'?'active':''}" data-inv-tab="verified">Đã đối chiếu</button><button class="nv-aiinv-tab ${tab==='all'?'active':''}" data-inv-tab="all">Tất cả</button><button class="nv-aiinv-tab ${tab==='catalog'?'active':''}" data-inv-tab="catalog">Danh mục</button></div>${tab==='catalog'?`<div class="nv-aiinv-grid">${CHEMICAL_CATALOG.map(c=>`<div class="nv-aiinv-card"><div class="nv-aiinv-top"><div class="nv-aiinv-name">${esc(c.product)}</div><span class="nv-aiinv-badge">Tham chiếu</span></div><div class="nv-aiinv-line"><span class="nv-aiinv-label">Hoạt chất</span>${esc(c.active)}</div><div class="nv-aiinv-line"><span class="nv-aiinv-label">Cây</span>${esc(c.crop)}</div><div class="nv-aiinv-line"><span class="nv-aiinv-label">Đối tượng</span>${esc(c.targets)}</div><div class="nv-aiinv-line"><span class="nv-aiinv-label">Công dụng</span>${esc(c.effect)}</div><div class="nv-aiinv-foot"><span class="nv-aiinv-sub">${esc(c.source)}</span></div></div>`).join('')}</div>`:filtered.length?`<div class="nv-aiinv-grid">${filtered.map(x=>`<div class="nv-aiinv-card"><div class="nv-aiinv-top"><div class="nv-aiinv-name">${esc(x.name||'Ứng viên')}</div><span class="nv-aiinv-badge ${x.verified?'ok':''}">${x.verified?'ĐÃ ĐỐI CHIẾU':'AI ĐỀ XUẤT'}</span></div><div class="nv-aiinv-line"><span class="nv-aiinv-label">Hoạt chất</span>${esc(x.active||'Chưa có')}</div><div class="nv-aiinv-line"><span class="nv-aiinv-label">Cây</span>${esc(x.crop||'Theo khuyến cáo')}</div><div class="nv-aiinv-line"><span class="nv-aiinv-label">Đối tượng</span>${esc(x.targets||'Theo khuyến cáo')}</div><div class="nv-aiinv-line"><span class="nv-aiinv-label">Công dụng</span>${esc(x.effect||'Theo nhãn')}</div><div class="nv-aiinv-line"><span class="nv-aiinv-label">Liều</span>${esc(x.dose||'Theo nhãn')} <span class="nv-aiinv-label">PHI</span>${esc(x.phi||'Theo nhãn')}</div><div class="nv-aiinv-foot"><button class="nv-aiinv-btn alt" data-inv-source="${esc(x.source)}">Nguồn/khuyến cáo</button><span class="nv-aiinv-sub">${x.verified?'Đã đối chiếu nhãn':'Cần đối chiếu nhãn trước khi mua/sử dụng'}</span></div></div>`).join('')}</div>`:'<div class="nv-aiinv-empty">Chưa có ứng viên. Khi AI tạo khuyến cáo có hóa học, vật tư sẽ tự xuất hiện ở đây.</div>'}<div class="nv-aiinv-note">⚠️ Đây là lớp quản lý ứng viên, không thay thế nhãn sản phẩm. Luôn kiểm tra sản phẩm/hoạt chất, cây, đối tượng, liều và PHI theo nhãn hiện hành trước mua hoặc sử dụng.</div></div>`;
  }
  async function enhanceInventory(tab='ai'){
    if(!location.hash.includes('settings'))return;
    const cards=[...document.querySelectorAll('.card')];
    const host=cards.find(c=>/Vật tư đã đối chiếu/.test(c.textContent||'')); if(!host)return;
    try{
      const data=await jfetch('/api/data'); const r=await syncChemicalCandidates(data); data.inventory=r.data.inventory; const old=host.querySelector('.nv-aiinv'); if(old)old.remove(); host.insertAdjacentHTML('beforeend',inventoryHTML(data,r.candidates,tab));
    }catch(err){
      if(!host.querySelector('.nv-aiinv')) host.insertAdjacentHTML('beforeend',`<div class="nv-aiinv"><div class="nv-aiinv-empty">Không tải được kho vật tư AI: ${esc(err.message)}</div></div>`);
    }
  }
  document.addEventListener('click',ev=>{
    const tab=ev.target.closest('[data-inv-tab]'); if(tab){ev.preventDefault();ev.stopImmediatePropagation();enhanceInventory(tab.dataset.invTab);return;}
    const src=ev.target.closest('[data-inv-source]'); if(src){toast(`Nguồn: ${src.dataset.invSource}`,'info');}
  },true);
  const obs=new MutationObserver(()=>{if(location.hash.includes('settings'))setTimeout(()=>enhanceInventory('ai'),80);}); obs.observe(document.body,{subtree:true,childList:true});
  window.addEventListener('hashchange',()=>setTimeout(()=>enhanceInventory('ai'),160));
  setTimeout(()=>enhanceInventory('ai'),500);
})();
