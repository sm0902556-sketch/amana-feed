// مصنع الأمانة — يشتغل من غير نت، ويجيب التحديث أول ما النت يكون موجود
const CACHE='amana-v4';
const LIBS=['https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js','https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/dist/html-to-image.js'];
const FILES=['./index.html','./manifest.json','./banner.jpg','./icon-192.png','./icon-512.png','./icon-maskable.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>Promise.all([
  ...FILES.map(f=>fetch(f,{cache:'reload'}).then(r=>r.ok&&c.put(f,r)).catch(()=>{})),
  ...LIBS.map(f=>c.add(f).catch(()=>{}))])).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const req=e.request,u=new URL(req.url);
  if(req.method!=='GET')return;
  if(u.origin==='https://cdn.jsdelivr.net'){ // المكتبات: من الكاش الأول
    e.respondWith(caches.match(req).then(r=>r||fetch(req).then(n=>{const c=n.clone();caches.open(CACHE).then(x=>x.put(req,c));return n})));return;}
  if(u.origin!==location.origin)return; // سكريبت جوجل وتليجرام يروحوا للنت على طول
  // ملفات البرنامج: من النت الأول دايمًا (عشان التحديث يوصل)، ولو مفيش نت من الكاش
  const isPage=req.mode==='navigate'||u.pathname.endsWith('/')||u.pathname.endsWith('.html');
  const key=isPage?'./index.html':u.pathname.endsWith('version.json')?null:req.url;
  e.respondWith(fetch(u.href,{cache:'no-store',credentials:'same-origin'}).then(r=>{
      if(r.ok&&key){const c=r.clone();caches.open(CACHE).then(x=>x.put(key,c))}return r})
    .catch(()=>caches.match(key||req.url,{ignoreSearch:true}).then(r=>r||caches.match('./index.html'))));
});
