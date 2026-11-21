import 'package:flutter/widgets.dart';

/// Inactivity window before a full-screen ad is offered.
const Duration idleAdDelay = Duration(seconds: 20);

/// Idle full-screen ads are only supported in the Android/iOS app.
Future<bool> showIdleAd(BuildContext context) async => false;
