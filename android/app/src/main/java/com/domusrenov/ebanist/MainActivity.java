package com.domusrenov.ebanist;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ContentValues;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.graphics.Insets;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.provider.MediaStore;
import android.speech.RecognizerIntent;
import android.text.Html;
import android.util.Base64;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.Toast;
import android.window.OnBackInvokedDispatcher;

import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URISyntaxException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * Ebanist pe Android: aplicația web într-un WebView propriu.
 *
 * De ce nu TWA: un TWA e Chrome cu altă iconiță. Aici aplicația are
 * ferestrele ei — tipărirea în PDF, salvarea fișierelor, camera, butonul
 * Înapoi și ecranul fără semnal sunt ale aplicației, nu ale browserului.
 *
 * Ce vine de pe site (index.html, service worker-ul) rămâne sursa unică:
 * o versiune nouă a aplicației web ajunge aici fără un .aab nou.
 */
public class MainActivity extends Activity {

    static final String HOST = "ebanist.com";
    static final String START = "https://" + HOST + "/app/";
    /* Adresa încărcată până la versionCode 5 (ROADMAP L.10, D-71). Linkurile
       vechi spre ea se deschid pe HOST; datele de pe ea se mută o singură
       dată, la prima pornire după actualizare (vezi boot()). */
    static final String OLD_HOST = "whimsical-wisp-61cbbf.netlify.app";
    static final String MIGRATE = "/android-migrate.html";
    static final int MIGRATE_TRIES = 3;
    static final int MIGRATE_CHUNK = 256 * 1024;
    static final long MIGRATE_TIMEOUT = 45000;
    static final int BRAND = 0xFF0E3B2A;
    static final int REQ_FILE = 1, REQ_CAMERA = 2, REQ_STORAGE = 3, REQ_SPEECH = 4;

    WebView web;
    View splash;
    ValueCallback<Uri[]> fileCallback;
    PermissionRequest pendingPermission;
    Object[] pendingSave;
    PlayBilling billing;
    boolean pageReady;
    long lastBack;
    boolean offline;
    SharedPreferences prefs;
    volatile boolean migrating;
    volatile String afterMigrate;
    int migrateRun;
    StringBuilder migrateBuf;
    String migrateData;

    /* Rulează după fiecare pagină încărcată. Pune în legătură trei lucruri
       pe care un WebView nu le face singur: window.print(), descărcările din
       blob: / data: și butonul Înapoi care închide întâi foaia deschisă. */
    static final String SHIM =
        "(function(){if(window.__ebShim)return;window.__ebShim=1;" +
        "window.print=function(){EbanistAndroid.print(document.title||'Ebanist');};" +
        /* CSP-ul site-ului (connect-src) nu lasă fetch() pe blob:, deci
           blob-urile se țin minte la creare și se citesc direct. */
        "var B={},co=URL.createObjectURL.bind(URL),rv=URL.revokeObjectURL.bind(URL);" +
        "URL.createObjectURL=function(o){var u=co(o);if(o instanceof Blob)B[u]=o;return u;};" +
        "URL.revokeObjectURL=function(u){setTimeout(function(){delete B[u];rv(u);},60000);};" +
        "function send(n,t,b64){EbanistAndroid.saveFile(n,t||'',b64);}" +
        "function save(a){var h=a.href||'',n=a.getAttribute('download')||'ebanist';" +
        "if(/^data:/.test(h)){var i=h.indexOf(','),head=h.slice(5,i),body=h.slice(i+1),t=head.split(';')[0];" +
        "if(/;base64/.test(head))send(n,t,body);else send(n,t,btoa(unescape(encodeURIComponent(decodeURIComponent(body)))));return true;}" +
        "if(/^blob:/.test(h)){var b=B[h];if(!b){EbanistAndroid.saveFailed();return true;}" +
        "var fr=new FileReader();fr.onload=function(){var s=String(fr.result);send(n,b.type,s.slice(s.indexOf(',')+1));};" +
        "fr.onerror=function(){EbanistAndroid.saveFailed();};fr.readAsDataURL(b);return true;}" +
        "return false;}" +
        "var oc=HTMLAnchorElement.prototype.click;" +
        "HTMLAnchorElement.prototype.click=function(){if(this.hasAttribute('download')&&save(this))return;return oc.apply(this,arguments);};" +
        "document.addEventListener('click',function(e){var a=e.target&&e.target.closest&&e.target.closest('a[download]');" +
        "if(a&&save(a))e.preventDefault();},true);" +
        "window.__ebBack=function(){var s=document.querySelector('.sheet.on');" +
        "if(s&&typeof closeSheets==='function'){closeSheets();return 1;}return 0;};" +
        "})();";

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        prefs = getSharedPreferences("ebanist", MODE_PRIVATE);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(BRAND);
        web = new WebView(this);
        web.setBackgroundColor(BRAND);
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));

        ImageView logo = new ImageView(this);
        logo.setImageResource(R.drawable.logo);
        logo.setScaleType(ImageView.ScaleType.CENTER_INSIDE);
        int px = (int) (160 * getResources().getDisplayMetrics().density);
        FrameLayout sp = new FrameLayout(this);
        sp.setBackgroundColor(BRAND);
        sp.addView(logo, new FrameLayout.LayoutParams(px, px, android.view.Gravity.CENTER));
        splash = sp;
        root.addView(splash, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);

        /* Android 15+ desenează sub barele de sistem. Aplicația web nu știe
           asta, deci îi lăsăm loc: marginile WebView-ului urmează barele și
           tastatura. Fundalul verde rămâne sub bara de stare. */
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            root.setOnApplyWindowInsetsListener((v, ins) -> {
                Insets i = ins.getInsets(WindowInsets.Type.systemBars()
                        | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                ViewGroup.MarginLayoutParams lp = (ViewGroup.MarginLayoutParams) web.getLayoutParams();
                lp.setMargins(i.left, i.top, i.right, i.bottom);
                web.setLayoutParams(lp);
                return WindowInsets.CONSUMED;
            });
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) c.setSystemBarsAppearance(0,
                    WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                    | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS);
        }

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        /* Cotele și tabelele sunt desenate pe mm: mărimea fontului din
           sistem nu trebuie să le rupă rândurile. */
        s.setTextZoom(100);
        s.setUserAgentString(s.getUserAgentString() + " EbanistAndroid/" + BuildConfig.VERSION_NAME);

        billing = new PlayBilling(this, (kind, payload) -> runOnUiThread(() -> web.evaluateJavascript(
                "window.__ebPlay&&window.__ebPlay(" + JSONObject.quote(kind) + "," + JSONObject.quote(payload.toString()) + ")", null)));
        web.addJavascriptInterface(new Bridge(), "EbanistAndroid");
        web.setWebViewClient(new Client());
        web.setWebChromeClient(new Chrome());
        web.setDownloadListener((url, ua, cd, mime, len) -> {
            if (url.startsWith("http")) openExternal(Uri.parse(url));
        });

        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::handleBack);
        }

        new Handler(Looper.getMainLooper()).postDelayed(this::hideSplash, 8000);

        /* Proiectele stau în localStorage-ul site-ului, nu în starea
           ferestrei: la repornire se încarcă mereu aplicația curată. */
        boot(startUrl(getIntent()));
    }

    /* Mutarea pe ebanist.com (L.10). Pentru WebView, adresa veche și cea nouă
       sunt origini diferite: localStorage și IndexedDB („ebanist”: proiectele,
       licența, backup-urile) rămân pe cea veche. O singură dată pe instalare,
       android-migrate.html le citește acolo, le trece prin fișierul
       origin-backup.json din memoria aplicației și scrie pe ebanist.com numai
       cheile care lipsesc. Adresa veche nu se golește: rămâne copia de
       siguranță, alături de fișier. O instalare nouă n-are ce muta. */
    void boot(String url) {
        if (prefs.getBoolean("originMoved", false) || freshInstall()) {
            prefs.edit().putBoolean("originMoved", true).apply();
            web.loadUrl(url);
            return;
        }
        int tries = prefs.getInt("originTries", 0);
        if (tries >= MIGRATE_TRIES) { web.loadUrl(url); return; }
        prefs.edit().putInt("originTries", tries + 1).apply();
        afterMigrate = url;
        migrating = true;
        /* o pagină care nu mai răspunde nu ține aplicația pe loc */
        int run = ++migrateRun;
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            if (migrating && run == migrateRun) migrateEnd("error:timeout");
        }, MIGRATE_TIMEOUT);
        web.loadUrl("https://" + OLD_HOST + MIGRATE);
    }

    boolean freshInstall() {
        try {
            PackageInfo pi = getPackageManager().getPackageInfo(getPackageName(), 0);
            return pi.firstInstallTime == pi.lastUpdateTime;
        } catch (PackageManager.NameNotFoundException e) {
            return false;
        }
    }

    void migrateEnd(String status) {
        if (!migrating) return;
        migrating = false;
        migrateBuf = null;
        migrateData = null;
        if (status != null && status.startsWith("ok")) prefs.edit().putBoolean("originMoved", true).apply();
        String url = afterMigrate != null ? afterMigrate : START;
        runOnUiThread(() -> web.loadUrl(url));
    }

    File migrateFile() { return new File(getFilesDir(), "origin-backup.json"); }

    static boolean isHost(Uri u, String host) {
        return u != null && "https".equals(u.getScheme()) && host.equals(u.getHost());
    }

    /* un link spre adresa veche → aceeași cale pe HOST */
    static String onHost(Uri u) {
        return u.buildUpon().authority(HOST).build().toString();
    }

    String startUrl(Intent i) {
        Uri u = i != null ? i.getData() : null;
        if (isHost(u, HOST)) return u.toString();
        if (isHost(u, OLD_HOST)) return onHost(u);
        return START;
    }

    @Override
    protected void onNewIntent(Intent i) {
        super.onNewIntent(i);
        if (i.getData() == null) return;
        if (migrating) { afterMigrate = startUrl(i); return; }
        web.loadUrl(startUrl(i));
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        /* reînnoiri, anulări, plăți în așteptare finalizate cât aplicația
           era închisă: Play le știe, aplicația web le află acum */
        if (pageReady) billing.restore("resume");
    }

    @Override
    protected void onDestroy() { billing.end(); super.onDestroy(); }

    @Override
    protected void onPause() { web.onPause(); super.onPause(); }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() { handleBack(); }

    /* Înapoi: întâi închide foaia deschisă, apoi istoricul aplicației,
       abia la urmă iese — și numai la a doua apăsare. */
    void handleBack() {
        web.evaluateJavascript("(window.__ebBack&&window.__ebBack())?1:0", r -> {
            if ("1".equals(r)) return;
            if (!offline && web.canGoBack()) { web.goBack(); return; }
            long now = System.currentTimeMillis();
            if (now - lastBack < 2000) { finish(); return; }
            lastBack = now;
            Toast.makeText(this, R.string.press_again, Toast.LENGTH_SHORT).show();
        });
    }

    void hideSplash() {
        if (splash == null || splash.getVisibility() != View.VISIBLE) return;
        splash.animate().alpha(0f).setDuration(250).withEndAction(() -> splash.setVisibility(View.GONE));
    }

    void openExternal(Uri u) {
        if ("intent".equals(u.getScheme())) { openIntentUri(u.toString()); return; }
        if (!tryStart(new Intent(Intent.ACTION_VIEW, u)))
            Toast.makeText(this, R.string.no_app, Toast.LENGTH_SHORT).show();
    }

    boolean tryStart(Intent i) {
        try {
            startActivity(i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            return true;
        } catch (ActivityNotFoundException e) {
            return false;
        }
    }

    /* Linkurile intent:// (butonul AR → Scene Viewer din ARCore). Chrome
       le înțelege singur, WebView-ul nu: ca ACTION_VIEW pe schema
       „intent” nu le deschide nicio aplicație. Se citesc ca în Chrome:
       numai activități BROWSABLE, fără componentă sau selector impuse de
       pagină. Dacă pachetul lipsește (ARCore neinstalat), pagina lui din
       Play, ca în Chrome; apoi browser_fallback_url. */
    void openIntentUri(String s) {
        Intent i;
        try {
            i = Intent.parseUri(s, Intent.URI_INTENT_SCHEME);
        } catch (URISyntaxException e) {
            Toast.makeText(this, R.string.no_app, Toast.LENGTH_SHORT).show();
            return;
        }
        i.addCategory(Intent.CATEGORY_BROWSABLE);
        i.setComponent(null);
        i.setSelector(null);
        if (tryStart(i)) return;
        String pkg = i.getPackage();
        if (pkg != null && tryStart(new Intent(Intent.ACTION_VIEW,
                Uri.parse("market://details?id=" + Uri.encode(pkg))))) return;
        String fb = i.getStringExtra("browser_fallback_url");
        if (fb != null && fb.startsWith("https://")
                && tryStart(new Intent(Intent.ACTION_VIEW, Uri.parse(fb)))) return;
        Toast.makeText(this, R.string.no_app, Toast.LENGTH_SHORT).show();
    }

    void showOffline() {
        offline = true;
        String html = "<!doctype html><html><head><meta name=viewport content='width=device-width,initial-scale=1'>"
            + "<style>body{margin:0;height:100vh;display:flex;align-items:center;justify-content:center;"
            + "background:#0E3B2A;color:#F3EFE6;font-family:sans-serif;text-align:center}"
            + "div{max-width:320px;padding:24px}h1{font-size:22px;color:#D4AF37;font-weight:600}"
            + "p{font-size:15px;line-height:1.5;opacity:.85}"
            + "button{margin-top:18px;background:#D4AF37;color:#0E3B2A;border:0;border-radius:10px;"
            + "padding:12px 28px;font-size:16px;font-weight:600}</style></head><body><div>"
            + "<h1>" + Html.escapeHtml(getString(R.string.offline_title)) + "</h1>"
            + "<p>" + Html.escapeHtml(getString(R.string.offline_text)) + "</p>"
            + "<button onclick='EbanistAndroid.retry()'>" + Html.escapeHtml(getString(R.string.retry)) + "</button>"
            + "</div></body></html>";
        web.loadDataWithBaseURL(null, html, "text/html", "utf-8", null);
        hideSplash();
    }

    class Client extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) {
            Uri u = req.getUrl();
            if (isHost(u, HOST)) return false;
            if (isHost(u, OLD_HOST)) { v.loadUrl(onHost(u)); return true; }
            openExternal(u);
            return true;
        }

        @Override
        public void onPageFinished(WebView v, String url) {
            Uri u = url != null ? Uri.parse(url) : null;
            if (isHost(u, HOST) && !MIGRATE.equals(u.getPath())) {
                offline = false;
                pageReady = true;
                v.evaluateJavascript(SHIM, null);
                hideSplash();
            }
        }

        @Override
        public void onReceivedError(WebView v, WebResourceRequest req, WebResourceError err) {
            if (!req.isForMainFrame()) return;
            /* Fără semnal în timpul mutării: datele rămân pe adresa veche,
               iar „Reîncearcă” o pornește din nou (boot). */
            if (migrating) {
                migrating = false; migrateBuf = null; migrateData = null;
                /* lipsa semnalului nu se numără între cele MIGRATE_TRIES */
                prefs.edit().putInt("originTries", Math.max(0, prefs.getInt("originTries", 1) - 1)).apply();
            }
            showOffline();
        }
    }

    class Chrome extends WebChromeClient {
        @Override
        public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
            if (fileCallback != null) fileCallback.onReceiveValue(null);
            fileCallback = cb;
            try {
                startActivityForResult(p.createIntent(), REQ_FILE);
            } catch (ActivityNotFoundException e) {
                fileCallback = null;
                return false;
            }
            return true;
        }

        @Override
        public void onPermissionRequest(PermissionRequest req) {
            runOnUiThread(() -> {
                Uri o = req.getOrigin();
                if (o == null || !HOST.equals(o.getHost())) { req.deny(); return; }
                List<String> ok = new ArrayList<>();
                for (String r : req.getResources())
                    if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r)) ok.add(r);
                if (ok.isEmpty()) { req.deny(); return; }
                if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                    req.grant(ok.toArray(new String[0]));
                } else {
                    pendingPermission = req;
                    requestPermissions(new String[]{Manifest.permission.CAMERA}, REQ_CAMERA);
                }
            });
        }
    }

    void writeFile(String fname, String mime, byte[] data) {
        try {
            if (Build.VERSION.SDK_INT >= 29) {
                ContentValues cv = new ContentValues();
                cv.put(MediaStore.Downloads.DISPLAY_NAME, fname);
                if (mime != null && !mime.isEmpty()) cv.put(MediaStore.Downloads.MIME_TYPE, mime);
                cv.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Ebanist");
                Uri u = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
                if (u == null) throw new IllegalStateException();
                try (OutputStream os = getContentResolver().openOutputStream(u)) { os.write(data); }
            } else {
                File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "Ebanist");
                if (!dir.isDirectory() && !dir.mkdirs()) throw new IllegalStateException();
                File f = new File(dir, fname);
                for (int n = 1; f.exists(); n++) {
                    int dot = fname.lastIndexOf('.');
                    f = new File(dir, dot > 0 ? fname.substring(0, dot) + " (" + n + ")" + fname.substring(dot) : fname + " (" + n + ")");
                }
                try (OutputStream os = new FileOutputStream(f)) { os.write(data); }
                MediaScannerConnection.scanFile(this, new String[]{f.getAbsolutePath()}, null, null);
            }
            runOnUiThread(() -> Toast.makeText(this, getString(R.string.saved, fname), Toast.LENGTH_LONG).show());
        } catch (Exception e) {
            runOnUiThread(() -> Toast.makeText(this, R.string.save_failed, Toast.LENGTH_SHORT).show());
        }
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] res) {
        super.onRequestPermissionsResult(code, perms, res);
        if (code == REQ_STORAGE && pendingSave != null) {
            Object[] ps = pendingSave;
            pendingSave = null;
            if (res.length > 0 && res[0] == PackageManager.PERMISSION_GRANTED)
                writeFile((String) ps[0], (String) ps[1], (byte[]) ps[2]);
            else Toast.makeText(this, R.string.save_failed, Toast.LENGTH_SHORT).show();
            return;
        }
        if (code != REQ_CAMERA || pendingPermission == null) return;
        PermissionRequest req = pendingPermission;
        pendingPermission = null;
        if (res.length > 0 && res[0] == PackageManager.PERMISSION_GRANTED) {
            req.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
        } else {
            req.deny();
            Toast.makeText(this, R.string.camera_denied, Toast.LENGTH_LONG).show();
        }
    }

    @Override
    @SuppressWarnings("deprecation")
    protected void onActivityResult(int code, int result, Intent data) {
        super.onActivityResult(code, result, data);
        if (code == REQ_FILE && fileCallback != null) {
            fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result, data));
            fileCallback = null;
        }
        if (code == REQ_SPEECH) {
            List<String> r = (result == RESULT_OK && data != null)
                    ? data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS) : null;
            sendSpeech(r != null && !r.isEmpty() ? r.get(0) : "");
        }
    }

    /* Dictarea: WebView-ul nu are Web Speech API (Chrome o avea în TWA).
       Recunoașterea vocală a sistemului nu cere permisiunea de microfon:
       o cere aplicația Google care o face. "" = anulat, null = indisponibil. */
    void startSpeech(String lang) {
        Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
                .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                .putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        if (lang != null && !lang.isEmpty()) i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang);
        try {
            startActivityForResult(i, REQ_SPEECH);
        } catch (ActivityNotFoundException e) {
            sendSpeech(null);
        }
    }

    void sendSpeech(String text) {
        web.evaluateJavascript("window.__ebSpeech&&window.__ebSpeech("
                + (text == null ? "null" : JSONObject.quote(text)) + ")", null);
    }

    /* Punte JS → Android. Se încarcă numai pagini de pe HOST (restul pleacă
       în browser), deci nicio pagină străină nu ajunge la ea. Excepția e
       android-migrate.html pe OLD_HOST, tot a noastră, o singură dată. */
    class Bridge {
        @JavascriptInterface
        public void speech(String lang) { runOnUiThread(() -> startSpeech(lang)); }

        @JavascriptInterface
        public void print(String title) {
            runOnUiThread(() -> {
                String job = (title == null || title.isEmpty()) ? "Ebanist" : title;
                PrintManager pm = (PrintManager) getSystemService(PRINT_SERVICE);
                PrintDocumentAdapter ad = web.createPrintDocumentAdapter(job);
                pm.print(job, ad, new PrintAttributes.Builder()
                        .setMediaSize(PrintAttributes.MediaSize.ISO_A4).build());
            });
        }

        @JavascriptInterface
        public void saveFile(String name, String mime, String b64) {
            String fname = (name == null ? "ebanist" : name).replaceAll("[\\\\/:*?\"<>|]+", "_");
            byte[] data;
            try { data = Base64.decode(b64, Base64.DEFAULT); } catch (Exception e) { saveFailed(); return; }
            if (Build.VERSION.SDK_INT >= 29) { writeFile(fname, mime, data); return; }
            /* Android 7–9: Descărcările publice cer permisiunea de scriere,
               cerută abia la primul export, nu la pornire. */
            runOnUiThread(() -> {
                if (checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED) {
                    writeFile(fname, mime, data);
                } else {
                    pendingSave = new Object[]{fname, mime, data};
                    requestPermissions(new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE}, REQ_STORAGE);
                }
            });
        }

        @JavascriptInterface
        public void saveFailed() {
            runOnUiThread(() -> Toast.makeText(MainActivity.this, R.string.save_failed, Toast.LENGTH_SHORT).show());
        }

        /* ---- Google Play Billing (vezi PlayBilling) ---- */
        @JavascriptInterface
        public String billingAvailable() { return "1"; }

        @JavascriptInterface
        public void billingQuery() { billing.queryProducts(); }

        @JavascriptInterface
        public void billingBuy(String plan) { billing.buy(plan == null ? "" : plan); }

        @JavascriptInterface
        public void billingRestore() { billing.restore("check"); }

        @JavascriptInterface
        public void billingManage() {
            openExternal(Uri.parse("https://play.google.com/store/account/subscriptions?sku="
                    + PlayBilling.PRODUCT_ID + "&package=" + getPackageName()));
        }

        @JavascriptInterface
        public void retry() {
            runOnUiThread(() -> { offline = false; web.clearHistory(); boot(START); });
        }

        /* ---- mutarea datelor pe HOST (android-migrate.html, vezi boot) ----
           Toate tac în afara mutării: nicio pagină nu le poate porni singură. */
        @JavascriptInterface
        public void migrateBegin() { if (migrating) migrateBuf = new StringBuilder(); }

        @JavascriptInterface
        public void migratePut(String part) {
            if (migrating && migrateBuf != null && part != null) migrateBuf.append(part);
        }

        @JavascriptInterface
        public void migrateExported(int items) {
            if (!migrating || migrateBuf == null) return;
            try (OutputStream os = new FileOutputStream(migrateFile())) {
                os.write(migrateBuf.toString().getBytes(StandardCharsets.UTF_8));
            } catch (Exception e) {
                migrateEnd("error:write");
                return;
            }
            migrateBuf = null;
            runOnUiThread(() -> web.loadUrl("https://" + HOST + MIGRATE));
        }

        @JavascriptInterface
        public String migrateSize() {
            if (!migrating) return "0";
            File f = migrateFile();
            byte[] b = new byte[(int) f.length()];
            try (InputStream is = new FileInputStream(f)) {
                int off = 0, n;
                while (off < b.length && (n = is.read(b, off, b.length - off)) > 0) off += n;
            } catch (Exception e) {
                return "0";
            }
            migrateData = new String(b, StandardCharsets.UTF_8);
            return String.valueOf(migrateData.length());
        }

        /* bucata care începe la `from`; nu taie o pereche surrogate (emoji) */
        @JavascriptInterface
        public String migrateGet(int from) {
            String d = migrateData;
            if (!migrating || d == null || from < 0 || from >= d.length()) return "";
            int to = Math.min(d.length(), from + MIGRATE_CHUNK);
            if (to < d.length() && to - from > 1 && Character.isHighSurrogate(d.charAt(to - 1))) to--;
            return d.substring(from, to);
        }

        @JavascriptInterface
        public void migrateFinish(String status) { migrateEnd(status); }
    }
}
