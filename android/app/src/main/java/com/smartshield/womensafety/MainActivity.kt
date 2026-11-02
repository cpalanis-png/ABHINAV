package com.smartshield.womensafety

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.net.ConnectivityManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Looper
import android.provider.Settings
import android.telephony.SmsManager
import android.webkit.GeolocationPermissions
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import org.json.JSONObject

/**
 * Smart Shield Women Safety — MainActivity
 *
 * Implements:
 * 1. Android Runtime Permission Manager for ACCESS_FINE_LOCATION, ACCESS_COARSE_LOCATION,
 *    CAMERA, and RECORD_AUDIO using ActivityResultContracts.
 * 2. Strict origin-validated WebChromeClient handling onPermissionRequest (camera/microphone),
 *    onPermissionRequestCanceled, and onGeolocationPermissionsShowPrompt (location).
 * 3. Pre-request permission rationale dialogs and permanent-denial recovery actions that open
 *    Settings.ACTION_APPLICATION_DETAILS_SETTINGS.
 * 4. Automatic permission state recheck in onResume() and cleanup of pending requests in onDestroy().
 * 5. SmartShieldAndroidBridge (@JavascriptInterface) for bi-directional synchronization with the
 *    Smart Shield React web application.
 */
class MainActivity : AppCompatActivity() {

    companion object {
        /**
         * Exact trusted HTTPS origins for the Smart Shield Women Safety web application.
         * WebView camera, microphone, and geolocation permissions are NEVER granted to untrusted origins.
         */
        private val TRUSTED_ORIGINS = setOf(
            "https://ais-pre-emvmqd2ko5lz7y7x3yyyrr-751605392223.asia-southeast1.run.app",
            "https://ais-dev-emvmqd2ko5lz7y7x3yyyrr-751605392223.asia-southeast1.run.app"
        )

        private const val PREFS_NAME = "smart_shield_permission_prefs"
        private const val KEY_ASKED_LOCATION = "asked_location"
        private const val KEY_ASKED_CAMERA = "asked_camera"
        private const val KEY_ASKED_MIC = "asked_microphone"
        private const val KEY_ASKED_SMS = "asked_sms"

        private const val ACTION_SMS_SENT = "com.smartshield.womensafety.SMS_SENT"
        private const val ACTION_SMS_DELIVERED = "com.smartshield.womensafety.SMS_DELIVERED"
    }

    private lateinit var webView: WebView
    private lateinit var prefs: SharedPreferences
    private lateinit var fusedLocationClient: FusedLocationProviderClient

    // Pending WebView permission callbacks (cleared on cancel or onDestroy)
    private var pendingWebPermissionRequest: PermissionRequest? = null
    private var pendingGeoCallback: GeolocationPermissions.Callback? = null
    private var pendingGeoOrigin: String? = null

    // Last verified native GPS fix
    @Volatile
    private var lastVerifiedLocation: Location? = null

    // Hardware Magnetometer state for AI Private Space Security Scanner
    private var sensorManager: SensorManager? = null
    private var magnetometerSensor: Sensor? = null
    @Volatile
    private var latestMagX: Float = 0f
    @Volatile
    private var latestMagY: Float = 0f
    @Volatile
    private var latestMagZ: Float = 0f
    @Volatile
    private var hasMagReading: Boolean = false

    private val magnetometerListener = object : SensorEventListener {
        override fun onSensorChanged(event: SensorEvent?) {
            if (event?.sensor?.type == Sensor.TYPE_MAGNETIC_FIELD && event.values.size >= 3) {
                latestMagX = event.values[0]
                latestMagY = event.values[1]
                latestMagZ = event.values[2]
                hasMagReading = true
            }
        }

        override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}
    }

    // ========================================================================
    // 1. RUNTIME PERMISSION LAUNCHERS (ActivityResultContracts)
    // ========================================================================

    /**
     * Launcher for Location permissions (ACCESS_FINE_LOCATION + ACCESS_COARSE_LOCATION).
     * Handles precise grant, approximate-only grant (Android 12+), one-time grant, and denial.
     */
    private val locationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { results ->
        prefs.edit().putBoolean(KEY_ASKED_LOCATION, true).apply()

        val fineGranted = results[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
            hasPermission(Manifest.permission.ACCESS_FINE_LOCATION)
        val coarseGranted = results[Manifest.permission.ACCESS_COARSE_LOCATION] == true ||
            hasPermission(Manifest.permission.ACCESS_COARSE_LOCATION)
        val anyLocationGranted = fineGranted || coarseGranted

        // Resolve any pending WebChromeClient geolocation prompt for a trusted origin
        val callback = pendingGeoCallback
        val origin = pendingGeoOrigin
        pendingGeoCallback = null
        pendingGeoOrigin = null

        if (callback != null && origin != null) {
            if (isTrustedOrigin(origin) && anyLocationGranted) {
                // retain = false so WebView re-verifies OS permission state on future sessions
                callback.invoke(origin, true, false)
            } else {
                callback.invoke(origin, false, false)
            }
        }

        if (anyLocationGranted) {
            fetchFreshNativeLocation()
        }

        pushPermissionStateToWeb()
    }

    /**
     * Launcher for Camera and/or Microphone runtime permissions triggered by either
     * WebChromeClient.onPermissionRequest or SmartShieldAndroidBridge.
     */
    private val mediaPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { _ ->
        val cameraGranted = hasPermission(Manifest.permission.CAMERA)
        val micGranted = hasPermission(Manifest.permission.RECORD_AUDIO)

        // Resolve any pending WebChromeClient.onPermissionRequest
        val webRequest = pendingWebPermissionRequest
        pendingWebPermissionRequest = null

        if (webRequest != null) {
            val requestOrigin = webRequest.origin?.toString()
            if (!isTrustedOrigin(requestOrigin)) {
                webRequest.deny()
            } else {
                val approvedResources = mutableListOf<String>()
                for (resource in webRequest.resources) {
                    when (resource) {
                        PermissionRequest.RESOURCE_VIDEO_CAPTURE -> {
                            if (cameraGranted) approvedResources.add(resource)
                        }
                        PermissionRequest.RESOURCE_AUDIO_CAPTURE -> {
                            if (micGranted) approvedResources.add(resource)
                        }
                    }
                }

                if (approvedResources.isNotEmpty()) {
                    webRequest.grant(approvedResources.toTypedArray())
                } else {
                    webRequest.deny()
                }
            }
        }

        pushPermissionStateToWeb()
    }

    /**
     * Launcher for SEND_SMS runtime permission used for instant SOS emergency SMS alerts.
     */
    private val smsPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { _ ->
        prefs.edit().putBoolean(KEY_ASKED_SMS, true).apply()
        pushPermissionStateToWeb()
    }

    private val smsSentReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            val contactId = intent?.getStringExtra("contactId") ?: return
            val phone = intent.getStringExtra("phone") ?: ""
            when (resultCode) {
                Activity.RESULT_OK -> {
                    pushSmsStatusToWeb(contactId, phone, "submitted", null)
                }
                SmsManager.RESULT_ERROR_GENERIC_FAILURE -> {
                    pushSmsStatusToWeb(contactId, phone, "failed", "Carrier generic SMS failure")
                }
                SmsManager.RESULT_ERROR_NO_SERVICE -> {
                    pushSmsStatusToWeb(contactId, phone, "failed", "No cellular service available")
                }
                SmsManager.RESULT_ERROR_NULL_PDU -> {
                    pushSmsStatusToWeb(contactId, phone, "failed", "Cellular PDU error")
                }
                SmsManager.RESULT_ERROR_RADIO_OFF -> {
                    pushSmsStatusToWeb(contactId, phone, "failed", "Cellular radio / Airplane mode is on")
                }
                else -> {
                    pushSmsStatusToWeb(contactId, phone, "failed", "SMS transmission error (code $resultCode)")
                }
            }
        }
    }

    private val smsDeliveredReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            val contactId = intent?.getStringExtra("contactId") ?: return
            val phone = intent.getStringExtra("phone") ?: ""
            if (resultCode == Activity.RESULT_OK) {
                pushSmsStatusToWeb(contactId, phone, "delivered", null)
            }
        }
    }

    // ========================================================================
    // 2. ACTIVITY LIFECYCLE
    // ========================================================================

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        sensorManager = getSystemService(Context.SENSOR_SERVICE) as? SensorManager
        magnetometerSensor = sensorManager?.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD)

        ContextCompat.registerReceiver(
            this,
            smsSentReceiver,
            IntentFilter(ACTION_SMS_SENT),
            ContextCompat.RECEIVER_NOT_EXPORTED
        )
        ContextCompat.registerReceiver(
            this,
            smsDeliveredReceiver,
            IntentFilter(ACTION_SMS_DELIVERED),
            ContextCompat.RECEIVER_NOT_EXPORTED
        )

        webView = WebView(this)
        setContentView(webView)

        configureWebView()

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })

        // Load the trusted HTTPS Smart Shield web application
        webView.loadUrl(BuildConfig.SMART_SHIELD_WEB_URL)
    }

    /**
     * Recheck permission and location service states every time the Activity resumes
     * (e.g., when returning from Android App Settings or Device Location Settings, or
     * if a permission was revoked or expired after a one-time grant).
     */
    override fun onResume() {
        super.onResume()
        webView.onResume()
        pushPermissionStateToWeb()
        if (isAnyLocationGranted() && isDeviceLocationEnabled()) {
            fetchFreshNativeLocation()
        }
    }

    override fun onPause() {
        try {
            sensorManager?.unregisterListener(magnetometerListener)
        } catch (_: Exception) {
        }
        webView.onPause()
        super.onPause()
    }

    /**
     * Never retain a pending WebView permission request or geolocation callback
     * after the Activity is destroyed.
     */
    override fun onDestroy() {
        try {
            pendingWebPermissionRequest?.deny()
        } catch (_: Exception) {
        }
        pendingWebPermissionRequest = null

        try {
            val callback = pendingGeoCallback
            val origin = pendingGeoOrigin
            if (callback != null && origin != null) {
                callback.invoke(origin, false, false)
            }
        } catch (_: Exception) {
        }
        pendingGeoCallback = null
        pendingGeoOrigin = null

        try {
            unregisterReceiver(smsSentReceiver)
        } catch (_: Exception) {
        }
        try {
            unregisterReceiver(smsDeliveredReceiver)
        } catch (_: Exception) {
        }

        webView.removeJavascriptInterface("SmartShieldAndroidBridge")
        webView.stopLoading()
        webView.webChromeClient = null
        webView.destroy()
        super.onDestroy()
    }

    // ========================================================================
    // 3. WEBVIEW & WEBCHROMECLIENT CONFIGURATION
    // ========================================================================

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView() {
        val settings: WebSettings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.setGeolocationEnabled(true)
        settings.mediaPlaybackRequiresUserGesture = false
        settings.allowFileAccess = false
        settings.allowContentAccess = false
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW

        // Register the native Android permission & location bridge for trusted origins
        webView.addJavascriptInterface(SmartShieldAndroidBridge(), "SmartShieldAndroidBridge")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?
            ): Boolean {
                val url = request?.url ?: return false
                val scheme = url.scheme?.lowercase() ?: return false

                // Handle emergency phone dialer (tel:112, tel:1091, etc.) and SMS intents natively
                if (scheme == "tel" || scheme == "sms" || scheme == "mailto") {
                    return try {
                        startActivity(Intent(Intent.ACTION_VIEW, url))
                        true
                    } catch (_: Exception) {
                        true
                    }
                }

                // Open external non-Smart-Shield links (e.g. Google Maps share links) in external browser/maps app
                if (scheme == "https" && !isTrustedOrigin(url.toString())) {
                    return try {
                        startActivity(Intent(Intent.ACTION_VIEW, url))
                        true
                    } catch (_: Exception) {
                        false
                    }
                }

                // Block insecure HTTP navigation
                if (scheme != "https") {
                    return true
                }

                return false
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                if (isTrustedOrigin(url)) {
                    pushPermissionStateToWeb()
                }
            }
        }

        webView.webChromeClient = object : WebChromeClient() {

            /**
             * Handles Web camera (RESOURCE_VIDEO_CAPTURE) and microphone (RESOURCE_AUDIO_CAPTURE)
             * requests from navigator.mediaDevices.getUserMedia() or Web Speech API.
             */
            override fun onPermissionRequest(request: PermissionRequest?) {
                if (request == null) return

                runOnUiThread {
                    if (isFinishing || isDestroyed) {
                        request.deny()
                        return@runOnUiThread
                    }

                    val origin = request.origin?.toString()
                    if (!isTrustedOrigin(origin)) {
                        // Never grant camera/microphone access to untrusted origins
                        request.deny()
                        return@runOnUiThread
                    }

                    // Map requested web resources strictly to supported Android runtime permissions
                    val requestedWebResources = request.resources ?: emptyArray()
                    val requiredAndroidPermissions = mutableListOf<String>()
                    var supportsAtLeastOneResource = false

                    for (res in requestedWebResources) {
                        when (res) {
                            PermissionRequest.RESOURCE_VIDEO_CAPTURE -> {
                                supportsAtLeastOneResource = true
                                if (!hasPermission(Manifest.permission.CAMERA)) {
                                    requiredAndroidPermissions.add(Manifest.permission.CAMERA)
                                }
                            }
                            PermissionRequest.RESOURCE_AUDIO_CAPTURE -> {
                                supportsAtLeastOneResource = true
                                if (!hasPermission(Manifest.permission.RECORD_AUDIO)) {
                                    requiredAndroidPermissions.add(Manifest.permission.RECORD_AUDIO)
                                }
                            }
                        }
                    }

                    // Deny immediately if the request contains no supported media resources
                    if (!supportsAtLeastOneResource) {
                        request.deny()
                        return@runOnUiThread
                    }

                    // If all required Android permissions are already granted, approve only the
                    // supported resources requested by this trusted origin
                    if (requiredAndroidPermissions.isEmpty()) {
                        val approved = requestedWebResources.filter {
                            (it == PermissionRequest.RESOURCE_VIDEO_CAPTURE && hasPermission(Manifest.permission.CAMERA)) ||
                                (it == PermissionRequest.RESOURCE_AUDIO_CAPTURE && hasPermission(Manifest.permission.RECORD_AUDIO))
                        }
                        if (approved.isNotEmpty()) {
                            request.grant(approved.toTypedArray())
                        } else {
                            request.deny()
                        }
                        return@runOnUiThread
                    }

                    // Cancel any earlier unfinished request before storing the new one
                    pendingWebPermissionRequest?.deny()
                    pendingWebPermissionRequest = request

                    // Record which permissions are being requested so we can detect permanent denial
                    if (requiredAndroidPermissions.contains(Manifest.permission.CAMERA)) {
                        prefs.edit().putBoolean(KEY_ASKED_CAMERA, true).apply()
                    }
                    if (requiredAndroidPermissions.contains(Manifest.permission.RECORD_AUDIO)) {
                        prefs.edit().putBoolean(KEY_ASKED_MIC, true).apply()
                    }

                    val needsRationale = requiredAndroidPermissions.any { perm ->
                        ActivityCompat.shouldShowRequestPermissionRationale(this@MainActivity, perm)
                    }

                    if (needsRationale) {
                        showMediaPermissionRationaleDialog(
                            permissions = requiredAndroidPermissions.distinct().toTypedArray(),
                            onCancel = {
                                pendingWebPermissionRequest?.deny()
                                pendingWebPermissionRequest = null
                                pushPermissionStateToWeb()
                            }
                        )
                    } else {
                        mediaPermissionLauncher.launch(requiredAndroidPermissions.distinct().toTypedArray())
                    }
                }
            }

            /**
             * Clears pendingWebPermissionRequest if the web page cancels the permission request.
             */
            override fun onPermissionRequestCanceled(request: PermissionRequest?) {
                super.onPermissionRequestCanceled(request)
                runOnUiThread {
                    if (pendingWebPermissionRequest == request) {
                        pendingWebPermissionRequest = null
                    }
                }
            }

            /**
             * Handles Web geolocation requests (navigator.geolocation.getCurrentPosition / watchPosition).
             */
            override fun onGeolocationPermissionsShowPrompt(
                origin: String?,
                callback: GeolocationPermissions.Callback?
            ) {
                if (callback == null) return

                runOnUiThread {
                    if (isFinishing || isDestroyed) {
                        callback.invoke(origin, false, false)
                        return@runOnUiThread
                    }

                    if (!isTrustedOrigin(origin)) {
                        // Never grant geolocation to untrusted websites
                        callback.invoke(origin, false, false)
                        return@runOnUiThread
                    }

                    if (isAnyLocationGranted()) {
                        callback.invoke(origin, true, false)
                        return@runOnUiThread
                    }

                    // Store callback and request Android runtime location permissions first
                    pendingGeoCallback = callback
                    pendingGeoOrigin = origin
                    requestAndroidLocationPermissionWithRationale(
                        onCancel = {
                            pendingGeoCallback?.invoke(origin, false, false)
                            pendingGeoCallback = null
                            pendingGeoOrigin = null
                            pushPermissionStateToWeb()
                        }
                    )
                }
            }

            override fun onGeolocationPermissionsHidePrompt() {
                super.onGeolocationPermissionsHidePrompt()
                runOnUiThread {
                    pendingGeoCallback = null
                    pendingGeoOrigin = null
                }
            }
        }
    }

    // ========================================================================
    // 4. ORIGIN VALIDATION & PERMISSION HELPERS
    // ========================================================================

    /**
     * Validates that the requesting URL or origin matches an exact trusted HTTPS Smart Shield origin.
     */
    private fun isTrustedOrigin(originOrUrl: String?): Boolean {
        if (originOrUrl.isNullOrBlank()) return false
        return try {
            val uri = Uri.parse(originOrUrl.trim())
            val scheme = uri.scheme?.lowercase() ?: return false
            val host = uri.host?.lowercase() ?: return false
            if (scheme != "https") return false
            val normalizedOrigin = if (uri.port != -1 && uri.port != 443) {
                "$scheme://$host:${uri.port}"
            } else {
                "$scheme://$host"
            }
            TRUSTED_ORIGINS.contains(normalizedOrigin)
        } catch (_: Exception) {
            false
        }
    }

    private fun hasPermission(permission: String): Boolean {
        return ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED
    }

    private fun isAnyLocationGranted(): Boolean {
        return hasPermission(Manifest.permission.ACCESS_FINE_LOCATION) ||
            hasPermission(Manifest.permission.ACCESS_COARSE_LOCATION)
    }

    private fun isDeviceLocationEnabled(): Boolean {
        return try {
            val lm = getSystemService(Context.LOCATION_SERVICE) as LocationManager
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                lm.isLocationEnabled
            } else {
                lm.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
                    lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
            }
        } catch (_: Exception) {
            false
        }
    }

    /**
     * Detects whether a permission is permanently denied ("Don't ask again" / denied twice on Android 11+):
     * True when the permission is currently not granted, has been requested at least once,
     * and shouldShowRequestPermissionRationale() returns false.
     */
    private fun isPermissionPermanentlyDenied(permission: String, askedPrefKey: String): Boolean {
        if (hasPermission(permission)) return false
        val wasAskedBefore = prefs.getBoolean(askedPrefKey, false)
        if (!wasAskedBefore) return false
        return !ActivityCompat.shouldShowRequestPermissionRationale(this, permission)
    }

    private fun requestAndroidLocationPermissionWithRationale(onCancel: (() -> Unit)? = null) {
        val permissions = arrayOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION
        )

        val shouldShowRationale = ActivityCompat.shouldShowRequestPermissionRationale(
            this,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) || ActivityCompat.shouldShowRequestPermissionRationale(
            this,
            Manifest.permission.ACCESS_COARSE_LOCATION
        )

        if (shouldShowRationale) {
            AlertDialog.Builder(this)
                .setTitle("Location Access Needed for Safety")
                .setMessage(
                    "Smart Shield needs access to your phone's GPS location so it can attach your " +
                        "verified coordinates to emergency SOS alerts, monitor your safety perimeter, " +
                        "and find nearby police stations and hospitals."
                )
                .setCancelable(false)
                .setPositiveButton("Continue") { _, _ ->
                    prefs.edit().putBoolean(KEY_ASKED_LOCATION, true).apply()
                    locationPermissionLauncher.launch(permissions)
                }
                .setNegativeButton("Not Now") { dialog, _ ->
                    dialog.dismiss()
                    onCancel?.invoke()
                }
                .show()
        } else {
            prefs.edit().putBoolean(KEY_ASKED_LOCATION, true).apply()
            locationPermissionLauncher.launch(permissions)
        }
    }

    private fun showMediaPermissionRationaleDialog(
        permissions: Array<String>,
        onCancel: (() -> Unit)? = null
    ) {
        val needsCam = permissions.contains(Manifest.permission.CAMERA)
        val needsMic = permissions.contains(Manifest.permission.RECORD_AUDIO)

        val title = when {
            needsCam && needsMic -> "Camera & Microphone Access Needed"
            needsCam -> "Camera Access Needed for SOS Evidence"
            else -> "Microphone Access Needed for Voice & SOS"
        }

        val message = when {
            needsCam && needsMic ->
                "Smart Shield uses your camera and microphone during an SOS emergency to record " +
                    "tamper-evident video and audio evidence into your local vault."
            needsCam ->
                "Smart Shield uses your camera during an SOS emergency to capture video evidence " +
                    "into your encrypted device vault."
            else ->
                "Smart Shield uses your microphone for hands-free Voice SOS ('Smart Shield Help'), " +
                    "voice questions to the Safety AI Assistant, and SOS audio evidence recording."
        }

        AlertDialog.Builder(this)
            .setTitle(title)
            .setMessage(message)
            .setCancelable(false)
            .setPositiveButton("Continue") { _, _ ->
                mediaPermissionLauncher.launch(permissions)
            }
            .setNegativeButton("Not Now") { dialog, _ ->
                dialog.dismiss()
                onCancel?.invoke()
            }
            .show()
    }

    // ========================================================================
    // 5. NATIVE GPS ACQUISITION (FusedLocationProvider + LocationManager Fallback)
    // ========================================================================

    @SuppressLint("MissingPermission")
    private fun fetchFreshNativeLocation() {
        if (!isAnyLocationGranted() || !isDeviceLocationEnabled()) return

        val priority = if (hasPermission(Manifest.permission.ACCESS_FINE_LOCATION)) {
            Priority.PRIORITY_HIGH_ACCURACY
        } else {
            Priority.PRIORITY_BALANCED_POWER_ACCURACY
        }

        try {
            val tokenSource = CancellationTokenSource()
            fusedLocationClient.getCurrentLocation(priority, tokenSource.token)
                .addOnSuccessListener { location: Location? ->
                    if (location != null && isValidCoordinate(location.latitude, location.longitude)) {
                        lastVerifiedLocation = location
                        pushLocationToWeb(location, "android-fused")
                    } else {
                        fallbackToLocationManager()
                    }
                }
                .addOnFailureListener {
                    fallbackToLocationManager()
                }
        } catch (_: Exception) {
            fallbackToLocationManager()
        }
    }

    @SuppressLint("MissingPermission")
    private fun fallbackToLocationManager() {
        if (!isAnyLocationGranted()) return
        try {
            val lm = getSystemService(Context.LOCATION_SERVICE) as LocationManager
            val provider = when {
                hasPermission(Manifest.permission.ACCESS_FINE_LOCATION) &&
                    lm.isProviderEnabled(LocationManager.GPS_PROVIDER) -> LocationManager.GPS_PROVIDER
                lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER) -> LocationManager.NETWORK_PROVIDER
                else -> null
            } ?: return

            lm.requestSingleUpdate(
                provider,
                object : LocationListener {
                    override fun onLocationChanged(location: Location) {
                        if (isValidCoordinate(location.latitude, location.longitude)) {
                            lastVerifiedLocation = location
                            pushLocationToWeb(location, "android-location-manager")
                        }
                    }
                    @Deprecated("Deprecated in Java")
                    override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
                    override fun onProviderEnabled(provider: String) {}
                    override fun onProviderDisabled(provider: String) {}
                },
                Looper.getMainLooper()
            )
        } catch (_: Exception) {
        }
    }

    private fun isValidCoordinate(lat: Double, lng: Double): Boolean {
        if (lat.isNaN() || lng.isNaN()) return false
        if (lat == 0.0 && lng == 0.0) return false
        return lat in -90.0..90.0 && lng in -180.0..180.0
    }

    // ========================================================================
    // 6. WEBVIEW JAVASCRIPT BRIDGE & STATE SYNCHRONIZATION
    // ========================================================================

    private fun buildPermissionStateJson(): String {
        val fineGranted = hasPermission(Manifest.permission.ACCESS_FINE_LOCATION)
        val coarseGranted = hasPermission(Manifest.permission.ACCESS_COARSE_LOCATION)
        val cameraGranted = hasPermission(Manifest.permission.CAMERA)
        val micGranted = hasPermission(Manifest.permission.RECORD_AUDIO)
        val smsGranted = hasPermission(Manifest.permission.SEND_SMS)
        val locationEnabled = isDeviceLocationEnabled()

        val locationPermDenied = !fineGranted && !coarseGranted &&
            isPermissionPermanentlyDenied(Manifest.permission.ACCESS_COARSE_LOCATION, KEY_ASKED_LOCATION)
        val cameraPermDenied = !cameraGranted &&
            isPermissionPermanentlyDenied(Manifest.permission.CAMERA, KEY_ASKED_CAMERA)
        val micPermDenied = !micGranted &&
            isPermissionPermanentlyDenied(Manifest.permission.RECORD_AUDIO, KEY_ASKED_MIC)
        val smsPermDenied = !smsGranted &&
            isPermissionPermanentlyDenied(Manifest.permission.SEND_SMS, KEY_ASKED_SMS)

        return JSONObject().apply {
            put("fineLocationGranted", fineGranted)
            put("coarseLocationGranted", coarseGranted)
            put("cameraGranted", cameraGranted)
            put("microphoneGranted", micGranted)
            put("smsGranted", smsGranted)
            put("locationServicesEnabled", locationEnabled)
            put("locationPermanentlyDenied", locationPermDenied)
            put("cameraPermanentlyDenied", cameraPermDenied)
            put("microphonePermanentlyDenied", micPermDenied)
            put("smsPermanentlyDenied", smsPermDenied)
            put("packageName", applicationContext.packageName)
            put("sdkInt", Build.VERSION.SDK_INT)
        }.toString()
    }

    private fun pushSmsStatusToWeb(
        contactId: String,
        phone: String,
        status: String,
        errorReason: String?
    ) {
        runOnUiThread {
            if (isFinishing || isDestroyed) return@runOnUiThread
            val currentUrl = webView.url
            if (!isTrustedOrigin(currentUrl)) return@runOnUiThread

            val json = JSONObject().apply {
                put("contactId", contactId)
                put("phone", phone)
                put("status", status)
                put("channel", "android-sms-manager")
                put("timestamp", System.currentTimeMillis())
                if (!errorReason.isNullOrBlank()) {
                    put("errorReason", errorReason)
                }
            }.toString()

            val escaped = JSONObject.quote(json)
            webView.evaluateJavascript(
                "if (window.onAndroidSmsStatusUpdate) { window.onAndroidSmsStatusUpdate($escaped); }",
                null
            )
        }
    }

    private fun pushPermissionStateToWeb() {
        runOnUiThread {
            if (isFinishing || isDestroyed) return@runOnUiThread
            val currentUrl = webView.url
            if (!isTrustedOrigin(currentUrl)) return@runOnUiThread
            val json = buildPermissionStateJson()
            val escaped = JSONObject.quote(json)
            webView.evaluateJavascript(
                "if (window.onAndroidPermissionUpdate) { window.onAndroidPermissionUpdate($escaped); }",
                null
            )
        }
    }

    private fun pushLocationToWeb(location: Location, providerTag: String) {
        runOnUiThread {
            if (isFinishing || isDestroyed) return@runOnUiThread
            val currentUrl = webView.url
            if (!isTrustedOrigin(currentUrl)) return@runOnUiThread

            val json = JSONObject().apply {
                put("latitude", location.latitude)
                put("longitude", location.longitude)
                put("accuracy", location.accuracy.toDouble())
                put("timestamp", location.time)
                put("provider", providerTag)
                put("isMock", if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) location.isMock else location.isFromMockProvider)
                put("permissionStatus", "granted")
                put("precision", if (hasPermission(Manifest.permission.ACCESS_FINE_LOCATION)) "precise" else "approximate")
            }.toString()

            val escaped = JSONObject.quote(json)
            webView.evaluateJavascript(
                "if (window.onAndroidLocationUpdate) { window.onAndroidLocationUpdate($escaped); }",
                null
            )
        }
    }

    /**
     * JavaScript interface exposed as `window.SmartShieldAndroidBridge` to the trusted Smart Shield web app.
     */
    inner class SmartShieldAndroidBridge {

        @JavascriptInterface
        fun getPermissionStateJson(): String {
            return buildPermissionStateJson()
        }

        @JavascriptInterface
        fun requestLocationPermission() {
            runOnUiThread {
                if (isFinishing || isDestroyed) return@runOnUiThread
                if (hasPermission(Manifest.permission.ACCESS_FINE_LOCATION)) {
                    pushPermissionStateToWeb()
                    fetchFreshNativeLocation()
                    return@runOnUiThread
                }
                requestAndroidLocationPermissionWithRationale()
            }
        }

        @JavascriptInterface
        fun requestCameraPermission() {
            runOnUiThread {
                if (isFinishing || isDestroyed) return@runOnUiThread
                if (hasPermission(Manifest.permission.CAMERA)) {
                    pushPermissionStateToWeb()
                    return@runOnUiThread
                }
                prefs.edit().putBoolean(KEY_ASKED_CAMERA, true).apply()
                val perms = arrayOf(Manifest.permission.CAMERA)
                if (ActivityCompat.shouldShowRequestPermissionRationale(this@MainActivity, Manifest.permission.CAMERA)) {
                    showMediaPermissionRationaleDialog(perms)
                } else {
                    mediaPermissionLauncher.launch(perms)
                }
            }
        }

        @JavascriptInterface
        fun requestMicrophonePermission() {
            runOnUiThread {
                if (isFinishing || isDestroyed) return@runOnUiThread
                if (hasPermission(Manifest.permission.RECORD_AUDIO)) {
                    pushPermissionStateToWeb()
                    return@runOnUiThread
                }
                prefs.edit().putBoolean(KEY_ASKED_MIC, true).apply()
                val perms = arrayOf(Manifest.permission.RECORD_AUDIO)
                if (ActivityCompat.shouldShowRequestPermissionRationale(this@MainActivity, Manifest.permission.RECORD_AUDIO)) {
                    showMediaPermissionRationaleDialog(perms)
                } else {
                    mediaPermissionLauncher.launch(perms)
                }
            }
        }

        @JavascriptInterface
        fun requestMediaPermissions() {
            runOnUiThread {
                if (isFinishing || isDestroyed) return@runOnUiThread
                val missing = mutableListOf<String>()
                if (!hasPermission(Manifest.permission.CAMERA)) {
                    missing.add(Manifest.permission.CAMERA)
                    prefs.edit().putBoolean(KEY_ASKED_CAMERA, true).apply()
                }
                if (!hasPermission(Manifest.permission.RECORD_AUDIO)) {
                    missing.add(Manifest.permission.RECORD_AUDIO)
                    prefs.edit().putBoolean(KEY_ASKED_MIC, true).apply()
                }
                if (missing.isEmpty()) {
                    pushPermissionStateToWeb()
                    return@runOnUiThread
                }
                val perms = missing.toTypedArray()
                val needsRationale = perms.any {
                    ActivityCompat.shouldShowRequestPermissionRationale(this@MainActivity, it)
                }
                if (needsRationale) {
                    showMediaPermissionRationaleDialog(perms)
                } else {
                    mediaPermissionLauncher.launch(perms)
                }
            }
        }

        @JavascriptInterface
        fun getNativeLocationJson(): String {
            val loc = lastVerifiedLocation ?: return ""
            return JSONObject().apply {
                put("latitude", loc.latitude)
                put("longitude", loc.longitude)
                put("accuracy", loc.accuracy.toDouble())
                put("timestamp", loc.time)
                put("provider", loc.provider ?: "android-fused")
                put("isMock", if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) loc.isMock else loc.isFromMockProvider)
                put("permissionStatus", if (isAnyLocationGranted()) "granted" else "denied")
                put("precision", if (hasPermission(Manifest.permission.ACCESS_FINE_LOCATION)) "precise" else "approximate")
            }.toString()
        }

        @JavascriptInterface
        fun requestFreshNativeLocation() {
            runOnUiThread {
                if (isAnyLocationGranted()) {
                    fetchFreshNativeLocation()
                } else {
                    requestAndroidLocationPermissionWithRationale()
                }
            }
        }

        @JavascriptInterface
        fun openAppSettings() {
            runOnUiThread {
                try {
                    val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                        data = Uri.fromParts("package", applicationContext.packageName, null)
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    startActivity(intent)
                } catch (_: Exception) {
                    try {
                        startActivity(Intent(Settings.ACTION_SETTINGS).apply {
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        })
                    } catch (_: Exception) {
                    }
                }
            }
        }

        @JavascriptInterface
        fun openLocationSettings() {
            runOnUiThread {
                try {
                    val intent = Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    startActivity(intent)
                } catch (_: Exception) {
                }
            }
        }

        @JavascriptInterface
        fun requestSmsPermission() {
            runOnUiThread {
                if (isFinishing || isDestroyed) return@runOnUiThread
                if (hasPermission(Manifest.permission.SEND_SMS)) {
                    pushPermissionStateToWeb()
                    return@runOnUiThread
                }
                prefs.edit().putBoolean(KEY_ASKED_SMS, true).apply()
                smsPermissionLauncher.launch(Manifest.permission.SEND_SMS)
            }
        }

        /**
         * Dispatches an emergency SOS SMS to a single contact using Android's native SmsManager
         * and registers PendingIntents to report actual sent/delivered/failed status back to the web UI.
         */
        @JavascriptInterface
        fun sendEmergencySms(contactId: String, phone: String, message: String): String {
            val cleanPhone = phone.trim()
            if (cleanPhone.isEmpty() || message.isBlank()) {
                return JSONObject().apply {
                    put("accepted", false)
                    put("status", "failed")
                    put("errorReason", "Phone number or message is empty.")
                }.toString()
            }

            if (!hasPermission(Manifest.permission.SEND_SMS)) {
                runOnUiThread {
                    if (!isFinishing && !isDestroyed) {
                        prefs.edit().putBoolean(KEY_ASKED_SMS, true).apply()
                        smsPermissionLauncher.launch(Manifest.permission.SEND_SMS)
                    }
                }
                return JSONObject().apply {
                    put("accepted", false)
                    put("status", "permission_required")
                    put("errorReason", "Android SEND_SMS permission is required to send automatic SMS.")
                }.toString()
            }

            return try {
                val smsManager: SmsManager = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    getSystemService(SmsManager::class.java) ?: SmsManager.getDefault()
                } else {
                    @Suppress("DEPRECATION")
                    SmsManager.getDefault()
                }

                val parts = smsManager.divideMessage(message)
                val sentIntents = ArrayList<PendingIntent>(parts.size)
                val deliveredIntents = ArrayList<PendingIntent>(parts.size)
                val baseReqCode = (contactId.hashCode() and 0x0FFFFFFF)

                for (i in parts.indices) {
                    val sentIntent = Intent(ACTION_SMS_SENT).apply {
                        setPackage(packageName)
                        putExtra("contactId", contactId)
                        putExtra("phone", cleanPhone)
                    }
                    val deliveredIntent = Intent(ACTION_SMS_DELIVERED).apply {
                        setPackage(packageName)
                        putExtra("contactId", contactId)
                        putExtra("phone", cleanPhone)
                    }

                    val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                    sentIntents.add(
                        PendingIntent.getBroadcast(
                            this@MainActivity,
                            baseReqCode + i,
                            sentIntent,
                            flags
                        )
                    )
                    deliveredIntents.add(
                        PendingIntent.getBroadcast(
                            this@MainActivity,
                            baseReqCode + 1000 + i,
                            deliveredIntent,
                            flags
                        )
                    )
                }

                smsManager.sendMultipartTextMessage(
                    cleanPhone,
                    null,
                    parts,
                    sentIntents,
                    deliveredIntents
                )

                JSONObject().apply {
                    put("accepted", true)
                    put("status", "sending")
                    put("channel", "android-sms-manager")
                }.toString()
            } catch (e: Exception) {
                JSONObject().apply {
                    put("accepted", false)
                    put("status", "failed")
                    put("errorReason", e.message ?: "Failed to invoke Android SmsManager")
                }.toString()
            }
        }

        /**
         * Opens the native Android SMS application pre-filled with the recipient number(s) and emergency message
         * when direct background SEND_SMS permission is not granted.
         */
        @JavascriptInterface
        fun openSmsComposer(phonesCsv: String, message: String) {
            runOnUiThread {
                try {
                    val cleanRecipients = phonesCsv
                        .split(",", ";")
                        .map { it.trim() }
                        .filter { it.isNotEmpty() }
                        .joinToString(";")
                    val uri = Uri.parse("smsto:$cleanRecipients")
                    val intent = Intent(Intent.ACTION_SENDTO, uri).apply {
                        putExtra("sms_body", message)
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    startActivity(intent)
                } catch (_: Exception) {
                }
            }
        }

        @JavascriptInterface
        fun hasMagnetometer(): Boolean {
            return magnetometerSensor != null
        }

        @JavascriptInterface
        fun startMagnetometer(): Boolean {
            val sm = sensorManager ?: return false
            val sensor = magnetometerSensor ?: return false
            return try {
                sm.registerListener(magnetometerListener, sensor, SensorManager.SENSOR_DELAY_UI)
            } catch (_: Exception) {
                false
            }
        }

        @JavascriptInterface
        fun stopMagnetometer() {
            try {
                sensorManager?.unregisterListener(magnetometerListener)
            } catch (_: Exception) {
            }
        }

        @JavascriptInterface
        fun getMagnetometerReading(): String {
            if (!hasMagReading) return ""
            return JSONObject().apply {
                put("x", latestMagX.toDouble())
                put("y", latestMagY.toDouble())
                put("z", latestMagZ.toDouble())
                put("timestamp", System.currentTimeMillis())
            }.toString()
        }

        @JavascriptInterface
        fun hasTorch(): Boolean {
            return packageManager.hasSystemFeature(PackageManager.FEATURE_CAMERA_FLASH)
        }

        @JavascriptInterface
        fun setTorchMode(enabled: Boolean): Boolean {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return false
            return try {
                val cm = getSystemService(Context.CAMERA_SERVICE) as? CameraManager ?: return false
                val torchCameraId = cm.cameraIdList.firstOrNull { id ->
                    val chars = cm.getCameraCharacteristics(id)
                    chars.get(CameraCharacteristics.FLASH_INFO_AVAILABLE) == true
                } ?: return false
                cm.setTorchMode(torchCameraId, enabled)
                true
            } catch (_: Exception) {
                false
            }
        }

        @JavascriptInterface
        fun getLocalNetworkSummary(): String {
            return try {
                val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return ""
                val activeNet = cm.activeNetwork ?: return ""
                val linkProps = cm.getLinkProperties(activeNet) ?: return ""
                val localIp = linkProps.linkAddresses
                    .mapNotNull { it.address?.hostAddress }
                    .firstOrNull { !it.contains(":") } ?: ""
                val gatewayIp = linkProps.routes
                    .mapNotNull { it.gateway?.hostAddress }
                    .firstOrNull { !it.contains(":") && it != "0.0.0.0" } ?: ""
                val dns = linkProps.dnsServers.mapNotNull { it.hostAddress }.joinToString(", ")
                JSONObject().apply {
                    put("interfaceName", linkProps.interfaceName ?: "wlan0")
                    put("localIp", localIp)
                    put("gatewayIp", gatewayIp)
                    put("dnsServers", dns)
                }.toString()
            } catch (_: Exception) {
                ""
            }
        }
    }
}
