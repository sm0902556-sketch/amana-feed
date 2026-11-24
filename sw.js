// مصنع الأمانة — يشتغل من غير نت، ويجيب التحديث أول ما النت يكون موجود
const CACHE='amana-v1';
const LIBS=['https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js','https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/dist/html-to-image.js'];
const FILES=['./','./index.html','./manifest.json','./banner.jpg','./icon-192.png','./icon-512.png','./icon-maskable.png',...LIBS];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>Promise.all(FILES.map(f=>c.add(f).catch(()=>{})))).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET')return;
  if(u.origin==='https://cdn.jsdelivr.net'){ // المكتبات: من الكاش الأول
    e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(n=>{const c=n.clone();caches.open(CACHE).then(x=>x.put(e.request,c));return n})));return;}
  if(u.origin!==location.origin)return; // سكريبت جوجل وتليجرام يروحوا للنت على طول
  // ملفات البرنامج: من النت الأول (عشان التحديث يوصل)، ولو مفيش نت من الكاش
  e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{const c=r.clone();caches.open(CACHE).then(x=>x.put(e.request,c));return r})
    .catch(()=>caches.match(e.request,{ignoreSearch:true}).then(r=>r||caches.match('./index.html'))));
});
