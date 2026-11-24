package com.msaeed.amana;

// مصنع الأمانة للأعلاف — برمجة المبرمج محمد سعيد 01123840671
// التطبيق بيفتح البرنامج من الرابط، فأي تحديث على الرابط بيوصل لوحده.

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ContentValues;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.hardware.biometrics.BiometricManager;
import android.hardware.biometrics.BiometricPrompt;
import android.os.CancellationSignal;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.util.Base64;
import android.view.View;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

public class MainActivity extends Activity {
    static final String APP_URL = "https://sm0902556-sketch.github.io/amana-feed/";
    static final String HOST = "sm0902556-sketch.github.io";
    static final int FILE_REQ = 7;
    WebView web;
    ValueCallback<Uri[]> fileCb;
    SharedPreferences prefs;
    boolean unlocked = false, prompting = false;
    long leftAt = 0;
    static final long RELOCK_MS = 30_000;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        Window w = getWindow();
        w.setStatusBarColor(Color.parseColor("#2f5d34"));
        prefs = getSharedPreferences("amana", MODE_PRIVATE);
        web = new WebView(this);
        setContentView(web);
        if (bioLockOn()) { web.setVisibility(View.INVISIBLE); unlock(); } else unlocked = true;
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setSupportMultipleWindows(false);
        s.setUserAgentString(s.getUserAgentString() + " AmanaApp/1.0");
        web.addJavascriptInterface(new Bridge(), "Android");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if (HOST.equals(u.getHost())) return false;
                openExternal(u);
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (fileCb != null) fileCb.onReceiveValue(null);
                fileCb = cb;
                try {
                    startActivityForResult(p.createIntent(), FILE_REQ);
                } catch (ActivityNotFoundException e) {
                    fileCb = null;
                    return false;
                }
                return true;
            }
        });

        if (b != null) web.restoreState(b);
        else web.loadUrl(APP_URL);
    }

    void openExternal(Uri u) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, u));
        } catch (Exception e) {
            toast("مفيش تطبيق يفتح الرابط ده");
        }
    }

    void toast(String m) {
        runOnUiThread(() -> Toast.makeText(this, m, Toast.LENGTH_LONG).show());
    }

    File writeCache(String b64, String name) throws Exception {
        File dir = new File(getCacheDir(), "share");
        dir.mkdirs();
        File f = new File(dir, name.replaceAll("[\\\\/:*?\"<>|]", "_"));
        try (FileOutputStream o = new FileOutputStream(f)) {
            o.write(Base64.decode(b64, Base64.DEFAULT));
        }
        return f;
    }

    class Bridge {
        // إرسال PDF على واتساب — لو فيه رقم بيفتح محادثة العميل على طول
        @JavascriptInterface
        public void sharePdf(String b64, String name, String phone, String text) {
            try {
                File f = writeCache(b64, name);
                Uri uri = Uri.parse("content://" + getPackageName() + ".files/share/" + Uri.encode(f.getName()));
                Intent i = new Intent(Intent.ACTION_SEND);
                i.setType("application/pdf");
                i.putExtra(Intent.EXTRA_STREAM, uri);
                if (text != null && !text.isEmpty()) i.putExtra(Intent.EXTRA_TEXT, text);
                i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                String ph = phone == null ? "" : phone.replaceAll("\\D", "");
                if (ph.startsWith("0")) ph = "2" + ph;
                if (!ph.isEmpty()) {
                    for (String pkg : new String[]{"com.whatsapp", "com.whatsapp.w4b"}) {
                        try {
                            Intent wi = new Intent(i);
                            wi.setPackage(pkg);
                            wi.putExtra("jid", ph + "@s.whatsapp.net");
                            startActivity(wi);
                            return;
                        } catch (ActivityNotFoundException ignored) {
                        }
                    }
                }
                startActivity(Intent.createChooser(i, "إرسال الفاتورة"));
            } catch (Exception e) {
                toast("حصلت مشكلة في إرسال الملف");
            }
        }

        // حفظ ملف (PDF أو نسخة احتياطية) في فولدر التنزيلات
        @JavascriptInterface
        public void saveFile(String b64, String name, String mime) {
            try {
                byte[] data = Base64.decode(b64, Base64.DEFAULT);
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentValues cv = new ContentValues();
                    cv.put(MediaStore.Downloads.DISPLAY_NAME, name);
                    cv.put(MediaStore.Downloads.MIME_TYPE, mime);
                    cv.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/مصنع الأمانة");
                    Uri u = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
                    try (OutputStream o = getContentResolver().openOutputStream(u)) {
                        o.write(data);
                    }
                    toast("✅ اتحفظ في التنزيلات ← مصنع الأمانة: " + name);
                } else {
                    File f = writeCache(b64, name);
                    Uri uri = Uri.parse("content://" + getPackageName() + ".files/share/" + Uri.encode(f.getName()));
                    Intent i = new Intent(Intent.ACTION_SEND);
                    i.setType(mime);
                    i.putExtra(Intent.EXTRA_STREAM, uri);
                    i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    startActivity(Intent.createChooser(i, "حفظ / إرسال الملف"));
                }
            } catch (Exception e) {
                toast("حصلت مشكلة في حفظ الملف");
            }
        }

        // طباعة (أو حفظ PDF من شاشة الطباعة)
        @JavascriptInterface
        public void print(String title) {
            runOnUiThread(() -> {
                PrintManager pm = (PrintManager) getSystemService(PRINT_SERVICE);
                PrintDocumentAdapter ad = web.createPrintDocumentAdapter(title == null ? "مصنع الأمانة" : title);
                pm.print(title == null ? "مصنع الأمانة" : title, ad, new PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4).build());
            });
        }

        @JavascriptInterface
        public String version() {
            return "1.1";
        }

        @JavascriptInterface
        public boolean hasBiometric() { return bioSupported(); }

        @JavascriptInterface
        public boolean getBioLock() { return bioLockOn(); }

        // تشغيل/إيقاف القفل — لازم البصمة الأول للتأكيد
        @JavascriptInterface
        public void setBioLock(boolean on) {
            runOnUiThread(() -> authenticate(on ? "أكّد البصمة لتشغيل القفل" : "أكّد البصمة لإيقاف القفل", ok -> {
                if (ok) prefs.edit().putBoolean("bioLock", on).apply();
                boolean now = bioLockOn();
                web.evaluateJavascript("window.bioLockChanged&&bioLockChanged(" + now + "," + ok + ")", null);
            }));
        }
    }

    // ===================== قفل البصمة =====================
    boolean bioSupported() {
        if (Build.VERSION.SDK_INT < 28) return false;
        if (Build.VERSION.SDK_INT >= 30) {
            BiometricManager bm = getSystemService(BiometricManager.class);
            return bm != null && bm.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_WEAK | BiometricManager.Authenticators.DEVICE_CREDENTIAL) == BiometricManager.BIOMETRIC_SUCCESS;
        }
        if (Build.VERSION.SDK_INT == 29) {
            BiometricManager bm = getSystemService(BiometricManager.class);
            return bm != null && bm.canAuthenticate() == BiometricManager.BIOMETRIC_SUCCESS;
        }
        return getPackageManager().hasSystemFeature(PackageManager.FEATURE_FINGERPRINT);
    }
    boolean bioLockOn() { return prefs.getBoolean("bioLock", false) && bioSupported(); }

    interface Done { void ok(boolean success); }

    void authenticate(String subtitle, Done done) {
        if (Build.VERSION.SDK_INT < 28) { done.ok(true); return; }
        if (prompting) return;
        prompting = true;
        BiometricPrompt.Builder b = new BiometricPrompt.Builder(this)
                .setTitle("مصنع الأمانة")
                .setSubtitle(subtitle);
        if (Build.VERSION.SDK_INT >= 30) {
            b.setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_WEAK | BiometricManager.Authenticators.DEVICE_CREDENTIAL);
        } else if (Build.VERSION.SDK_INT == 29) {
            b.setDeviceCredentialAllowed(true);
        } else {
            b.setNegativeButton("إلغاء", getMainExecutor(), (d, w) -> { prompting = false; done.ok(false); });
        }
        b.build().authenticate(new CancellationSignal(), getMainExecutor(), new BiometricPrompt.AuthenticationCallback() {
            @Override public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult r) { prompting = false; done.ok(true); }
            @Override public void onAuthenticationError(int code, CharSequence msg) { prompting = false; done.ok(false); }
        });
    }

    void unlock() {
        authenticate("افتح البرنامج بالبصمة", ok -> {
            if (ok) { unlocked = true; web.setVisibility(View.VISIBLE); }
            else finish();  // لو لغى البصمة البرنامج يقفل
        });
    }

    @Override
    protected void onStop() { super.onStop(); if (unlocked) leftAt = System.currentTimeMillis(); }

    @Override
    protected void onRestart() {
        super.onRestart();
        if (bioLockOn() && unlocked && leftAt > 0 && System.currentTimeMillis() - leftAt > RELOCK_MS) {
            unlocked = false; web.setVisibility(View.INVISIBLE); unlock();
        }
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        if (req == FILE_REQ && fileCb != null) {
            fileCb.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(res, data));
            fileCb = null;
            return;
        }
        super.onActivityResult(req, res, data);
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onSaveInstanceState(Bundle o) {
        super.onSaveInstanceState(o);
        web.saveState(o);
    }
}
