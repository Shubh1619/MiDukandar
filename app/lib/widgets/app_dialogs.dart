import 'package:flutter/material.dart';

import '../l10n/generated/app_localizations.dart';
import '../theme/md_design.dart';

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