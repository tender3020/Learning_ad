package com.yizhi.learning;

import android.os.Bundle;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import java.util.concurrent.atomic.AtomicBoolean;

public class MainActivity extends BridgeActivity {
    private final AtomicBoolean textMenuEnabled = new AtomicBoolean(true);

    public class YizhiNativeBridge {
        @JavascriptInterface
        public void setTextMenuEnabled(boolean enabled) {
            textMenuEnabled.set(enabled);
        }
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Window window = getWindow();
        WindowCompat.setDecorFitsSystemWindows(window, false);
        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(window, window.getDecorView());
        if (controller != null) {
            // 隐藏状态栏后，从顶部下滑只会短暂出现电量栏，松手自动收起
            controller.setSystemBarsBehavior(
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            );
        }
        setupWebViewTextMenu();
    }

    @Override
    public void onStart() {
        super.onStart();
        setupWebViewTextMenu();
    }

    private void setupWebViewTextMenu() {
        if (getBridge() == null) {
            return;
        }
        WebView webView = getBridge().getWebView();
        if (webView == null) {
            return;
        }
        webView.removeJavascriptInterface("YizhiNative");
        webView.addJavascriptInterface(new YizhiNativeBridge(), "YizhiNative");
        // 计划卡片长按时吞掉系统「复制 / 全选 / 分享」；阅读页会重新打开
        webView.setOnLongClickListener(v -> !textMenuEnabled.get());
    }
}
