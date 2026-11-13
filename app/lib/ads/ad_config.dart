/// Ad placements available in the Flutter app.
///
/// Mirrors the web `AdPlacement` list where the two apps share a surface.
enum AdPlacement {
  /// Always-visible banner under the app bar. The only slot a `MINIMAL` plan
  /// may see.
  top,
  dashboard,
  invoices,
  products,
  customers,
  reports,
  expenses,
}

/// AdMob configuration.
///
/// Android ships with the production `ca-app-pub-5690703416607762` ad units;
/// iOS still uses Google's official **test** units until its own AdMob app and
/// units exist. Override either platform at build time, for example:
///
/// ```sh
/// flutter build apk \
///   --dart-define=ADMOB_ANDROID_BANNER_ID=ca-app-pub-.../... \
///   --dart-define=ADMOB_ANDROID_INTERSTITIAL_ID=ca-app-pub-.../... \
///   --dart-define=ADMOB_ANDROID_REWARDED_ID=ca-app-pub-.../...
/// ```
class AdConfig {
  const AdConfig._();

  static const String androidBannerUnitId = String.fromEnvironment(
    'ADMOB_ANDROID_BANNER_ID',
    defaultValue: 'ca-app-pub-5690703416607762/4142815519',
  );
  static const String iosBannerUnitId = String.fromEnvironment(
    'ADMOB_IOS_BANNER_ID',
    defaultValue: 'ca-app-pub-3940256099942544/2934735716',
  );

  static const String androidInterstitialUnitId = String.fromEnvironment(
    'ADMOB_ANDROID_INTERSTITIAL_ID',
    defaultValue: 'ca-app-pub-5690703416607762/2561160591',
  );
  static const String iosInterstitialUnitId = String.fromEnvironment(
    'ADMOB_IOS_INTERSTITIAL_ID',
    defaultValue: 'ca-app-pub-3940256099942544/4411468910',
  );

  static const String androidRewardedUnitId = String.fromEnvironment(
    'ADMOB_ANDROID_REWARDED_ID',
    defaultValue: 'ca-app-pub-5690703416607762/3292768272',
  );
  static const String iosRewardedUnitId = String.fromEnvironment(
    'ADMOB_IOS_REWARDED_ID',
    defaultValue: 'ca-app-pub-3940256099942544/1712485313',
  );
}
