/// No-op ad service for web and desktop builds. Keeps the app compiling where
/// `google_mobile_ads` has no platform implementation.
Future<void> initializeAds() async {}

Future<void> preloadInterstitial() async {}

Future<bool> showInterstitialAd() async => false;

Future<bool> showRewardedAd() async => false;
