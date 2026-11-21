import 'dart:async';
import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';

import 'ad_config.dart';

/// AdMob invalidates an ad after 4 hours. Refresh a little earlier so a
/// preloaded ad can never be stale when an action needs it.
const Duration _maxPreloadedAdAge = Duration(hours: 3);
const Duration _loadTimeout = Duration(seconds: 12);
const Duration _showTimeout = Duration(seconds: 15);

bool _initialized = false;
bool _preloading = false;
bool _showing = false;
InterstitialAd? _preloadedInterstitial;
DateTime? _preloadedAt;

/// `dart:developer` logs are not emitted in release builds, so use the
/// framework logger that still reaches logcat as `I/flutter`.
void _log(String message) => debugPrint('[MiDukandar.Ads] $message');

/// Initializes the Mobile Ads SDK once per process.
Future<void> initializeAds() async {
  if (_initialized) return;
  _initialized = true;
  try {
    await MobileAds.instance.initialize();
    _log('Mobile Ads SDK initialized');
  } catch (error) {
    // Leave `_initialized` false so a later attempt can retry.
    _initialized = false;
    _log('Mobile Ads SDK initialization failed: $error');
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

InterstitialAd? _takeFreshPreloadedAd() {
  final ad = _preloadedInterstitial;
  final loadedAt = _preloadedAt;
  _preloadedInterstitial = null;
  _preloadedAt = null;
  if (ad == null || loadedAt == null) return null;
  if (DateTime.now().difference(loadedAt) >= _maxPreloadedAdAge) {
    _log('discarding stale preloaded interstitial');
    ad.dispose();
    return null;
  }
  return ad;
}

Future<InterstitialAd?> _loadInterstitial(String unitId) async {
  final completer = Completer<InterstitialAd?>();
  try {
    await InterstitialAd.load(
      adUnitId: unitId,
      request: const AdRequest(),
      adLoadCallback: InterstitialAdLoadCallback(
        onAdLoaded: (ad) {
          _log('interstitial loaded: $unitId');
          if (!completer.isCompleted) completer.complete(ad);
        },
        onAdFailedToLoad: (error) {
          _log('interstitial load failed: ${error.code} ${error.message}');
          if (!completer.isCompleted) completer.complete(null);
        },
      ),
    );
  } catch (error) {
    _log('interstitial load exception: $error');
    if (!completer.isCompleted) completer.complete(null);
  }
  return completer.future.timeout(
    _loadTimeout,
    onTimeout: () {
      _log('interstitial load timed out');
      return null;
    },
  );
}

/// Keeps one interstitial ready so an action does not have to wait for a
/// network round trip. Safe to call repeatedly; only one load runs at a time.
Future<void> preloadInterstitial() async {
  final unitId = _interstitialUnitId;
  if (unitId.isEmpty || _preloading || _preloadedInterstitial != null) return;
  await initializeAds();
  if (_initialized == false || _preloading || _preloadedInterstitial != null) {
    return;
  }
  _preloading = true;
  try {
    final ad = await _loadInterstitial(unitId);
    if (ad == null) return;
    if (_preloadedInterstitial != null) {
      // Another load won the race; keep the newer ad only if ours is fresher.
      ad.dispose();
      return;
    }
    _preloadedInterstitial = ad;
    _preloadedAt = DateTime.now();
    _log('interstitial preloaded and ready');
  } finally {
    _preloading = false;
  }
}

Future<bool> _showAd(InterstitialAd ad) async {
  final completer = Completer<bool>();
  var shown = false;
  var disposed = false;

  void disposeAd() {
    if (disposed) return;
    disposed = true;
    ad.dispose();
  }

  ad.fullScreenContentCallback = FullScreenContentCallback<InterstitialAd>(
    onAdShowedFullScreenContent: (ad) {
      shown = true;
      _log('interstitial showed full screen');
    },
    onAdImpression: (_) => _log('interstitial impression'),
    onAdDismissedFullScreenContent: (ad) {
      _log('interstitial dismissed');
      disposeAd();
      _complete(completer, shown);
    },
    onAdFailedToShowFullScreenContent: (ad, error) {
      _log('interstitial show failed: ${error.code} ${error.message}');
      disposeAd();
      _complete(completer, false);
    },
  );

  try {
    await ad.show();
  } catch (error) {
    _log('interstitial show exception: $error');
    disposeAd();
    _complete(completer, false);
  }

  return completer.future.timeout(
    _showTimeout,
    onTimeout: () {
      _log('interstitial show timed out; disposing');
      disposeAd();
      return shown;
    },
  );
}

/// Shows a real AdMob interstitial. Uses a preloaded ad when available,
/// otherwise loads one on demand. Always queues the next preload so the
/// following action is not left waiting on the network.
Future<bool> showInterstitialAd() async {
  final unitId = _interstitialUnitId;
  if (unitId.isEmpty) return false;
  if (_showing) {
    _log('interstitial already showing; skipping');
    return false;
  }
  _showing = true;
  try {
    await initializeAds();

    final ad = _takeFreshPreloadedAd() ?? await _loadInterstitial(unitId);
    if (ad == null) {
      _log('no interstitial available to show');
      return false;
    }

    final result = await _showAd(ad);
    return result;
  } finally {
    _showing = false;
    unawaited(preloadInterstitial());
  }
}

/// Loads and shows a rewarded ad. Returns `true` only when the user actually
/// earned the reward, so callers never grant a benefit for a skipped ad.
Future<bool> showRewardedAd() async {
  final unitId = _rewardedUnitId;
  if (unitId.isEmpty) return false;
  await initializeAds();

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
            onAdFailedToShowFullScreenContent: (ad, error) {
              _log('rewarded show failed: ${error.code} ${error.message}');
              ad.dispose();
              _complete(completer, false);
            },
          );
          ad.show(onUserEarnedReward: (_, _) => earned = true).catchError((Object error) {
            _log('rewarded show exception: $error');
            ad.dispose();
            _complete(completer, false);
          });
        },
        onAdFailedToLoad: (error) {
          _log('rewarded load failed: ${error.code} ${error.message}');
          _complete(completer, false);
        },
      ),
    );
  } catch (error) {
    _log('rewarded load exception: $error');
    _complete(completer, false);
  }

  return completer.future.timeout(
    const Duration(seconds: 20),
    onTimeout: () => false,
  );
}
