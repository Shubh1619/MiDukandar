package com.example.app

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.telephony.SmsManager
import android.telephony.SubscriptionManager
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

/**
 * `midukandar/sms` platform channel.
 *
 * The udhaari SMS is sent from the shop's own SIM (SMS_MODE=device) instead of
 * a paid gateway. The backend reserves the daily allowance, records the
 * message, and returns `{id, to, body}`; the Dart side calls `sendSms` here and
 * reports the outcome back to the API.
 *
 * Phones can hold two SIMs and one of them may have no SMS recharge, so the
 * channel also exposes the active SIMs (`getSims`) and sends through the exact
 * subscription the owner picked (`subscriptionId`).
 */
class MainActivity : FlutterActivity() {
    private val channelName = "midukandar/sms"
    private val permissionRequestCode = 1001
    private var pendingPermissionResult: MethodChannel.Result? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, channelName)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "hasPermission" -> result.success(hasSmsPermission() && hasPhoneStatePermission())
                    "requestPermission" -> requestPermissions(result)
                    "getSims" -> result.success(activeSims())
                    "sendSms" -> {
                        val to = call.argument<String>("to")
                        val body = call.argument<String>("body")
                        val subscriptionId = call.argument<Int>("subscriptionId")
                        if (to.isNullOrBlank() || body.isNullOrBlank()) {
                            result.error("INVALID_ARGUMENT", "to and body are required", null)
                        } else {
                            sendSms(to, body, subscriptionId, result)
                        }
                    }
                    else -> result.notImplemented()
                }
            }
    }

    private fun hasSmsPermission(): Boolean =
        ContextCompat.checkSelfPermission(this, Manifest.permission.SEND_SMS) ==
            PackageManager.PERMISSION_GRANTED

    /** Needed to read the SIM list; sending itself only needs SEND_SMS. */
    private fun hasPhoneStatePermission(): Boolean =
        ContextCompat.checkSelfPermission(this, Manifest.permission.READ_PHONE_STATE) ==
            PackageManager.PERMISSION_GRANTED

    /**
     * Active SIMs, in slot order. Empty when there is no telephony hardware, no
     * SIM, or the phone-state permission was refused.
     */
    private fun activeSims(): List<Map<String, Any?>> {
        if (!hasPhoneStatePermission()) return emptyList()
        val manager =
            getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE) as? SubscriptionManager
                ?: return emptyList()
        val list = try {
            manager.activeSubscriptionInfoList
        } catch (_: SecurityException) {
            null
        } ?: return emptyList()

        return list
            .sortedBy { it.simSlotIndex }
            .map { info ->
                // displayName is the short carrier name the SIM tray shows
                // ("Jio"); carrierName can be a long brand string
                // ("Jio True5G | Jio") that wraps in the picker.
                val display = info.displayName?.toString()?.trim().orEmpty()
                val carrier = info.carrierName?.toString()?.trim().orEmpty()
                val label = when {
                    display.isNotEmpty() -> display
                    carrier.isNotEmpty() -> carrier
                    else -> "SIM ${info.simSlotIndex + 1}"
                }
                mapOf(
                    "subscriptionId" to info.subscriptionId,
                    "slotIndex" to info.simSlotIndex,
                    "label" to label,
                )
            }
    }

    private fun requestPermissions(result: MethodChannel.Result) {
        if (hasSmsPermission() && hasPhoneStatePermission()) {
            result.success(true)
            return
        }
        if (pendingPermissionResult != null) {
            result.error("IN_PROGRESS", "A permission request is already running", null)
            return
        }
        pendingPermissionResult = result
        ActivityCompat.requestPermissions(
            this,
            arrayOf(Manifest.permission.SEND_SMS, Manifest.permission.READ_PHONE_STATE),
            permissionRequestCode,
        )
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != permissionRequestCode) return
        pendingPermissionResult?.success(hasSmsPermission() && hasPhoneStatePermission())
        pendingPermissionResult = null
    }

    /** Sends through [subscriptionId] when given, otherwise the default SIM. */
    private fun smsManagerFor(subscriptionId: Int?): SmsManager {
        if (subscriptionId == null || subscriptionId < 0) return SmsManager.getDefault()
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            getSystemService(SmsManager::class.java).createForSubscriptionId(subscriptionId)
        } else {
            @Suppress("DEPRECATION")
            SmsManager.getSmsManagerForSubscriptionId(subscriptionId)
        }
    }

    private fun sendSms(
        to: String,
        body: String,
        subscriptionId: Int?,
        result: MethodChannel.Result,
    ) {
        if (!hasSmsPermission()) {
            result.error("PERMISSION_DENIED", "SEND_SMS permission not granted", null)
            return
        }
        try {
            // Keep the country code, drop spaces/dashes: "+9193226..." becomes
            // "9193226...", which SmsManager accepts.
            val address = to.replace(Regex("[^0-9+]"), "")
            val smsManager = smsManagerFor(subscriptionId)
            val parts = smsManager.divideMessage(body)
            if (parts.size > 1) {
                smsManager.sendMultipartTextMessage(address, null, parts, null, null)
            } else {
                smsManager.sendTextMessage(address, null, body, null, null)
            }
            result.success(null)
        } catch (e: SecurityException) {
            result.error("PERMISSION_DENIED", e.message ?: "SEND_SMS permission denied", null)
        } catch (e: Exception) {
            result.error("SEND_FAILED", e.message ?: "Could not send SMS", null)
        }
    }
}
