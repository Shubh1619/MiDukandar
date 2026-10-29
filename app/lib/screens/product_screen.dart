import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../l10n/generated/app_localizations.dart';
import '../l10n/status_labels.dart';
import '../models/app_models.dart';
import '../services/api_service.dart';
import '../theme/md_design.dart';
import '../widgets/app_dialogs.dart';
import '../widgets/md_inputs.dart';

class ProductScreen extends StatefulWidget {
  const ProductScreen({
    super.key,
    required this.apiService,
    this.onCreate,
    this.onUpdate,
    this.onArchive,
    this.onAdjust,
    this.onFetchDetail,
  });

  final ApiService apiService;
  final Future<void> Function(Map<String, dynamic>)? onCreate;
  final Future<void> Function(String id, Map<String, dynamic>)? onUpdate;
  final Future<void> Function(String id)? onArchive;
  final Future<void> Function(String id, num qty, String reason)? onAdjust;
  final Future<Map<String, dynamic>?> Function(String id)? onFetchDetail;

  @override
  State<ProductScreen> createState() => _ProductScreenState();
}

class _ProductScreenState extends State<ProductScreen> {
  final TextEditingController _searchController = TextEditingController();
  String _query = '';
  String? _selectedCategory;
  ProductSummary? _summary;
  List<String> _categories = [];
  List<Product> _products = const [];
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final results = await Future.wait([
        widget.apiService.getProducts(),
        widget.apiService.getProductSummary(),
        widget.apiService.getProductCategories(),
      ]);
      if (!mounted) return;
      setState(() {
        _products = results[0] as List<Product>;
        _summary = results[1] as ProductSummary;
        _categories = results[2] as List<String>;
        _error = null;
      });
    } catch (e) {
      debugPrint('Failed to load products: $e');
      if (!mounted) return;
      setState(() => _error = e.toString());
    }
  }

  List<Product> get _filtered {
    final query = _query.trim().toLowerCase();
    return _products.where((p) {
      if (_selectedCategory != null && p.category != _selectedCategory) return false;
      if (query.isEmpty) return true;
      if (p.name.toLowerCase().contains(query)) return true;
      if ((p.sku ?? '').toLowerCase().contains(query)) return true;
      if ((p.barcode ?? '').toLowerCase().contains(query)) return true;
      return false;
    }).toList();
  }

  Future<void> _showCreateDialog(BuildContext context) async {
    final l = AppLocalizations.of(context)!;
    final nameController = TextEditingController();
    final categoryController = TextEditingController();
    final unitController = TextEditingController(text: 'pc');
    final priceController = TextEditingController();
    final purchaseController = TextEditingController();
    final stockController = TextEditingController(text: '0');
    final minStockController = TextEditingController(text: '0');
    final gstController = TextEditingController(text: '0');
    final expiryController = TextEditingController();

    final result = await AppDialogs.showFormSheet<Map<String, dynamic>>(
      context,
      title: l.prodAddTitle,
      builder: (sheetContext) {
        return Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameController,
              decoration: InputDecoration(labelText: l.prodProductName),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: categoryController,
              decoration: InputDecoration(labelText: l.prodCategory),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: unitController,
                    decoration: InputDecoration(labelText: l.prodUnit),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: NumberField(
                    controller: stockController,
                    decimals: 0,
                    label: l.prodOpeningStock,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: NumberField(
                    controller: priceController,
                    label: l.prodSellingPrice,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: NumberField(
                    controller: purchaseController,
                    label: l.prodPurchasePrice,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: NumberField(
                    controller: minStockController,
                    label: l.prodMinStock,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: NumberField(
                    controller: gstController,
                    label: l.prodGstPercent,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            TextField(
              controller: expiryController,
              decoration: const InputDecoration(labelText: 'Expiry date (YYYY-MM-DD)'),
              keyboardType: TextInputType.datetime,
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: TextButton(
                    onPressed: () => Navigator.pop(sheetContext),
                    child: Text(l.cancel),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  flex: 2,
                  child: FilledButton(
                    onPressed: () {
                      final name = nameController.text.trim();
                      if (name.isEmpty || widget.onCreate == null) {
                        Navigator.pop(sheetContext);
                        return;
                      }
                      final payload = {
                        'name': name,
                        'category': categoryController.text.trim().isNotEmpty ? categoryController.text.trim() : 'General',
                        'unit': unitController.text.trim().isNotEmpty ? unitController.text.trim() : 'pc',
                        'sellingPrice': num.tryParse(priceController.text.trim()) ?? 0,
                        'purchasePrice': num.tryParse(purchaseController.text.trim()) ?? num.tryParse(priceController.text.trim()) ?? 0,
                        'openingStock': num.tryParse(stockController.text.trim()) ?? 0,
                        'gstPercent': num.tryParse(gstController.text.trim()) ?? 0,
                        'minStock': num.tryParse(minStockController.text.trim()) ?? 0,
                        if (expiryController.text.trim().isNotEmpty) 'expiryDate': expiryController.text.trim(),
                      };
                      Navigator.pop(sheetContext, payload);
                    },
                    child: Text(l.save),
                  ),
                ),
              ],
            ),
          ],
        );
      },
    );
    // Function-locals scoped to this dialog; dispose before returning so the
    // sheet's controllers aren't retained after it closes.
    nameController.dispose();
    categoryController.dispose();
    unitController.dispose();
    priceController.dispose();
    purchaseController.dispose();
    stockController.dispose();
    minStockController.dispose();
    gstController.dispose();
    expiryController.dispose();
    if (result != null && widget.onCreate != null) {
      if (!context.mounted) return;
      AppDialogs.showLoading(context);
      try {
        await widget.onCreate!(result);
      } finally {
        if (context.mounted) AppDialogs.hideLoading(context);
      }
    }
  }

  Future<void> _showEditDialog(BuildContext context, Product product) async {
    final l = AppLocalizations.of(context)!;
    final nameController = TextEditingController(text: product.name);
    final categoryController = TextEditingController(text: product.category ?? l.prodGeneral);
    final unitController = TextEditingController(text: product.unit);
    final priceController = TextEditingController(text: product.sellingPrice.toString());
    final purchaseController = TextEditingController(text: (product.purchasePrice ?? product.sellingPrice).toString());
    final gstController = TextEditingController(text: (product.gstPercent ?? 0).toString());
    final minStockController = TextEditingController(text: (product.minStock ?? 0).toString());
    final expiryController = TextEditingController(text: product.expiryDate?.toString().substring(0, product.expiryDate!.toString().length >= 10 ? 10 : product.expiryDate!.toString().length) ?? '');

    final result = await AppDialogs.showFormSheet<Map<String, dynamic>>(
      context,
      title: l.prodEditProduct,
      builder: (sheetContext) {
        return Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameController,
              decoration: InputDecoration(labelText: l.prodProductName),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: categoryController,
              decoration: InputDecoration(labelText: l.prodCategory),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: unitController,
                    decoration: InputDecoration(labelText: l.prodUnit),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: NumberField(
                    controller: gstController,
                    label: l.prodGstPercent,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: NumberField(
                    controller: priceController,
                    label: l.prodSellingPrice,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: NumberField(
                    controller: purchaseController,
                    label: l.prodPurchasePrice,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            NumberField(
              controller: minStockController,
              label: l.prodMinStock,
            ),
            const SizedBox(height: 12),
            TextField(
              controller: expiryController,
              decoration: const InputDecoration(labelText: 'Expiry date (YYYY-MM-DD)'),
              keyboardType: TextInputType.datetime,
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: TextButton(
                    onPressed: () => Navigator.pop(sheetContext),
                    child: Text(l.cancel),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  flex: 2,
                  child: FilledButton(
                    onPressed: () {
                      final payload = <String, dynamic>{
                        'name': nameController.text.trim().isNotEmpty ? nameController.text.trim() : product.name,
                        'category': categoryController.text.trim().isNotEmpty ? categoryController.text.trim() : 'General',
                        'unit': unitController.text.trim().isNotEmpty ? unitController.text.trim() : product.unit,
                        'sellingPrice': num.tryParse(priceController.text.trim()) ?? product.sellingPrice,
                        'purchasePrice': num.tryParse(purchaseController.text.trim()) ?? product.purchasePrice ?? product.sellingPrice,
                        'gstPercent': num.tryParse(gstController.text.trim()) ?? 0,
                        'minStock': num.tryParse(minStockController.text.trim()) ?? 0,
                      };
                      if (expiryController.text.trim().isEmpty) {
                        payload['expiryDate'] = null;
                      } else {
                        payload['expiryDate'] = expiryController.text.trim();
                      }
                      Navigator.pop(sheetContext, payload);
                    },
                    child: Text(l.save),
                  ),
                ),
              ],
            ),
          ],
        );
      },
    );
    nameController.dispose();
    categoryController.dispose();
    unitController.dispose();
    priceController.dispose();
    purchaseController.dispose();
    gstController.dispose();
    minStockController.dispose();
    expiryController.dispose();
    if (result != null && widget.onUpdate != null) {
      await widget.onUpdate!(product.id, result);
    }
  }

  Future<void> _showAdjustDialog(BuildContext context, Product product) async {
    final l = AppLocalizations.of(context)!;
    final qtyController = TextEditingController(text: '0');
    final reasonController = TextEditingController(text: l.prodManualAdjustment);
    bool isAddition = true;

    final result = await AppDialogs.showFormSheet<Map<String, dynamic>>(
      context,
      title: l.prodAdjustStockTitle(product.name),
      builder: (sheetContext) {
        return StatefulBuilder(
          builder: (ctx, setDialogState) {
            return Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l.prodCurrently(product.stock.toString(), product.unit),
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 12),
                SegmentedButton<bool>(
                  segments: [
                    ButtonSegment(value: true, label: Text(l.prodAddLabel), icon: const Icon(Icons.add)),
                    ButtonSegment(value: false, label: Text(l.prodRemoveLabel), icon: const Icon(Icons.remove)),
                  ],
                  selected: {isAddition},
                  onSelectionChanged: (s) => setDialogState(() => isAddition = s.first),
                ),
                const SizedBox(height: 12),
                NumberField(
                  controller: qtyController,
                  allowNegative: true,
                  label: l.prodQuantity,
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: reasonController,
                  decoration: InputDecoration(labelText: l.prodReason),
                ),
                const SizedBox(height: 20),
                Row(
                  children: [
                    Expanded(
                      child: TextButton(
                        onPressed: () => Navigator.pop(sheetContext),
                        child: Text(l.cancel),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      flex: 2,
                      child: FilledButton(
                        onPressed: () {
                          final qty = num.tryParse(qtyController.text.trim()) ?? 0;
                          final reason = reasonController.text.trim().isNotEmpty ? reasonController.text.trim() : l.prodManualAdjustment;
                          if (qty.toDouble() == 0 || widget.onAdjust == null) {
                            Navigator.pop(sheetContext);
                            return;
                          }
                          Navigator.pop(sheetContext, {'qty': isAddition ? qty : -qty.abs(), 'reason': reason});
                        },
                        child: Text(l.prodApply),
                      ),
                    ),
                  ],
                ),
              ],
            );
          },
        );
      },
    );
    qtyController.dispose();
    reasonController.dispose();
    if (result != null && widget.onAdjust != null) {
      if (!context.mounted) return;
      AppDialogs.showLoading(context);
      try {
        await widget.onAdjust!(
          product.id,
          result['qty'] as num,
          result['reason'] as String,
        );
      } finally {
        if (context.mounted) AppDialogs.hideLoading(context);
      }
    }
  }

  Future<void> _confirmArchive(BuildContext context, Product product) async {
    final l = AppLocalizations.of(context)!;
    final confirmed = await AppDialogs.showConfirm(
      context,
      title: l.prodArchiveConfirmTitle,
      message: l.prodArchiveMessage(product.name),
      confirmLabel: l.prodArchive,
      destructive: true,
    );
    if (confirmed == true && widget.onArchive != null) {
      if (!context.mounted) return;
      AppDialogs.showLoading(context);
      try {
        await widget.onArchive!(product.id);
      } finally {
        if (context.mounted) AppDialogs.hideLoading(context);
      }
    }
  }

  void _onProductTap(BuildContext context, Product product) {
    if (widget.onFetchDetail == null) {
      _showActionsSheet(context, product);
      return;
    }
    _showDetailSheet(context, product);
  }

  Future<void> _showDetailSheet(BuildContext context, Product product) async {
    final formatCurrency = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 2);
    Map<String, dynamic>? detail;
    try {
      detail = await widget.onFetchDetail!(product.id);
    } catch (_) {}
    if (!context.mounted) return;

    final movements = detail?['movements'];
    final movementList = movements is List ? movements.whereType<Map<String, dynamic>>().take(20).toList() : <Map<String, dynamic>>[];

    final l = AppLocalizations.of(context)!;
    await AppDialogs.showFormSheet<void>(
      context,
      title: product.name,
      subtitle: l.prodProductMeta(product.category ?? l.prodGeneral, product.unit),
      builder: (ctx) {
        return Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Align(
              alignment: Alignment.centerLeft,
              child: MdChip(
                label: localizedStatus(ctx, product.isLow ? 'LOW STOCK' : 'IN STOCK'),
                background: product.isLow ? MdColors.red50 : MdColors.green100,
                foreground: product.isLow ? MdColors.red700 : MdColors.green700,
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                _DetailStat(label: l.prodSelling, value: formatCurrency.format(product.sellingPrice)),
                const SizedBox(width: 10),
                _DetailStat(label: l.prodPurchase, value: formatCurrency.format(product.purchasePrice ?? 0)),
                const SizedBox(width: 10),
                _DetailStat(label: l.statusInStock, value: '${product.stock}'),
              ],
            ),
            if (product.expiryDate != null && product.expiryDate!.toString().isNotEmpty) ...[
              const SizedBox(height: 12),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: MdColors.navy50,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: MdColors.border),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.event, size: 18, color: MdColors.navy700),
                    const SizedBox(width: 8),
                    Text('Expiry: ${_expiryLabel(product.expiryDate)}', style: const TextStyle(fontWeight: FontWeight.w600)),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: FilledButton.icon(
                    onPressed: () => _showAdjustDialog(ctx, product),
                    icon: const Icon(Icons.tune),
                    label: Text(l.prodAdjustStock),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => _showEditDialog(ctx, product),
                    icon: const Icon(Icons.edit_outlined),
                    label: Text(l.edit),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (widget.onArchive != null)
              TextButton.icon(
                onPressed: () => _confirmArchive(ctx, product),
                icon: const Icon(Icons.archive_outlined, color: MdColors.red700),
                label: Text(l.prodArchiveProduct, style: const TextStyle(color: MdColors.red700)),
              ),
            const Divider(height: 32),
            Text(l.prodStockMovements, style: const TextStyle(fontWeight: FontWeight.w700, color: MdColors.navy900)),
            const SizedBox(height: 8),
            if (movementList.isEmpty)
              Padding(
                padding: const EdgeInsets.all(16),
                child: Center(child: Text(l.prodNoMovements, style: const TextStyle(color: MdColors.mutedForeground))),
              )
            else
              ...movementList.map((m) {
                final type = (m['type'] ?? 'ADJUSTMENT').toString();
                final qty = (m['qty'] is num) ? m['qty'] as num : num.tryParse('${m['qty']}') ?? 0;
                final isIn = qty > 0;
                final when = (m['createdAt'] ?? '').toString();
                return Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: MdColors.navy50,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: MdColors.border),
                  ),
                  child: Row(
                    children: [
                      MdChip(
                        label: localizedStatus(ctx, type),
                        background: isIn ? MdColors.green100 : MdColors.red50,
                        foreground: isIn ? MdColors.green700 : MdColors.red700,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          (m['note'] ?? '').toString().isEmpty ? type : (m['note'] ?? '').toString(),
                          style: const TextStyle(fontSize: 13),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      Text(
                        '${isIn ? '+' : ''}$qty',
                        style: TextStyle(fontWeight: FontWeight.w700, color: isIn ? MdColors.green700 : MdColors.red700),
                      ),
                      const SizedBox(width: 8),
                      Text(_shortDate(when), style: const TextStyle(fontSize: 11, color: MdColors.mutedForeground)),
                    ],
                  ),
                );
              }),
          ],
        );
      },
    );
  }

  void _showActionsSheet(BuildContext context, Product product) {
    final l = AppLocalizations.of(context)!;
    AppDialogs.showFormSheet<void>(
      context,
      title: l.prodActionsTitle,
      builder: (ctx) {
        return Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.tune),
              title: Text(l.prodAdjustStock),
              onTap: () {
                Navigator.pop(ctx);
                _showAdjustDialog(context, product);
              },
            ),
            ListTile(
              leading: const Icon(Icons.edit_outlined),
              title: Text(l.prodEditProduct),
              onTap: () {
                Navigator.pop(ctx);
                _showEditDialog(context, product);
              },
            ),
            if (widget.onArchive != null)
              ListTile(
                leading: const Icon(Icons.archive_outlined, color: MdColors.red700),
                title: Text(l.prodArchiveProduct, style: const TextStyle(color: MdColors.red700)),
                onTap: () {
                  Navigator.pop(ctx);
                  _confirmArchive(context, product);
                },
              ),
          ],
        );
      },
    );
  }

  String _shortDate(String raw) {
    if (raw.isEmpty) return '';
    try {
      return DateFormat('d MMM').format(DateTime.parse(raw).toLocal());
    } catch (_) {
      return raw.length > 10 ? raw.substring(0, 10) : raw;
    }
  }

  /// `expiryDate` arrives as a free-form string, so it can be empty or shorter
  /// than a full ISO date. Slicing it blindly throws a RangeError and takes the
  /// whole product screen down.
  String _expiryLabel(String? raw) {
    final value = (raw ?? '').trim();
    if (value.isEmpty) return '';
    return value.length > 10 ? value.substring(0, 10) : value;
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final filtered = _filtered;
    final formatCurrency = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          MdHeader(
            title: l.prodTitle,
            subtitle: l.prodSubtitle,
          ),
          if (widget.onCreate != null)
            Align(
              alignment: Alignment.centerRight,
              child: FilledButton.icon(
                onPressed: () => _showCreateDialog(context),
                icon: const Icon(Icons.add),
                label: Text(l.prodAddTitle),
              ),
            ),
          const SizedBox(height: 16),
          MdSearchField(
            controller: _searchController,
            onChanged: (v) => setState(() => _query = v),
            hint: l.prodSearchHint,
          ),
          if (_summary != null) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _SummaryTile(label: l.total, value: '${_summary!.total}', icon: Icons.inventory_2_outlined),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _SummaryTile(label: l.statusLow, value: '${_summary!.low}', icon: Icons.warning_amber_outlined, color: MdColors.red700),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _SummaryTile(label: l.prodValue, value: _shortNumber(context, _summary!.value), icon: Icons.currency_rupee),
                ),
              ],
            ),
          ],
          if (_categories.isNotEmpty) ...[
            const SizedBox(height: 12),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _CategoryChip(
                    label: l.prodAll,
                    selected: _selectedCategory == null,
                    onTap: () => setState(() => _selectedCategory = null),
                  ),
                  ..._categories.map((c) => _CategoryChip(
                        label: c,
                        selected: _selectedCategory == c,
                        onTap: () => setState(() => _selectedCategory = _selectedCategory == c ? null : c),
                      )),
                ],
              ),
            ),
          ],
          const SizedBox(height: 16),
          Expanded(
            child: _error != null
                ? MdErrorState(
                    message: _error!,
                    retryLabel: l.retry,
                    onRetry: _load,
                  )
                : filtered.isEmpty
                ? MdEmptyState(
                    icon: Icons.inventory_2_outlined,
                    title: l.prodEmptyTitle,
                    subtitle: l.prodEmptySubtitle,
                  )
                : ListView.separated(
                    physics: const AlwaysScrollableScrollPhysics(),
                    itemCount: filtered.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 10),
                    itemBuilder: (context, index) {
                      final product = filtered[index];
                      final hasSku = product.sku != null && product.sku!.isNotEmpty;
                      return MdCard(
                        onTap: () => _onProductTap(context, product),
                        padding: const EdgeInsets.all(14),
                        child: Row(
                          children: [
                            Container(
                              width: 44,
                              height: 44,
                              decoration: BoxDecoration(
                                color: MdColors.navy50,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: const Icon(Icons.inventory_2_outlined, color: MdColors.navy600, size: 22),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    product.name,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(fontWeight: FontWeight.w700, color: MdColors.foreground),
                                  ),
                                  const SizedBox(height: 3),
                                  Text(
                                    hasSku
                                        ? l.prodProductMetaSku(product.category ?? l.prodGeneral, product.unit, product.sku!)
                                        : l.prodProductMeta(product.category ?? l.prodGeneral, product.unit),
                                    style: const TextStyle(fontSize: 11, color: MdColors.mutedForeground),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  if (product.expiryDate != null && product.expiryDate!.toString().isNotEmpty) ...[
                                    const SizedBox(height: 2),
                                    Text(
                                      'Exp: ${_expiryLabel(product.expiryDate)}',
                                      style: const TextStyle(fontSize: 10, color: MdColors.mutedForeground),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text(
                                  formatCurrency.format(product.sellingPrice),
                                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: MdColors.navy900),
                                ),
                                const SizedBox(height: 4),
                                MdChip(
                                  label: product.isLow
                                      ? l.prodLowQty(product.stock.toString())
                                      : l.prodStockQty(product.stock.toString()),
                                  background: product.isLow ? MdColors.red50 : MdColors.green100,
                                  foreground: product.isLow ? MdColors.red700 : MdColors.green700,
                                ),
                              ],
                            ),
                          ],
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}

class _CategoryChip extends StatelessWidget {
  const _CategoryChip({required this.label, required this.selected, required this.onTap});

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ChoiceChip(
        label: Text(label),
        selected: selected,
        onSelected: (_) => onTap(),
        showCheckmark: false,
        selectedColor: MdColors.navy900,
        backgroundColor: MdColors.navy50,
        labelStyle: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: selected ? Colors.white : MdColors.navy700,
        ),
        side: BorderSide(
          color: selected ? MdColors.navy900 : MdColors.border,
        ),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
        visualDensity: VisualDensity.compact,
      ),
    );
  }
}

class _DetailStat extends StatelessWidget {
  const _DetailStat({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: MdColors.navy50,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: MdColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: const TextStyle(fontSize: 11, color: MdColors.mutedForeground, fontWeight: FontWeight.w600)),
            const SizedBox(height: 4),
            Text(value, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: MdColors.navy900)),
          ],
        ),
      ),
    );
  }
}

class _SummaryTile extends StatelessWidget {
  const _SummaryTile({
    required this.label,
    required this.value,
    required this.icon,
    this.color = MdColors.navy700,
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
          Text(value, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: MdColors.foreground)),
          Text(label, style: const TextStyle(fontSize: 11, color: MdColors.mutedForeground)),
        ],
      ),
    );
  }
}

String _shortNumber(BuildContext context, num value) {
  final l = AppLocalizations.of(context)!;
  if (value >= 10000000) return '${(value / 10000000).toStringAsFixed(1)} ${l.prodAbbrevCrore}';
  if (value >= 100000) return '${(value / 100000).toStringAsFixed(1)} ${l.prodAbbrevLakh}';
  if (value >= 1000) return '${(value / 1000).toStringAsFixed(1)} ${l.prodAbbrevThousand}';
  return value.toStringAsFixed(0);
}