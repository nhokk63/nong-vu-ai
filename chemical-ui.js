(function(){
  const API='https://nong-vu-ai.draculacom1.workers.dev';
  const esc=s=>String(s??'').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));
  const crop={coffee:'Cà phê',pepper:'Hồ tiêu',areca:'Cau'};
  const typeOf=(x)=>{
    const s=`${x?.effect||''} ${x?.active||''} ${x?.target||''} ${x?.targets||''}`.toLowerCase();
    if(/cỏ|glyphosate|glufosinate|paraquat/.test(s)) return 'Trừ cỏ';
    if(/rệp|sâu|bọ|nhện|aphid|insect|mite/.test(s)) return 'Trừ sâu';
    if(/nấm|fung|rỉ|thán thư|phytophthora|bệnh/.test(s)) return 'Trừ bệnh';
    if(/ốc/.test(s)) return 'Trừ ốc';
    if(/tuyến trùng|nematode/.test(s)) return 'Tuyến trùng';
    return 'Khác';
  };
  const parse=v=>{try{return JSON.parse(v||'{}')}catch{return {}}};
  const data=async()=>{const r=await fetch(API+'/api/data'); if(!r.ok) throw new Error('Không tải được dữ liệu'); return r.json()};
  const syncInventory=async(items)=>{const d=await data(); const payload={plants:d.plants||[],recs:d.recs||[],tasks:d.tasks||[],inventory:items}; const r=await fetch(API+'/api/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}); if(!r.ok) throw new Error((await r.json().catch(()=>({}))).error||'Không lưu được kho'); return r.json();};
  const css=`
  #nv-chemical-tab{position:fixed;right:16px;bottom:94px;z-index:9990;border:0;border-radius:18px;background:linear-gradient(135deg,#0b7a42,#0a5f37);color:#fff;padding:11px 13px;box-shadow:0 10px 28px rgba(0,90,55,.24);font-weight:800;font-size:13px;display:flex;align-items:center;gap:7px}
  #nv-chemical-overlay{position:fixed;inset:0;z-index:10000;background:rgba(245,246,249,.97);backdrop-filter:blur(14px);overflow:auto;display:none}
  #nv-chemical-overlay.on{display:block;animation:nvChemIn .2s ease both}@keyframes nvChemIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  .nvchem-head{position:sticky;top:0;z-index:3;background:rgba(245,246,249,.92);backdrop-filter:blur(16px);padding:18px 18px 12px;border-bottom:1px solid #e6e6eb}
  .nvchem-title{font-size:30px;font-weight:900;letter-spacing:-.7px}.nvchem-sub{color:#6f7078;margin-top:3px}.nvchem-back{float:right;border:0;width:40px;height:40px;border-radius:14px;background:#fff;font-size:24px;box-shadow:0 4px 18px rgba(0,0,0,.08)}
  .nvchem-body{padding:14px 14px 110px;max-width:760px;margin:auto}.nvchem-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.nvchem-stat{background:#fff;border:1px solid #e9e9ee;border-radius:18px;padding:14px}.nvchem-stat b{display:block;font-size:24px}.nvchem-stat span{font-size:12px;color:#777}
  .nvchem-card{background:#fff;border:1px solid #e7e7ec;border-radius:20px;padding:16px;margin-top:12px;box-shadow:0 5px 20px rgba(0,0,0,.035)}
  .nvchem-card h3{margin:0;font-size:18px}.nvchem-meta{color:#73757d;font-size:13px;margin-top:4px}.nvchem-tag{display:inline-block;border-radius:999px;padding:5px 9px;font-size:11px;font-weight:800;margin:8px 5px 0 0;background:#eef6f1;color:#17653d}.nvchem-tag.warn{background:#fff4dd;color:#8a5b00}.nvchem-row{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:11px 0;border-top:1px solid #efeff3}.nvchem-row:first-child{border-top:0}.nvchem-name{font-weight:800}.nvchem-small{font-size:12px;color:#777;line-height:1.45}.nvchem-check{width:22px;height:22px;accent-color:#16824c}.nvchem-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.nvchem-btn{border:0;border-radius:13px;padding:10px 13px;font-weight:800}.nvchem-btn.primary{background:#1684f5;color:#fff}.nvchem-btn.light{background:#eef0f4}.nvchem-btn.green{background:#dcf7e8;color:#16633c}.nvchem-filter{display:flex;gap:8px;overflow:auto;padding:8px 0}.nvchem-filter button{border:0;background:#fff;padding:9px 12px;border-radius:999px;white-space:nowrap}.nvchem-filter button.on{background:#0d7a47;color:#fff}.nvchem-empty{padding:28px 12px;text-align:center;color:#777}.nvchem-note{font-size:12px;color:#72747c;line-height:1.5}.nvchem-danger{color:#ad2d2d}.nvchem-step{display:flex;gap:10px;align-items:flex-start;padding:12px 0;border-top:1px solid #efeff3}.nvchem-step .day{min-width:62px;font-weight:900;color:#0c7642}.nvchem-step .day small{display:block;color:#777;font-weight:600;font-size:10px}
  @media(min-width:700px){.nvchem-body{padding-left:20px;padding-right:20px}.nvchem-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}
  `;
  const st=document.createElement('style'); st.textContent=css; document.head.appendChild(st);

  let currentTab='all', cached=null;
  function ensureShell(){
    if(document.getElementById('nv-chemical-overlay')) return;
    const b=document.createElement('button'); b.id='nv-chemical-tab'; b.innerHTML='🧪 Kho thuốc'; b.onclick=()=>open(); document.body.appendChild(b);
    const o=document.createElement('div'); o.id='nv-chemical-overlay';
    o.innerHTML='<div class="nvchem-head"><button class="nvchem-back" id="nvchem-close">×</button><div class="nvchem-title">Kho vật tư AI</div><div class="nvchem-sub">Phác đồ • thuốc theo cữ • tồn kho • theo dõi hiệu lực</div></div><div id="nvchem-content" class="nvchem-body"></div>';
    document.body.appendChild(o); $('#nvchem-close',o).onclick=close;
  }
  function $(s,r=document){return r.querySelector(s)};
  function close(){const o=document.getElementById('nv-chemical-overlay'); if(o)o.classList.remove('on');}
  async function open(){ensureShell(); const o=document.getElementById('nv-chemical-overlay');o.classList.add('on'); await render();}
  function recommendationChemicals(recs){
    const map=new Map();
    for(const r of recs||[]){const p=parse(r.payload); for(const c of (p.chemical||[])){const key=`${String(c.product||c.name||'').toLowerCase()}|${String(c.active||'').toLowerCase()}`; if(!key.replace(/\|/g,'')) continue; if(!map.has(key))map.set(key,{...c,plantId:r.plant_id,recId:r.id,recTitle:r.title});}}
    return [...map.values()];
  }
  async function ensureAiInventory(d){
    const inv=[...(d.inventory||[])]; const known=new Map(inv.map(x=>[`${String(x.name).toLowerCase()}|${String(x.active||'').toLowerCase()}`,x])); let changed=false;
    for(const c of recommendationChemicals(d.recs)){
      const name=c.product||c.name; if(!name) continue; const key=`${String(name).toLowerCase()}|${String(c.active||'').toLowerCase()}`;
      if(known.has(key)) continue;
      const item={id:crypto.randomUUID(),name,active:c.active||'',crop:c.crop||c.crops||'',targets:c.target||c.targets||'',label_verified:0,dose:c.dose||'Theo nhãn',phi:c.phi||'Theo nhãn',stock:0,unit:'chai/lọ',created_at:new Date().toISOString()};
      inv.push(item); known.set(key,item); changed=true;
    }
    if(changed){try{await syncInventory(inv); d.inventory=inv;}catch{}}
    return d;
  }
  function stats(d,chem){const owned=(d.inventory||[]).filter(x=>Number(x.stock)>0).length;return `<div class="nvchem-grid"><div class="nvchem-stat"><b>${chem.length}</b><span>Thuốc AI đang đề xuất</span></div><div class="nvchem-stat"><b>${owned}</b><span>Loại đang có</span></div><div class="nvchem-stat"><b>${(d.recs||[]).filter(r=>r.status==='PENDING').length}</b><span>Khuyến cáo chờ duyệt</span></div><div class="nvchem-stat"><b>${(d.tasks||[]).filter(t=>t.status==='PLANNED').length}</b><span>Cữ đang theo dõi</span></div></div>`}
  function filters(chem){const types=['all',...new Set(chem.map(typeOf))];return `<div class="nvchem-filter">${types.map(t=>`<button class="${currentTab===t?'on':''}" data-chem-filter="${esc(t)}">${t==='all'?'Tất cả':esc(t)}</button>`).join('')}</div>`}
  function courseCard(r,d){
    const p=d.plants.find(x=>x.id===r.plant_id); const body=parse(r.payload); const cs=body.chemical||[]; const steps=Array.isArray(body.nextSteps)?body.nextSteps:[]; const tasks=(d.tasks||[]).filter(t=>t.rec_id===r.id).sort((a,b)=>(a.scheduled_at||'').localeCompare(b.scheduled_at||''));
    if(!cs.length && !steps.length) return '';
    const stage=stageName(p?.crop,p?.stage); const chtml=cs.map(c=>`<div class="nvchem-row"><div><div class="nvchem-name">${esc(c.product||c.name||'Ứng viên thuốc')}</div><div class="nvchem-small">${esc(c.active||'')} · ${esc(c.target||c.targets||'')} · Công dụng: ${esc(c.effect||c.effects||'')}</div><div class="nvchem-small">Liều: ${esc(c.dose||'Theo nhãn')} · PHI: ${esc(c.phi||'Theo nhãn')}</div><div class="nvchem-small ${c.verification&&c.verification!=='VERIFIED'?'nvchem-danger':''}">${esc(c.verification||'UNVERIFIED')}</div></div></div>`).join('');
    const shtml=steps.map((s,i)=>{const t=tasks[i];const when=t?.scheduled_at?new Date(t.scheduled_at).toLocaleString('vi-VN',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'';return `<div class="nvchem-step"><div class="day">${Number(s.daysFromNow)===0?'Hôm nay':`+${Number(s.daysFromNow)||0} ngày`}<small>${when?esc(when):''}</small></div><div><b>${esc(s.title||s.kind||`Cữ ${i+1}`)}</b><div class="nvchem-small">${esc(s.notes||'')}</div><div class="nvchem-small">Sau cữ này: cập nhật tình trạng cây để điều chỉnh cữ tiếp theo.</div></div></div>`}).join('');
    return `<div class="nvchem-card"><h3>${esc(r.title||'Phác đồ AI')}</h3><div class="nvchem-meta">${esc(p?.name||'Cây trồng')} · ${esc(stage||'')} · ${esc(r.status||'')}</div>${r.status==='PENDING'?'<span class="nvchem-tag warn">CHỜ XÁC NHẬN</span>':''}<div style="margin-top:10px;font-weight:800">💊 Thuốc/ứng viên trong phác đồ</div>${chtml||'<div class="nvchem-note">Chưa có ứng viên hóa học trong tư vấn này.</div>'}<div style="margin-top:10px;font-weight:800">🗓 Quy trình theo cữ</div>${shtml||'<div class="nvchem-note">Chưa có các mốc tiếp theo.</div>'}<div class="nvchem-actions"><button class="nvchem-btn light" data-close-chem>Đóng</button></div></div>`;
  }
  async function toggleOwned(itemId,checked){
    if(!cached)return; const inv=cached.inventory||[]; const item=inv.find(x=>x.id===itemId); if(!item)return; item.stock=checked?1:0; try{await syncInventory(inv); render();}catch(e){alert(e.message)}
  }
  async function render(){
    ensureShell(); const host=document.getElementById('nvchem-content'); host.innerHTML='<div class="nvchem-card">Đang đồng bộ kho vật tư AI…</div>';
    try{cached=await ensureAiInventory(await data());}catch(e){host.innerHTML=`<div class="nvchem-card nvchem-danger">${esc(e.message)}</div>`;return;}
    const chem=recommendationChemicals(cached.recs); const filtered=currentTab==='all'?chem:chem.filter(typeOf===currentTab);
    const inv=cached.inventory||[]; const pending=(cached.recs||[]).filter(r=>r.status==='PENDING' && parse(r.payload).chemical?.length);
    const allItems=inv.length?inv:[];
    host.innerHTML=`${stats(cached,chem)}${filters(chem)}<div class="nvchem-card"><h3>🤖 Phác đồ AI đang theo dõi</h3><div class="nvchem-note">AI đưa thuốc vào kho tự động sau mỗi tư vấn. Chỉ tích “Đã có” khi mày thực sự có thuốc đó. Phối trộn chỉ được phép khi nhãn/nguồn chính thức cho phép; hệ thống không tự bịa cặp phối.</div>${pending.map(r=>courseCard(r,cached)).join('')||'<div class="nvchem-empty">Chưa có phác đồ chờ theo dõi.</div>'}</div><div class="nvchem-card"><h3>🧪 Kho thuốc</h3><div class="nvchem-note">Chia theo công dụng. Ô tick là trạng thái mày đang có trong kho.</div>${allItems.filter(x=>currentTab==='all'||typeOf(x)===currentTab).map(x=>`<div class="nvchem-row"><div><div class="nvchem-name">${esc(x.name)}</div><div class="nvchem-small">${esc(x.active||'Chưa rõ hoạt chất')} · ${esc(x.crop||'')} · ${esc(x.targets||'')}</div><span class="nvchem-tag">${esc(typeOf(x))}</span><span class="nvchem-tag ${x.label_verified?'':'warn'}">${x.label_verified?'ĐÃ ĐỐI CHIẾU':'CHƯA XÁC MINH NHÃN'}</span></div><input class="nvchem-check" type="checkbox" ${Number(x.stock)>0?'checked':''} data-chem-owned="${esc(x.id)}"></div>`).join('')||'<div class="nvchem-empty">Chưa có thuốc. Hãy chạy tư vấn AI để tạo danh sách đề xuất.</div>'}</div><div class="nvchem-card"><h3>⚠️ Quy tắc sử dụng</h3><div class="nvchem-note">Không tự tăng liều hoặc rút ngắn khoảng cách. Thời gian tác dụng, PHI và khả năng phối trộn phải lấy từ nhãn/nguồn đã xác minh. Nếu AI chưa có dữ liệu xác minh, kho chỉ hiển thị “Theo nhãn” và không coi đó là hướng dẫn sử dụng.</div></div>`;
    host.querySelectorAll('[data-chem-owned]').forEach(e=>e.addEventListener('change',()=>toggleOwned(e.dataset.chemOwned,e.checked)));
    host.querySelectorAll('[data-chem-filter]').forEach(e=>e.addEventListener('click',()=>{currentTab=e.dataset.chemFilter;render()}));
    host.querySelectorAll('[data-close-chem]').forEach(e=>e.addEventListener('click',close));
  }
  const mo=new MutationObserver(()=>ensureShell()); mo.observe(document.body,{childList:true,subtree:true});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
  setTimeout(ensureShell,800);
})();
