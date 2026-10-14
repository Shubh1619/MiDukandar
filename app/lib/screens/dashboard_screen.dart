import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../l10n/generated/app_localizations.dart';
import '../main.dart';
import '../models/app_models.dart';
import '../theme/md_design.dart';

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({
    super.key,
    required this.stats,
    required this.storeName,
    required this.onNavigate,
    this.onLowStockTap,
    this.onInvoiceDetailTap,
  });

  final DashboardStats stats;
  final String storeName;
  final ValueChanged<AppSection> onNavigate;
  final VoidCallback? onLowStockTap;
  final VoidCallback? onInvoiceDetailTap;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          MdHeader(
            title: l.dashTitle,
            subtitle: l.dashHeaderSubtitle(storeName),
            trailing: const _DigitalClock(),
          ),
          const SizedBox(height: 20),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              childAspectRatio: 1.45,
            ),
            itemCount: 4,
            itemBuilder: (context, index) {
              return switch (index) {
                0 => MdStatCard(
                    label: l.dashSalesToday,
                    value: formatINR(stats.todaySales),
                    sub: l.dashSalesTodaySub,
                    icon: Icons.currency_rupee,
                  ),
                1 => MdStatCard(
                    label: l.dashPurchasesToday,
                    value: formatINR(stats.todayPurchases),
                    sub: l.dashPurchasesTodaySub,
                    icon: Icons.local_shipping_outlined,
                  ),
                2 => MdStatCard(
                    label: l.dashProfitToday,
                    value: formatINR(stats.todayProfit),
                    sub: l.dashProfitTodaySub,
                    icon: Icons.trending_up,
                    tone: MdColors.green600,
                  ),
                _ => MdStatCard(
                    label: l.dashCustomerUdhaari,
                    value: formatINR(stats.receivables),
                    sub: l.dashCustomerUdhaariSub,
                    icon: Icons.account_balance_wallet_outlined,
                  ),
              };
            },
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _InfoCard(
                  title: l.dashSupplierPayables,
                  icon: Icons.payments_outlined,
                  value: formatINR(stats.payables),
                  sub: l.dashSupplierPayablesSub,
                  iconBg: MdColors.navy50,
                  iconFg: MdColors.navy600,
                  onTap: () => onNavigate(AppSection.purchases),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _InfoCard(
                  title: l.dashLowStock,
                  icon: Icons.warning_amber_outlined,
                  value: '${stats.lowStockCount}',
                  sub: l.dashLowStockSub,
                  iconBg: MdColors.red50,
                  iconFg: MdColors.red700,
                  valueColor: MdColors.red700,
                  onTap: onLowStockTap,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _QuickControls(onNavigate: onNavigate),
          const SizedBox(height: 20),
          Row(
            children: [
              Expanded(
                child: Text(
                  l.dashRecentTransactions,
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16, color: MdColors.navy900),
                ),
              ),
              GestureDetector(
                onTap: onInvoiceDetailTap,
                child: Text(
                  l.dashViewAll,
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: MdColors.navy700),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (stats.recentTransactions.isEmpty)
            MdEmptyState(
              icon: Icons.receipt_long_outlined,
              title: l.dashNoTransactions,
              subtitle: l.dashNoTransactionsSub,
            )
          else
            ...stats.recentTransactions.map((tx) => _RecentTile(tx: tx)),
        ],
      ),
    );
  }
}

class _QuickControls extends StatelessWidget {
  const _QuickControls({required this.onNavigate});

  final ValueChanged<AppSection> onNavigate;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final actions = <(IconData, String, AppSection)>[
      (Icons.inventory_2_outlined, l.sectionInventory, AppSection.inventory),
      (Icons.receipt_long_outlined, l.dashQuickInvoices, AppSection.reports),
      (Icons.handshake_outlined, l.sectionUdhaari, AppSection.udhaari),
      (Icons.bar_chart_outlined, l.dashQuickReports, AppSection.reports),
    ];
    return MdCard(
      padding: const EdgeInsets.all(16),
      color: MdColors.navy950,
      borderColor: MdColors.navy900,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            l.dashQuickControls,
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: Colors.white),
          ),
          const SizedBox(height: 12),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              mainAxisSpacing: 10,
              crossAxisSpacing: 10,
              childAspectRatio: 3.4,
            ),
            itemCount: actions.length,
            itemBuilder: (context, index) {
              final (icon, label, section) = actions[index];
              return InkWell(
                onTap: () => onNavigate(section),
                borderRadius: BorderRadius.circular(12),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  decoration: BoxDecoration(
                    color: MdColors.navy900,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: MdColors.navy800),
                  ),
                  child: Row(
                    children: [
                      Icon(icon, size: 17, color: MdColors.royal400),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.white)),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  const _InfoCard({
    required this.title,
    required this.icon,
    required this.value,
    required this.sub,
    required this.iconBg,
    required this.iconFg,
    this.valueColor,
    this.onTap,
  });

  final String title;
  final IconData icon;
  final String value;
  final String sub;
  final Color iconBg;
  final Color iconFg;
  final Color? valueColor;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return MdCard(
      onTap: onTap,
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 24,
                height: 24,
                decoration: BoxDecoration(color: iconBg, borderRadius: BorderRadius.circular(7)),
                child: Icon(icon, size: 14, color: iconFg),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: MdColors.navy900)),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            value,
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.bold,
              fontFeatures: const [FontFeature.tabularFigures()],
              color: valueColor ?? MdColors.foreground,
            ),
          ),
          const SizedBox(height: 2),
          Text(sub, style: const TextStyle(fontSize: 11, color: MdColors.mutedForeground)),
        ],
      ),
    );
  }
}

class _DigitalClock extends StatelessWidget {
  const _DigitalClock();

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final now = DateTime.now();
    final hh = ((now.hour % 12) == 0 ? 12 : now.hour % 12).toString().padLeft(2, '0');
    final mm = now.minute.toString().padLeft(2, '0');
    final ampm = now.hour < 12 ? l.dashTimeAm : l.dashTimePm;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: BoxDecoration(
            color: Colors.black,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.red.shade900.withOpacity(0.4)),
            boxShadow: [BoxShadow(color: Colors.red.shade500.withOpacity(0.2), blurRadius: 16, spreadRadius: -4)],
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('$hh:$mm', style: const TextStyle(color: MdColors.red500, fontWeight: FontWeight.bold, fontSize: 20, letterSpacing: 2, fontFamily: 'monospace')),
              const SizedBox(width: 6),
              Text(ampm, style: const TextStyle(color: MdColors.red500, fontWeight: FontWeight.bold, fontSize: 10, letterSpacing: 2)),
            ],
          ),
        ),
        const SizedBox(height: 4),
        Text(
          DateFormat('EEE, d MMM').format(now),
          style: const TextStyle(color: MdColors.mutedForeground, fontSize: 11),
        ),
      ],
    );
  }
}

class _RecentTile extends StatelessWidget {
  const _RecentTile({required this.tx});

  final RecentTransaction tx;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final isSale = tx.type.toUpperCase() == 'SALE';
    final isPurchase = tx.type.toUpperCase() == 'PURCHASE';
    final typeLabel = isSale ? l.dashTypeSale : (isPurchase ? l.dashTypePurchase : l.dashTypePayment);

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: MdColors.border),
        color: MdColors.surface,
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          children: [
            Row(
              children: [
                MdChip(
                  label: typeLabel,
                  background: isSale ? MdColors.green100 : (isPurchase ? MdColors.navy100 : MdColors.royal100),
                  foreground: isSale ? MdColors.green700 : (isPurchase ? MdColors.navy600 : MdColors.royal600),
                ),
                const SizedBox(width: 8),
                Flexible(
                  child: Text(
                    tx.number,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                  ),
                ),
                const Spacer(),
                Text(formatINR(tx.amount), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
              ],
            ),
            const SizedBox(height: 6),
            Row(
              children: [
                Expanded(
                  child: Text(
                    tx.party,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: MdColors.mutedForeground, fontSize: 12),
                  ),
                ),
                const SizedBox(width: 8),
                Flexible(
                  child: Text(
                    tx.mode ?? '-',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: MdColors.mutedForeground, fontSize: 11),
                  ),
                ),
                const SizedBox(width: 12),
                Flexible(
                  child: Text(
                    _formatWhen(tx.createdAt),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: MdColors.mutedForeground, fontSize: 11),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

String _formatWhen(String? raw) {
  if (raw == null || raw.isEmpty) return '';
  try {
    final dt = DateTime.parse(raw).toLocal();
    return DateFormat('d MMM HH:mm').format(dt);
  } catch (_) {
    return raw;
  }
}