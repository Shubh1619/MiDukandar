import 'dart:io' show Platform;

import 'package:flutter/material.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';

import 'ad_config.dart';
import 'ad_policy.dart';

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

  String get _unitId {
    if (Platform.isAndroid) return AdConfig.androidBannerUnitId;
    if (Platform.isIOS) return AdConfig.iosBannerUnitId;
    return '';
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  void _load() {
    final unitId = _unitId;
    if (unitId.isEmpty) {
      _failed = true;
      return;
    }
    final ad = BannerAd(
      size: AdSize.banner,
      adUnitId: unitId,
      request: const AdRequest(),
      listener: BannerAdListener(
        onAdLoaded: (_) {
          if (!mounted) return;
          setState(() => _loaded = true);
        },
        onAdFailedToLoad: (ad, _) {
          ad.dispose();
          if (!mounted) return;
          setState(() {
            _ad = null;
            _failed = true;
          });
        },
      ),
    );
    _ad = ad;
    ad.load();
  }

  @override
  void dispose() {
    _ad?.dispose();
    super.dispose();
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
