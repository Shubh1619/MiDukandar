import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../l10n/generated/app_localizations.dart';
import '../models/app_models.dart';
import '../services/api_service.dart';
import '../theme/md_design.dart';
import '../widgets/app_dialogs.dart';
import '../widgets/md_inputs.dart';

class SuppliersScreen extends StatefulWidget {
  const SuppliersScreen({
    super.key,
    required this.apiService,
    this.onCreate,
    this.onUpdate,
    this.onDelete,
    this.onRefresh,
  });

  final ApiService apiService;
  final Future<void> Function(Map<String, dynamic>)? onCreate;
  final Future<void> Function(String id, Map<String, dynamic>)? onUpdate;
  final Future<void> Function(String id)? onDelete;
  final Future<void> Function()? onRefresh;

  @override
  State<SuppliersScreen> createState() => _SuppliersScreenState();
}

class _SuppliersScreenState extends State<SuppliersScreen> {
  SupplierSummary? _summary;
  bool _loading = true;
  String? _error;
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
      final results = await Future.wait([
        widget.apiService.getSuppliers(),
        widget.apiService.getSupplierSummary(),
      ]);
      if (!mounted) return;
      setState(() {
        _suppliers = results[0] as List<Supplier>;
        _summary = results[1] as SupplierSummary;
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

  @override
  void didUpdateWidget(covariant SuppliersScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    _load();
  }

  Future<void> _showCreateDialog(BuildContext context) async {
    final l = AppLocalizations.of(context)!;
    final nameController = TextEditingController();
    final phoneController = TextEditingController();
    final phoneKey = GlobalKey<MobileNumberFieldState>();
    final emailController = TextEditingController();
    final gstinController = TextEditingController();
    final addressController = TextEditingController();

    final result = await AppDialogs.showFormSheet<Map<String, dynamic>>(
      context,
      title: l.suppAddSupplier,
      builder: (sheetContext) {
        return Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              controller: nameController,
              decoration: InputDecoration(labelText: l.suppSupplierName),
            ),
            const SizedBox(height: 12),
            MobileNumberField(
              key: phoneKey,
              controller: phoneController,
              allowEmpty: true,
            ),
            const SizedBox(height: 12),
            TextField(
              controller: emailController,
              keyboardType: TextInputType.emailAddress,
              decoration: InputDecoration(labelText: l.suppEmailOptional),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: gstinController,
              decoration: InputDecoration(labelText: l.suppGstinOptional),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: addressController,
              minLines: 2,
              maxLines: 3,
              decoration: InputDecoration(labelText: l.suppAddressOptional),
            ),
            const SizedBox(height: 20),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                TextButton(onPressed: () => Navigator.pop(sheetContext), child: Text(l.cancel)),
                const SizedBox(width: 8),
                FilledButton(
                  onPressed: () {
                    final name = nameController.text.trim();
                    if (name.isEmpty) {
                      Navigator.pop(sheetContext);
                      return;
                    }
                    if (phoneKey.currentState?.validate() != null) return;
                    final payload = {
                      'name': name,
                      'phone': phoneController.text.trim(),
                      'email': emailController.text.trim().isNotEmpty ? emailController.text.trim() : '',
                      'gstin': gstinController.text.trim().isNotEmpty ? gstinController.text.trim() : '',
                      'address': addressController.text.trim().isNotEmpty ? addressController.text.trim() : '',
                      'category': 'General',
                      'openingBalance': 0,
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
    nameController.dispose();
    phoneController.dispose();
    emailController.dispose();
    gstinController.dispose();
    addressController.dispose();

    if (result != null && widget.onCreate != null) {
      if (!context.mounted) return;
      AppDialogs.showLoading(context);
      try {
        await widget.onCreate!(result);
      } catch (error) {
        if (!context.mounted) return;
        AppDialogs.showError(context, l.errCreateSupplier(error.toString()));
      } finally {
        if (context.mounted) {
          AppDialogs.hideLoading(context);
        }
      }
    }
  }

  Future<void> _showEditDialog(BuildContext context, Supplier s) async {
    final l = AppLocalizations.of(context)!;
    final nameController = TextEditingController(text: s.name);
    final phoneController = TextEditingController(text: s.phone ?? '');
    final phoneKey = GlobalKey<MobileNumberFieldState>();
    final emailController = TextEditingController(text: s.email ?? '');
    final gstinController = TextEditingController(text: s.gstin ?? '');
    final addressController = TextEditingController(text: s.address ?? '');

    final result = await AppDialogs.showFormSheet<Map<String, dynamic>>(
      context,
      title: l.suppEditSupplier,
      builder: (sheetContext) {
        return Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              controller: nameController,
              decoration: InputDecoration(labelText: l.suppSupplierName),
            ),
            const SizedBox(height: 12),
            MobileNumberField(
              key: phoneKey,
              controller: phoneController,
              allowEmpty: true,
            ),
            const SizedBox(height: 12),
            TextField(
              controller: emailController,
              keyboardType: TextInputType.emailAddress,
              decoration: InputDecoration(labelText: l.suppEmailOptional),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: gstinController,
              decoration: InputDecoration(labelText: l.suppGstinOptional),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: addressController,
              minLines: 2,
              maxLines: 3,
              decoration: InputDecoration(labelText: l.suppAddressOptional),
            ),
            const SizedBox(height: 20),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                TextButton(onPressed: () => Navigator.pop(sheetContext), child: Text(l.cancel)),
                const SizedBox(width: 8),
                FilledButton(
                  onPressed: () {
                    final name = nameController.text.trim();
                    if (name.isEmpty) {
                      Navigator.pop(sheetContext);
                      return;
                    }
                    if (phoneKey.currentState?.validate() != null) return;
                    Navigator.pop(sheetContext, {
                      'name': name,
                      'phone': phoneController.text.trim(),
                      'email': emailController.text.trim().isNotEmpty ? emailController.text.trim() : '',
                      'gstin': gstinController.text.trim().isNotEmpty ? gstinController.text.trim() : '',
                      'address': addressController.text.trim().isNotEmpty ? addressController.text.trim() : '',
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
    nameController.dispose();
    phoneController.dispose();
    emailController.dispose();
    gstinController.dispose();
    addressController.dispose();

    if (result != null && widget.onUpdate != null) {
      if (!context.mounted) return;
      AppDialogs.showLoading(context);
      try {
        await widget.onUpdate!(s.id, result);
      } catch (error) {
        if (!context.mounted) return;
        AppDialogs.showError(context, l.errUpdateSupplier(error.toString()));
      } finally {
        if (context.mounted) {
          AppDialogs.hideLoading(context);
        }
      }
    }
  }

  Future<void> _confirmDelete(BuildContext context, Supplier s) async {
    final l = AppLocalizations.of(context)!;
    final confirmed = await AppDialogs.showConfirm(
      context,
      title: l.suppDeleteTitle,
      message: l.suppDeleteMessage(s.name),
      confirmLabel: l.delete,
      destructive: true,
    );
    if (confirmed != true || widget.onDelete == null) return;
    if (!context.mounted) return;
    AppDialogs.showLoading(context);
    try {
      await widget.onDelete!(s.id);
    } catch (error) {
      if (!context.mounted) return;
      AppDialogs.showError(context, l.errDeleteSupplier(error.toString()));
    } finally {
      if (context.mounted) AppDialogs.hideLoading(context);
    }
  }

  void _showActions(BuildContext context, Supplier s) {
    final l = AppLocalizations.of(context)!;
    AppDialogs.showFormSheet<void>(
      context,
      title: s.name,
      builder: (sheetContext) {
        return Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.receipt_long_outlined),
              title: Text(l.suppViewDetails),
              onTap: () {
                Navigator.pop(sheetContext);
                _showDetail(context, s);
              },
            ),
            if (widget.onUpdate != null)
              ListTile(
                leading: const Icon(Icons.edit_outlined),
                title: Text(l.edit),
                onTap: () {
                  Navigator.pop(sheetContext);
                  _showEditDialog(context, s);
                },
              ),
            if (widget.onDelete != null)
              ListTile(
                leading: Icon(Icons.delete_outline, color: Colors.red.shade700),
                title: Text(l.delete, style: TextStyle(color: Colors.red.shade700)),
                onTap: () {
                  Navigator.pop(sheetContext);
                  _confirmDelete(context, s);
                },
              ),
          ],
        );
      },
    );
  }

  void _showDetail(BuildContext context, Supplier s) {
    final l = AppLocalizations.of(context)!;
    final formatCurrency = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
    final formatDate = DateFormat('d MMM yy');
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (sheetContext) {
        return DraggableScrollableSheet(
          expand: false,
          initialChildSize: 0.7,
          maxChildSize: 0.95,
          builder: (context, controller) {
            return FutureBuilder<Map<String, dynamic>>(
              future: widget.apiService.getSupplierDetail(s.id),
              builder: (context, snapshot) {
                if (snapshot.connectionState != ConnectionState.done) {
                  return const Center(
                    child: Padding(
                      padding: EdgeInsets.all(24),
                      child: CircularProgressIndicator(),
                    ),
                  );
                }
                if (snapshot.hasError) {
                  return Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Text(snapshot.error.toString(), style: const TextStyle(color: Colors.red)),
                    ),
                  );
                }
                final data = snapshot.data ?? const <String, dynamic>{};
                final supplier = (data['supplier'] as Map?) ?? const {};
                final pos = (data['purchaseOrders'] as List?) ?? const [];
                final payments = (data['payments'] as List?) ?? const [];
                final outstanding = _toNum(supplier['outstandingPayable']);

                return ListView(
                  controller: controller,
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                  children: [
                    Text(s.name, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 4),
                    if (outstanding > 0)
                      Text(
                        l.suppPayableAmount(formatCurrency.format(outstanding)),
                        style: TextStyle(color: Colors.red.shade700, fontWeight: FontWeight.w600),
                      ),
                    const SizedBox(height: 16),
                    Text(l.suppPurchaseOrders, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                    const SizedBox(height: 8),
                    if (pos.isEmpty)
                      Text(l.suppNoPOs, style: TextStyle(color: Colors.grey.shade600))
                    else
                      ...pos.map((raw) {
                        final po = raw is Map ? raw : const {};
                        final poDate = DateTime.tryParse('${po['orderDate'] ?? ''}');
                        return ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: const Icon(Icons.description_outlined),
                          title: Text('${po['poNumber'] ?? ''}'),
                          subtitle: Text(
                            poDate != null ? formatDate.format(poDate) : '${po['orderDate'] ?? ''}',
                          ),
                          trailing: Text(
                            formatCurrency.format(_toNum(po['totalAmount'])),
                            style: const TextStyle(fontWeight: FontWeight.w600),
                          ),
                        );
                      }),
                    const SizedBox(height: 16),
                    Text(l.suppPayments, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                    const SizedBox(height: 8),
                    if (payments.isEmpty)
                      Text(l.suppNoPayments, style: TextStyle(color: Colors.grey.shade600))
                    else
                      ...payments.map((raw) {
                        final p = raw is Map ? raw : const {};
                        final payDate = DateTime.tryParse('${p['paymentDate'] ?? ''}');
                        return ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: const Icon(Icons.payments_outlined),
                          title: Text(formatCurrency.format(_toNum(p['amount']))),
                          subtitle: Text(
                            [
                              if (payDate != null) formatDate.format(payDate),
                              if ('${p['paymentMode'] ?? ''}'.isNotEmpty) '${p['paymentMode']}',
                              if ('${p['poNumber'] ?? ''}'.isNotEmpty) '${p['poNumber']}',
                            ].join(' • '),
                          ),
                        );
                      }),
                  ],
                );
              },
            );
          },
        );
      },
    );
  }

  num _toNum(dynamic value) {
    if (value is num) return value;
    if (value == null) return 0;
    return num.tryParse(value.toString()) ?? 0;
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final formatCurrency = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
    final formatDate = DateFormat('d MMM yy');
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          MdHeader(
            title: l.sectionSuppliers,
            subtitle: l.suppSubtitle,
          ),
          const SizedBox(height: 16),
          if (_summary != null) ...[
            Row(
              children: [
                Expanded(
                  child: MdStatCard(
                    label: l.sectionSuppliers,
                    value: '${_summary!.total}',
                    sub: l.suppTotalRegisteredVendors,
                    icon: Icons.storefront_outlined,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: MdStatCard(
                    label: l.suppTotalPayable,
                    value: formatCurrency.format(_summary!.totalPayable),
                    sub: l.suppAcrossOpenAccounts(_summary!.outstandingCount.toString()),
                    icon: Icons.payments_outlined,
                    tone: MdColors.red700,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                MdChip(label: l.suppXSettled(_summary!.settledCount.toString()), background: MdColors.green100, foreground: MdColors.green700, icon: Icons.check_circle_outline),
                MdChip(label: l.suppXOutstanding(_summary!.outstandingCount.toString()), background: MdColors.royal100, foreground: MdColors.royal600, icon: Icons.schedule_outlined),
                MdChip(label: l.suppXOverdue(_summary!.overdueCount.toString()), background: MdColors.red50, foreground: MdColors.red700, icon: Icons.error_outline),
              ],
            ),
            const SizedBox(height: 16),
          ],
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              if (widget.onCreate != null)
                FilledButton.icon(
                  onPressed: () => _showCreateDialog(context),
                  icon: const Icon(Icons.add),
                  label: Text(l.suppAddSupplier),
                ),
            ],
          ),
          const SizedBox(height: 12),
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
                    : _suppliers.isEmpty
                        ? MdEmptyState(
                    icon: Icons.local_shipping_outlined,
                    title: l.suppNoSuppliers,
                    subtitle: l.suppNoSuppliersSub,
                  )
                : ListView.separated(
                    physics: const AlwaysScrollableScrollPhysics(),
                    itemCount: _suppliers.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 10),
                    itemBuilder: (context, index) {
                      final s = _suppliers[index];
                      return Card(
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          side: BorderSide(color: Colors.grey.shade200),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: InkWell(
                          borderRadius: BorderRadius.circular(16),
                          onTap: widget.onUpdate != null || widget.onDelete != null
                              ? () => _showActions(context, s)
                              : null,
                          child: Padding(
                            padding: const EdgeInsets.all(14),
                            child: Row(
                              children: [
                                CircleAvatar(
                                  backgroundColor: Colors.teal.shade100,
                                  child: Icon(Icons.storefront_outlined, color: Colors.teal.shade700),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        s.name,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(fontWeight: FontWeight.w700),
                                      ),
                                      const SizedBox(height: 4),
                                      if (s.phone != null && s.phone!.isNotEmpty)
                                        Text(s.phone!, style: TextStyle(color: Colors.grey.shade600, fontSize: 13)),
                                      if (s.email != null && s.email!.isNotEmpty)
                                        Text(s.email!, style: TextStyle(color: Colors.grey.shade500, fontSize: 12)),
                                      if (s.address != null && s.address!.isNotEmpty)
                                        Text(s.address!, style: TextStyle(color: Colors.grey.shade500, fontSize: 12)),
                                    ],
                                  ),
                                ),
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    if (s.outstandingPayable != null && s.outstandingPayable!.toDouble() > 0)
                                      Text(
                                        l.suppPayableAmount(formatCurrency.format(s.outstandingPayable!)),
                                        style: TextStyle(color: Colors.red.shade700, fontWeight: FontWeight.w600, fontSize: 12),
                                      ),
                                    if (s.totalPurchases != null)
                                      Text(
                                        l.suppPurchasesAmount(formatCurrency.format(s.totalPurchases!)),
                                        style: TextStyle(color: Colors.grey.shade700, fontSize: 12),
                                      ),
                                    if (s.lastOrderDate != null)
                                      Text(
                                        l.suppLastDate(formatDate.format(DateTime.tryParse(s.lastOrderDate!) ?? DateTime.now())),
                                        style: TextStyle(color: Colors.grey.shade500, fontSize: 11),
                                      ),
                                  ],
                                ),
                                if (widget.onUpdate != null || widget.onDelete != null) ...[
                                  const SizedBox(width: 4),
                                  Icon(Icons.more_vert, color: Colors.grey.shade400),
                                ],
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