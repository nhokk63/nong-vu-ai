(()=>{
'use strict';
const ensure=()=>{
  const bottom=document.querySelector('#app .bottom');
  if(!bottom) return false;
  if(bottom.querySelector('[data-needs-tab]')) return true;
  const b=document.createElement('button');
  b.type='button';
  b.className='nv-needs-tab';
  b.dataset.needsTab='1';
  b.setAttribute('aria-label','Nhu cầu & vật tư');
  b.innerHTML='<b>🌿</b><span>Nhu cầu</span>';
  bottom.appendChild(b);
  bottom.style.gridTemplateColumns='repeat(5,minmax(0,1fr))';
  return true;
};
const start=()=>{ensure();new MutationObserver(()=>ensure()).observe(document.body,{childList:true,subtree:true});};
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
})();
