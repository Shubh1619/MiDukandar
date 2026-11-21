import 'dart:io' show Platform;

import 'package:flutter/widgets.dart';

import 'ad_policy.dart';
import 'ad_service.dart';

/// Inactivity window before a full-screen ad is shown.
const Duration idleAdDelay = Duration(seconds: 20);

/// Shows a real AdMob interstitial after the user has been idle on a screen.
/// Returns `true` only if the ad actually took the full screen, so the caller
/// can start the ad cooldown only after a real impression.
Future<bool> showIdleAd(BuildContext context) async {
  if (!AdPolicy.instance.allowsFullScreen) return false;
  if (!Platform.isAndroid && !Platform.isIOS) return false;
  return showInterstitialAd();
}
