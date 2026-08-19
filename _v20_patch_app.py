from pathlib import Path
import re
p=Path('app.js')
s=p.read_text()
orig=s

needle='<div class="actions"><button class="btn secondary" data-action="consult" data-id="${esc(p.id)}">Tư vấn</button><button class="btn ghost" data-action="update-plant" data-id="${esc(p.id)}">Cập nhật</button></div>'
replacement='<div class="actions"><button class="btn secondary" data-action="consult" data-id="${esc(p.id)}">Tư vấn</button><button class="btn ghost" data-action="update-plant" data-id="${esc(p.id)}">Cập nhật</button><button class="btn danger" data-action="delete-plant" data-id="${esc(p.id)}">Xóa cây</button></div>'
if needle in s:s=s.replace(needle,replacement,1)

s=re.sub(r"function inventoryList\(\)\{.*?\n\}", "function inventoryList(){return state.inventory.length?`<div class=\"list\" style=\"margin-top:10px\">${state.inventory.slice(0,8).map(x=>`<div class=\"item\"><div class=\"row\"><div><div class=\"item-title\">${esc(x.name)}</div><div class=\"item-meta\">${esc(x.active||'')} • ${esc(x.crop||'')} • ${x.label_verified?'Đã đối chiếu':'Chưa đối chiếu'}</div></div><button class=\"btn danger\" data-action=\"delete-inventory\" data-id=\"${esc(x.id)}\">Xóa</button></div></div>`).join('')}</div>`:`<div class=\"empty\" style=\"margin-top:10px\">Chưa có vật tư.</div>`;}", s, count=1, flags=re.S)

old_reject="else if(action==='reject-rec'){try{await api(`/api/recommendations/${encodeURIComponent(r.id)}`,{method:'DELETE'});}catch{} state.recs=state.recs.filter(x=>x.id!==r.id);persistLocal();render();toast('Đã từ chối và xoá khỏi danh sách');}"
new_reject="else if(action==='reject-rec'){try{const out=await api(`/api/recommendations/${encodeURIComponent(r.id)}`,{method:'DELETE'});if(!out.ok)throw new Error('Cloud không xác nhận xóa');}catch(err){toast(`Không xóa được khuyến cáo: ${err.message}`,'error');return;} state.recs=state.recs.filter(x=>x.id!==r.id);persistLocal();render();toast('Đã từ chối và xoá khỏi danh sách');}"
if old_reject in s:s=s.replace(old_reject,new_reject,1)

pat=r"else if\(action==='clear-plans'\)\{.*?\n \}\n else if\(action==='clear-all'\)\{"
rep="""else if(action==='clear-plans'){
  if(confirm('Xóa toàn bộ lịch và khuyến cáo cũ? Cây và vật tư sẽ được giữ lại.')){
    try{const out=await api('/api/data/plans',{method:'DELETE'}); if(!out.ok)throw new Error('Cloud không xác nhận xóa');
      state.recs=[]; state.tasks=[]; localStorage.removeItem('nv_recs'); localStorage.removeItem('nv_tasks'); persistLocal(); await loadData(); render(); toast('Đã xóa sạch lịch và khuyến cáo cũ','success');
    }catch(err){toast(`Không xóa được lịch/khuyến cáo: ${err.message}`,'error');}
  }
 }
 else if(action==='clear-all'){"""
s,n=re.subn(pat,rep,s,count=1,flags=re.S)
if n!=1: raise SystemExit('clear-plans block not found')

pat=r"else if\(action==='clear-all'\)\{.*?\n \}\n else if\(action==='add-inventory'\)"
rep="""else if(action==='clear-all'){
  if(confirm('XÓA TOÀN BỘ dữ liệu trên D1 và điện thoại? Cây, vật tư, lịch, khuyến cáo, quan sát, thời tiết và nhật ký thông báo sẽ bị xóa.')){
    const again=prompt('Nhập XOA để xác nhận:');
    if(again==='XOA'){
      try{const out=await api('/api/data',{method:'DELETE'}); if(!out.ok)throw new Error('Cloud không xác nhận xóa');
        state.plants=[];state.recs=[];state.tasks=[];state.inventory=[];state.weather=null;['nv_plants','nv_recs','nv_tasks','nv_inventory'].forEach(k=>localStorage.removeItem(k)); persistLocal(); await loadData(); render(); toast('Đã xóa TOÀN BỘ dữ liệu','success');
      }catch(err){toast(`Không xóa được dữ liệu: ${err.message}`,'error');}
    }
  }
 }
 else if(action==='delete-plant'){
   const p=state.plants.find(x=>x.id===a.dataset.id); if(!p)return;
   if(!confirm(`Xóa cây “${p.name||cropName(p.crop)}” và toàn bộ lịch/khuyến cáo/quan sát/thời tiết liên quan?`))return;
   try{const out=await api(`/api/plants/${encodeURIComponent(p.id)}`,{method:'DELETE'}); if(!out.ok)throw new Error('Cloud không xác nhận xóa'); state.plants=state.plants.filter(x=>x.id!==p.id); state.recs=state.recs.filter(x=>x.plant_id!==p.id); state.tasks=state.tasks.filter(x=>x.plant_id!==p.id); persistLocal(); await loadData(); render(); toast('Đã xóa cây và dữ liệu liên quan','success');}catch(err){toast(`Không xóa được cây: ${err.message}`,'error');}
 }
 else if(action==='delete-inventory'){
   const i=state.inventory.find(x=>x.id===a.dataset.id); if(!i)return;
   if(!confirm(`Xóa vật tư “${i.name}”?`))return;
   try{const out=await api(`/api/inventory/${encodeURIComponent(i.id)}`,{method:'DELETE'}); if(!out.ok)throw new Error('Cloud không xác nhận xóa'); state.inventory=state.inventory.filter(x=>x.id!==i.id); persistLocal(); await loadData(); render(); toast('Đã xóa vật tư','success');}catch(err){toast(`Không xóa được vật tư: ${err.message}`,'error');}
 }
 else if(action==='add-inventory')"""
s,n=re.subn(pat,rep,s,count=1,flags=re.S)
if n!=1: raise SystemExit('clear-all block not found')

s=s.replace("source:'AI cloud (OpenRouter)'","source:'AI cloud (Groq/OpenRouter)'")
if s==orig: raise SystemExit('No changes made')
for x in ['delete-plant','delete-inventory','Không xóa được dữ liệu','AI cloud (Groq/OpenRouter)']:
    if x not in s: raise SystemExit(f'missing patch marker: {x}')
p.write_text(s)
print('patched',len(s),'bytes')
