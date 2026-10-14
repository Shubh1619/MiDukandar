import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../l10n/generated/app_localizations.dart';
import '../models/app_models.dart';
import '../theme/md_design.dart';

/// Brand palette used to tint the user's avatar circle.
const List<Color> _avatarPalette = [
  MdColors.navy900,
  Color(0xFF1473E6), // royal600
  Color(0xFF0FA665), // green600
  MdColors.navy700,
];

String _initialsFor(AuthUser? user) {
  final name = (user?.name ?? '').trim();
  if (name.isNotEmpty) {
    final parts = name.split(RegExp(r'\s+'));
    if (parts.length == 1) {
      return parts.first.characters.take(2).toString().toUpperCase();
    }
    return (parts.first.characters.first.toString() +
            parts.last.characters.first.toString())
        .toUpperCase();
  }
  // Fall back to email first character if name unavailable
  final email = (user?.email ?? '').trim();
  if (email.isNotEmpty) {
    return email.characters.first.toUpperCase();
  }
  // Final fallback - never show '?'
  return 'U';
}

Color _avatarColorFor(AuthUser? user) {
  final seed = user?.email ?? user?.id ?? '';
  if (seed.isEmpty) return MdColors.navy900;
  return _avatarPalette[seed.hashCode.abs() % _avatarPalette.length];
}

/// Avatar trigger on the app bar plus an overlay dropdown that exposes the
/// signed-in user and shortcuts to Business Profile / Settings / Sign Out.
class ProfileMenu extends StatefulWidget {
  const ProfileMenu({
    super.key,
    this.user,
    required this.onBusinessProfile,
    required this.onSettings,
    required this.onSignOut,
  });

  final AuthUser? user;
  final VoidCallback onBusinessProfile;
  final VoidCallback onSettings;
  final Future<void> Function() onSignOut;

  @override
  State<ProfileMenu> createState() => _ProfileMenuState();
}

class _ProfileMenuState extends State<ProfileMenu> {
  OverlayEntry? _entry;

  void _toggle() {
    if (_entry != null) {
      _close();
    } else {
      _open();
    }
  }

  void _close() {
    _entry?.remove();
    _entry = null;
  }

  void _open() {
    final overlay = Overlay.maybeOf(context);
    final renderBox = context.findRenderObject() as RenderBox?;
    if (overlay == null || renderBox == null || !renderBox.attached) return;

    final anchor = renderBox.localToGlobal(Offset.zero) & renderBox.size;
    final menuWidth = math.min(288.0, MediaQuery.sizeOf(context).width - 24);

    _entry = OverlayEntry(
      builder: (overlayContext) {
        final screen = MediaQuery.sizeOf(overlayContext);
        final maxLeft = math.max(8.0, screen.width - menuWidth - 8.0);
        final left = (anchor.right - menuWidth).clamp(8.0, maxLeft);
        final top =
            math.max(0.0, math.min(anchor.bottom + 6, screen.height - 300));
        return Stack(
          children: [
            Positioned.fill(
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: _close,
                child: const SizedBox.expand(),
              ),
            ),
            Positioned(
              left: left,
              top: top,
              width: menuWidth,
              child: _ProfileDropdown(
                user: widget.user,
                onBusinessProfile: () {
                  _close();
                  widget.onBusinessProfile.call();
                },
                onSettings: () {
                  _close();
                  widget.onSettings.call();
                },
                onSignOut: () {
                  _close();
                  widget.onSignOut.call();
                },
              ),
            ),
          ],
        );
      },
    );
    overlay.insert(_entry!);
  }

  @override
  void dispose() {
    _close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: AppLocalizations.of(context)!.menuViewBusinessProfile,
      child: Material(
        color: Colors.transparent,
        shape: const CircleBorder(),
        child: InkWell(
          key: const Key('profile-menu-trigger'),
          customBorder: const CircleBorder(),
          onTap: _toggle,
          child: const Padding(
            padding: EdgeInsets.all(4),
            child: _Avatar(size: 36, fontSize: 12),
          ),
        ),
      ),
    );
  }
}

class _Avatar extends StatelessWidget {
  const _Avatar({this.user, this.size = 44, this.fontSize = 14});

  final AuthUser? user;
  final double size;
  final double fontSize;

  @override
  Widget build(BuildContext context) {
    // Show neutral placeholder when user data isn't available yet
    if (user == null) {
      return Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: MdColors.navy200,
          shape: BoxShape.circle,
        ),
      );
    }

    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: _avatarColorFor(user),
        shape: BoxShape.circle,
      ),
      child: Text(
        _initialsFor(user),
        style: TextStyle(
          color: Colors.white,
          fontSize: fontSize,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

/// Animated popup card: header with avatar + name/email, divider, menu rows
/// styled like the More screen's icon chips, then Sign Out.
class _ProfileDropdown extends StatefulWidget {
  const _ProfileDropdown({
    required this.user,
    required this.onBusinessProfile,
    required this.onSettings,
    required this.onSignOut,
  });

  final AuthUser? user;
  final VoidCallback onBusinessProfile;
  final VoidCallback onSettings;
  final VoidCallback onSignOut;

  @override
  State<_ProfileDropdown> createState() => _ProfileDropdownState();
}

class _ProfileDropdownState extends State<_ProfileDropdown>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _fade;
  late final Animation<Offset> _slide;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 180),
    );
    final curved =
        CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic);
    _fade = curved;
    _slide = Tween<Offset>(
      begin: const Offset(0, -0.06),
      end: Offset.zero,
    ).animate(curved);
    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final user = widget.user;
    final name = (user?.name ?? '').trim();
    final email = (user?.email ?? '').trim();
    final subtitle = email.isNotEmpty ? email : (user?.phone ?? '').trim();
    return FadeTransition(
      opacity: _fade,
      child: SlideTransition(
        position: _slide,
        child: Container(
          decoration: BoxDecoration(
            color: MdColors.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: MdColors.border),
            boxShadow: const [
              BoxShadow(
                color: MdColors.cardShadow,
                blurRadius: 24,
                offset: Offset(0, 10),
              ),
            ],
          ),
          clipBehavior: Clip.antiAlias,
          child: Material(
            type: MaterialType.transparency,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 14),
                  child: Row(
                    children: [
                      _Avatar(user: user),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              name.isEmpty ? '—' : name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                                color: MdColors.navy900,
                              ),
                            ),
                            if (subtitle.isNotEmpty) ...[
                              const SizedBox(height: 2),
                              Text(
                                subtitle,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: MdColors.mutedForeground,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const Divider(height: 1, thickness: 1),
                _DropdownItem(
                  icon: Icons.storefront_outlined,
                  label: l.menuViewBusinessProfile,
                  onTap: widget.onBusinessProfile,
                ),
                _DropdownItem(
                  icon: Icons.settings_outlined,
                  label: l.moreSettings,
                  onTap: widget.onSettings,
                ),
                const Divider(height: 1, thickness: 1),
                _DropdownItem(
                  icon: Icons.logout,
                  label: l.signOut,
                  onTap: widget.onSignOut,
                  danger: true,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _DropdownItem extends StatelessWidget {
  const _DropdownItem({
    required this.icon,
    required this.label,
    required this.onTap,
    this.danger = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool danger;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: SizedBox(
        height: 52,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: danger ? MdColors.red50 : MdColors.navy50,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  icon,
                  size: 18,
                  color: danger ? MdColors.red700 : MdColors.navy600,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w600,
                    color: danger ? MdColors.red700 : MdColors.navy900,
                  ),
                ),
              ),
              Icon(
                Icons.chevron_right,
                size: 18,
                color: danger ? MdColors.red700 : MdColors.navy300,
              ),
            ],
          ),
        ),
      ),
    );
  }
}