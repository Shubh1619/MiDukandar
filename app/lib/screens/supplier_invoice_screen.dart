import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../l10n/generated/app_localizations.dart';
import '../l10n/status_labels.dart';
import '../models/app_models.dart';
import '../services/api_service.dart';
import '../widgets/app_dialogs.dart';
import '../widgets/md_inputs.dart';

class SupplierInvoiceScreen extends StatefulWidget {
  const SupplierInvoiceScreen({super.key, required this.apiService, this.onCreate, this.onPay});

  final ApiService apiService;
  final Future<void> Function(String supplierId, Map<String, dynamic>)?
  onCreate;
  final Future<void> Function(Purchase, num amount, String mode)? onPay;

  @override
  State<SupplierInvoiceScreen> createState() => _SupplierInvoiceScreenState();
}

class _SupplierInvoiceScreenState extends State<SupplierInvoiceScreen> {
  bool _loading = true;
  String? _error;
  List<Purchase> _purchases = const [];
  List<Supplier> _suppliers = const [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final purchases = await widget.apiService.getPurchases();
      final suppliers = await widget.apiService.getSuppliers();
      if (!mounted) return;
      setState(() {
        _purchases = purchases;
        _suppliers = suppliers;
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

  Future<void> _showCreateDialog(BuildContext context) async {
    final l = AppLocalizations.of(context)!;
    if (_suppliers.isEmpty) {
      AppDialogs.showError(context, l.suppNoSuppliers);
      return;
    }
    final totalController = TextEditingController(text: '0');
    String selectedSupplierId = _suppliers.first.id;

    final result = await AppDialogs.showFormSheet<Map<String, dynamic>>(
      context,
      title: l.purchAddPurchase,
      builder: (sheetContext) {
        return StatefulBuilder(
          builder: (ctx, setSheetState) {
            return Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                MdPickerField<String>(
                  label: l.purchSupplierName,
                  selected: selectedSupplierId,
                  prefixIcon: Icons.storefront_outlined,
                  pickerTitle: l.purchSupplierName,
                  options: _suppliers
                      .map((s) => MdPickerOption(value: s.id, label: s.name))
                      .toList(),
                  onChanged: (v) => setSheetState(() => selectedSupplierId = v),
                ),
                const SizedBox(height: 12),
                NumberField(
                  controller: totalController,
                  label: l.purchTotalAmount,
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
                        final total = num.tryParse(totalController.text.trim()) ?? 0;
                        final supplier = _suppliers.firstWhere(
                          (s) => s.id == selectedSupplierId,
                          orElse: () => _suppliers.first,
                        );
                        Navigator.pop(sheetContext, {
                          'supplierId': selectedSupplierId,
                          'supplierMobile': supplier.phone ?? '',
                          'lines': [
                            {
                              'productId': null,
                              'productName': l.purchPurchaseItem,
                              'qty': 1,
                              'unitPrice': total,
                              'gstPercent': 0,
                            }
                          ],
                          'discount': 0,
                          'paidAmount': 0,
                          'notes': l.purchFromMobileApp,
                        });
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
    totalController.dispose();

    if (result == null || widget.onCreate == null || !context.mounted) return;
    final supplierId = result['supplierId'] as String;
    final payload = Map<String, dynamic>.from(result)..remove('supplierId');
    AppDialogs.showLoading(context);
    try {
      await widget.onCreate!(supplierId, payload);
    } finally {
      if (context.mounted) AppDialogs.hideLoading(context);
    }
  }

  Future<void> _showPayDialog(BuildContext context, Purchase item) async {
    final l = AppLocalizations.of(context)!;
    final formatCurrency = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
    final amountController = TextEditingController(text: item.dueAmount.toString());
    String mode = 'CASH';

    final result = await AppDialogs.showFormSheet<Map<String, dynamic>>(
      context,
      title: l.purchPayTitle,
      builder: (sheetContext) {
        return StatefulBuilder(
          builder: (ctx, setDialogState) {
            return Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  l.purchDueAmount(formatCurrency.format(item.dueAmount)),
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 12),
                NumberField(
                  controller: amountController,
                  label: l.amount,
                ),
                const SizedBox(height: 12),
                MdPickerField<String>(
                  label: l.billMode,
                  selected: mode,
                  prefixIcon: Icons.payments_outlined,
                  pickerTitle: l.billMode,
                  options: const ['CASH', 'UPI', 'CARD']
                      .map((m) => MdPickerOption(
                            value: m,
                            label: m == 'CASH' ? l.billModeCash : m == 'UPI' ? l.billModeUpi : l.billModeCard,
                          ))
                      .toList(),
                  onChanged: (v) => setDialogState(() => mode = v),
                ),
                const SizedBox(height: 20),
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    TextButton(onPressed: () => Navigator.pop(sheetContext), child: Text(l.cancel)),
                    const SizedBox(width: 8),
                    FilledButton(
                      onPressed: () {
                        final amount = num.tryParse(amountController.text.trim()) ?? 0;
                        if (amount <= 0) return;
                        Navigator.pop(sheetContext, {'amount': amount, 'mode': mode});
                      },
                      child: Text(l.purchPayTitle),
                    ),
                  ],
                ),
              ],
            );
          },
        );
      },
    );
    amountController.dispose();

    if (result == null || widget.onPay == null || !context.mounted) return;
    AppDialogs.showLoading(context);
    try {
      await widget.onPay!(item, result['amount'] as num, result['mode'] as String);
    } catch (error) {
      if (!context.mounted) return;
      AppDialogs.showError(context, l.errRecordPayment(error.toString()));
    } finally {
      if (context.mounted) AppDialogs.hideLoading(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final formatCurrency = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
    final formatDate = DateFormat('d MMM yy');
    final totalBilled = _purchases.fold<num>(0, (sum, p) => sum + p.total);
    final totalPaid = _purchases.fold<num>(0, (sum, p) => sum + p.paidAmount);

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: Text(l.sectionPurchases, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold))),
              if (widget.onCreate != null)
                FilledButton.icon(
                  onPressed: () => _showCreateDialog(context),
                  icon: const Icon(Icons.add),
                  label: Text(l.purchAddPurchase),
                ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _SummaryCard(title: l.purchTotalBilled, value: formatCurrency.format(totalBilled), color: const Color(0xFF1F4E79)),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _SummaryCard(title: l.statusPaid, value: formatCurrency.format(totalPaid), color: Colors.green.shade700),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _error != null
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.error_outline, size: 48, color: Colors.red),
                            const SizedBox(height: 12),
                            Text(_error!, style: const TextStyle(color: Colors.red)),
                            const SizedBox(height: 12),
                            FilledButton(
                              onPressed: _load,
                              child: Text(l.retry),
                            ),
                          ],
                        ),
                      )
                    : _purchases.isEmpty
                        ? Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Icon(Icons.local_shipping_outlined, size: 64, color: Colors.grey),
                                const SizedBox(height: 12),
                                Text(l.purchNoPurchasesYet, style: const TextStyle(color: Colors.grey)),
                              ],
                            ),
                          )
                        : ListView.separated(
                            physics: const AlwaysScrollableScrollPhysics(),
                            itemCount: _purchases.length,
                            separatorBuilder: (_, _) => const SizedBox(height: 10),
                            itemBuilder: (context, index) {
                              final item = _purchases[index];
                      final isPaid = item.paymentStatus.toLowerCase() == 'paid' || item.dueAmount.toDouble() <= 0;
                      final isPartial = !isPaid && item.paidAmount.toDouble() > 0;
                      final statusLabel = isPaid
                          ? localizedStatus(context, 'PAID')
                          : (isPartial
                              ? localizedStatus(context, 'PARTIAL')
                              : localizedStatus(context, 'UNPAID'));
                      final statusColor = isPaid ? Colors.green : (isPartial ? Colors.blue : Colors.orange);
                      return Card(
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          side: BorderSide(color: Colors.grey.shade200),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: InkWell(
                          borderRadius: BorderRadius.circular(16),
                          onTap: (!isPaid && widget.onPay != null) ? () => _showPayDialog(context, item) : null,
                          child: Padding(
                          padding: const EdgeInsets.all(14),
                          child: Row(
                            children: [
                              CircleAvatar(
                                backgroundColor: Colors.blue.shade100,
                                child: Icon(Icons.local_shipping_outlined, color: Colors.blue.shade700),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      item.purchaseNumber,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(fontWeight: FontWeight.w700),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      item.supplierName,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(color: Colors.grey.shade600),
                                    ),
                                    const SizedBox(height: 2),
                                    if (item.createdAt.isNotEmpty)
                                      Text(
                                        formatDate.format(DateTime.tryParse(item.createdAt) ?? DateTime.now()),
                                        style: TextStyle(color: Colors.grey.shade500, fontSize: 12),
                                      ),
                                  ],
                                ),
                              ),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  Text(formatCurrency.format(item.total), style: const TextStyle(fontWeight: FontWeight.bold)),
                                  const SizedBox(height: 4),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: statusColor.shade100,
                                      borderRadius: BorderRadius.circular(999),
                                    ),
                                    child: Text(
                                      statusLabel,
                                      style: TextStyle(
                                        color: statusColor.shade800,
                                        fontWeight: FontWeight.w600,
                                        fontSize: 12,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  if (item.dueAmount.toDouble() > 0)
                                    Text(l.purchDueAmount(formatCurrency.format(item.dueAmount).toString()), style: TextStyle(color: Colors.red.shade700, fontSize: 12)),
                                ],
                              ),
                            ],
                          ),
                        ),
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

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({required this.title, required this.value, required this.color});

  final String title;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: color.withAlpha(20),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: TextStyle(color: color, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          Text(value, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }
}
