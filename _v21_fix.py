from pathlib import Path

worker = Path('_worker.js')
app = Path('app.js')

w = worker.read_text(encoding='utf-8')
old = "'Access-Control-Allow-Methods':'GET,POST,OPTIONS'"
new = "'Access-Control-Allow-Methods':'GET,POST,DELETE,OPTIONS'"
if old in w:
    w = w.replace(old, new, 1)

plant_marker = "  if(url.pathname==='/api/plants' && request.method==='POST'){"
plant_route = '''  if(url.pathname.startsWith('/api/plants/') && request.method==='DELETE'){
    const id=decodeURIComponent(url.pathname.split('/').pop()||'');
    if(!id) return json({error:'Thiếu plant id'},400);
    if(!env.DB) return json({ok:false,local:true});
    await env.DB.batch([
      env.DB.prepare('DELETE FROM tasks WHERE plant_id=?').bind(id),
      env.DB.prepare('DELETE FROM recommendations WHERE plant_id=?').bind(id),
      env.DB.prepare('DELETE FROM observations WHERE plant_id=?').bind(id),
      env.DB.prepare('DELETE FROM weather_snapshots WHERE plant_id=?').bind(id),
      env.DB.prepare('DELETE FROM plants WHERE id=?').bind(id)
    ]);
    return json({ok:true,deleted:id});
  }
'''
if "request.method==='DELETE'" not in w or "DELETE FROM plants WHERE id=?" not in w:
    if plant_marker not in w:
        raise SystemExit('plant POST marker not found')
    w = w.replace(plant_marker, plant_route + plant_marker, 1)

inv_marker = "  if(url.pathname==='/api/sync' && request.method==='POST'){"
inv_route = '''  if(url.pathname.startsWith('/api/inventory/') && request.method==='DELETE'){
    const id=decodeURIComponent(url.pathname.split('/').pop()||'');
    if(!id) return json({error:'Thiếu inventory id'},400);
    if(!env.DB) return json({ok:false,local:true});
    await env.DB.prepare('DELETE FROM inventory WHERE id=?').bind(id).run();
    return json({ok:true,deleted:id});
  }
'''
if "DELETE FROM inventory WHERE id=?" not in w:
    if inv_marker not in w:
        raise SystemExit('sync marker not found')
    w = w.replace(inv_marker, inv_route + inv_marker, 1)

worker.write_text(w, encoding='utf-8')

a = app.read_text(encoding='utf-8')
old_listener = "$('#app').addEventListener('click',async e=>{\n const tab=e.target.closest('[data-tab]');"
new_listener = "document.addEventListener('click',async e=>{\n if(!e.target.closest('#app')) return;\n const tab=e.target.closest('[data-tab]');"
if old_listener in a:
    a = a.replace(old_listener, new_listener, 1)

old_consult = " else if(action==='consult')consult(a.dataset.id);"
new_consult = " else if(action==='consult'){ toast('Đang mở AI tư vấn…'); consult(a.dataset.id); }"
if old_consult in a:
    a = a.replace(old_consult, new_consult, 1)

app.write_text(a, encoding='utf-8')
print('V21 fixes applied')
