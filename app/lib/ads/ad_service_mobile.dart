import 'dart:async';
import 'dart:io' show Platform;

import 'package:google_mobile_ads/google_mobile_ads.dart';

import 'ad_config.dart';

bool _initialized = false;

/// Initializes the Mobile Ads SDK once per process.
Future<void> initializeAds() async {
  if (_initialized) return;
  _initialized = true;
  try {
    await MobileAds.instance.initialize();
  } catch (_) {
    // Leave `_initialized` false so a later attempt can retry.
    _initialized = false;
  }
}

String get _interstitialUnitId {
  if (Platform.isAndroid) return AdConfig.androidInterstitialUnitId;
  if (Platform.isIOS) return AdConfig.iosInterstitialUnitId;
  return '';
}

String get _rewardedUnitId {
  if (Platform.isAndroid) return AdConfig.androidRewardedUnitId;
  if (Platform.isIOS) return AdConfig.iosRewardedUnitId;
  return '';
}

void _complete(Completer<bool> completer, bool value) {
  if (!completer.isCompleted) completer.complete(value);
}

/// Loads and shows an interstitial. Returns `true` once it has been dismissed,
/// `false` when no ad could be shown (offline, no fill, unsupported platform).
Future<bool> showInterstitialAd() async {
  final unitId = _interstitialUnitId;
  if (unitId.isEmpty) return false;

  final completer = Completer<bool>();
  try {
    await InterstitialAd.load(
      adUnitId: unitId,
      request: const AdRequest(),
      adLoadCallback: InterstitialAdLoadCallback(
        onAdLoaded: (ad) {
          if (completer.isCompleted) {
            ad.dispose();
            return;
          }
          ad.fullScreenContentCallback = FullScreenContentCallback<InterstitialAd>(
            onAdDismissedFullScreenContent: (ad) {
              ad.dispose();
              _complete(completer, true);
            },
            onAdFailedToShowFullScreenContent: (ad, _) {
              ad.dispose();
              _complete(completer, false);
            },
          );
          ad.show().catchError((Object _) {
            ad.dispose();
            _complete(completer, false);
          });
        },
        onAdFailedToLoad: (_) => _complete(completer, false),
      ),
    );
  } catch (_) {
    _complete(completer, false);
  }

  return completer.future.timeout(
    const Duration(seconds: 12),
    onTimeout: () => false,
  );
}

/// Loads and shows a rewarded ad. Returns `true` only when the user actually
/// earned the reward, so callers never grant a benefit for a skipped ad.
Future<bool> showRewardedAd() async {
  final unitId = _rewardedUnitId;
  if (unitId.isEmpty) return false;

  final completer = Completer<bool>();
  var earned = false;
  try {
    await RewardedAd.load(
      adUnitId: unitId,
      request: const AdRequest(),
      rewardedAdLoadCallback: RewardedAdLoadCallback(
        onAdLoaded: (ad) {
          if (completer.isCompleted) {
            ad.dispose();
            return;
          }
          ad.fullScreenContentCallback = FullScreenContentCallback<RewardedAd>(
            onAdDismissedFullScreenContent: (ad) {
              ad.dispose();
              _complete(completer, earned);
            },
            onAdFailedToShowFullScreenContent: (ad, _) {
              ad.dispose();
              _complete(completer, false);
            },
          );
          ad.show(onUserEarnedReward: (_, _) => earned = true).catchError((Object _) {
            ad.dispose();
            _complete(completer, false);
          });
        },
        onAdFailedToLoad: (_) => _complete(completer, false),
      ),
    );
  } catch (_) {
    _complete(completer, false);
  }

  return completer.future.timeout(
    const Duration(seconds: 20),
    onTimeout: () => false,
  );
}
