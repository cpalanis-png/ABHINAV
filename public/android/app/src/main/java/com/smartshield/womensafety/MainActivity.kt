package com.smartshield.womensafety

import android.Manifest
import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.ContactsContract
import android.provider.Settings
import android.webkit.GeolocationPermissions
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationServices
import com.smartshield.womensafety.location.SmartShieldLocationManager
import com.smartshield.womensafety.services.LocationEscortService
import org.json.JSONObject

/**
 * Smart Shield Women Safety — MainActivity
 * Implements complete Android Activity Result permission lifecycle,
 * WebView Geolocation bridge (onGeolocationPermissionsShowPrompt + @JavascriptInterface),
 * precise vs approximate location handling, device GPS services check,
 * settings recovery, and emergency SOS location dispatch.
 */
class MainActivity : ComponentActivity() {

    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var smartLocationManager: SmartShieldLocationManager
    private var webViewRef: WebView? = null
    private var pendingGeolocationCallback: GeolocationPermissions.Callback? = null
    private var pendingGeolocationOrigin: String? = null

    // Permission state observables
    private var isFineLocationGranted by mutableStateOf(false)
    private var isCoarseLocationGranted by mutableStateOf(false)
    private var isLocationServicesEnabled by mutableStateOf(false)
    private var permissionDeniedPermanently by mutableStateOf(false)
    private var currentLocation by mutableStateOf<Location?>(null)
    private var isLocating by mutableStateOf(false)
    private var locationStatusMessage by mutableStateOf("Checking location permissions...")
    private var showNativeDiagnosticsDrawer by mutableStateOf(false)

    // 1. Foreground Location Permission Launcher (Coarse + Fine together)
    private val locationPermissionLauncher =
        registerForActivityResult(
            ActivityResultContracts.RequestMultiplePermissions()
        ) { permissions ->
            val fineGranted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true
            val coarseGranted = permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true

            isFineLocationGranted = fineGranted
            isCoarseLocationGranted = coarseGranted

            // Resolve any pending WebView geolocation permission request
            pendingGeolocationCallback?.let { callback ->
                val origin = pendingGeolocationOrigin ?: ""
                callback.invoke(origin, fineGranted || coarseGranted, false)
                pendingGeolocationCallback = null
                pendingGeolocationOrigin = null
            }

            when {
                fineGranted -> {
                    permissionDeniedPermanently = false
                    locationStatusMessage = "Precise location granted."
                    checkLocationServicesAndStart(requirePrecise = true)
                }
                coarseGranted -> {
                    permissionDeniedPermanently = false
                    locationStatusMessage = "Approximate location granted. Accuracy is limited."
                    checkLocationServicesAndStart(requirePrecise = false)
                }
                else -> {
                    val shouldShowRationale =
                        shouldShowRequestPermissionRationale(Manifest.permission.ACCESS_FINE_LOCATION) ||
                        shouldShowRequestPermissionRationale(Manifest.permission.ACCESS_COARSE_LOCATION)

                    permissionDeniedPermanently = !shouldShowRationale
                    locationStatusMessage = if (permissionDeniedPermanently) {
                        "Location permission permanently denied. Please enable in Android Settings."
                    } else {
                        "Location permission is required for SOS coordinates and safety geofences."
                    }
                    pushPermissionStateToWebView()
                }
            }
        }

    // 2. Background Location Launcher (Requested strictly after foreground permission & user consent)
    private val backgroundLocationLauncher =
        registerForActivityResult(
            ActivityResultContracts.RequestPermission()
        ) { granted ->
            if (granted) {
                Toast.makeText(this, "Background SafeWalk escort enabled", Toast.LENGTH_SHORT).show()
                LocationEscortService.startService(this)
            } else {
                Toast.makeText(this, "SafeWalk will only track while app is in foreground", Toast.LENGTH_LONG).show()
            }
        }

    // 3. Notification Permission Launcher (Android 13+ / API 33+)
    private val notificationPermissionLauncher =
        registerForActivityResult(
            ActivityResultContracts.RequestPermission()
        ) { granted ->
            if (!granted) {
                Toast.makeText(this, "Emergency alerts will be delivered in-app without system notifications", Toast.LENGTH_SHORT).show()
            }
        }

    // 4. Microphone Permission Launcher (On-demand for Voice AI)
    private val microphonePermissionLauncher =
        registerForActivityResult(
            ActivityResultContracts.RequestPermission()
        ) { granted ->
            if (granted) {
                Toast.makeText(this, "Voice mode microphone access granted", Toast.LENGTH_SHORT).show()
            } else {
                Toast.makeText(this, "Microphone permission required for voice activation", Toast.LENGTH_SHORT).show()
            }
        }

    // 5. Native Address Book Contact Picker Launcher (zero broad READ_CONTACTS permission needed)
    private val contactPickerLauncher =
        registerForActivityResult(
            ActivityResultContracts.StartActivityForResult()
        ) { result ->
            if (result.resultCode == RESULT_OK && result.data != null) {
                val contactUri: Uri? = result.data?.data
                if (contactUri != null) {
                    handlePickedContactUri(contactUri)
                } else {
                    notifyContactPickerCancelled()
                }
            } else {
                notifyContactPickerCancelled()
            }
        }

    /**
     * Reads name and phone number from the selected contact URI granted by Android intent
     */
    private fun handlePickedContactUri(contactUri: Uri) {
        try {
            var contactName = ""
            var contactPhone = ""

            val projection = arrayOf(
                ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
                ContactsContract.CommonDataKinds.Phone.NUMBER
            )

            contentResolver.query(contactUri, projection, null, null, null)?.use { cursor ->
                if (cursor.moveToFirst()) {
                    val nameIdx = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME)
                    val numIdx = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.NUMBER)
                    if (nameIdx != -1) contactName = cursor.getString(nameIdx) ?: ""
                    if (numIdx != -1) contactPhone = cursor.getString(numIdx) ?: ""
                }
            }

            val payload = JSONObject().apply {
                put("status", "success")
                put("name", contactName)
                put("phone", contactPhone)
            }.toString()

            webViewRef?.post {
                webViewRef?.evaluateJavascript(
                    "window.onAndroidContactPicked && window.onAndroidContactPicked($payload);",
                    null
                )
            }
        } catch (e: Exception) {
            val errPayload = JSONObject().apply {
                put("status", "error")
                put("error", e.message ?: "Failed to read contact data")
            }.toString()
            webViewRef?.post {
                webViewRef?.evaluateJavascript(
                    "window.onAndroidContactPicked && window.onAndroidContactPicked($errPayload);",
                    null
                )
            }
        }
    }

    private fun notifyContactPickerCancelled() {
        webViewRef?.post {
            webViewRef?.evaluateJavascript(
                "window.onAndroidContactPickerCancelled && window.onAndroidContactPickerCancelled();",
                null
            )
        }
    }
        super.onCreate(savedInstanceState)
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        smartLocationManager = SmartShieldLocationManager(this, fusedLocationClient)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }

        setContent {
            SmartShieldTheme {
                MainSafetyScreen()
            }
        }
    }

    override fun onResume() {
        super.onResume()
        // Always re-check permissions and GPS toggle when returning from Android Settings
        recheckPermissionsAndServices()
    }

    /**
     * Checks current runtime permission status from the Android system
     */
    private fun recheckPermissionsAndServices() {
        val fine = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val coarse = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED

        isFineLocationGranted = fine
        isCoarseLocationGranted = coarse

        val locationManager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        isLocationServicesEnabled = locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
                locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)

        if (fine || coarse) {
            permissionDeniedPermanently = false
            if (isLocationServicesEnabled) {
                requestFreshLocation()
            } else {
                locationStatusMessage = "Device GPS / Location Services are turned off."
            }
        } else {
            locationStatusMessage = "Location permission is required for emergency safety features."
        }
        pushPermissionStateToWebView()
    }

    /**
     * Push updated permission & location state directly into the WebView JS context
     */
    private fun pushPermissionStateToWebView() {
        val loc = currentLocation
        if (loc != null && smartLocationManager.isValidCoordinate(loc)) {
            val payload = JSONObject().apply {
                put("latitude", loc.latitude)
                put("longitude", loc.longitude)
                put("accuracy", loc.accuracy.toDouble())
                put("timestamp", loc.time)
                put("isFineGranted", isFineLocationGranted)
                put("isCoarseGranted", isCoarseLocationGranted)
                put("isGpsEnabled", isLocationServicesEnabled)
            }.toString()
            webViewRef?.post {
                webViewRef?.evaluateJavascript(
                    "window.onAndroidLocationUpdate && window.onAndroidLocationUpdate($payload);",
                    null
                )
            }
        }
    }

    /**
     * JavaScript Interface exposed as `window.SmartShieldAndroidBridge` inside the WebView
     */
    inner class SmartShieldJsBridge {
        @JavascriptInterface
        fun getPermissionStatus(): String {
            val fine = ContextCompat.checkSelfPermission(
                this@MainActivity,
                Manifest.permission.ACCESS_FINE_LOCATION
            ) == PackageManager.PERMISSION_GRANTED
            val coarse = ContextCompat.checkSelfPermission(
                this@MainActivity,
                Manifest.permission.ACCESS_COARSE_LOCATION
            ) == PackageManager.PERMISSION_GRANTED
            val mic = ContextCompat.checkSelfPermission(
                this@MainActivity,
                Manifest.permission.RECORD_AUDIO
            ) == PackageManager.PERMISSION_GRANTED
            val notif = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                ContextCompat.checkSelfPermission(
                    this@MainActivity,
                    Manifest.permission.POST_NOTIFICATIONS
                ) == PackageManager.PERMISSION_GRANTED
            } else true

            val lm = getSystemService(Context.LOCATION_SERVICE) as LocationManager
            val gpsEnabled = lm.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
                    lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)

            return JSONObject().apply {
                put("fineLocation", fine)
                put("coarseLocation", coarse)
                put("microphone", mic)
                put("notifications", notif)
                put("isLocationServicesEnabled", gpsEnabled)
                put("permanentlyDenied", permissionDeniedPermanently)
                put("packageName", packageName)
            }.toString()
        }

        @JavascriptInterface
        fun requestLocationPermission(): String {
            runOnUiThread {
                this@MainActivity.requestLocationPermission()
            }
            return getPermissionStatus()
        }

        @JavascriptInterface
        fun getFreshLocationJson(): String {
            runOnUiThread {
                this@MainActivity.requestFreshLocation()
            }
            val loc = currentLocation
            return if (loc != null && smartLocationManager.isValidCoordinate(loc)) {
                JSONObject().apply {
                    put("latitude", loc.latitude)
                    put("longitude", loc.longitude)
                    put("accuracy", loc.accuracy.toDouble())
                    put("timestamp", loc.time)
                }.toString()
            } else {
                "{}"
            }
        }

        @JavascriptInterface
        fun openAppSettings() {
            runOnUiThread {
                this@MainActivity.openAppSettings()
            }
        }

        @JavascriptInterface
        fun openLocationSettings() {
            runOnUiThread {
                this@MainActivity.openLocationServicesSettings()
            }
        }

        @JavascriptInterface
        fun pickNativeContact() {
            runOnUiThread {
                try {
                    val intent = Intent(
                        Intent.ACTION_PICK,
                        ContactsContract.CommonDataKinds.Phone.CONTENT_URI
                    )
                    contactPickerLauncher.launch(intent)
                } catch (e: Exception) {
                    Toast.makeText(this@MainActivity, "Could not open contacts: ${e.message}", Toast.LENGTH_SHORT).show()
                    notifyContactPickerCancelled()
                }
            }
        }

        @JavascriptInterface
        fun isNativeContactPickerAvailable(): Boolean {
            return true
        }
    }

    /**
     * Launch foreground location permission dialog
     */
    fun requestLocationPermission() {
        locationPermissionLauncher.launch(
            arrayOf(
                Manifest.permission.ACCESS_COARSE_LOCATION,
                Manifest.permission.ACCESS_FINE_LOCATION
            )
        )
    }

    /**
     * Request background location strictly with explicit user explanation (SafeWalk Escort)
     */
    fun requestSafeWalkBackgroundLocation() {
        if (!isFineLocationGranted && !isCoarseLocationGranted) {
            Toast.makeText(this, "Foreground location must be granted first.", Toast.LENGTH_SHORT).show()
            requestLocationPermission()
            return
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            backgroundLocationLauncher.launch(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
        } else {
            LocationEscortService.startService(this)
        }
    }

    /**
     * Check device location services and retrieve location
     */
    private fun checkLocationServicesAndStart(requirePrecise: Boolean) {
        val locationManager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        isLocationServicesEnabled = locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
                locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)

        if (!isLocationServicesEnabled) {
            locationStatusMessage = "Location Services (GPS) disabled. Please enable device location."
            return
        }

        requestFreshLocation()
    }

    /**
     * Retrieve fresh GPS fix with timeout, timestamp, and accuracy validation
     */
    fun requestFreshLocation() {
        if (!isFineLocationGranted && !isCoarseLocationGranted) {
            requestLocationPermission()
            return
        }

        isLocating = true
        locationStatusMessage = "Acquiring fresh satellite location..."

        smartLocationManager.getFreshLocation(
            preferPrecise = isFineLocationGranted,
            timeoutMs = 8000L,
            onSuccess = { loc ->
                isLocating = false
                currentLocation = loc
                val acc = loc.accuracy
                val precisionLabel = if (acc <= 100) "Precise (±${acc.toInt()}m)" else "Approximate (±${acc.toInt()}m)"
                locationStatusMessage = "Live fix acquired: $precisionLabel"
                pushPermissionStateToWebView()
            },
            onTimeoutOrError = { lastKnown ->
                isLocating = false
                if (lastKnown != null) {
                    currentLocation = lastKnown
                    val secondsOld = (System.currentTimeMillis() - lastKnown.time) / 1000
                    locationStatusMessage = "Using last-known location (${secondsOld}s ago, ±${lastKnown.accuracy.toInt()}m)"
                    pushPermissionStateToWebView()
                } else {
                    locationStatusMessage = "Location unavailable. Please check GPS reception and tap Retry."
                }
            }
        )
    }

    /**
     * Navigate user to Android Application Details Settings
     */
    fun openAppSettings() {
        try {
            val intent = Intent(
                Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                Uri.fromParts("package", packageName, null)
            )
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            startActivity(intent)
        } catch (e: ActivityNotFoundException) {
            val intent = Intent(Settings.ACTION_MANAGE_APPLICATIONS_SETTINGS)
            startActivity(intent)
        }
    }

    /**
     * Navigate user to Device Location Source Settings
     */
    fun openLocationServicesSettings() {
        try {
            val intent = Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            startActivity(intent)
        } catch (e: Exception) {
            openAppSettings()
        }
    }

    /**
     * Compose UI hosting the native permission status bar + hybrid WebView
     */
    @SuppressLint("SetJavaScriptEnabled")
    @OptIn(ExperimentalMaterial3Api::class)
    @Composable
    fun MainSafetyScreen() {
        Scaffold(
            topBar = {
                TopAppBar(
                    title = {
                        Column {
                            Text(
                                text = "SMART SHIELD 5.0",
                                fontWeight = FontWeight.Bold,
                                color = Color.White,
                                fontSize = 16.sp
                            )
                            Text(
                                text = locationStatusMessage,
                                color = if (isFineLocationGranted) Color(0xFF34D399) else Color(0xFFFBBF24),
                                fontSize = 11.sp
                            )
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = Color(0xFF0F172A)
                    ),
                    actions = {
                        IconButton(onClick = { showNativeDiagnosticsDrawer = !showNativeDiagnosticsDrawer }) {
                            Icon(
                                imageVector = if (isFineLocationGranted) Icons.Default.GpsFixed else Icons.Default.LocationOff,
                                contentDescription = "GPS Diagnostics",
                                tint = if (isFineLocationGranted) Color(0xFF10B981) else Color(0xFFF59E0B)
                            )
                        }
                        IconButton(onClick = { openAppSettings() }) {
                            Icon(Icons.Default.Settings, contentDescription = "Settings", tint = Color.LightGray)
                        }
                    }
                )
            },
            containerColor = Color(0xFF020617)
        ) { padding ->
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
            ) {
                if (showNativeDiagnosticsDrawer || (!isFineLocationGranted && !isCoarseLocationGranted) || !isLocationServicesEnabled) {
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A)),
                        shape = RoundedCornerShape(0.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(12.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            currentLocation?.let { loc ->
                                Text(
                                    text = "Verified Native GPS: ${String.format("%.5f", loc.latitude)}°, ${String.format("%.5f", loc.longitude)}° (±${loc.accuracy.toInt()}m)",
                                    color = Color(0xFF38BDF8),
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.SemiBold
                                )
                            }

                            if (!isFineLocationGranted && !isCoarseLocationGranted) {
                                Button(
                                    onClick = {
                                        if (permissionDeniedPermanently) openAppSettings() else requestLocationPermission()
                                    },
                                    colors = ButtonDefaults.buttonColors(
                                        containerColor = if (permissionDeniedPermanently) Color(0xFF7C3AED) else Color(0xFF0284C7)
                                    ),
                                    modifier = Modifier.fillMaxWidth(),
                                    shape = RoundedCornerShape(10.dp)
                                ) {
                                    Icon(
                                        if (permissionDeniedPermanently) Icons.Default.Settings else Icons.Default.LocationOn,
                                        contentDescription = null
                                    )
                                    Spacer(Modifier.width(8.dp))
                                    Text(
                                        if (permissionDeniedPermanently) "Open Android App Settings" else "Enable Android Location Permission"
                                    )
                                }
                            } else if (!isLocationServicesEnabled) {
                                Button(
                                    onClick = { openLocationServicesSettings() },
                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFD97706)),
                                    modifier = Modifier.fillMaxWidth(),
                                    shape = RoundedCornerShape(10.dp)
                                ) {
                                    Icon(Icons.Default.Settings, contentDescription = null)
                                    Spacer(Modifier.width(8.dp))
                                    Text("Turn On Device GPS / Location Services")
                                }
                            } else {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Button(
                                        onClick = { requestFreshLocation() },
                                        enabled = !isLocating,
                                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1E293B)),
                                        modifier = Modifier.weight(1f),
                                        shape = RoundedCornerShape(10.dp)
                                    ) {
                                        Text(if (isLocating) "Locating..." else "Refresh GPS Fix", color = Color.White, fontSize = 12.sp)
                                    }
                                    Button(
                                        onClick = { requestSafeWalkBackgroundLocation() },
                                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0D9488)),
                                        modifier = Modifier.weight(1f),
                                        shape = RoundedCornerShape(10.dp)
                                    ) {
                                        Text("SafeWalk Escort", fontSize = 12.sp)
                                    }
                                }
                            }
                        }
                    }
                }

                // Hybrid WebView container with full Geolocation & JS Bridge support
                AndroidView(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    factory = { ctx ->
                        WebView(ctx).apply {
                            webViewRef = this
                            settings.apply {
                                javaScriptEnabled = true
                                domStorageEnabled = true
                                databaseEnabled = true
                                setGeolocationEnabled(true)
                                mediaPlaybackRequiresUserGesture = false
                                cacheMode = WebSettings.LOAD_DEFAULT
                            }

                            addJavascriptInterface(SmartShieldJsBridge(), "SmartShieldAndroidBridge")

                            webViewClient = WebViewClient()
                            webChromeClient = object : WebChromeClient() {
                                override fun onGeolocationPermissionsShowPrompt(
                                    origin: String?,
                                    callback: GeolocationPermissions.Callback?
                                ) {
                                    val hasFine = ContextCompat.checkSelfPermission(
                                        this@MainActivity,
                                        Manifest.permission.ACCESS_FINE_LOCATION
                                    ) == PackageManager.PERMISSION_GRANTED
                                    val hasCoarse = ContextCompat.checkSelfPermission(
                                        this@MainActivity,
                                        Manifest.permission.ACCESS_COARSE_LOCATION
                                    ) == PackageManager.PERMISSION_GRANTED

                                    if (hasFine || hasCoarse) {
                                        callback?.invoke(origin, true, false)
                                    } else {
                                        pendingGeolocationOrigin = origin
                                        pendingGeolocationCallback = callback
                                        requestLocationPermission()
                                    }
                                }

                                override fun onPermissionRequest(request: PermissionRequest?) {
                                    request?.grant(request.resources)
                                }
                            }

                            loadUrl("file:///android_asset/public/index.html")
                        }
                    }
                )
            }
        }
    }
}

@Composable
fun SmartShieldTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = darkColorScheme(
            primary = Color(0xFF7C3AED),
            secondary = Color(0xFF0284C7),
            background = Color(0xFF020617)
        ),
        content = content
    )
}
