import 'package:flutter/material.dart';

import '../l10n/generated/app_localizations.dart';
import '../l10n/status_labels.dart';
import '../main.dart';
import '../models/app_models.dart';
import '../services/api_service.dart';
import '../theme/md_design.dart';
import '../widgets/app_dialogs.dart';
import '../widgets/md_inputs.dart';

class InventoryScreen extends StatefulWidget {
  const InventoryScreen({
    super.key,
    required this.apiService,
    this.onChanged,
    this.lowOnly,
  });

  final ApiService apiService;
  final Future<void> Function()? onChanged;
  final bool? lowOnly;

  @override
  State<InventoryScreen> createState() => _InventoryScreenState();
}

class _InventoryScreenState extends State<InventoryScreen> {
  final TextEditingController _searchController = TextEditingController();
  bool _lowOnly = false;
  bool _loading = true;
  String? _error;
  List<InventoryStock> _stock = const [];
  ProductSummary _summary = const ProductSummary(
    total: 0, active: 0, low: 0, out: 0, archived: 0, value: 0,
  );
  List<StockMovementLedger> _movements = const [];

  @override
  void initState() {
    super.initState();
    _lowOnly = widget.lowOnly ?? false;
    _load();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final results = await Future.wait<Object>([
        widget.apiService.getInventoryStock(
          lowOnly: _lowOnly,
          search: _searchController.text.trim(),
        ),
        widget.apiService.getProductSummary(),
        widget.apiService.getStockMovements(limit: 30),
      ]);
      if (!mounted) return;
      setState(() {
        _stock = results[0] as List<InventoryStock>;
        _summary = results[1] as ProductSummary;
        _movements = results[2] as List<StockMovementLedger>;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _adjust(InventoryStock item) async {
    final l = AppLocalizations.of(context)!;
    final qtyController = TextEditingController();
    final reasonController = TextEditingController(text: l.invnManualAdjustment);
    bool addMode = true;

    final signedQty = await AppDialogs.showFormSheet<num>(
      context,
      title: l.invnAdjustStockTitle(item.name),
      subtitle: l.invnCurrentBalance('${item.balance} ${item.unit}'),
      builder: (sheetContext) {
        return StatefulBuilder(
          builder: (ctx, setDialogState) {
            return Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SegmentedButton<bool>(
                  segments: [
                    ButtonSegment(
                      value: true,
                      label: Text(l.invnAddPlus),
                      icon: const Icon(Icons.add),
                    ),
                    ButtonSegment(
                      value: false,
                      label: Text(l.invnRemoveMinus),
                      icon: const Icon(Icons.remove),
                    ),
                  ],
                  selected: {addMode},
                  onSelectionChanged: (s) => setDialogState(() => addMode = s.first),
                ),
                const SizedBox(height: 12),
                NumberField(
                  controller: qtyController,
                  allowNegative: true,
                  label: l.invnQuantity,
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: reasonController,
                  decoration: InputDecoration(labelText: l.invnReason),
                ),
                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    TextButton(
                      onPressed: () => Navigator.pop(sheetContext),
                      child: Text(l.cancel),
                    ),
                    const SizedBox(width: 8),
                    FilledButton(
                      onPressed: () {
                        final qty = num.tryParse(qtyController.text.trim());
                        if (qty == null || qty == 0) return;
                        Navigator.pop(sheetContext, addMode ? qty.abs() : -qty.abs());
                      },
                      child: Text(l.save),
                    ),
                  ],
                ),
              ],
            );
          },
        );
      },
    );

    if (signedQty == null || !mounted) return;
    AppDialogs.showLoading(context);
    try {
      await widget.apiService.adjustStock(
        item.id,
        qty: signedQty,
        reason: reasonController.text.trim().isNotEmpty
            ? reasonController.text.trim()
            : l.invnManualAdjustment,
      );
      if (!mounted) return;
      AppDialogs.hideLoading(context);
      AppDialogs.showSuccess(context, l.invnStockUpdated);
      await _load();
      await widget.onChanged?.call();
    } catch (error) {
      if (!mounted) return;
      AppDialogs.hideLoading(context);
      AppDialogs.showError(context, l.invnAdjustFailed(error.toString()));
    }
  }

  void _showMovements() {
    final l = AppLocalizations.of(context)!;
    AppDialogs.showFormSheet<void>(
      context,
      title: l.invnMovementsTitle,
      subtitle: l.invnMovementsSubtitle,
      builder: (sheetContext) {
        if (_movements.isEmpty) {
          return MdEmptyState(
            icon: Icons.history,
            title: l.invnNoMovements,
            subtitle: l.invnNoMovementsSub,
          );
        }
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (final m in _movements) ...[
              _movementTile(context, m),
              const SizedBox(height: 8),
            ],
          ],
        );
      },
    );
  }

  Widget _movementTile(BuildContext context, StockMovementLedger m) {
    final l = AppLocalizations.of(context)!;
    final positive = m.qty > 0;
    return MdCard(
      padding: const EdgeInsets.all(12),
      child: Row(
        children: [
          MdChip(
            label: localizedStatus(context, m.type.toLowerCase()),
            background: positive
                ? MdColors.green100
                : MdColors.red50,
            foreground: positive
                ? MdColors.green700
                : MdColors.red700,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(m.productName ?? '—',
                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                Text(
                  m.note ?? m.referenceType ?? '',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                      fontSize: 11, color: MdColors.mutedForeground),
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '${positive ? '+' : ''}${m.qty}',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  color: positive ? MdColors.green700 : MdColors.red700,
                ),
              ),
              if (m.balanceAfter != null)
                Text('${l.invnBal} ${m.balanceAfter}',
                    style: const TextStyle(
                        fontSize: 10, color: MdColors.mutedForeground)),
            ],
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            MdHeader(
              title: l.sectionInventory,
              subtitle: l.invnHeaderSubtitle,
              trailing: IconButton(
                onPressed: _load,
                tooltip: l.refresh,
                icon: const Icon(Icons.refresh),
              ),
            ),
            const SizedBox(height: 16),
            MdSearchField(
              controller: _searchController,
              onChanged: (_) => _load(),
              hint: l.invnSearchHint,
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _SummaryTile(
                    label: l.invnValueLabel,
                    value: formatINR(_summary.value),
                    icon: Icons.inventory_2_outlined,
                    color: MdColors.navy700,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _SummaryTile(
                    label: l.invnLowStock,
                    value: '${_summary.low}',
                    icon: Icons.warning_amber_outlined,
                    color: MdColors.amber500,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _SummaryTile(
                    label: l.statusOutOfStock,
                    value: '${_summary.out}',
                    icon: Icons.inventory,
                    color: MdColors.red700,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                ChoiceChip(
                  label: Text(l.invnAll),
                  selected: !_lowOnly,
                  onSelected: (_) {
                    setState(() => _lowOnly = false);
                    _load();
                  },
                ),
                const SizedBox(width: 8),
                ChoiceChip(
                  label: Text(l.invnLowOnly),
                  selected: _lowOnly,
                  onSelected: (_) {
                    setState(() => _lowOnly = true);
                    _load();
                  },
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Align(
                    alignment: Alignment.centerRight,
                    child: FittedBox(
                      fit: BoxFit.scaleDown,
                      child: TextButton.icon(
                        onPressed: _showMovements,
                        icon: const Icon(Icons.history, size: 16),
                        label: Text(l.invnMovements),
                      ),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Expanded(
              child: _buildBody(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBody() {
    final l = AppLocalizations.of(context)!;
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return MdEmptyState(
        icon: Icons.cloud_off,
        title: l.invnLoadError,
        subtitle: '$_error',
      );
    }
    if (_stock.isEmpty) {
      return MdEmptyState(
        icon: Icons.inventory_2_outlined,
        title: l.invnNoStock,
        subtitle: l.invnNoStockSub,
      );
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.separated(
        physics: const AlwaysScrollableScrollPhysics(),
        itemCount: _stock.length,
        separatorBuilder: (_, _) => const SizedBox(height: 8),
        itemBuilder: (context, index) {
          final item = _stock[index];
          return MdCard(
            onTap: () => _adjust(item),
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: item.isLow ? MdColors.red50 : MdColors.navy50,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    item.isLow ? Icons.warning_amber_outlined : Icons.inventory_2_outlined,
                    size: 18,
                    color: item.isLow ? MdColors.red700 : MdColors.navy600,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(item.name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                      Text(
                        '${item.category ?? l.invnGeneral} · ${item.sku ?? l.invnNoSku}',
                        style: const TextStyle(fontSize: 11, color: MdColors.mutedForeground),
                      ),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Row(
                      children: [
                        if (item.isLow) ...[
                          MdChip(
                            label: localizedStatus(context, 'LOW'),
                            background: MdColors.red50,
                            foreground: MdColors.red700,
                          ),
                          const SizedBox(width: 6),
                        ],
                        Text(
                          '${item.balance} ${item.unit}',
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                        ),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      l.invnMrp(formatINR(item.sellingPrice).toString()),
                      style: const TextStyle(fontSize: 11, color: MdColors.mutedForeground),
                    ),
                  ],
                ),
                const SizedBox(width: 4),
                const Icon(Icons.chevron_right, color: MdColors.navy300, size: 18),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _SummaryTile extends StatelessWidget {
  const _SummaryTile({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return MdCard(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 16, color: color),
          const SizedBox(height: 6),
          Text(
            value,
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 17, color: color),
          ),
          const SizedBox(height: 2),
          Text(label, style: const TextStyle(fontSize: 10, color: MdColors.mutedForeground)),
        ],
      ),
    );
  }
}