import 'package:flutter/material.dart';

import 'ad_config.dart';
import 'ad_policy.dart';

/// Web / desktop fallback. `google_mobile_ads` only supports Android and iOS,
/// so the conditional import in `md_ad_banner.dart` selects this widget for
/// every other platform. It renders the same in-house promo used by the web
/// app when no AdMob unit is available.
class MdAdBanner extends StatelessWidget {
  const MdAdBanner({
    super.key,
    required this.placement,
    this.margin = const EdgeInsets.symmetric(vertical: 12),
  });

  final AdPlacement placement;
  final EdgeInsetsGeometry margin;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: AdPolicy.instance,
      builder: (context, _) {
        if (!AdPolicy.instance.allows(placement)) {
          return const SizedBox.shrink();
        }
        return Padding(
          padding: margin,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: const Color(0xFFFFFBEB),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFFCD34D)),
            ),
            child: Row(
              children: [
                const Icon(
                  Icons.campaign_outlined,
                  size: 20,
                  color: Color(0xFFB45309),
                ),
                const SizedBox(width: 10),
                const Expanded(
                  child: Text(
                    'Sponsored · Upgrade your plan to remove ads.',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF78350F),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  'AD',
                  style: TextStyle(
                    fontSize: 9,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.8,
                    color: Colors.amber.shade900,
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
