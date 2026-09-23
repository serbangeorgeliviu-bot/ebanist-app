package com.domusrenov.ebanist;

import android.app.Activity;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Collections;
import java.util.List;

/**
 * Abonamentul Ebanist Pro prin Google Play.
 *
 * Un singur abonament, {@link #PRODUCT_ID}, cu două planuri de bază
 * ({@code monthly}, {@code yearly}) create în Play Console. Prețul afișat
 * vine de la Play, în moneda utilizatorului — nu e scris nicăieri în cod.
 *
 * Ce știe aplicația web: numai ce îi spune clasa asta, prin
 * {@code window.__ebPlay(kind, json)}. Play e sursa adevărului: la fiecare
 * pornire și revenire în aplicație se recitesc achizițiile active, iar un
 * abonament anulat sau expirat dispare de aici singur.
 */
final class PlayBilling {

    static final String PRODUCT_ID = "ebanist_pro";

    interface Sink { void send(String kind, JSONObject payload); }

    private final Activity activity;
    private final Sink sink;
    private final BillingClient client;
    private ProductDetails details;
    private boolean ready;
    private Runnable afterConnect;

    PlayBilling(Activity activity, Sink sink) {
        this.activity = activity;
        this.sink = sink;
        this.client = BillingClient.newBuilder(activity)
                .setListener(this::onPurchasesUpdated)
                .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
                .enableAutoServiceReconnection()
                .build();
    }

    /* ---- conexiunea: o dată, apoi ce era de făcut ---- */
    private void whenReady(Runnable r) {
        if (ready && client.isReady()) { r.run(); return; }
        afterConnect = r;
        client.startConnection(new BillingClientStateListener() {
            @Override public void onBillingSetupFinished(BillingResult res) {
                ready = res.getResponseCode() == BillingClient.BillingResponseCode.OK;
                Runnable next = afterConnect; afterConnect = null;
                if (!ready) { fail("products", "unavailable", res); fail("purchases", "unavailable", res); return; }
                if (next != null) next.run();
            }
            @Override public void onBillingServiceDisconnected() { ready = false; }
        });
    }

    /* ---- produsele: planurile cu prețul lor ---- */
    void queryProducts() {
        whenReady(() -> {
            QueryProductDetailsParams p = QueryProductDetailsParams.newBuilder()
                    .setProductList(Collections.singletonList(QueryProductDetailsParams.Product.newBuilder()
                            .setProductId(PRODUCT_ID)
                            .setProductType(BillingClient.ProductType.SUBS).build()))
                    .build();
            client.queryProductDetailsAsync(p, (res, result) -> {
                if (res.getResponseCode() != BillingClient.BillingResponseCode.OK) { fail("products", "error", res); return; }
                List<ProductDetails> list = result.getProductDetailsList();
                details = (list == null || list.isEmpty()) ? null : list.get(0);
                JSONObject out = new JSONObject();
                JSONArray plans = new JSONArray();
                try {
                    if (details != null && details.getSubscriptionOfferDetails() != null) {
                        for (ProductDetails.SubscriptionOfferDetails o : details.getSubscriptionOfferDetails()) {
                            /* numai planul de bază: ofertele promoționale se aleg
                               în Play Console, nu se ghicesc aici */
                            if (o.getOfferId() != null) continue;
                            List<ProductDetails.PricingPhase> ph = o.getPricingPhases().getPricingPhaseList();
                            ProductDetails.PricingPhase last = ph.get(ph.size() - 1);
                            JSONObject j = new JSONObject();
                            j.put("plan", o.getBasePlanId());
                            j.put("price", last.getFormattedPrice());
                            j.put("period", last.getBillingPeriod());
                            j.put("micros", last.getPriceAmountMicros());
                            j.put("currency", last.getPriceCurrencyCode());
                            plans.put(j);
                        }
                    }
                    out.put("ok", true);
                    out.put("plans", plans);
                } catch (Exception e) { fail("products", "error", null); return; }
                sink.send("products", out);
            });
        });
    }

    /* ---- cumpărarea ---- */
    void buy(String plan) {
        whenReady(() -> {
            if (details == null || details.getSubscriptionOfferDetails() == null) {
                fail("purchases", "unavailable", null, "buy"); return;
            }
            String token = null;
            for (ProductDetails.SubscriptionOfferDetails o : details.getSubscriptionOfferDetails())
                if (o.getOfferId() == null && o.getBasePlanId().equals(plan)) token = o.getOfferToken();
            if (token == null) { fail("purchases", "unavailable", null, "buy"); return; }
            BillingFlowParams fp = BillingFlowParams.newBuilder()
                    .setProductDetailsParamsList(Collections.singletonList(
                            BillingFlowParams.ProductDetailsParams.newBuilder()
                                    .setProductDetails(details).setOfferToken(token).build()))
                    .build();
            activity.runOnUiThread(() -> {
                BillingResult r = client.launchBillingFlow(activity, fp);
                if (r.getResponseCode() != BillingClient.BillingResponseCode.OK) fail("purchases", "error", r, "buy");
            });
        });
    }

    /* ---- ce e activ acum (la pornire, la revenire, la „Reverifică”) ---- */
    void restore(String source) {
        whenReady(() -> client.queryPurchasesAsync(
                QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build(),
                (res, purchases) -> {
                    if (res.getResponseCode() != BillingClient.BillingResponseCode.OK) { fail("purchases", "error", res, source); return; }
                    handle(purchases, source);
                }));
    }

    private void onPurchasesUpdated(BillingResult res, List<Purchase> purchases) {
        int code = res.getResponseCode();
        if (code == BillingClient.BillingResponseCode.OK && purchases != null) { handle(purchases, "buy"); return; }
        if (code == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) { restore("buy"); return; }
        fail("purchases", code == BillingClient.BillingResponseCode.USER_CANCELED ? "canceled" : "error", res, "buy");
    }

    /* Un abonament neconfirmat în 3 zile e rambursat automat de Google:
       confirmarea se face aici, imediat ce Play spune PURCHASED. */
    private void handle(List<Purchase> purchases, String source) {
        JSONObject out = new JSONObject();
        JSONArray items = new JSONArray();
        try {
            for (Purchase p : purchases) {
                if (!p.getProducts().contains(PRODUCT_ID)) continue;
                boolean bought = p.getPurchaseState() == Purchase.PurchaseState.PURCHASED;
                if (bought && !p.isAcknowledged()) {
                    client.acknowledgePurchase(AcknowledgePurchaseParams.newBuilder()
                            .setPurchaseToken(p.getPurchaseToken()).build(), r -> { });
                }
                JSONObject j = new JSONObject();
                j.put("productId", PRODUCT_ID);
                j.put("token", p.getPurchaseToken());
                j.put("orderId", p.getOrderId() == null ? "" : p.getOrderId());
                j.put("state", bought ? "purchased"
                        : p.getPurchaseState() == Purchase.PurchaseState.PENDING ? "pending" : "other");
                j.put("autoRenewing", p.isAutoRenewing());
                j.put("time", p.getPurchaseTime());
                items.put(j);
            }
            out.put("ok", true);
            out.put("source", source);
            out.put("items", items);
        } catch (Exception e) { fail("purchases", "error", null, source); return; }
        sink.send("purchases", out);
    }

    private void fail(String kind, String code, BillingResult r) { fail(kind, code, r, "auto"); }

    private void fail(String kind, String code, BillingResult r, String source) {
        try {
            JSONObject j = new JSONObject();
            j.put("ok", false);
            j.put("code", code);
            j.put("source", source);
            if (r != null) j.put("detail", r.getResponseCode() + " " + r.getDebugMessage());
            sink.send(kind, j);
        } catch (Exception ignored) { }
    }

    void end() { try { client.endConnection(); } catch (Exception ignored) { } }
}
