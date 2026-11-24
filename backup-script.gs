/**
 * سكريبت النسخ الاحتياطي — برامج المبرمج محمد سعيد (01123840671)
 * بيتعمل مرة واحدة بس على جيميل المبرمج، ويخدم كل البرامج (مصنع الأمانة، الإخوة، التمساح...)
 *
 * - صاحب المحل يكتب جيميله في البرنامج → يوصله كود تأكيد → يكتبه → خلاص
 * - كل 24 ساعة النسخة توصل على جيميل صاحب المحل مرفقة
 * - ونسخة بتتحفظ في درايف المبرمج (فولدر لكل محل) عشان التطوير والدعم
 */

const ROOT_FOLDER = 'نسخ احتياطية - برامج محمد سعيد';
const KEEP = 60;   // عدد النسخ اللي تفضل لكل محل في الدرايف

function doPost(e) {
  try {
    const b = JSON.parse(e.postData.contents);
    const props = PropertiesService.getScriptProperties();

    // ===== حساب المزامنة: اسم مستخدم + كلمة سر (زي برنامج الإخوة) =====
    if (b.action === 'login' || b.action === 'usync') {
      const id = acctId(b.app, b.user);
      if (!id) return out({ ok: false, err: 'اكتب اسم مستخدم (حروف إنجليزي أو أرقام)' });
      if (b.action === 'login') return out(login(props, id, String(b.pass || '')));
      if (!okTok(props, id, b.token)) return out({ ok: false, err: 'سجّل الدخول تاني', relogin: 1 });
      return out(sync(id, b));
    }

    const email = String(b.email || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return out({ ok: false, err: 'الإيميل غلط' });
    const shop = b.shop || 'البرنامج';

    // 1) طلب كود تأكيد
    if (b.action === 'verify') {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      props.setProperty('code:' + email, code + '|' + Date.now());
      GmailApp.sendEmail(email, 'كود تأكيد النسخ الاحتياطي — ' + shop,
        'كود التأكيد: ' + code + '\n\nاكتب الكود ده في برنامج ' + shop + ' عشان النسخ الاحتياطية توصلك على الإيميل ده كل يوم.\n\nبرمجة المبرمج محمد سعيد — 01123840671',
        { name: shop });
      return out({ ok: true });
    }

    // 2) تأكيد الكود
    if (b.action === 'confirm') {
      const saved = (props.getProperty('code:' + email) || '').split('|');
      if (!saved[0] || saved[0] !== String(b.code).trim()) return out({ ok: false, err: 'الكود غلط' });
      if (Date.now() - Number(saved[1]) > 30 * 60 * 1000) return out({ ok: false, err: 'الكود انتهى — اطلب كود جديد' });
      const token = Utilities.getUuid();
      const toks = getToks(props, email); toks.push(token);
      props.setProperty('toks:' + email, JSON.stringify(toks.slice(-10)));  // لحد 10 أجهزة
      props.deleteProperty('code:' + email);
      return out({ ok: true, token: token });
    }

    // 3) رفع نسخة
    if (b.action === 'backup') {
      if (!okTok(props, email, b.token)) return out({ ok: false, err: 'الإيميل مش متأكد — أكّده تاني' });
      const blob = Utilities.newBlob(b.data, 'application/json', b.name || 'backup.json');
      const folder = shopFolder(shop);
      folder.createFile(blob.copyBlob());
      cleanup(folder);
      GmailApp.sendEmail(email, '💾 نسخة احتياطية — ' + shop + ' — ' + Utilities.formatDate(new Date(), 'Africa/Cairo', 'yyyy-MM-dd'),
        (b.caption || '') + '\n\nالملف مرفق. احتفظ بيه — تقدر ترجّعه من إعدادات البرنامج ← استرجاع نسخة.\n\nبرمجة المبرمج محمد سعيد — 01123840671',
        { attachments: [blob], name: shop });
      return out({ ok: true });
    }
    // 4) مزامنة بين الأجهزة
    if (b.action === 'sync') {
      if (!okTok(props, email, b.token)) return out({ ok: false, err: 'الإيميل مش متأكد — أكّده تاني' });
      return out(sync(email, b));
    }
    return out({ ok: false, err: 'طلب غير معروف' });
  } catch (err) {
    return out({ ok: false, err: String(err) });
  }
}

function acctId(app, user) {
  const u = String(user || '').trim().toLowerCase();
  if (!/^[a-z0-9_.\-]{3,30}$/.test(u)) return '';
  return String(app || 'app').replace(/[^a-z0-9_\-]/gi, '') + '~' + u;
}
function hashPass(pass, salt) {
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + '|' + pass, Utilities.Charset.UTF_8));
}
function login(props, id, pass) {
  if (pass.length < 4) return { ok: false, err: 'كلمة السر لازم 4 حروف أو أرقام على الأقل' };
  const fails = Number(props.getProperty('fail:' + id) || 0);
  if (fails >= 10) return { ok: false, err: 'محاولات غلط كتير — كلم المبرمج 01123840671' };
  const raw = props.getProperty('acct:' + id);
  let created = false;
  if (!raw) {
    const salt = Utilities.getUuid();
    props.setProperty('acct:' + id, JSON.stringify({ salt: salt, h: hashPass(pass, salt), at: Date.now() }));
    created = true;
  } else {
    const a = JSON.parse(raw);
    if (hashPass(pass, a.salt) !== a.h) { props.setProperty('fail:' + id, String(fails + 1)); return { ok: false, err: 'كلمة السر غلط' }; }
    props.deleteProperty('fail:' + id);
  }
  const token = Utilities.getUuid();
  const toks = getToks(props, id); toks.push(token);
  props.setProperty('toks:' + id, JSON.stringify(toks.slice(-10)));
  return { ok: true, token: token, created: created };
}

function getToks(props, email) {
  let t = []; try { t = JSON.parse(props.getProperty('toks:' + email) || '[]'); } catch (e) {}
  const old = props.getProperty('tok:' + email); if (old && t.indexOf(old) < 0) t.push(old);
  return t;
}
function okTok(props, email, tok) { return !!tok && getToks(props, email).indexOf(tok) >= 0; }

// ===== المزامنة: كل سجل (فاتورة/صنف/عميل/حركة) ليه وقت تعديل، والأحدث هو اللي بيكسب =====
function syncFile(email) {
  const r = DriveApp.getFoldersByName(ROOT_FOLDER);
  const root = r.hasNext() ? r.next() : DriveApp.createFolder(ROOT_FOLDER);
  const s = root.getFoldersByName('مزامنة');
  const folder = s.hasNext() ? s.next() : root.createFolder('مزامنة');
  const name = 'sync-' + email + '.json';
  const f = folder.getFilesByName(name);
  return f.hasNext() ? f.next() : folder.createFile(name, JSON.stringify({ rev: 0, recs: {} }), 'application/json');
}
function sync(email, b) {
  const props = PropertiesService.getScriptProperties();
  const changes0 = Array.isArray(b.changes) ? b.changes : [];
  // تشييك سريع: لو مفيش جديد مش محتاجين نفتح ملف الدرايف خالص
  const knownRev = props.getProperty('rev:' + email);
  if (!changes0.length && knownRev !== null && Number(b.since) === Number(knownRev)) return { ok: true, rev: Number(knownRev), recs: [] };
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const file = syncFile(email);
    const st = JSON.parse(file.getBlob().getDataAsString() || '{"rev":0,"recs":{}}');
    const since = Number(b.since) || 0;
    const changes = Array.isArray(b.changes) ? b.changes : [];
    const keep = {};   // سجلات الجهاز كان عنده نسخة أقدم منها — نرجّعها له
    let changed = false;
    if (changes.length) st.rev++;
    changes.forEach(c => {
      const ex = st.recs[c.k];
      if (ex && ex.u > c.u) { keep[c.k] = 1; return; }
      st.recs[c.k] = c.del ? { del: 1, u: c.u, r: st.rev } : { v: c.v, u: c.u, r: st.rev };
      changed = true;
    });
    if (changed) file.setContent(JSON.stringify(st)); else if (changes.length) st.rev--;
    props.setProperty('rev:' + email, String(st.rev));
    const mine = {}; changes.forEach(c => { if (!keep[c.k]) mine[c.k] = 1; });
    const recs = [];
    Object.keys(st.recs).forEach(k => {
      const x = st.recs[k];
      if ((x.r > since && !mine[k]) || keep[k]) recs.push({ k: k, v: x.v, del: x.del || 0, u: x.u });
    });
    return { ok: true, rev: st.rev, recs: recs };
  } finally { lock.releaseLock(); }
}

function doGet() { return out({ ok: true, msg: 'شغال' }); }

function shopFolder(shop) {
  const r = DriveApp.getFoldersByName(ROOT_FOLDER);
  const root = r.hasNext() ? r.next() : DriveApp.createFolder(ROOT_FOLDER);
  const s = root.getFoldersByName(shop);
  return s.hasNext() ? s.next() : root.createFolder(shop);
}
function cleanup(folder) {
  const files = []; const it = folder.getFiles();
  while (it.hasNext()) files.push(it.next());
  files.sort((a, b) => b.getDateCreated() - a.getDateCreated());
  files.slice(KEEP).forEach(f => f.setTrashed(true));
}
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

// شغّلها مرة واحدة من المحرر عشان توافق على الصلاحيات
function authorize() { shopFolder('تجربة'); GmailApp.getAliases(); Logger.log('تمام'); }
