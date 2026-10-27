package com.example.app

import android.Manifest
import android.content.pm.PackageManager
import android.telephony.SmsManager
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
                    "hasPermission" -> result.success(hasSmsPermission())
                    "requestPermission" -> requestSmsPermission(result)
                    "sendSms" -> {
                        val to = call.argument<String>("to")
                        val body = call.argument<String>("body")
                        if (to.isNullOrBlank() || body.isNullOrBlank()) {
                            result.error("INVALID_ARGUMENT", "to and body are required", null)
                        } else {
                            sendSms(to, body, result)
                        }
                    }
                    else -> result.notImplemented()
                }
            }
    }

    private fun hasSmsPermission(): Boolean =
        ContextCompat.checkSelfPermission(this, Manifest.permission.SEND_SMS) ==
            PackageManager.PERMISSION_GRANTED

    private fun requestSmsPermission(result: MethodChannel.Result) {
        if (hasSmsPermission()) {
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
            arrayOf(Manifest.permission.SEND_SMS),
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
        val granted = grantResults.isNotEmpty() &&
            grantResults[0] == PackageManager.PERMISSION_GRANTED
        pendingPermissionResult?.success(granted)
        pendingPermissionResult = null
    }

    private fun sendSms(to: String, body: String, result: MethodChannel.Result) {
        if (!hasSmsPermission()) {
            result.error("PERMISSION_DENIED", "SEND_SMS permission not granted", null)
            return
        }
        try {
            // Keep the country code, drop spaces/dashes: "+9193226..." becomes
            // "9193226...", which SmsManager accepts.
            val address = to.replace(Regex("[^0-9+]"), "")
            val smsManager = SmsManager.getDefault()
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
