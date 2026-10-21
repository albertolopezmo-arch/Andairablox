package com.almdevil.quizlqsa;

import android.app.Activity;
import android.os.Build;
import android.view.Gravity;
import android.view.View;
import android.view.WindowInsets;
import android.widget.LinearLayout;
import android.widget.FrameLayout;
import com.google.android.gms.ads.AdView;
import com.google.android.gms.ads.AdSize;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import androidx.webkit.JavaScriptReplyProxy;
import java.util.Collections;
import org.json.JSONObject;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;
import android.os.Bundle;
import android.graphics.Color;
import android.net.Uri;
import android.content.ContentValues;
import android.content.Intent;
import android.provider.MediaStore;
import android.util.Base64;
import androidx.core.content.FileProvider;
import java.io.File;
import java.io.OutputStream;
import java.io.FileOutputStream;
import android.webkit.WebView;
import android.webkit.WebSettings;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewClientCompat;

public final class MainActivity extends Activity {
    private WebView web;
    private AdView banner;
    private FrameLayout bannerHost;
    private int bannerWidth=0;
    private boolean adsReady=false;
    private boolean rewardBusy=false;
    // Google demo IDs. Replace app and unit IDs together before publishing.
    private static final String REWARD_UNIT="ca-app-pub-3940256099942544/5224354917";
    private void reply(JavaScriptReplyProxy proxy,String id,boolean earned,String error){
        rewardBusy=false;
        try{JSONObject value=new JSONObject();value.put("id",id);value.put("rewarded",earned);value.put("error",error);proxy.postMessage(value.toString());}catch(Exception ignored){}
    }
    private void showReward(JavaScriptReplyProxy proxy,String id){
        if(rewardBusy){try{JSONObject value=new JSONObject();value.put("id",id);value.put("rewarded",false);value.put("error","Ya hay un vídeo abierto.");proxy.postMessage(value.toString());}catch(Exception ignored){}return;}
        rewardBusy=true;
        MobileAds.initialize(this,status->runOnUiThread(()->{
            if(isFinishing()||isDestroyed()){rewardBusy=false;return;}
            RewardedAd.load(this,REWARD_UNIT,new AdRequest.Builder().build(),new RewardedAdLoadCallback(){
                @Override public void onAdFailedToLoad(LoadAdError error){reply(proxy,id,false,"No hay vídeo disponible. Inténtalo más tarde.");}
                @Override public void onAdLoaded(RewardedAd ad){
                    if(isFinishing()||isDestroyed()){rewardBusy=false;return;}
                    final boolean[] earned={false};
                    ad.setFullScreenContentCallback(new FullScreenContentCallback(){
                        @Override public void onAdDismissedFullScreenContent(){reply(proxy,id,earned[0],earned[0]?"":"Completa el vídeo para cobrar.");}
                        @Override public void onAdFailedToShowFullScreenContent(AdError error){reply(proxy,id,false,"No se pudo abrir el vídeo.");}
                    });
                    ad.show(MainActivity.this,reward->earned[0]=true);
                }
            });
        }));
    }
    private void showInterstitial(JavaScriptReplyProxy proxy,String id){
        if(rewardBusy){try{JSONObject value=new JSONObject();value.put("id",id);value.put("error","Ya hay un anuncio abierto.");proxy.postMessage(value.toString());}catch(Exception ignored){}return;}
        rewardBusy=true;
        MobileAds.initialize(this,status->runOnUiThread(()->{
            if(isFinishing()||isDestroyed()){rewardBusy=false;return;}
            InterstitialAd.load(this,"ca-app-pub-3940256099942544/1033173712",new AdRequest.Builder().build(),new InterstitialAdLoadCallback(){
                @Override public void onAdFailedToLoad(LoadAdError error){reply(proxy,id,false,"No hay anuncio disponible.");}
                @Override public void onAdLoaded(InterstitialAd ad){
                    if(isFinishing()||isDestroyed()){rewardBusy=false;return;}
                    ad.setFullScreenContentCallback(new FullScreenContentCallback(){
                        @Override public void onAdDismissedFullScreenContent(){reply(proxy,id,false,"");}
                        @Override public void onAdFailedToShowFullScreenContent(AdError error){reply(proxy,id,false,"No se pudo abrir el anuncio.");}
                    });
                    ad.show(MainActivity.this);
                }
            });
        }));
    }
    private void handleStoreImage(JavaScriptReplyProxy proxy,JSONObject request){
        String id=request.optString("id"),action=request.optString("action"),name=request.optString("fileName","imagen.png").replaceAll("[^A-Za-z0-9._-]","_");
        Uri savedUri=null;
        try{
            String data=request.getString("dataUrl");int comma=data.indexOf(',');if(comma<0)throw new IllegalArgumentException("Imagen no válida.");
            byte[] bytes=Base64.decode(data.substring(comma+1),Base64.DEFAULT);
            if(bytes.length==0||bytes.length>8*1024*1024)throw new IllegalArgumentException("La imagen supera el tamaño permitido.");
            if(Build.VERSION.SDK_INT>=29){
                ContentValues values=new ContentValues();values.put(MediaStore.Images.Media.DISPLAY_NAME,name);values.put(MediaStore.Images.Media.MIME_TYPE,"image/png");values.put(MediaStore.Images.Media.RELATIVE_PATH,"Pictures/Quiz LQSA");values.put(MediaStore.Images.Media.IS_PENDING,1);
                savedUri=getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI,values);if(savedUri==null)throw new IllegalStateException("No se pudo crear el archivo.");
                try(OutputStream output=getContentResolver().openOutputStream(savedUri)){if(output==null)throw new IllegalStateException("No se pudo escribir la imagen.");output.write(bytes);}
                values.clear();values.put(MediaStore.Images.Media.IS_PENDING,0);getContentResolver().update(savedUri,values,null,null);
            }else{
                File directory=new File(getCacheDir(),"shared-images");if(!directory.exists()&&!directory.mkdirs())throw new IllegalStateException("No se pudo preparar la imagen.");
                File file=new File(directory,name);try(FileOutputStream output=new FileOutputStream(file)){output.write(bytes);}
                savedUri=FileProvider.getUriForFile(this,getPackageName()+".files",file);
            }
            if("share-image".equals(action)){
                Intent send=new Intent(Intent.ACTION_SEND);send.setType("image/png");send.putExtra(Intent.EXTRA_STREAM,savedUri);send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                runOnUiThread(()->startActivity(Intent.createChooser(send,"Compartir sticker")));
            }else if(Build.VERSION.SDK_INT<29){
                Intent send=new Intent(Intent.ACTION_SEND);send.setType("image/png");send.putExtra(Intent.EXTRA_STREAM,savedUri);send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                runOnUiThread(()->startActivity(Intent.createChooser(send,"Guardar o compartir fondo")));
            }
            JSONObject response=new JSONObject();response.put("id",id);response.put("ok",true);proxy.postMessage(response.toString());
        }catch(Exception error){
            if(savedUri!=null&&Build.VERSION.SDK_INT>=29)getContentResolver().delete(savedUri,null,null);
            try{JSONObject response=new JSONObject();response.put("id",id);response.put("ok",false);response.put("error",error.getMessage()==null?"No se pudo guardar la imagen.":error.getMessage());proxy.postMessage(response.toString());}catch(Exception ignored){}
        }
    }
    private void loadBanner(){
        if(!adsReady||bannerHost==null||isFinishing()||isDestroyed())return;
        int width=bannerHost.getWidth()-bannerHost.getPaddingLeft()-bannerHost.getPaddingRight();
        if(width<=0||width==bannerWidth)return;
        bannerWidth=width;
        if(banner!=null){banner.destroy();bannerHost.removeView(banner);}
        banner=new AdView(this);
        banner.setAdUnitId("ca-app-pub-3940256099942544/6300978111");
        int widthDp=Math.max(1,(int)(width/getResources().getDisplayMetrics().density));
        AdSize size=AdSize.getCurrentOrientationAnchoredAdaptiveBannerAdSize(this,widthDp);
        banner.setAdSize(size);
        bannerHost.setMinimumHeight(size.getHeightInPixels(this));
        bannerHost.addView(banner,new FrameLayout.LayoutParams(FrameLayout.LayoutParams.WRAP_CONTENT,FrameLayout.LayoutParams.WRAP_CONTENT,Gravity.CENTER));
        banner.loadAd(new AdRequest.Builder().build());
    }
    @Override public void onCreate(Bundle state){
        super.onCreate(state);
        WebViewAssetLoader loader=new WebViewAssetLoader.Builder()
            .addPathHandler("/",new WebViewAssetLoader.AssetsPathHandler(this)).build();
        web=new WebView(this);web.setBackgroundColor(Color.rgb(250,244,231));
        WebSettings settings=web.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        web.setWebViewClient(new WebViewClientCompat(){
            @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){return loader.shouldInterceptRequest(request.getUrl());}
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){
                String host=request.getUrl().getHost();
                if("appassets.androidplatform.net".equals(host))return false;
                // YouTube's player is a remote iframe. Let its own frame navigate while
                // keeping unrelated top-level navigation outside the app blocked.
                return request.isForMainFrame()||!("youtube-nocookie.com".equals(host)||"www.youtube-nocookie.com".equals(host)||"youtube.com".equals(host)||"www.youtube.com".equals(host));
            }
        });
        if(WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)){
            WebViewCompat.addWebMessageListener(web,"QuizRewardAds",Collections.singleton("https://appassets.androidplatform.net"),(view,message,origin,isMainFrame,proxy)->{
                if(!isMainFrame)return;
                try{JSONObject request=new JSONObject(message.getData());String action=request.optString("action");if("open-url".equals(action)){Uri uri=Uri.parse(request.optString("url"));String host=uri.getHost();if("https".equals(uri.getScheme())&&("youtube.com".equals(host)||"www.youtube.com".equals(host))){runOnUiThread(()->{try{startActivity(new Intent(Intent.ACTION_VIEW,uri));}catch(Exception ignored){}});}return;}String id=request.getString("id");if(id.length()>80)return;if("splash-finished".equals(action)){runOnUiThread(()->{bannerHost.setVisibility(View.VISIBLE);loadBanner();});return;}if("watch".equals(action))runOnUiThread(()->showReward(proxy,id));else if("interstitial".equals(action))runOnUiThread(()->showInterstitial(proxy,id));else if("save-image".equals(action)||"share-image".equals(action))runOnUiThread(()->handleStoreImage(proxy,request));}catch(Exception ignored){}
            });
        }
        LinearLayout layout=new LinearLayout(this);layout.setOrientation(LinearLayout.VERTICAL);layout.setBackgroundColor(Color.BLACK);
        // Reserve separate native space so the banner never overlays the web content.
        layout.addView(web,new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT,0,1));
        bannerHost=new FrameLayout(this);bannerHost.setVisibility(View.GONE);bannerHost.setBackgroundColor(Color.rgb(250,244,231));
        layout.addView(bannerHost,new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT,LinearLayout.LayoutParams.WRAP_CONTENT));
        if(Build.VERSION.SDK_INT>=30){
            getWindow().setDecorFitsSystemWindows(false);
            layout.setOnApplyWindowInsetsListener((view,insets)->{
                android.graphics.Insets bars=insets.getInsets(WindowInsets.Type.systemBars()|WindowInsets.Type.displayCutout());
                view.setPadding(bars.left,bars.top,bars.right,bars.bottom);
                return WindowInsets.CONSUMED;
            });
        }
        setContentView(layout);layout.requestApplyInsets();
        bannerHost.addOnLayoutChangeListener((view,l,t,r,b,ol,ot,or,ob)->loadBanner());
        MobileAds.initialize(this,status->runOnUiThread(()->{adsReady=true;loadBanner();}));
        if(!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER))layout.postDelayed(()->{if(!isFinishing()&&!isDestroyed())bannerHost.setVisibility(View.VISIBLE);},7000);
        web.loadUrl("https://appassets.androidplatform.net/index.html");
    }
    @SuppressWarnings("deprecation") @Override public void onBackPressed(){if(web.canGoBack())web.goBack();else super.onBackPressed();}
    @Override protected void onPause(){if(banner!=null)banner.pause();super.onPause();}
    @Override protected void onResume(){super.onResume();if(banner!=null)banner.resume();}
    @Override protected void onDestroy(){if(banner!=null){banner.destroy();banner=null;}if(web!=null)web.destroy();super.onDestroy();}
}
