import 'package:flutter/material.dart';

import '../l10n/generated/app_localizations.dart';
import '../theme/md_design.dart';

/// A web-style dark navy sidebar navigation drawer, mirroring the structure of
/// `web/src/components/shell/Sidebar.tsx` (MAIN_NAV + SYSTEM_NAV, role pill,
/// sync footer).
class NavyDrawer extends StatelessWidget {
  const NavyDrawer({
    super.key,
    required this.current,
    required this.onSelect,
    this.role,
    this.width,
  });

  /// Currently active nav key (e.g. 'dashboard', 'products'). An empty/null
  /// value means no item is highlighted.
  final String? current;
  final ValueChanged<String> onSelect;
  final String? role;
  final double? width;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final roleKey = (role ?? 'OWNER').toUpperCase();
    final roleLabel = _roleLabel(l, roleKey);
    final accessNote = _accessNote(l, roleKey);
    final badgeLetter = _badgeLetter(roleKey);

    return SizedBox(
      width: width,
      child: Container(
        color: MdColors.navy950,
        child: SafeArea(
        child: Column(
          children: [
            _DrawerHeader(
              tagline: l.appTagline,
              collapsed: false,
            ),
            _RolePill(
              badgeLetter: badgeLetter,
              roleLabel: roleLabel,
              accessNote: accessNote,
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
                children: [
                  ..._mainNavItems(context).map(
                    (item) => _NavRow(
                      key: ValueKey('main-${item.key}'),
                      icon: item.icon,
                      label: item.label,
                      active: current == item.key,
                      onTap: () => onSelect(item.key),
                    ),
                  ),
                  const _GroupLabel(labelKey: 'system'),
                  ..._systemNavItems(context).map(
                    (item) => _NavRow(
                      key: ValueKey('system-${item.key}'),
                      icon: item.icon,
                      label: item.label,
                      active: current == item.key,
                      onTap: () => onSelect(item.key),
                    ),
                  ),
                  const _GroupLabel(labelKey: 'more'),
                  ..._moreNavItems(context).map(
                    (item) => _NavRow(
                      key: ValueKey('more-${item.key}'),
                      icon: item.icon,
                      label: item.label,
                      active: current == item.key,
                      onTap: () => onSelect(item.key),
                    ),
                  ),
                ],
              ),
            ),
            _SyncFooter(syncText: l.syncOnline),
          ],
        ),
        ),
      ),
    );
  }
}

String _roleLabel(AppLocalizations l, String role) => switch (role) {
      'CASHIER' => l.userRoleCashier,
      'MANAGER' => l.userRoleManager,
      'STOCK_MANAGER' => l.userRoleStockManager,
      'SUPERADMIN' => l.userRolePlatformAdmin,
      'ADMIN' => l.userRoleAdmin,
      'STAFF' => l.userRoleStaff,
      'OWNER' => l.userRoleOwner,
      _ => role,
    };

String _accessNote(AppLocalizations l, String role) => switch (role) {
      'SUPERADMIN' => l.roleAccessPlatform,
      'CASHIER' => l.roleAccessLimited,
      _ => l.roleAccessFull,
    };

String _badgeLetter(String role) => switch (role) {
      'CASHIER' => 'C',
      'OWNER' => 'O',
      'SUPERADMIN' => 'S',
      _ => 'M',
    };

List<_NavRowData> _mainNavItems(BuildContext context) {
  final l = AppLocalizations.of(context)!;
  return [
    _NavRowData(key: 'dashboard', icon: Icons.dashboard_outlined, label: l.navDashboard),
    _NavRowData(key: 'products', icon: Icons.inventory_2_outlined, label: l.navProductsStock),
    _NavRowData(key: 'invoices', icon: Icons.receipt_long_outlined, label: l.navSalesInvoices),
    _NavRowData(key: 'customers', icon: Icons.people_alt_outlined, label: l.navCustomers),
    _NavRowData(key: 'suppliers', icon: Icons.local_shipping_outlined, label: l.sectionSuppliers),
    _NavRowData(key: 'supplierInvoices', icon: Icons.insert_drive_file_outlined, label: l.sectionSupplierInvoices),
    _NavRowData(key: 'expenses', icon: Icons.account_balance_wallet_outlined, label: l.sectionExpenses),
    _NavRowData(key: 'reports', icon: Icons.bar_chart_outlined, label: l.sectionReports),
  ];
}

List<_NavRowData> _systemNavItems(BuildContext context) {
  final l = AppLocalizations.of(context)!;
  return [
    _NavRowData(key: 'settings', icon: Icons.settings_outlined, label: l.sectionSettings),
    _NavRowData(key: 'users', icon: Icons.manage_accounts_outlined, label: l.sectionUsers),
  ];
}

List<_NavRowData> _moreNavItems(BuildContext context) {
  final l = AppLocalizations.of(context)!;
  return [
    _NavRowData(key: 'inventory', icon: Icons.inventory_outlined, label: l.sectionInventory),
    _NavRowData(key: 'purchases', icon: Icons.shopping_cart_outlined, label: l.sectionPurchases),
    _NavRowData(key: 'payments', icon: Icons.account_balance_wallet_outlined, label: l.sectionPayments),
    _NavRowData(key: 'udhaari', icon: Icons.payments_outlined, label: l.sectionUdhaari),
  ];
}

class _NavRowData {
  const _NavRowData({required this.key, required this.icon, required this.label});

  final String key;
  final IconData icon;
  final String label;
}

class _NavRow extends StatelessWidget {
  const _NavRow({super.key, required this.icon, required this.label, required this.active, required this.onTap});

  final IconData icon;
  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 1),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
          decoration: BoxDecoration(
            color: active ? MdColors.navy800 : Colors.transparent,
            borderRadius: BorderRadius.circular(8),
            border: active ? Border.all(color: MdColors.navy700) : null,
          ),
          child: Row(
            children: [
              Icon(
                icon,
                size: 18,
                color: active ? Colors.white : MdColors.navy400,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                    color: active ? Colors.white : MdColors.navy200,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _GroupLabel extends StatelessWidget {
  const _GroupLabel({required this.labelKey});

  final String labelKey;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 14, 12, 6),
      child: Text(
        switch (labelKey) {
          'system' => l.navSystem,
          'more' => l.moreTitle,
          _ => labelKey,
        },
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.bold,
          letterSpacing: 1.6,
          color: MdColors.navy500,
        ),
      ),
    );
  }
}

class _DrawerHeader extends StatelessWidget {
  const _DrawerHeader({required this.tagline, required this.collapsed});

  final String tagline;
  final bool collapsed;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: EdgeInsets.fromLTRB(16, 20, 16, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (!collapsed) ...[
            Container(
              height: 62,
              padding: const EdgeInsets.symmetric(horizontal: 10),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Image.asset(
                'assets/logo.png',
                fit: BoxFit.contain,
                errorBuilder: (_, _, _) => const Icon(
                  Icons.storefront,
                  size: 40,
                  color: MdColors.navy900,
                ),
              ),
            ),
            const SizedBox(height: 10),
            Text(
              tagline,
              maxLines: 2,
              style: const TextStyle(fontSize: 10, color: MdColors.navy300),
            ),
          ],
        ],
      ),
    );
  }
}

class _RolePill extends StatelessWidget {
  const _RolePill({
    required this.badgeLetter,
    required this.roleLabel,
    required this.accessNote,
  });

  final String badgeLetter;
  final String roleLabel;
  final String accessNote;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(8),
        color: MdColors.navy900.withValues(alpha: 0.7),
        border: Border.all(color: MdColors.navy800),
      ),
      child: Row(
        children: [
          Container(
            width: 24,
            height: 24,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(6),
              color: MdColors.royal500.withValues(alpha: 0.2),
            ),
            alignment: Alignment.center,
            child: Text(
              badgeLetter,
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.bold,
                color: MdColors.royal300,
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Role: $roleLabel',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.white),
                ),
                const SizedBox(height: 1),
                Text(
                  accessNote,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 9, color: MdColors.navy300),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SyncFooter extends StatelessWidget {
  const _SyncFooter({required this.syncText});

  final String syncText;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        border: const Border(
          top: BorderSide(color: Color(0xB3162C48)), // navy-800 / 70%
        ),
      ),
      child: Row(
        children: [
          const Icon(Icons.wifi, size: 14, color: MdColors.green400),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              'Sync: $syncText',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: MdColors.green400,
              ),
            ),
          ),
        ],
      ),
    );
  }
}