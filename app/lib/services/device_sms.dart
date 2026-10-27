import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// Sends SMS from the phone's own SIM.
///
/// The native side is a method channel implemented in `MainActivity.kt`
/// (`midukandar/sms`). Only Android supports it; on every other platform
/// [hasPermission] reports false and [send] throws, so the caller falls back to
/// opening the SMS composer.
class DeviceSms {
  DeviceSms({MethodChannel? channel})
      : _channel = channel ?? const MethodChannel('midukandar/sms');

  final MethodChannel _channel;

  bool get isSupported => !kIsWeb && defaultTargetPlatform == TargetPlatform.android;

  Future<bool> hasPermission() async {
    if (!isSupported) return false;
    try {
      return await _channel.invokeMethod<bool>('hasPermission') ?? false;
    } on PlatformException {
      return false;
    } on MissingPluginException {
      return false;
    }
  }

  Future<bool> requestPermission() async {
    if (!isSupported) return false;
    try {
      return await _channel.invokeMethod<bool>('requestPermission') ?? false;
    } on PlatformException {
      return false;
    } on MissingPluginException {
      return false;
    }
  }

  /// Throws [PlatformException] when the SMS could not be handed to the radio.
  Future<void> send({required String to, required String body}) async {
    await _channel.invokeMethod<void>('sendSms', {'to': to, 'body': body});
  }
}
