// مصنع الأمانة للأعلاف — نسخة الكمبيوتر
// برمجة المبرمج محمد سعيد 01123840671
// البرنامج بيفتح من الرابط، فأي تحديث بيوصل لوحده، والبيانات محفوظة على الكمبيوتر.
const { app, BrowserWindow, shell, Menu, session } = require('electron');
const path = require('path');
const APP_URL = 'https://sm0902556-sketch.github.io/amana-feed/';
const HOST = 'sm0902556-sketch.github.io';

if (!app.requestSingleInstanceLock()) app.quit();
let win;
function create() {
  win = new BrowserWindow({
    width: 1280, height: 820, minWidth: 900, minHeight: 600,
    title: 'مصنع الأمانة', icon: path.join(__dirname, 'build/icon.png'),
    backgroundColor: '#2f5d34', autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true, spellcheck: false }
  });
  Menu.setApplicationMenu(null);
  win.maximize();
  win.loadURL(APP_URL);
  // أي رابط برّه البرنامج (واتساب، جيميل...) يفتح في المتصفح
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (new URL(url).host !== HOST) { e.preventDefault(); shell.openExternal(url); } });
  win.webContents.on('did-fail-load', () => setTimeout(() => win.loadURL(APP_URL), 4000));
  // F5 تحديث، Ctrl+P طباعة
  win.webContents.on('before-input-event', (e, i) => {
    if (i.type !== 'keyDown') return;
    if (i.key === 'F5') win.webContents.reloadIgnoringCache();
    if (i.key === 'F12' && i.control && i.shift) win.webContents.openDevTools();
  });
}
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
// كل مرة البرنامج يفتح: يمسح ملفات البرنامج القديمة المتخزنة (مش البيانات) عشان ياخد آخر إصدار
app.whenReady().then(async () => {
  try { await session.defaultSession.clearStorageData({ storages: ['serviceworkers', 'cachestorage'] }); } catch (e) {}
  try { await session.defaultSession.clearCache(); } catch (e) {}
  create();
});
app.on('window-all-closed', () => app.quit());
