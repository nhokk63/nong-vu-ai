(()=>{
'use strict';
const style=document.createElement('style');
style.textContent=`
#nvx-launch,#nv-kho-pro-btn,#nv-regimen-tab{display:none!important}
.nv-clean-tool{width:40px;height:40px;border:1px solid rgba(60,60,67,.14);border-radius:12px;background:#fff;display:grid;place-items:center;box-shadow:0 2px 8px rgba(0,0,0,.05);font-size:19px;line-height:1}
.nv-clean-tool:active{transform:scale(.96)}
.nv-clean-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.20);backdrop-filter:blur(8px);z-index:10040;display:none}
.nv-clean-sheet{position:fixed;left:50%;bottom:0;transform:translateX(-50%);width:min(100%,620px);background:#fff;border-radius:24px 24px 0 0;padding:18px 16px calc(20px + env(safe-area-inset-bottom));z-index:10041;box-shadow:0 -18px 50px rgba(0,0,0,.16);display:none}
.nv-clean-sheet.on,.nv-clean-backdrop.on{display:block}
.nv-clean-head{display:flex;justify-content:space-between;align-items:center;gap:10px}.nv-clean-title{font-size:21px;font-weight:900;letter-spacing:-.03em}.nv-clean-sub{color:#72757d;font-size:12px;margin-top:4px}.nv-clean-close{width:36px;height:36px;border:0;border-radius:12px;background:#f1f2f4;font-size:20px}
.nv-clean-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}
.nv-clean-action{border:1px solid #e2e4ea;border-radius:16px;background:#f8f9fb;padding:15px;text-align:left;font-weight:850;cursor:pointer}
.nv-clean-action b{display:block;font-size:15px}.nv-clean-action span{display:block;font-size:11px;color:#72757d;margin-top:5px;font-weight:600}.nv-clean-action.blue{background:linear-gradient(135deg,#edf5ff,#f7fbff);border-color:#cfe2ff}.nv-clean-action.green{background:linear-gradient(135deg,#ebf9f0,#f7fcf9);border-color:#cfead8}
@media(max-width:420px){.nv-clean-actions{grid-template-columns:1fr}}
`;
document.head.appendChild(style);
let installed=false;
function close(){document.querySelector('.nv-clean-sheet')?.classList.remove('on');document.querySelector('.nv-clean-backdrop')?.classList.remove('on')}
function open(){
 let bd=document.querySelector('.nv-clean-backdrop'),sh=document.querySelector('.nv-clean-sheet');
 if(!bd){bd=document.createElement('div');bd.className='nv-clean-backdrop';bd.onclick=close;document.body.appendChild(bd)}
 if(!sh){sh=document.createElement('div');sh.className='nv-clean-sheet';sh.innerHTML=`<div class="nv-clean-head"><div><div class="nv-clean-title">🧰 Nhu cầu & vật tư</div><div class="nv-clean-sub">Một chỗ để xem cây cần gì, phác đồ và vật tư cần bổ sung.</div></div><button class="nv-clean-close" type="button">×</button></div><div class="nv-clean-actions"><button class="nv-clean-action blue" id="nv-open-needs">🌿 Nhu cầu dinh dưỡng<span>N • P • K • trung vi lượng • vật tư theo giai đoạn</span></button><button class="nv-clean-action green" id="nv-open-stock">🧪 Kho & phác đồ<span>Thuốc, hoạt chất, cữ xử lý, tồn kho và cần mua</span></button></div>`;document.body.appendChild(sh);sh.querySelector('.nv-clean-close').onclick=close;sh.querySelector('#nv-open-stock').onclick=()=>{close();setTimeout(()=>{if(window.NVKhoPro?.open)window.NVKhoPro.open();else document.getElementById('nv-kho-pro-btn')?.click()},80)};sh.querySelector('#nv-open-needs').onclick=()=>{close();setTimeout(()=>{if(document.getElementById('nvx-launch'))document.getElementById('nvx-launch').click()},80)}}
 bd.classList.add('on');sh.classList.add('on');
}
function setup(){
 const nav=document.querySelector('.nav-actions');
 if(!nav || document.getElementById('nv-clean-tool')) return;
 const b=document.createElement('button');b.id='nv-clean-tool';b.className='nv-clean-tool';b.type='button';b.title='Nhu cầu & vật tư';b.textContent='🧰';b.onclick=open;nav.appendChild(b);installed=true;
}
const mo=new MutationObserver(setup);mo.observe(document.body,{childList:true,subtree:true});
setTimeout(setup,250);setTimeout(setup,1000);setTimeout(setup,2200);
})();