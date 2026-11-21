import 'package:flutter/material.dart';

import '../l10n/generated/app_localizations.dart';
import '../services/device_sms.dart';
import '../theme/md_design.dart';

/// Asks which SIM should send the udhaari SMS.
///
/// Used both by the Udhaari send path and by Settings → SMS SIM. Returns the
/// chosen subscription id, or null when the dialog is dismissed. A centered
/// dialog is used so the choice rows never sit under the app's bottom nav.
Future<int?> showSimPicker(BuildContext context, List<DeviceSim> sims) {
  return showDialog<int>(
    context: context,
    builder: (dialogContext) {
      final l = AppLocalizations.of(dialogContext)!;
      return AlertDialog(
        title: Text(l.smsChooseSimTitle),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              l.smsChooseSimBody,
              style: const TextStyle(
                fontSize: 12,
                color: MdColors.mutedForeground,
              ),
            ),
            const SizedBox(height: 12),
            for (final sim in sims)
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    color: MdColors.navy50,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(
                    Icons.sim_card_outlined,
                    size: 18,
                    color: MdColors.navy900,
                  ),
                ),
                title: Text(
                  sim.label,
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                subtitle: Text(l.smsSimSlot(sim.slotNumber)),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => Navigator.pop(dialogContext, sim.subscriptionId),
              ),
          ],
        ),
      );
    },
  );
}
