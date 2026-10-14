import 'package:flutter/material.dart';

import '../l10n/generated/app_localizations.dart';
import '../l10n/status_labels.dart';

/// Color tokens mirrored from `web/src/app/globals.css`.
class MdColors {
  MdColors._();

  // navy scale
  static const Color navy50 = Color(0xFFF0F4F9);
  static const Color navy100 = Color(0xFFDCE5F1);
  static const Color navy200 = Color(0xFFB9CBDD);
  static const Color navy300 = Color(0xFF8FAAC4);
  static const Color navy400 = Color(0xFF5E80A5);
  static const Color navy500 = Color(0xFF3C5D83);
  static const Color navy600 = Color(0xFF2A4669);
  static const Color navy700 = Color(0xFF1E3556);
  static const Color navy800 = Color(0xFF162C48);
  static const Color navy900 = Color(0xFF0F2747);
  static const Color navy950 = Color(0xFF091A33);

  // royal (blue) accent
  static const Color royal100 = Color(0xFFDBEAFE);
  static const Color royal300 = Color(0xFF93C5FD);
  static const Color royal400 = Color(0xFF60A5FA);
  static const Color royal500 = Color(0xFF3B82F6);
  static const Color royal600 = Color(0xFF1473E6);

  // green accent
  static const Color green100 = Color(0xFFD3F5E5);
  static const Color green400 = Color(0xFF44C890);
  static const Color green500 = Color(0xFF18B978);
  static const Color green600 = Color(0xFF0FA665);
  static const Color green700 = Color(0xFF0C8553);

  // semantic / neutrals
  static const Color amber500 = Color(0xFFF59E0B);
  static const Color red50 = Color(0xFFFEF2F2);
  static const Color red500 = Color(0xFFEF4444);
  static const Color red700 = Color(0xFFB91C1C);
  static const Color background = Color(0xFFF8FAFC);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color mutedForeground = Color(0xFF64748B);
  static const Color border = Color(0xFFE2E8F0);
  static const Color foreground = Color(0xFF172033);

  static const Color primary = navy900;
  static const Color primaryHover = navy950;
  static const Color cardShadow =
      Color(0x140F2747); // rgb(15 39 71 / 0.08)
}

/// Shared card with the web dashboard's shadow/border language.
class MdCard extends StatelessWidget {
  const MdCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(14),
    this.margin,
    this.color = MdColors.surface,
    this.borderColor = MdColors.border,
    this.radius = 16,
    this.onTap,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry? margin;
  final Color color;
  final Color borderColor;
  final double radius;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: margin,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: borderColor),
        boxShadow: const [
          BoxShadow(
            color: MdColors.cardShadow,
            blurRadius: 16,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(radius),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(radius),
          child: Padding(padding: padding, child: child),
        ),
      ),
    );
  }
}

/// Stat card matching `web/src/components/shared/stat-card.tsx`.
class MdStatCard extends StatelessWidget {
  const MdStatCard({
    super.key,
    required this.label,
    required this.value,
    required this.sub,
    required this.icon,
    this.tone,
    this.onTap,
  });

  final String label;
  final String value;
  final String sub;
  final IconData icon;
  final Color? tone;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return MdCard(
      onTap: onTap,
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  label.toUpperCase(),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.4,
                    color: MdColors.mutedForeground,
                  ),
                ),
              ),
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  color: MdColors.navy50,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, size: 15, color: MdColors.navy600),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Flexible(
            child: FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Text(
                value,
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                  letterSpacing: -0.4,
                  fontFeatures: const [FontFeature.tabularFigures()],
                  color: tone ?? MdColors.foreground,
                ),
              ),
            ),
          ),
          const SizedBox(height: 2),
          Text(
            sub,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 11, color: MdColors.mutedForeground),
          ),
        ],
      ),
    );
  }
}

/// Page title header (title + subtitle + optional trailing widget).
class MdHeader extends StatelessWidget {
  const MdHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.trailing,
  });

  final String title;
  final String? subtitle;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: const TextStyle(fontSize: 26, fontWeight: FontWeight.bold, color: MdColors.navy900)),
              if (subtitle != null) ...[
                const SizedBox(height: 4),
                Text(subtitle!, style: const TextStyle(fontSize: 13, color: MdColors.mutedForeground)),
              ],
            ],
          ),
        ),
        ?trailing,
      ],
    );
  }
}

/// Colored status pill, mirroring web chip styling.
class MdChip extends StatelessWidget {
  const MdChip({
    super.key,
    required this.label,
    this.background,
    this.foreground,
    this.icon,
  });

  final String label;
  final Color? background;
  final Color? foreground;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: background ?? MdColors.navy100,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 11, color: foreground ?? MdColors.navy600),
            const SizedBox(width: 3),
          ],
          Text(
            label,
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.bold,
              color: foreground ?? MdColors.navy600,
            ),
          ),
        ],
      ),
    );
  }

  static const Map<String, Color> _bg = {
    'green': MdColors.green100,
    'amber': Color(0xFFFEF3C7),
    'red': MdColors.red50,
    'blue': MdColors.royal100,
  };

  static const Map<String, Color> _fg = {
    'green': MdColors.green700,
    'amber': Color(0xFF92400E),
    'red': MdColors.red700,
    'blue': MdColors.royal600,
  };

  static MdChip status(BuildContext context, String status) {
    final label = localizedStatus(context, status);
    final key = status.trim().toLowerCase().replaceAll('_', ' ').replaceAll('-', ' ');
    if (key.contains('paid') || key == 'settled' || key == 'active' || key == 'received' || key == 'completed') {
      return MdChip(label: label, background: _bg['green'], foreground: _fg['green']);
    }
    if (key.contains('due') || key.contains('unpaid') || key == 'pending' || key.contains('overdue') || key == 'outstanding' || key == 'void') {
      return MdChip(label: label, background: _bg['red'], foreground: _fg['red']);
    }
    if (key == 'low' || key.contains('stock') || key == 'draft' || key.contains('partial') || key.contains('open')) {
      return MdChip(label: label, background: _bg['amber'], foreground: _fg['amber']);
    }
    return MdChip(label: label, background: _bg['blue'], foreground: _fg['blue']);
  }
}

class MdSearchField extends StatelessWidget {
  const MdSearchField({
    super.key,
    required this.controller,
    required this.onChanged,
    this.hint,
  });

  final TextEditingController controller;
  final ValueChanged<String> onChanged;
  final String? hint;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      onChanged: onChanged,
      decoration: InputDecoration(
        hintText: hint ?? AppLocalizations.of(context)!.searchHint,
        prefixIcon: const Icon(Icons.search, size: 20, color: MdColors.navy400),
        isDense: true,
        filled: true,
        fillColor: MdColors.navy50,
        contentPadding: const EdgeInsets.symmetric(vertical: 12),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: MdColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: MdColors.royal600, width: 1.5),
        ),
      ),
    );
  }
}

class MdEmptyState extends StatelessWidget {
  const MdEmptyState({
    super.key,
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 48, color: MdColors.navy300),
            const SizedBox(height: 12),
            Text(title, style: const TextStyle(fontWeight: FontWeight.w600, color: MdColors.navy700)),
            const SizedBox(height: 4),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: const TextStyle(color: MdColors.mutedForeground, fontSize: 12),
            ),
          ],
        ),
      ),
    );
  }
}

/// App-wide light theme using the web's navy primary + tokens.
ThemeData buildMdTheme() {
  final colorScheme = ColorScheme.fromSeed(
    seedColor: MdColors.navy900,
    primary: MdColors.navy900,
    surface: MdColors.surface,
    brightness: Brightness.light,
  ).copyWith(
    primary: MdColors.navy900,
    surface: MdColors.surface,
    onSurface: MdColors.foreground,
  );

  final base = ThemeData(
    useMaterial3: true,
    colorScheme: colorScheme,
    scaffoldBackgroundColor: MdColors.background,
    appBarTheme: const AppBarTheme(
      centerTitle: false,
      backgroundColor: MdColors.background,
      foregroundColor: MdColors.navy900,
      elevation: 0,
      surfaceTintColor: Colors.transparent,
    ),
    dialogTheme: const DialogThemeData(
      backgroundColor: MdColors.surface,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.all(Radius.circular(20))),
    ),
    bottomSheetTheme: const BottomSheetThemeData(
      backgroundColor: MdColors.surface,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      showDragHandle: false,
    ),
    snackBarTheme: const SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      elevation: 4,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.all(Radius.circular(14))),
    ),
  );

  return base.copyWith(
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: MdColors.navy900,
        foregroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        textStyle: const TextStyle(fontWeight: FontWeight.w600),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: MdColors.surface,
      indicatorColor: MdColors.navy50,
      elevation: 0,
      height: 68,
      labelTextStyle: WidgetStateProperty.resolveWith((states) {
        final selected = states.contains(WidgetState.selected);
        return TextStyle(
          fontSize: 11,
          fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
          color: selected ? MdColors.navy900 : MdColors.mutedForeground,
        );
      }),
      iconTheme: WidgetStateProperty.resolveWith((states) {
        final selected = states.contains(WidgetState.selected);
        return IconThemeData(
          color: selected ? MdColors.navy900 : MdColors.navy400,
          size: 22,
        );
      }),
    ),
    dividerTheme: const DividerThemeData(color: MdColors.border),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: MdColors.navy50,
      labelStyle: const TextStyle(color: MdColors.navy500),
      hintStyle: const TextStyle(color: MdColors.navy300),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: MdColors.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: MdColors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: MdColors.royal600, width: 1.5),
      ),
    ),
  );
}

/// Numeric display style with tabular figures (web: `tabular-nums`).
const TextStyle mdTabular = TextStyle(
  fontFeatures: [FontFeature.tabularFigures()],
);