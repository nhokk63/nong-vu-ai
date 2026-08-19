const VERSION='nongvu-ai-v21.5';
const CACHE=`${VERSION}-static`;
const STATIC=['./','./index.html','./styles.css?v=36','./boot-guard.js?v=36','./app.js?v=36','./modal-fix.js?v=36','./need-materials.js?v=36','./ui-clean.js?v=36','./chemical-catalog.json?v=20260819','./manifest.json','./knowledge.json','./icon-192.png','./icon-512.png','./icon-180.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(STATIC)).then(()=>self.skipWaiting()).catch(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET') return;
 const url=new URL(req.url);
 if(url.pathname.includes('/api/')){event.respondWith(fetch(req).catch(()=>new Response(JSON.stringify({error:'offline'}),{status:503,headers:{'content-type':'application/json'}})));return;}
 event.respondWith(fetch(req).then(res=>{if(res.ok&&url.origin===location.origin){const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy)).catch(()=>{})}return res}).catch(()=>caches.match(req).then(c=>c||caches.match('./index.html'))));
});
