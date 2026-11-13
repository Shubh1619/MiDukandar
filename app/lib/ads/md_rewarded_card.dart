import 'package:flutter/material.dart';

import '../theme/md_design.dart';
import '../widgets/app_dialogs.dart';
import 'ad_policy.dart';
import 'ad_service.dart';

/// Opt-in rewarded ad card for ad-supported (`STANDARD`) plans.
///
/// Rewarded ads are deliberately user-initiated: nothing is shown until the
/// user taps the button, and the button says thank-you only after the SDK
/// confirms the reward was earned.
class MdRewardedCard extends StatefulWidget {
  const MdRewardedCard({super.key});

  @override
  State<MdRewardedCard> createState() => _MdRewardedCardState();
}

class _MdRewardedCardState extends State<MdRewardedCard> {
  bool _busy = false;

  Future<void> _watch() async {
    if (_busy) return;
    setState(() => _busy = true);
    final earned = await showRewardedAd();
    if (!mounted) return;
    setState(() => _busy = false);
    if (earned) {
      AppDialogs.showSuccess(context, 'Thank you for supporting MiDukandar!');
    } else {
      AppDialogs.showError(
        context,
        'No rewarded ad is available right now. Please try again shortly.',
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: AdPolicy.instance,
      builder: (context, _) {
        if (!AdPolicy.instance.allowsFullScreen) {
          return const SizedBox.shrink();
        }
        return MdCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(
                      color: MdColors.navy50,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(
                      Icons.ondemand_video_outlined,
                      color: MdColors.royal600,
                      size: 20,
                    ),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Support MiDukandar',
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            color: MdColors.navy900,
                          ),
                        ),
                        SizedBox(height: 2),
                        Text(
                          'Watch a short ad to keep the app free for your business.',
                          style: TextStyle(
                            fontSize: 12,
                            color: MdColors.mutedForeground,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: _busy ? null : _watch,
                icon: _busy
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.play_circle_outline, size: 18),
                label: Text(_busy ? 'Loading ad…' : 'Watch a short ad'),
              ),
            ],
          ),
        );
      },
    );
  }
}
