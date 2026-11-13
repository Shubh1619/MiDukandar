import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';

import 'ad_config.dart';
import 'ad_policy.dart';
import 'ad_service.dart';

/// Android / iOS AdMob banner.
///
/// The widget stays out of the tree entirely when the current plan does not
/// allow ads, and it reserves the standard 320x50 space while loading so the
/// surrounding layout does not jump.
class MdAdBanner extends StatefulWidget {
  const MdAdBanner({
    super.key,
    required this.placement,
    this.margin = const EdgeInsets.symmetric(vertical: 12),
  });

  final AdPlacement placement;
  final EdgeInsetsGeometry margin;

  @override
  State<MdAdBanner> createState() => _MdAdBannerState();
}

class _MdAdBannerState extends State<MdAdBanner> {
  BannerAd? _ad;
  bool _loaded = false;
  bool _failed = false;
  bool _loading = false;

  String get _unitId {
    if (Platform.isAndroid) return AdConfig.androidBannerUnitId;
    if (Platform.isIOS) return AdConfig.iosBannerUnitId;
    return '';
  }

  @override
  void initState() {
    super.initState();
    AdPolicy.instance.addListener(_onPolicyChanged);
    // The shell pushes the store plan into AdPolicy while it initialises, so
    // the first allowed placement may arrive a frame later than this widget.
    WidgetsBinding.instance.addPostFrameCallback((_) => _maybeLoad());
  }

  @override
  void didUpdateWidget(covariant MdAdBanner oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.placement != widget.placement) {
      _disposeAd();
      _maybeLoad();
    }
  }

  @override
  void dispose() {
    AdPolicy.instance.removeListener(_onPolicyChanged);
    _disposeAd();
    super.dispose();
  }

  void _disposeAd() {
    _ad?.dispose();
    _ad = null;
    _loaded = false;
    _loading = false;
  }

  void _onPolicyChanged() {
    if (!mounted) return;
    if (!AdPolicy.instance.allows(widget.placement)) {
      setState(() {});
      return;
    }
    // The plan can arrive after the widget mounts (login, refresh). Clear a
    // previous failure so a newly allowed placement gets one fresh attempt.
    setState(() => _failed = false);
    _maybeLoad();
  }

  Future<void> _maybeLoad() async {
    if (!mounted || _loading || _loaded || _failed) return;
    if (!AdPolicy.instance.allows(widget.placement)) return;
    final unitId = _unitId;
    if (unitId.isEmpty) {
      setState(() => _failed = true);
      return;
    }

    _loading = true;
    // Never load before the Mobile Ads SDK is ready; a load issued during
    // startup can otherwise fail with "SDK not initialized".
    await initializeAds();
    if (!mounted || !AdPolicy.instance.allows(widget.placement)) {
      _loading = false;
      return;
    }

    final ad = BannerAd(
      size: AdSize.banner,
      adUnitId: unitId,
      request: const AdRequest(),
      listener: BannerAdListener(
        onAdLoaded: (_) {
          if (!mounted) return;
          setState(() {
            _loading = false;
            _loaded = true;
          });
        },
        onAdFailedToLoad: (ad, error) {
          ad.dispose();
          if (kDebugMode) {
            debugPrint(
              'AdMob banner ${widget.placement.name} failed: '
              '${error.code} ${error.message}',
            );
          }
          if (!mounted) return;
          setState(() {
            _ad = null;
            _loading = false;
            _failed = true;
          });
        },
      ),
    );
    _ad = ad;
    ad.load();
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: AdPolicy.instance,
      builder: (context, _) {
        if (!AdPolicy.instance.allows(widget.placement) || _failed) {
          return const SizedBox.shrink();
        }
        final ad = _ad;
        if (ad == null || !_loaded) {
          return Padding(
            padding: widget.margin,
            child: const SizedBox(height: 50),
          );
        }
        return Padding(
          padding: widget.margin,
          child: Center(
            child: SizedBox(
              width: ad.size.width.toDouble(),
              height: ad.size.height.toDouble(),
              child: AdWidget(ad: ad),
            ),
          ),
        );
      },
    );
  }
}
