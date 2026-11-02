package com.smartshield.womensafety.location

import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import kotlin.math.floor

/**
 * SmartShieldLocationManager
 * Coordinates high-accuracy and coarse-fallback location acquisition,
 * FusedLocationProviderClient + native Android LocationManager fallback,
 * NMEA 0183 coordinate conversion (ESP32-C3 Mini + NEO-6M),
 * coordinate boundary validation, and last-known location fallback with age.
 */
class SmartShieldLocationManager(
    private val context: Context,
    private val fusedLocationClient: FusedLocationProviderClient
) {
    private var lastValidLocation: Location? = null
    private val handler = Handler(Looper.getMainLooper())
    private val systemLocationManager =
        context.getSystemService(Context.LOCATION_SERVICE) as LocationManager

    /**
     * Request a fresh location fix with bounded timeout, supporting both
     * precise (PRIORITY_HIGH_ACCURACY) and approximate (PRIORITY_BALANCED_POWER_ACCURACY)
     * plus automatic fallback to Android's native LocationManager if Play Services fails.
     */
    @SuppressLint("MissingPermission")
    fun getFreshLocation(
        preferPrecise: Boolean = true,
        timeoutMs: Long = 8000L,
        onSuccess: (Location) -> Unit,
        onTimeoutOrError: (Location?) -> Unit
    ) {
        val cts = CancellationTokenSource()
        var hasResponded = false

        val priority = if (preferPrecise) {
            Priority.PRIORITY_HIGH_ACCURACY
        } else {
            Priority.PRIORITY_BALANCED_POWER_ACCURACY
        }

        val timeoutRunnable = Runnable {
            if (!hasResponded) {
                hasResponded = true
                cts.cancel()
                // Fallback to native Android LocationManager before surrendering to cache
                requestNativeLocationManagerFallback(
                    preferPrecise = preferPrecise,
                    onSuccess = onSuccess,
                    onFallback = { onTimeoutOrError(lastValidLocation) }
                )
            }
        }
        handler.postDelayed(timeoutRunnable, timeoutMs)

        try {
            fusedLocationClient.getCurrentLocation(priority, cts.token)
                .addOnSuccessListener { location: Location? ->
                    if (!hasResponded) {
                        if (location != null && isValidCoordinate(location)) {
                            hasResponded = true
                            handler.removeCallbacks(timeoutRunnable)
                            lastValidLocation = location
                            onSuccess(location)
                        } else if (preferPrecise) {
                            // High accuracy returned null (e.g. indoor / coarse-only permission);
                            // automatically retry with balanced power / coarse accuracy
                            hasResponded = true
                            handler.removeCallbacks(timeoutRunnable)
                            getFreshLocation(
                                preferPrecise = false,
                                timeoutMs = 5000L,
                                onSuccess = onSuccess,
                                onTimeoutOrError = onTimeoutOrError
                            )
                        } else {
                            hasResponded = true
                            handler.removeCallbacks(timeoutRunnable)
                            requestNativeLocationManagerFallback(
                                preferPrecise = false,
                                onSuccess = onSuccess,
                                onFallback = { getLastKnownLocation(onSuccess, onTimeoutOrError) }
                            )
                        }
                    }
                }
                .addOnFailureListener {
                    if (!hasResponded) {
                        hasResponded = true
                        handler.removeCallbacks(timeoutRunnable)
                        requestNativeLocationManagerFallback(
                            preferPrecise = preferPrecise,
                            onSuccess = onSuccess,
                            onFallback = { getLastKnownLocation(onSuccess, onTimeoutOrError) }
                        )
                    }
                }
        } catch (e: SecurityException) {
            hasResponded = true
            handler.removeCallbacks(timeoutRunnable)
            onTimeoutOrError(null)
        }
    }

    /**
     * Native Android LocationManager fallback (works on devices without Google Play Services
     * or when FusedLocationProviderClient times out).
     */
    @SuppressLint("MissingPermission")
    private fun requestNativeLocationManagerFallback(
        preferPrecise: Boolean,
        onSuccess: (Location) -> Unit,
        onFallback: () -> Unit
    ) {
        try {
            val providers = buildList {
                if (preferPrecise && systemLocationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                    add(LocationManager.GPS_PROVIDER)
                }
                if (systemLocationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                    add(LocationManager.NETWORK_PROVIDER)
                }
                if (systemLocationManager.isProviderEnabled(LocationManager.PASSIVE_PROVIDER)) {
                    add(LocationManager.PASSIVE_PROVIDER)
                }
            }

            for (provider in providers) {
                val lastLoc = systemLocationManager.getLastKnownLocation(provider)
                if (lastLoc != null && isValidCoordinate(lastLoc) && getLocationAgeSeconds(lastLoc) <= 120) {
                    lastValidLocation = lastLoc
                    onSuccess(lastLoc)
                    return
                }
            }

            val activeProvider = providers.firstOrNull()
            if (activeProvider == null) {
                onFallback()
                return
            }

            var resolved = false
            val listener = object : LocationListener {
                override fun onLocationChanged(loc: Location) {
                    if (!resolved && isValidCoordinate(loc)) {
                        resolved = true
                        systemLocationManager.removeUpdates(this)
                        lastValidLocation = loc
                        onSuccess(loc)
                    }
                }
                @Deprecated("Deprecated in Java")
                override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
                override fun onProviderEnabled(provider: String) {}
                override fun onProviderDisabled(provider: String) {}
            }

            systemLocationManager.requestSingleUpdate(activeProvider, listener, Looper.getMainLooper())
            handler.postDelayed({
                if (!resolved) {
                    resolved = true
                    systemLocationManager.removeUpdates(listener)
                    onFallback()
                }
            }, 3500L)
        } catch (e: Exception) {
            onFallback()
        }
    }

    /**
     * Retrieve cached last known location from FusedLocationProviderClient or native LocationManager
     */
    @SuppressLint("MissingPermission")
    fun getLastKnownLocation(
        onSuccess: (Location) -> Unit,
        onUnavailable: (Location?) -> Unit
    ) {
        try {
            fusedLocationClient.lastLocation.addOnSuccessListener { loc: Location? ->
                if (loc != null && isValidCoordinate(loc)) {
                    lastValidLocation = loc
                    onSuccess(loc)
                } else {
                    onUnavailable(lastValidLocation)
                }
            }.addOnFailureListener {
                onUnavailable(lastValidLocation)
            }
        } catch (e: SecurityException) {
            onUnavailable(null)
        }
    }

    /**
     * Validate latitude and longitude within physical Earth bounds.
     * Strictly rejects (0.0, 0.0) Null Island and out-of-bounds coordinates.
     */
    fun isValidCoordinate(location: Location): Boolean {
        val lat = location.latitude
        val lng = location.longitude
        return lat in -90.0..90.0 &&
                lng in -180.0..180.0 &&
                !(lat == 0.0 && lng == 0.0) &&
                !lat.isNaN() &&
                !lng.isNaN()
    }

    /**
     * Convert NMEA 0183 ddmm.mmmm / dddmm.mmmm format from ESP32-C3 Mini + NEO-6M
     * using: decimal = degrees + (minutes / 60.0), negative for S or W.
     */
    fun convertNmeaToDecimalDegrees(rawValue: String, hemisphere: String): Double? {
        val numeric = rawValue.trim().toDoubleOrNull() ?: return null
        if (numeric < 0.0) return null
        val degrees = floor(numeric / 100.0)
        val minutes = numeric - (degrees * 100.0)
        if (minutes < 0.0 || minutes >= 60.0) return null
        var decimal = degrees + (minutes / 60.0)
        val hemi = hemisphere.trim().uppercase()
        if (hemi == "S" || hemi == "W") {
            decimal = -decimal
        }
        return decimal
    }

    /**
     * Get age of location in seconds
     */
    fun getLocationAgeSeconds(location: Location): Long {
        return (System.currentTimeMillis() - location.time) / 1000
    }
}
