(()=>{
'use strict';
const API='https://nong-vu-ai.draculacom1.workers.dev';
const toast=(m,t='info')=>{if(typeof window.toast==='function')return window.toast(m,t);const e=document.createElement('div');e.textContent=m;e.style='position:fixed;left:50%;bottom:90px;transform:translateX(-50%);z-index:99999;background:'+(t==='error'?'#c52a22':'#111')+';color:#fff;padding:11px 14px;border-radius:13px;font-weight:700;max-width:90%;text-align:center';document.body.appendChild(e);setTimeout(()=>e.remove(),2800)};
const clean=()=>{
 document.querySelectorAll('#nv-regimen-tab,#nv-chemical-tab,#nv-regimen-overlay,#nv-chemical-overlay,#nv-kho-pro-btn,#nvx-launch,#nv-clean-tool,#nv-need-tab,#nv-kho-btn,.nv-regimen-tab,.nv-chemical-tab').forEach(e=>e.remove());
 document.querySelectorAll('#app .card').forEach(card=>{const text=(card.textContent||'').replace(/\s+/g,' ');if(text.includes('Vật tư đã đối chiếu')&&text.includes('Chỉ vật tư đã đối chiếu nhãn'))card.remove();if(text.includes('Kho vật tư AI')&&text.includes('AI tự đưa ứng viên'))card.remove();});
};
const addButton=()=>{const actions=document.querySelector('.nav-actions');if(!actions||actions.querySelector('[data-open-needs]'))return;const b=document.createElement('button');b.className='icon-btn';b.type='button';b.dataset.openNeeds='1';b.setAttribute('aria-label','Nhu cầu & vật tư');b.innerHTML='🌿';b.style.fontSize='18px';b.onclick=()=>window.NVNhuCau?.open?window.NVNhuCau.open():toast('Nhu cầu & vật tư đang khởi tạo','info');actions.appendChild(b)};
const json=async r=>{const t=await r.text();let d={};try{d=t?JSON.parse(t):{}}catch{d={}};if(!r.ok)throw new Error(d.error||`HTTP ${r.status}`);return d};
async function deleteInventory(id){
 const d=await json(await fetch(API+'/api/data',{cache:'no-store'}));
 if(!(d.inventory||[]).some(x=>String(x.id)===String(id)))throw new Error('Không tìm thấy vật tư cần xóa');
 await json(await fetch(API+'/api/inventory/'+encodeURIComponent(id),{method:'DELETE',headers:{'Content-Type':'application/json'}}));
 const verify=await json(await fetch(API+'/api/data',{cache:'no-store'}));
 if((verify.inventory||[]).some(x=>String(x.id)===String(id)))throw new Error('D1 vẫn còn vật tư sau khi xóa');
 localStorage.setItem('nv_inventory',JSON.stringify(verify.inventory||[]));
}
document.addEventListener('click',async e=>{const b=e.target.closest('[data-action="delete-inventory"]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();const id=b.dataset.id;if(!id)return;if(!confirm('Xóa vật tư này khỏi danh sách?'))return;b.disabled=true;try{await deleteInventory(id);toast('Đã xóa vật tư khỏi D1','success');setTimeout(()=>location.reload(),180)}catch(err){b.disabled=false;toast(`Không xóa được vật tư: ${err.message}`,'error')}},{capture:true});
const mo=new MutationObserver(()=>{clean();addButton()});
const start=()=>{clean();addButton();mo.observe(document.body,{childList:true,subtree:true})};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
