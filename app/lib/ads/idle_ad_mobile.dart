import 'dart:async';
import 'dart:io' show Platform;

import 'package:flutter/material.dart';

import '../l10n/generated/app_localizations.dart';
import '../theme/md_design.dart';
import 'ad_config.dart';
import 'ad_policy.dart';
import 'md_ad_banner_mobile.dart';

/// Inactivity window before a full-screen ad is offered.
const Duration idleAdDelay = Duration(seconds: 30);

/// How long the full-screen ad stays up before closing itself.
const Duration idleAdDisplayDuration = Duration(seconds: 10);

/// How long to wait for the banner to paint before giving up.
const Duration _loadTimeout = Duration(seconds: 12);

/// Opens the full-screen idle ad. Returns when the user cancels, when the
/// 10-second timer finishes, or when no ad could be loaded.
Future<void> showIdleAd(BuildContext context) async {
  if (!AdPolicy.instance.allowsFullScreen) return;
  if (!Platform.isAndroid && !Platform.isIOS) return;
  await Navigator.of(context).push<void>(
    PageRouteBuilder<void>(
      fullscreenDialog: true,
      opaque: true,
      barrierDismissible: false,
      transitionDuration: const Duration(milliseconds: 220),
      reverseTransitionDuration: const Duration(milliseconds: 180),
      pageBuilder: (_, _, _) => const _IdleAdPage(),
      transitionsBuilder: (_, animation, _, child) =>
          FadeTransition(opacity: animation, child: child),
    ),
  );
}

class _IdleAdPage extends StatefulWidget {
  const _IdleAdPage();

  @override
  State<_IdleAdPage> createState() => _IdleAdPageState();
}

class _IdleAdPageState extends State<_IdleAdPage> {
  Timer? _countdown;
  Timer? _loadTimer;
  int _remaining = idleAdDisplayDuration.inSeconds;
  bool _loaded = false;
  bool _closing = false;

  @override
  void initState() {
    super.initState();
    _loadTimer = Timer(_loadTimeout, () {
      if (!_loaded) _close();
    });
  }

  @override
  void dispose() {
    _countdown?.cancel();
    _loadTimer?.cancel();
    super.dispose();
  }

  void _onAdLoaded() {
    if (!mounted || _loaded) return;
    _loadTimer?.cancel();
    setState(() => _loaded = true);
    _countdown = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      if (_remaining <= 1) {
        timer.cancel();
        _close();
      } else {
        setState(() => _remaining--);
      }
    });
  }

  void _onAdFailed() {
    if (!mounted || _loaded) return;
    _loadTimer?.cancel();
    _close();
  }

  void _close() {
    if (_closing || !mounted) return;
    _closing = true;
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    return PopScope(
      // Back and the cancel buttons both leave immediately; the ad never traps
      // the user on this screen.
      canPop: true,
      child: Scaffold(
        backgroundColor: MdColors.navy950,
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
            child: Column(
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 7,
                        vertical: 3,
                      ),
                      decoration: BoxDecoration(
                        color: MdColors.navy800,
                        borderRadius: BorderRadius.circular(4),
                        border: Border.all(color: MdColors.navy700),
                      ),
                      child: Text(
                        'AD',
                        style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.8,
                          color: Colors.amber.shade400,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      l.idleAdLabel,
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1.1,
                        color: MdColors.navy300,
                      ),
                    ),
                    const Spacer(),
                    TextButton.icon(
                      onPressed: _close,
                      icon: const Icon(Icons.close_rounded, size: 18),
                      label: Text(l.idleAdCancel),
                      style: TextButton.styleFrom(
                        foregroundColor: Colors.white,
                      ),
                    ),
                  ],
                ),
                Expanded(
                  child: Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.workspace_premium_outlined,
                          size: 52,
                          color: Colors.amber.shade400,
                        ),
                        const SizedBox(height: 14),
                        Text(
                          l.idleAdThanks,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w700,
                            color: Colors.white,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          _loaded
                              ? l.idleAdAutoClose(_remaining)
                              : l.idleAdLoading,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontSize: 13,
                            color: MdColors.navy300,
                          ),
                        ),
                        const SizedBox(height: 28),
                        // The banner is always in the tree so it can load; it
                        // only paints once the SDK reports a fill.
                        ConstrainedBox(
                          constraints: const BoxConstraints(
                            minHeight: 50,
                            minWidth: 320,
                            maxWidth: 360,
                          ),
                          child: Center(
                            child: MdAdBanner(
                              placement: AdPlacement.idle,
                              margin: EdgeInsets.zero,
                              onLoaded: _onAdLoaded,
                              onFailed: _onAdFailed,
                            ),
                          ),
                        ),
                        if (!_loaded) ...[
                          const SizedBox(height: 18),
                          const SizedBox(
                            width: 22,
                            height: 22,
                            child: CircularProgressIndicator(strokeWidth: 2.2),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
                TextButton(
                  onPressed: _close,
                  style: TextButton.styleFrom(
                    foregroundColor: MdColors.navy300,
                  ),
                  child: Text(l.idleAdSkip),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
