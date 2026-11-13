import 'package:flutter/foundation.dart';

import '../models/app_models.dart';
import 'ad_config.dart';

/// Single source of truth for ad visibility in the Flutter app.
///
/// The backend already returns `planDetails` on `GET /api/store`; the shell
/// pushes that into this notifier. No plan => no ads.
class AdPolicy extends ChangeNotifier {
  AdPolicy._();

  static final AdPolicy instance = AdPolicy._();

  bool _adsEnabled = false;
  String _adsTier = 'STANDARD';
  String _status = 'ACTIVE';

  bool get adsEnabled => _adsEnabled;
  String get adsTier => _adsTier;
  String get status => _status;

  void updateFromStore(Store? store) {
    final plan = store?.planDetails;
    final enabled = plan?.adsEnabled ?? false;
    final status = plan?.status ?? 'ACTIVE';
    final tier = plan?.adsTier ?? 'STANDARD';
    if (enabled == _adsEnabled && status == _status && tier == _adsTier) {
      return;
    }
    _adsEnabled = enabled;
    _status = status;
    _adsTier = tier;
    if (kDebugMode) {
      debugPrint(
        'AdPolicy: plan=${plan?.name ?? 'none'} adsEnabled=$enabled '
        'tier=$tier status=$status',
      );
    }
    notifyListeners();
  }

  /// `MINIMAL` plans only get the top banner; `STANDARD` gets every surface.
  bool allows(AdPlacement placement) {
    if (!_adsEnabled || _status != 'ACTIVE') return false;
    if (_adsTier == 'MINIMAL') return placement == AdPlacement.top;
    return true;
  }

  /// Full-screen ads are only for `STANDARD` (ad-supported) plans.
  bool get allowsFullScreen =>
      _adsEnabled && _status == 'ACTIVE' && _adsTier != 'MINIMAL';
}
