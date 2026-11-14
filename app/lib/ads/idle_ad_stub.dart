import 'package:flutter/widgets.dart';

/// Inactivity window before a full-screen ad is offered.
const Duration idleAdDelay = Duration(seconds: 3);

/// How long the full-screen ad stays up before closing itself.
const Duration idleAdDisplayDuration = Duration(seconds: 10);

/// Idle full-screen ads are only supported in the Android/iOS app.
Future<void> showIdleAd(BuildContext context) async {}
