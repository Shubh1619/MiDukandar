import 'package:flutter/material.dart';

import '../l10n/generated/app_localizations.dart';
import '../services/device_sms.dart';
import '../theme/md_design.dart';

/// Asks which SIM should send the udhaari SMS.
///
/// Only shown when the phone reports two or more active SIMs; a single SIM is
/// used without prompting. Returns the chosen subscription id, or null when the
/// sheet is dismissed.
Future<int?> showSimPicker(BuildContext context, List<DeviceSim> sims) {
  return showModalBottomSheet<int>(
    context: context,
    showDragHandle: true,
    builder: (sheetContext) {
      final l = AppLocalizations.of(sheetContext)!;
      return SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 6),
              child: Text(
                l.smsChooseSimTitle,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: MdColors.navy900,
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
              child: Text(
                l.smsChooseSimBody,
                style: const TextStyle(
                  fontSize: 12,
                  color: MdColors.mutedForeground,
                ),
              ),
            ),
            Flexible(
              child: ListView.separated(
                shrinkWrap: true,
                itemCount: sims.length,
                separatorBuilder: (_, _) =>
                    const Divider(height: 1, indent: 20, endIndent: 20),
                itemBuilder: (_, i) {
                  final sim = sims[i];
                  return ListTile(
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
                    onTap: () => Navigator.pop(sheetContext, sim.subscriptionId),
                  );
                },
              ),
            ),
            const SizedBox(height: 8),
          ],
        ),
      );
    },
  );
}
