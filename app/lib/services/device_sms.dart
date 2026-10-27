import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// One active SIM in the phone.
///
/// [subscriptionId] is the Android subscription handle used to send through
/// this exact SIM; [slotIndex] is the physical tray slot (0-based).
class DeviceSim {
  const DeviceSim({
    required this.subscriptionId,
    required this.slotIndex,
    required this.label,
  });

  final int subscriptionId;
  final int slotIndex;

  /// Carrier name reported by Android, or `SIM 1` / `SIM 2` when unknown.
  final String label;

  /// 1-based tray slot, for display.
  int get slotNumber => slotIndex + 1;

  factory DeviceSim.fromMap(Map<dynamic, dynamic> map) => DeviceSim(
        subscriptionId: (map['subscriptionId'] as num?)?.toInt() ?? -1,
        slotIndex: (map['slotIndex'] as num?)?.toInt() ?? 0,
        label: (map['label'] as String?)?.trim().isNotEmpty == true
            ? (map['label'] as String).trim()
            : 'SIM ${((map['slotIndex'] as num?)?.toInt() ?? 0) + 1}',
      );
}

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

  /// Active SIMs in slot order. Empty when there is no SIM or the permissions
  /// were refused, in which case the caller should not attempt a silent send.
  Future<List<DeviceSim>> activeSims() async {
    if (!isSupported) return const [];
    try {
      final raw = await _channel.invokeMethod<List<dynamic>>('getSims');
      if (raw == null) return const [];
      return raw
          .whereType<Map<dynamic, dynamic>>()
          .map(DeviceSim.fromMap)
          .where((sim) => sim.subscriptionId >= 0)
          .toList(growable: false);
    } on PlatformException {
      return const [];
    } on MissingPluginException {
      return const [];
    }
  }

  /// Throws [PlatformException] when the SMS could not be handed to the radio.
  ///
  /// [subscriptionId] pins the send to one SIM; null uses the phone default.
  Future<void> send({
    required String to,
    required String body,
    int? subscriptionId,
  }) async {
    await _channel.invokeMethod<void>('sendSms', {
      'to': to,
      'body': body,
      if (subscriptionId != null && subscriptionId >= 0)
        'subscriptionId': subscriptionId,
    });
  }
}
