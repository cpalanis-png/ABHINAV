# Keep SmartShieldAndroidBridge JavascriptInterface methods for WebView bridge in release builds
-keepclassmembers class com.smartshield.womensafety.MainActivity$SmartShieldAndroidBridge {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes JavascriptInterface
-keepattributes *Annotation*
