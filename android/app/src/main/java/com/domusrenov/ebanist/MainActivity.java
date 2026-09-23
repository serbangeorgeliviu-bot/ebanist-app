package com.domusrenov.ebanist;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ContentValues;
import android.content.Intent;
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

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
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

    static final String HOST = "whimsical-wisp-61cbbf.netlify.app";
    static final String START = "https://" + HOST + "/app/";
    static final int BRAND = 0xFF0E3B2A;
    static final int REQ_FILE = 1, REQ_CAMERA = 2, REQ_STORAGE = 3;

    WebView web;
    View splash;
    ValueCallback<Uri[]> fileCallback;
    PermissionRequest pendingPermission;
    Object[] pendingSave;
    long lastBack;
    boolean offline;

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
        web.loadUrl(startUrl(getIntent()));
    }

    String startUrl(Intent i) {
        Uri u = i != null ? i.getData() : null;
        if (u != null && "https".equals(u.getScheme()) && HOST.equals(u.getHost())) return u.toString();
        return START;
    }

    @Override
    protected void onNewIntent(Intent i) {
        super.onNewIntent(i);
        if (i.getData() != null) web.loadUrl(startUrl(i));
    }

    @Override
    protected void onResume() { super.onResume(); web.onResume(); }

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
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, u).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, R.string.no_app, Toast.LENGTH_SHORT).show();
        }
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
            if ("https".equals(u.getScheme()) && HOST.equals(u.getHost())) return false;
            openExternal(u);
            return true;
        }

        @Override
        public void onPageFinished(WebView v, String url) {
            if (url != null && url.startsWith("https://" + HOST)) {
                offline = false;
                v.evaluateJavascript(SHIM, null);
                hideSplash();
            }
        }

        @Override
        public void onReceivedError(WebView v, WebResourceRequest req, WebResourceError err) {
            if (req.isForMainFrame()) showOffline();
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
    }

    /* Punte JS → Android. Se încarcă numai pagini de pe HOST (restul pleacă
       în browser), deci nicio pagină străină nu ajunge la ea. */
    class Bridge {
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

        @JavascriptInterface
        public void retry() {
            runOnUiThread(() -> { offline = false; web.clearHistory(); web.loadUrl(START); });
        }
    }
}
