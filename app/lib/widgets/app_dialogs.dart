import 'package:flutter/material.dart';

import '../l10n/generated/app_localizations.dart';
import '../models/app_models.dart';
import '../theme/md_design.dart';

/// Product expiry alert dialog: lists already-expired products (red) and
/// products expiring within the store's configured window (amber). Shown once
/// per app session from the auth gate. Returns when dismissed.
Future<void> showExpiryAlertDialog(BuildContext context, ExpiryAlert alert) {
  return showDialog<void>(
    context: context,
    builder: (dialogContext) {
      return AlertDialog(
        backgroundColor: MdColors.surface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Padding(
          padding: const EdgeInsets.only(top: 8),
          child: Row(
            children: [
              Icon(
                alert.expired.isNotEmpty ? Icons.error_outline : Icons.schedule,
                color: alert.expired.isNotEmpty ? MdColors.red700 : MdColors.amber500,
                size: 22,
              ),
              const SizedBox(width: 10),
              const Expanded(
                child: Text(
                  'Product expiry alert',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: MdColors.navy900),
                ),
              ),
            ],
          ),
        ),
        content: SizedBox(
          width: 360,
          child: ConstrainedBox(
            constraints: BoxConstraints(maxHeight: MediaQuery.of(dialogContext).size.height * 0.5),
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (alert.expired.isNotEmpty) ...[
                    _expiryGroupHeader('Expired (${alert.expired.length})', MdColors.red700),
                    ...alert.expired.map((p) => _expiryTile(p, true)),
                  ],
                  if (alert.expiringSoon.isNotEmpty) ...[
                    if (alert.expired.isNotEmpty) const SizedBox(height: 12),
                    _expiryGroupHeader(
                      'Expiring within ${alert.warningDays} day${alert.warningDays == 1 ? '' : 's'} (${alert.expiringSoon.length})',
                      MdColors.amber500,
                    ),
                    ...alert.expiringSoon.map((p) => _expiryTile(p, false)),
                  ],
                ],
              ),
            ),
          ),
        ),
        actionsPadding: const EdgeInsets.fromLTRB(16, 4, 16, 14),
        actions: [
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: MdColors.navy900, foregroundColor: Colors.white),
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: const Text('Got it'),
          ),
        ],
      );
    },
  );
}

Widget _expiryGroupHeader(String text, Color color) {
  return Padding(
    padding: const EdgeInsets.only(bottom: 6),
    child: Text(
      text.toUpperCase(),
      style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: color, letterSpacing: 0.5),
    ),
  );
}

Widget _expiryTile(ExpiringProduct p, bool expired) {
  final dateText = p.expiryDate ?? '';
  final label = expired
      ? '$dateText · ${p.daysLeft.abs()} day${p.daysLeft.abs() == 1 ? '' : 's'} overdue'
      : (p.daysLeft == 0
          ? '$dateText · expires today'
          : '$dateText · in ${p.daysLeft} day${p.daysLeft == 1 ? '' : 's'}');
  return Container(
    margin: const EdgeInsets.only(bottom: 6),
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
    decoration: BoxDecoration(
      color: expired ? const Color(0xFFFDECEC) : const Color(0xFFFFF7E6),
      borderRadius: BorderRadius.circular(10),
      border: Border.all(color: expired ? const Color(0xFFF5C2C2) : const Color(0xFFF3D9A4)),
    ),
    child: Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                p.name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontWeight: FontWeight.w700, color: MdColors.navy900, fontSize: 14),
              ),
              const SizedBox(height: 2),
              Text(label, style: const TextStyle(fontSize: 11.5, color: MdColors.mutedForeground)),
            ],
          ),
        ),
        const SizedBox(width: 8),
        Text(
          expired ? 'Expired' : 'Expiring',
          style: TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w800,
            color: expired ? MdColors.red700 : MdColors.amber500,
          ),
        ),
      ],
    ),
  );
}

/// Low-stock alert dialog: lists products whose balance has fallen to or below
/// their minimum level. Shown once per app session from the auth gate.
Future<void> showLowStockAlertDialog(BuildContext context, List<LowStockProduct> items) {
  return showDialog<void>(
    context: context,
    builder: (dialogContext) {
      return AlertDialog(
        backgroundColor: MdColors.surface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Padding(
          padding: const EdgeInsets.only(top: 8),
          child: Row(
            children: [
              const Icon(Icons.inventory_2_outlined, color: MdColors.amber500, size: 22),
              const SizedBox(width: 10),
              const Expanded(
                child: Text(
                  'Low stock alert',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: MdColors.navy900),
                ),
              ),
            ],
          ),
        ),
        content: SizedBox(
          width: 360,
          child: ConstrainedBox(
            constraints: BoxConstraints(maxHeight: MediaQuery.of(dialogContext).size.height * 0.5),
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    '${items.length} product${items.length == 1 ? '' : 's'} at or below the minimum level. Restock before running out.',
                    style: const TextStyle(fontSize: 13, color: MdColors.mutedForeground, height: 1.4),
                  ),
                  const SizedBox(height: 10),
                  ...items.map(_lowStockTile),
                ],
              ),
            ),
          ),
        ),
        actionsPadding: const EdgeInsets.fromLTRB(16, 4, 16, 14),
        actions: [
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: MdColors.navy900, foregroundColor: Colors.white),
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: const Text('Got it'),
          ),
        ],
      );
    },
  );
}

Widget _lowStockTile(LowStockProduct p) {
  return Container(
    margin: const EdgeInsets.only(bottom: 6),
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
    decoration: BoxDecoration(
      color: const Color(0xFFFFF7E6),
      borderRadius: BorderRadius.circular(10),
      border: Border.all(color: const Color(0xFFF3D9A4)),
    ),
    child: Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                p.name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontWeight: FontWeight.w700, color: MdColors.navy900, fontSize: 14),
              ),
              const SizedBox(height: 2),
              Text('${p.balance} left · minimum ${p.minStock}',
                  style: const TextStyle(fontSize: 11.5, color: MdColors.mutedForeground)),
            ],
          ),
        ),
        const SizedBox(width: 8),
        const Text(
          'Low stock',
          style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: MdColors.amber500),
        ),
      ],
    ),
  );
}

/// Shared popup API. Every screen routes its confirmations, form/input
/// popups, success/error feedback and loading states through this class so the
/// whole app uses one consistent popup system instead of ad-hoc Dialog /
/// SnackBar / bottom-sheet mix-ups.
///
/// Categories:
///  - [showConfirm]    centered confirm dialog; destructive => red confirm
///  - [showFormSheet]  rounded draggable bottom sheet for forms / details
///  - [showSuccess] / [showError] / [showWarning]   icon + color coded SnackBar
///  - [showLoading] / [hideLoading]  blocking overlay (disables background)
class AppDialogs {
  AppDialogs._();

  static bool _loadingVisible = false;

  /// Centered confirmation dialog with Cancel/Confirm. Returns `true` when the
  /// user confirms, `false` otherwise. Destructive actions get a red button.
  static Future<bool> showConfirm(
    BuildContext context, {
    required String title,
    String? message,
    String? confirmLabel,
    String? cancelLabel,
    bool destructive = false,
  }) async {
    final l = AppLocalizations.of(context)!;
    final result = await showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          backgroundColor: MdColors.surface,
          surfaceTintColor: Colors.transparent,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(
              title,
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: MdColors.navy900,
              ),
            ),
          ),
          content: message == null
              ? null
              : Text(
                  message,
                  style: const TextStyle(
                    fontSize: 14.5,
                    color: MdColors.mutedForeground,
                    height: 1.4,
                  ),
                ),
          actionsPadding: const EdgeInsets.fromLTRB(16, 4, 16, 14),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              style: TextButton.styleFrom(foregroundColor: MdColors.navy600),
              child: Text(cancelLabel ?? l.cancel),
            ),
            FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: destructive ? MdColors.red700 : MdColors.navy900,
                foregroundColor: Colors.white,
              ),
              onPressed: () => Navigator.of(dialogContext).pop(true),
              child: Text(confirmLabel ?? l.confirm),
            ),
          ],
        );
      },
    );
    return result ?? false;
  }

  /// Rounded, scrollable bottom sheet for forms / input / detail views.
  /// Dismisses by dragging down, tapping the backdrop or the close button.
  static Future<T?> showFormSheet<T>(
    BuildContext context, {
    required String title,
    String? subtitle,
    required WidgetBuilder builder,
  }) {
    return showModalBottomSheet<T>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      barrierColor: const Color(0x66091A33),
      builder: (sheetContext) {
        final bottomInset =
            MediaQuery.of(sheetContext).viewInsets.bottom +
                MediaQuery.of(sheetContext).padding.bottom;
        return Container(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.of(sheetContext).size.height * 0.92,
          ),
          decoration: const BoxDecoration(
            color: MdColors.surface,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 10),
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: MdColors.navy200,
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 12, 8, 0),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            title,
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                              color: MdColors.navy900,
                            ),
                          ),
                          if (subtitle != null) ...[
                            const SizedBox(height: 2),
                            Text(
                              subtitle,
                              style: const TextStyle(
                                fontSize: 12.5,
                                color: MdColors.mutedForeground,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    IconButton(
                      onPressed: () => Navigator.of(sheetContext).pop(),
                      visualDensity: VisualDensity.compact,
                      icon: const Icon(Icons.close, color: MdColors.navy400),
                    ),
                  ],
                ),
              ),
              const Divider(height: 22, indent: 20, endIndent: 20),
              Flexible(
                child: SingleChildScrollView(
                  padding: EdgeInsets.fromLTRB(20, 2, 20, 24 + bottomInset),
                  child: builder(sheetContext),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  /// Success feedback, auto-dismisses, positioned above the bottom nav bar.
  static void showSuccess(BuildContext context, String message) {
    _feedback(context, message,
        color: MdColors.green600, icon: Icons.check_circle_outline);
  }

  /// Error feedback, auto-dismisses, positioned above the bottom nav bar.
  static void showError(BuildContext context, String message) {
    _feedback(context, message,
        color: MdColors.red700, icon: Icons.error_outline);
  }

  /// Warning feedback, auto-dismisses, positioned above the bottom nav bar.
  static void showWarning(BuildContext context, String message) {
    _feedback(context, message,
        color: MdColors.amber500, icon: Icons.warning_amber_outlined);
  }

  static void _feedback(
    BuildContext context,
    String message, {
    required Color color,
    required IconData icon,
  }) {
    if (!context.mounted) return;
    final messenger = ScaffoldMessenger.of(context);
    messenger.hideCurrentSnackBar();
    messenger.showSnackBar(
      SnackBar(
        content: Row(
          children: [
            Icon(icon, color: Colors.white, size: 19),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                message,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w500,
                  fontSize: 14,
                ),
              ),
            ),
          ],
        ),
        backgroundColor: color,
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 3),
        margin: const EdgeInsets.fromLTRB(12, 8, 12, 12),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        elevation: 4,
      ),
    );
  }

  /// Blocking loading overlay. Disables all background interaction until
  /// [hideLoading] is called (or the loading dialog is dismissed).
  static void showLoading(BuildContext context, {String? message}) {
    if (_loadingVisible) return;
    _loadingVisible = true;
    final l = AppLocalizations.of(context)!;
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      useRootNavigator: true,
      builder: (dialogContext) => PopScope(
        canPop: false,
        child: AlertDialog(
          backgroundColor: MdColors.surface,
          surfaceTintColor: Colors.transparent,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          content: Row(
            children: [
              const SizedBox(
                width: 28,
                height: 28,
                child: CircularProgressIndicator(
                  strokeWidth: 3,
                  color: MdColors.navy700,
                ),
              ),
              const SizedBox(width: 18),
              Expanded(
                child: Text(
                  message ?? l.pleaseWait,
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    color: MdColors.navy800,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    ).then((_) => _loadingVisible = false);
  }

  /// Hides the blocking loading overlay started by [showLoading].
  static void hideLoading(BuildContext context) {
    if (!_loadingVisible) return;
    _loadingVisible = false;
    try {
      final navigator = Navigator.of(context, rootNavigator: true);
      if (navigator.canPop()) navigator.pop();
    } catch (_) {
      // Context is no longer mounted; nothing to dismiss.
    }
  }
}