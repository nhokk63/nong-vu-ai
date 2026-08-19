(()=>{
'use strict';
const style=document.createElement('style');
style.textContent=`
#nvx-launch,#nv-kho-pro-btn,#nv-regimen-tab{display:none!important}
.nv-clean-tool{width:40px;height:40px;border:1px solid rgba(60,60,67,.14);border-radius:12px;background:#fff;display:grid;place-items:center;box-shadow:0 2px 8px rgba(0,0,0,.05);font-size:20px;line-height:1}
.nv-clean-tool:active{transform:scale(.96)}
.nv-clean-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.18);backdrop-filter:blur(8px);z-index:9990;display:none}
.nv-clean-sheet{position:fixed;left:50%;bottom:0;transform:translateX(-50%);width:min(100%,620px);background:#fff;border-radius:24px 24px 0 0;padding:18px 16px calc(20px + env(safe-area-inset-bottom));z-index:9991;box-shadow:0 -18px 50px rgba(0,0,0,.16);display:none}
.nv-clean-sheet.on,.nv-clean-backdrop.on{display:block}
.nv-clean-title{font-size:22px;font-weight:900;letter-spacing:-.03em}.nv-clean-sub{color:#72757d;font-size:13px;margin-top:4px}
.nv-clean-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}
.nv-clean-action{border:1px solid #e2e4ea;border-radius:16px;background:#f8f9fb;padding:15px;text-align:left;font-weight:850}
.nv-clean-action b{display:block;font-size:15px}.nv-clean-action span{display:block;font-size:11px;color:#72757d;margin-top:5px;font-weight:600}
.nv-clean-action.primary{background:linear-gradient(135deg,#0b7a48,#1b9b64);border-color:transparent;color:#fff}.nv-clean-action.primary span{color:rgba(255,255,255,.82)}
@media(max-width:420px){.nv-clean-actions{grid-template-columns:1fr}}
`;
document.head.appendChild(style);
function setup(){
 const nav=document.querySelector('.nav-actions');
 if(!nav || document.getElementById('nv-clean-tool')) return;
 const b=document.createElement('button');b.id='nv-clean-tool';b.className='nv-clean-tool';b.type='button';b.title='Nhu cầu & vật tư';b.textContent='🧰';
 b.onclick=()=>{
   if(window.NVKhoPro?.open){window.NVKhoPro.open();return;}
   if(window.NVX?.open){window.NVX.open();return;}
   toast('Kho vật tư đang khởi động…');
 };
 nav.appendChild(b);
}
function toast(t){const e=document.createElement('div');e.textContent=t;e.style.cssText='position:fixed;left:50%;bottom:90px;transform:translateX(-50%);background:#111;color:#fff;padding:10px 13px;border-radius:10px;z-index:10050;font-size:12px';document.body.appendChild(e);setTimeout(()=>e.remove(),1800)}
const mo=new MutationObserver(setup);mo.observe(document.body,{childList:true,subtree:true});
setTimeout(setup,400);setTimeout(setup,1200);
})();