import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../l10n/generated/app_localizations.dart';
import '../main.dart';
import '../models/app_models.dart';
import '../services/api_service.dart';
import '../widgets/app_dialogs.dart';
import '../widgets/md_inputs.dart';

class InvoiceScreen extends StatefulWidget {
  const InvoiceScreen({
    super.key,
    required this.apiService,
    this.onCreate,
    this.onMarkPaid,
    this.onReverse,
    this.onUpdate,
  });

  final ApiService apiService;
  final Future<void> Function(Map<String, dynamic>)? onCreate;
  final Future<void> Function(InvoiceRecord)? onMarkPaid;
  final Future<void> Function(InvoiceRecord, String)? onReverse;
  final Future<void> Function(InvoiceRecord, Map<String, dynamic>)? onUpdate;

  @override
  State<InvoiceScreen> createState() => _InvoiceScreenState();
}

class _InvoiceScreenState extends State<InvoiceScreen> {
  final TextEditingController _searchController = TextEditingController();
  String _search = '';
  String _filter = 'all';
  bool _loading = true;
  String? _error;
  List<InvoiceRecord> _invoices = const [];

  @override
  void initState() {
    super.initState();
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
      final invoices = await widget.apiService.getInvoices();
      if (!mounted) return;
      setState(() {
        _invoices = invoices;
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

  List<InvoiceRecord> get _filteredInvoices {
    final query = _search.trim().toLowerCase();
    return _invoices.where((invoice) {
      final matchesSearch = query.isEmpty ||
          invoice.customerName.toLowerCase().contains(query) ||
          invoice.invoiceNumber.toLowerCase().contains(query);

      final matchesFilter = switch (_filter) {
        'paid' => invoice.isPaid,
        'udhaar' => invoice.isUdhaar,
        _ => true,
      };

      return matchesSearch && matchesFilter;
    }).toList();
  }

  num get totalRevenue => _invoices.fold(0, (sum, inv) => sum + inv.amount);
  num get pendingAmount => _invoices.fold(0, (sum, inv) => sum + inv.dueAmount);

  Future<void> _showCreateDialog({
    Map<String, dynamic>? resume,
    String? resumeId,
  }) async {
    final l = AppLocalizations.of(context)!;
    final resumeCustomer = (resume?['customer'] is Map)
        ? Map<String, dynamic>.from(resume!['customer'] as Map)
        : const <String, dynamic>{};
    final resumeLines = (resume?['lines'] is List && (resume!['lines'] as List).isNotEmpty)
        ? Map<String, dynamic>.from((resume['lines'] as List).first as Map)
        : const <String, dynamic>{};
    final customerController = TextEditingController(
      text: (resumeCustomer['name']?.toString() ?? ''),
    );
    final mobileController = TextEditingController(
      text: (resumeCustomer['mobile']?.toString() ?? ''),
    );
    final mobileKey = GlobalKey<MobileNumberFieldState>();
    final qtyController = TextEditingController(
      text: (resumeLines['qty']?.toString() ?? '1'),
    );
    final amountController = TextEditingController(
      text: (resumeLines['unitPrice']?.toString() ?? '0'),
    );
    final paidController = TextEditingController(
      text: (resume?['paidAmount']?.toString() ?? '0'),
    );
    String mode = (resume?['paymentMode']?.toString() ?? 'CASH');

    final result = await AppDialogs.showFormSheet<Map<String, dynamic>>(
      context,
      title: l.billNewInvoice,
      builder: (sheetContext) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: customerController,
                  decoration: InputDecoration(labelText: l.billCustomerName),
                ),
                const SizedBox(height: 12),
                MobileNumberField(
                  key: mobileKey,
                  controller: mobileController,
                  allowEmpty: true,
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: qtyController,
                        keyboardType: const TextInputType.numberWithOptions(decimal: false),
                        decoration: InputDecoration(labelText: l.billQty),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextField(
                        controller: amountController,
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        decoration: InputDecoration(labelText: l.billUnitPrice),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: paidController,
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        decoration: InputDecoration(labelText: l.billPaidAmount),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: MdPickerField<String>(
                        selected: mode,
                        label: l.billMode,
                        prefixIcon: Icons.payments_outlined,
                        options: [
                          MdPickerOption(value: 'CASH', label: l.billModeCash, icon: Icons.currency_rupee_outlined),
                          MdPickerOption(value: 'UPI', label: l.billModeUpi, icon: Icons.phone_iphone_outlined),
                          MdPickerOption(value: 'CARD', label: l.billModeCard, icon: Icons.credit_card_outlined),
                        ],
                        onChanged: (v) => setDialogState(() => mode = v),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    TextButton(
                      onPressed: () => Navigator.pop(sheetContext),
                      child: Text(l.cancel),
                    ),
                    const SizedBox(width: 8),
                    OutlinedButton.icon(
                      onPressed: () {
                        if (mobileKey.currentState?.validate() != null) return;
                        final payload = _buildBillPayload(
                          l: l,
                          customerName: customerController.text.trim(),
                          mobile: mobileController.text.trim(),
                          qty: qtyController.text.trim(),
                          unitPrice: amountController.text.trim(),
                          paid: paidController.text.trim(),
                          mode: mode,
                        );
                        Navigator.pop(sheetContext, {...payload, '__hold': true});
                      },
                      icon: const Icon(Icons.pause_circle_outline),
                      label: Text(l.billHold),
                    ),
                    const SizedBox(width: 8),
                    FilledButton(
                      onPressed: () {
                        if (mobileKey.currentState?.validate() != null) return;
                        final payload = _buildBillPayload(
                          l: l,
                          customerName: customerController.text.trim(),
                          mobile: mobileController.text.trim(),
                          qty: qtyController.text.trim(),
                          unitPrice: amountController.text.trim(),
                          paid: paidController.text.trim(),
                          mode: mode,
                        );
                        Navigator.pop(sheetContext, payload);
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
    customerController.dispose();
    mobileController.dispose();
    qtyController.dispose();
    amountController.dispose();
    paidController.dispose();

    if (result != null && mounted) {
      final isHold = result['__hold'] == true;
      final payload = Map<String, dynamic>.from(result)..remove('__hold');
      final customer = payload['customer'];
      final label = customer is Map ? customer['name']?.toString() : null;
      AppDialogs.showLoading(context);
      try {
        if (isHold) {
          await widget.apiService.holdSale(payload, label: label);
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(l.billHeldSaved)),
            );
          }
        } else if (widget.onCreate != null) {
          await widget.onCreate!(payload);
          if (resumeId != null) {
            await widget.apiService.deleteHeldBill(resumeId);
          }
        }
      } finally {
        if (mounted) AppDialogs.hideLoading(context);
      }
    }
  }

  Map<String, dynamic> _buildBillPayload({
    required AppLocalizations l,
    required String customerName,
    required String mobile,
    required String qty,
    required String unitPrice,
    required String paid,
    required String mode,
  }) {
    return {
      'customer': {
        'name': customerName.isNotEmpty ? customerName : l.billWalkInCustomer,
        'mobile': mobile,
        'address': '',
        'city': '',
        'state': '',
        'pincode': '',
        'gst': '',
      },
      'lines': [
        {
          'productId': null,
          'productName': l.billGenericItem,
          'qty': num.tryParse(qty) ?? 1,
          'unitPrice': num.tryParse(unitPrice) ?? 0,
          'discount': 0,
          'gstPercent': 0,
        }
      ],
      'paymentMode': mode,
      'discount': 0,
      'discountType': 'FLAT',
      'paidAmount': num.tryParse(paid) ?? 0,
      'notes': l.billCreatedFromMobileApp,
    };
  }

  Future<void> _showHeldBills() async {
    final l = AppLocalizations.of(context)!;
    List<Map<String, dynamic>> held;
    AppDialogs.showLoading(context);
    try {
      held = await widget.apiService.listHeldBills();
    } catch (e) {
      if (mounted) {
        AppDialogs.hideLoading(context);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
      }
      return;
    }
    if (!mounted) return;
    AppDialogs.hideLoading(context);

    await AppDialogs.showFormSheet<void>(
      context,
      title: l.billHeldBills,
      builder: (sheetContext) => held.isEmpty
          ? Padding(
              padding: const EdgeInsets.symmetric(vertical: 24),
              child: Center(child: Text(l.billNoHeldBills)),
            )
          : Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                for (final bill in held)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(bill['bill_number']?.toString() ?? ''),
                    subtitle: Text(
                      (bill['payload'] is Map &&
                              (bill['payload'] as Map)['customer'] is Map)
                          ? (((bill['payload'] as Map)['customer'] as Map)['name']
                                  ?.toString() ??
                              l.billWalkInCustomer)
                          : l.billWalkInCustomer,
                    ),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        TextButton(
                          onPressed: () async {
                            Navigator.pop(sheetContext);
                            final payload = (bill['payload'] is Map)
                                ? Map<String, dynamic>.from(bill['payload'] as Map)
                                : <String, dynamic>{};
                            await _showCreateDialog(
                              resume: payload,
                              resumeId: bill['id']?.toString(),
                            );
                            if (mounted) await _load();
                          },
                          child: Text(l.billResume),
                        ),
                        IconButton(
                          tooltip: l.delete,
                          icon: const Icon(Icons.delete_outline, color: Colors.red),
                          onPressed: () async {
                            Navigator.pop(sheetContext);
                            try {
                              await widget.apiService.deleteHeldBill(bill['id'].toString());
                              if (mounted) await _load();
                            } catch (e) {
                              if (mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(content: Text(e.toString())),
                                );
                              }
                            }
                          },
                        ),
                      ],
                    ),
                  ),
              ],
            ),
    );
  }

  Future<void> _confirmReverse(InvoiceRecord invoice) async {
    final l = AppLocalizations.of(context)!;
    final confirmed = await AppDialogs.showConfirm(
      context,
      title: l.billReverseTitle,
      message: l.billReverseMessage(invoice.invoiceNumber),
      confirmLabel: l.billReverse,
      destructive: true,
    );
    if (confirmed != true || widget.onReverse == null || !mounted) return;
    AppDialogs.showLoading(context);
    try {
      await widget.onReverse!(invoice, invoice.invoiceNumber);
    } finally {
      if (mounted) AppDialogs.hideLoading(context);
    }
  }

  Future<void> _showInvoiceDetails(InvoiceRecord invoice) async {
    final l = AppLocalizations.of(context)!;
    await AppDialogs.showFormSheet<void>(
      context,
      title: invoice.invoiceNumber,
      subtitle: invoice.customerName,
      builder: (sheetContext) {
        return Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Chip(
              label: Text(invoice.isPaid ? l.statusPaid : l.billUdhaar),
              backgroundColor: invoice.isPaid ? Colors.green.shade100 : Colors.orange.shade100,
              labelStyle: TextStyle(
                color: invoice.isPaid ? Colors.green.shade800 : Colors.orange.shade800,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 12),
            Text(l.billCustomerLine(invoice.customerName), style: TextStyle(color: Colors.grey.shade700)),
            if (invoice.customerMobile != null && invoice.customerMobile!.isNotEmpty)
              Text(l.billMobileLine(invoice.customerMobile!), style: TextStyle(color: Colors.grey.shade700)),
            Text(l.billDateLine(_formatDate(invoice.createdAt)), style: TextStyle(color: Colors.grey.shade700)),
            Text(l.billModeLine(invoice.paymentMode), style: TextStyle(color: Colors.grey.shade700)),
            if (invoice.notes != null && invoice.notes!.isNotEmpty)
              Text(l.billNoteLine(invoice.notes!), style: TextStyle(color: Colors.grey.shade700)),
            const Divider(height: 24),
            if (invoice.items.isEmpty)
              Text(l.billNoLineItems)
            else
              ...invoice.items.map(
                (item) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(
                    children: [
                      Expanded(child: Text(l.billLineItem(item.name, item.qty.toString()))),
                      Text(formatINR(item.amount), style: const TextStyle(fontWeight: FontWeight.w600)),
                    ],
                  ),
                ),
              ),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [Text(l.total, style: const TextStyle(fontWeight: FontWeight.bold)), Text(formatINR(invoice.amount), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16))],
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [Text(l.statusPaid), Text(formatINR(invoice.paidAmount))],
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [Text(l.billDue), Text(formatINR(invoice.dueAmount), style: TextStyle(color: invoice.dueAmount > 0 ? Colors.red : Colors.green))],
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                if (!invoice.isPaid && widget.onUpdate != null)
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () {
                        Navigator.pop(sheetContext);
                        _showEditDialog(invoice);
                      },
                      icon: const Icon(Icons.edit_outlined),
                      label: Text(l.edit),
                    ),
                  ),
                if (!invoice.isPaid)
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: () async {
                        Navigator.pop(sheetContext);
                        if (widget.onMarkPaid != null) {
                          AppDialogs.showLoading(context);
                          try {
                            await widget.onMarkPaid!(invoice);
                          } finally {
                            if (mounted) AppDialogs.hideLoading(context);
                          }
                        }
                      },
                      icon: const Icon(Icons.check_circle_outline),
                      label: Text(l.billPayAmount(formatINR(invoice.dueAmount))),
                    ),
                  ),
                if (!invoice.isPaid && widget.onReverse != null) ...[
                  if (widget.onMarkPaid != null || widget.onUpdate != null) const SizedBox(width: 10),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () {
                        Navigator.pop(sheetContext);
                        _confirmReverse(invoice);
                      },
                      icon: const Icon(Icons.undo_outlined),
                      label: Text(l.billReverse),
                      style: OutlinedButton.styleFrom(foregroundColor: Colors.red.shade700),
                    ),
                  ),
                ],
              ],
            ),
            if (invoice.isPaid && widget.onReverse != null) ...[
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: () {
                    Navigator.pop(sheetContext);
                    _confirmReverse(invoice);
                  },
                  icon: const Icon(Icons.undo_outlined),
                  label: Text(l.billReverse),
                  style: OutlinedButton.styleFrom(foregroundColor: Colors.red.shade700),
                ),
              ),
            ],
          ],
        );
      },
    );
  }

  Future<void> _showEditDialog(InvoiceRecord invoice) async {
    final l = AppLocalizations.of(context)!;
    final customerController = TextEditingController(text: invoice.customerName);
    final mobileController = TextEditingController(text: invoice.customerMobile ?? '');
    final mobileKey = GlobalKey<MobileNumberFieldState>();
    final paidController = TextEditingController(text: invoice.paidAmount.toString());
    String mode = invoice.paymentMode;

    final result = await AppDialogs.showFormSheet<Map<String, dynamic>>(
      context,
      title: l.billEditInvoice,
      builder: (sheetContext) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: customerController,
                  decoration: InputDecoration(labelText: l.billCustomerName),
                ),
                const SizedBox(height: 12),
                MobileNumberField(
                  key: mobileKey,
                  controller: mobileController,
                  allowEmpty: true,
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: paidController,
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        decoration: InputDecoration(labelText: l.billPaidAmount),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: MdPickerField<String>(
                        selected: mode,
                        label: l.billMode,
                        prefixIcon: Icons.payments_outlined,
                        options: [
                          MdPickerOption(value: 'CASH', label: l.billModeCash, icon: Icons.currency_rupee_outlined),
                          MdPickerOption(value: 'UPI', label: l.billModeUpi, icon: Icons.phone_iphone_outlined),
                          MdPickerOption(value: 'CARD', label: l.billModeCard, icon: Icons.credit_card_outlined),
                        ],
                        onChanged: (v) => setDialogState(() => mode = v),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
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
                        if (mobileKey.currentState?.validate() != null) return;
                        final customerName = customerController.text.trim();
                        final paid = num.tryParse(paidController.text.trim()) ?? 0;
                        final payload = {
                          'customer': {
                            'name': customerName.isNotEmpty ? customerName : l.billWalkInCustomer,
                            'mobile': mobileController.text.trim(),
                            'address': '',
                            'city': '',
                            'state': '',
                            'pincode': '',
                            'gst': '',
                          },
                          'paymentMode': mode,
                          'paidAmount': paid,
                          'notes': l.billCreatedFromMobileApp,
                        };
                        Navigator.pop(sheetContext, payload);
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
    customerController.dispose();
    mobileController.dispose();
    paidController.dispose();

    if (result != null && widget.onUpdate != null && mounted) {
      AppDialogs.showLoading(context);
      try {
        await widget.onUpdate!(invoice, result);
      } finally {
        if (mounted) AppDialogs.hideLoading(context);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;

    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null) {
      return Center(
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
      );
    }

    final filtered = _filteredInvoices;
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: Text(l.billInvoices, style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold))),
              OutlinedButton.icon(
                onPressed: _showHeldBills,
                icon: const Icon(Icons.pause_circle_outline),
                label: Text(l.billHeldBills),
              ),
              if (widget.onCreate != null) ...[
                const SizedBox(width: 8),
                FilledButton.icon(
                  onPressed: () => _showCreateDialog(),
                  icon: const Icon(Icons.add),
                  label: Text(l.billAddInvoice),
                ),
              ],
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _searchController,
                  onChanged: (v) => setState(() => _search = v),
                  decoration: InputDecoration(
                    hintText: l.billSearchPlaceholder,
                    prefixIcon: const Icon(Icons.search),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    filled: true,
                    fillColor: Colors.grey.shade50,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              DropdownButton<String>(
                value: _filter,
                items: [
                  DropdownMenuItem(value: 'all', child: Text(l.billAll)),
                  DropdownMenuItem(value: 'paid', child: Text(l.statusPaid)),
                  DropdownMenuItem(value: 'udhaar', child: Text(l.billUdhaar)),
                ],
                onChanged: (v) => setState(() => _filter = v ?? 'all'),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(child: _SummaryCard(title: l.billRevenue, value: formatINR(totalRevenue), color: const Color(0xFF1F4E79))),
              const SizedBox(width: 12),
              Expanded(child: _SummaryCard(title: l.statusPending, value: formatINR(pendingAmount), color: Colors.orange.shade700)),
            ],
          ),
          const SizedBox(height: 16),
          Expanded(
            child: filtered.isEmpty
                ? Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.receipt_long_outlined, size: 56, color: Colors.grey.shade400),
                        const SizedBox(height: 12),
                        Text(l.billNoMatchingInvoices, style: const TextStyle(color: Colors.grey)),
                      ],
                    ),
                  )
                : ListView.separated(
                    itemCount: filtered.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 12),
                    itemBuilder: (context, index) {
                      final invoice = filtered[index];
                      return Card(
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          side: BorderSide(color: Colors.grey.shade200),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: InkWell(
                          borderRadius: BorderRadius.circular(16),
                          onTap: () => _showInvoiceDetails(invoice),
                          child: Padding(
                            padding: const EdgeInsets.all(14),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(invoice.invoiceNumber, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                                          const SizedBox(height: 4),
                                          Text(invoice.customerName, style: TextStyle(color: Colors.grey.shade700, fontSize: 13)),
                                        ],
                                      ),
                                    ),
                                    Column(
                                      crossAxisAlignment: CrossAxisAlignment.end,
                                      children: [
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                          decoration: BoxDecoration(
                                            color: invoice.isPaid ? Colors.green.shade100 : Colors.orange.shade100,
                                            borderRadius: BorderRadius.circular(999),
                                          ),
                                          child: Text(
                                            invoice.isPaid ? l.statusPaid : l.billUdhaar,
                                            style: TextStyle(
                                              color: invoice.isPaid ? Colors.green.shade800 : Colors.orange.shade800,
                                              fontWeight: FontWeight.w600,
                                              fontSize: 12,
                                            ),
                                          ),
                                        ),
                                        const SizedBox(height: 8),
                                        Text(formatINR(invoice.amount), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                                      ],
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 10),
                                Row(
                                  children: [
                                    Text(_formatDate(invoice.createdAt), style: TextStyle(color: Colors.grey.shade600, fontSize: 12)),
                                    const Spacer(),
                                    if (invoice.dueAmount > 0) Text(l.billDueAmount(formatINR(invoice.dueAmount)), style: TextStyle(color: Colors.red.shade700, fontSize: 12, fontWeight: FontWeight.w600)),
                                    const SizedBox(width: 10),
                                    Icon(Icons.chevron_right, color: Colors.grey.shade400),
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

String _formatDate(String? raw) {
  if (raw == null || raw.isEmpty) return '';
  try {
    final dt = DateTime.parse(raw).toLocal();
    return DateFormat('d MMM yyyy').format(dt);
  } catch (_) {
    return raw;
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
          Text(value, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }
}