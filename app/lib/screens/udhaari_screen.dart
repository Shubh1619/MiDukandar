import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../l10n/generated/app_localizations.dart';
import '../l10n/status_labels.dart';
import '../models/app_models.dart';
import '../services/api_service.dart';
import '../services/device_sms_delivery.dart';
import '../theme/md_design.dart';
import '../widgets/app_dialogs.dart';
import '../widgets/md_inputs.dart';
import '../widgets/sim_picker.dart';

class UdhaariScreen extends StatefulWidget {
  const UdhaariScreen({
    super.key,
    required this.apiService,
    this.onPayment,
    this.onCreate,
  });

  final ApiService apiService;
  final Future<Map<String, dynamic>?> Function({
    required String customerId,
    required num amount,
    String mode,
    String? note,
  })? onPayment;
  final Future<Map<String, dynamic>?> Function(Map<String, dynamic> payload)? onCreate;

  @override
  State<UdhaariScreen> createState() => _UdhaariScreenState();
}

class _UdhaariScreenState extends State<UdhaariScreen> {
  UdhaariReminderCounts? _counts;
  bool _loading = true;
  String? _error;
  List<UdhaariCustomer> _udhaari = const [];
  List<Customer> _customers = const [];

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
        widget.apiService.getUdhaariCustomers(),
        widget.apiService.getCustomers(),
        widget.apiService.getUdhaariReminders(scope: 'all'),
      ]);
      if (!mounted) return;
      setState(() {
        _udhaari = results[0] as List<UdhaariCustomer>;
        _customers = results[1] as List<Customer>;
        _counts = (results[2] as ({List<UdhaariReminder> reminders, UdhaariReminderCounts counts})).counts;
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

  String _modeLabel(AppLocalizations l, String mode) {
    switch (mode.toLowerCase()) {
      case 'cash':
        return l.udhrModeCash;
      case 'upi':
        return l.udhrModeUpi;
      case 'card':
        return l.udhrModeCard;
      case 'bank':
        return l.udhrModeBank;
      default:
        return mode;
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final formatCurrency = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
    final formatDate = DateFormat('d MMM yy');

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

    final totalReceivables = _udhaari.fold<num>(0, (sum, u) => sum + u.balance);

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(l.udhrTitle, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold)),
              ),
              FilledButton.tonalIcon(
                onPressed: () => _showAddUdhaari(context),
                icon: const Icon(Icons.add, size: 18),
                label: Text(l.udhrAdd),
                style: FilledButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  minimumSize: const Size(0, 40),
                  backgroundColor: MdColors.navy50,
                  foregroundColor: MdColors.navy900,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.orange.shade50,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.orange.shade200),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(l.udhrTotalReceivables, style: TextStyle(color: Colors.orange.shade800, fontWeight: FontWeight.w600)),
                const SizedBox(height: 4),
                Text(formatCurrency.format(totalReceivables), style: TextStyle(fontSize: 26, fontWeight: FontWeight.bold, color: Colors.orange.shade900)),
              ],
            ),
          ),
          if (_counts != null) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: MdCard(
                    padding: const EdgeInsets.all(12),
                    color: MdColors.red50,
                    borderColor: MdColors.red500.withAlpha(77),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(l.statusOverdue, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: MdColors.red700)),
                        const SizedBox(height: 4),
                        Text('${_counts!.overdue}', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: MdColors.red700)),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: MdCard(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(l.udhrDueToday, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: MdColors.mutedForeground)),
                        const SizedBox(height: 4),
                        Text('${_counts!.today}', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: MdCard(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(l.udhrUpcoming, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: MdColors.mutedForeground)),
                        const SizedBox(height: 4),
                        Text('${_counts!.upcoming}', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ],
          const SizedBox(height: 16),
          Expanded(
            child: _udhaari.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.account_balance_wallet_outlined, size: 64, color: Colors.grey),
                        const SizedBox(height: 12),
                        Text(l.udhrNoRecords, style: const TextStyle(color: Colors.grey)),
                      ],
                    ),
                  )
                : ListView.separated(
                    physics: const AlwaysScrollableScrollPhysics(),
                    itemCount: _udhaari.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 10),
                    itemBuilder: (context, index) {
                      final u = _udhaari[index];
                      final isClear = u.balance.toDouble() <= 0;
                      return Card(
                        elevation: 2,
                        shadowColor: MdColors.cardShadow,
                        shape: RoundedRectangleBorder(
                          side: BorderSide(color: Colors.grey.shade200),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: InkWell(
                          borderRadius: BorderRadius.circular(16),
                          onTap: () => _showCustomerDetail(context, u, formatCurrency, formatDate),
                          child: Padding(
                            padding: const EdgeInsets.all(14),
                            child: Row(
                              children: [
                                CircleAvatar(
                                  backgroundColor: isClear ? Colors.green.shade100 : Colors.orange.shade100,
                                  child: Icon(
                                    Icons.person_outline,
                                    color: isClear ? Colors.green.shade700 : Colors.orange.shade700,
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        u.name,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(fontWeight: FontWeight.w700),
                                      ),
                                      const SizedBox(height: 4),
                                      if (u.mobile != null && u.mobile!.isNotEmpty)
                                        Text(u.mobile!, style: TextStyle(color: Colors.grey.shade600, fontSize: 13)),
                                      if (u.lastEntryDate != null)
                                        Text(
                                          l.udhrLastEntry(formatDate.format(DateTime.tryParse(u.lastEntryDate!) ?? DateTime.now())),
                                          style: TextStyle(color: Colors.grey.shade500, fontSize: 12),
                                        ),
                                    ],
                                  ),
                                ),
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    Text(
                                      formatCurrency.format(u.balance),
                                      style: TextStyle(
                                        fontWeight: FontWeight.bold,
                                        color: isClear ? Colors.green.shade700 : Colors.orange.shade800,
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      l.udhrTotalAmount(formatCurrency.format(u.totalAmount)),
                                      style: TextStyle(color: Colors.grey.shade600, fontSize: 12),
                                    ),
                                    if (!isClear) ...[
                                      const SizedBox(height: 8),
                                      FilledButton.tonal(
                                        onPressed: () => _showReceivePayment(context, u, formatCurrency),
                                        style: FilledButton.styleFrom(
                                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                          minimumSize: const Size(0, 30),
                                          textStyle: const TextStyle(fontSize: 12),
                                        ),
                                        child: Text(l.udhrReceive),
                                      ),
                                    ],
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

  Future<void> _showAddUdhaari(BuildContext context) async {
    final l = AppLocalizations.of(context)!;
    String? selectedCustomer;
    final newNameController = TextEditingController();
    final newMobileController = TextEditingController();
    final newMobileKey = GlobalKey<MobileNumberFieldState>();
    final amountController = TextEditingController();
    final noteController = TextEditingController();
    DateTime? entryDate;
    DateTime? dueDate;

    final result = await AppDialogs.showFormSheet<Map<String, dynamic>>(
      context,
      title: l.udhrNewEntry,
      builder: (sheetContext) {
        return StatefulBuilder(
          builder: (_, setSheetState) {
            return SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  MdPickerField<String>(
                    selected: selectedCustomer,
                    label: l.udhrSelectCustomer,
                    prefixIcon: Icons.person_outline,
                    options: [
                      MdPickerOption(value: '__new__', label: l.udhrAddNewCustomer, icon: Icons.person_add_outlined),
                      ..._customers.map(
                        (c) => MdPickerOption(
                          value: c.id,
                          label: c.name,
                          trailing: c.mobile != null && c.mobile!.isNotEmpty
                              ? Text(c.mobile!, style: const TextStyle(fontSize: 12, color: MdColors.mutedForeground))
                              : null,
                        ),
                      ),
                    ],
                    onChanged: (v) => setSheetState(() => selectedCustomer = v),
                  ),
                  const SizedBox(height: 12),
                  if (selectedCustomer == '__new__') ...[
                    TextField(
                      controller: newNameController,
                      decoration: InputDecoration(labelText: l.custNameLabel),
                    ),
                    const SizedBox(height: 12),
                    MobileNumberField(key: newMobileKey, controller: newMobileController),
                    const SizedBox(height: 12),
                  ],
                  NumberField(
                    controller: amountController,
                    label: l.udhrAmountLabel,
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: _DateField(
                          label: l.udhrEntryDate,
                          value: entryDate ?? DateTime.now(),
                          icon: Icons.event_outlined,
                          onTap: () async {
                            final picked = await showDatePicker(
                              context: sheetContext,
                              initialDate: entryDate ?? DateTime.now(),
                              firstDate: DateTime(2020),
                              lastDate: DateTime(2100),
                            );
                            if (picked != null) setSheetState(() => entryDate = picked);
                          },
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _DateField(
                          label: l.udhrDueDate,
                          value: dueDate,
                          icon: Icons.event_note_outlined,
                          clearable: true,
                          onTap: () async {
                            final picked = await showDatePicker(
                              context: sheetContext,
                              initialDate: dueDate ?? DateTime.now().add(const Duration(days: 30)),
                              firstDate: DateTime(2020),
                              lastDate: DateTime(2100),
                            );
                            if (picked != null) setSheetState(() => dueDate = picked);
                          },
                          onClear: () => setSheetState(() => dueDate = null),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: noteController,
                    minLines: 2,
                    maxLines: 3,
                    decoration: InputDecoration(labelText: l.udhrNoteOptional),
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
                          final isNewCustomer = selectedCustomer == '__new__';
                          final amount = num.tryParse(amountController.text.trim()) ?? 0;
                          if (isNewCustomer && newNameController.text.trim().isEmpty) {
                            Navigator.pop(sheetContext);
                            return;
                          }
                          if (newMobileKey.currentState?.validate() != null) {
                            return;
                          }
                          if (amount.toDouble() <= 0) {
                            AppDialogs.showError(sheetContext, l.udhrAmountRequired);
                            return;
                          }
                          String ymd(DateTime d) =>
                              '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
                          final payload = <String, dynamic>{
                            if (isNewCustomer)
                              'customer': {
                                'name': newNameController.text.trim(),
                                if (newMobileController.text.trim().isNotEmpty)
                                  'mobile': newMobileController.text.trim(),
                              }
                            else
                              'customerId': selectedCustomer,
                            'amount': amount,
                            'entryDate': ymd(entryDate ?? DateTime.now()),
                            if (dueDate != null) 'dueDate': ymd(dueDate!),
                            if (noteController.text.trim().isNotEmpty) 'note': noteController.text.trim(),
                          };
                          Navigator.pop(sheetContext, payload);
                        },
                        child: Text(l.save),
                      ),
                    ],
                  ),
                ],
              ),
            );
          },
        );
      },
    );
    newNameController.dispose();
    newMobileController.dispose();
    amountController.dispose();
    noteController.dispose();

    if (result == null || !context.mounted) return;
    AppDialogs.showLoading(context);
    Map<String, dynamic>? response;
    try {
      response = widget.onCreate != null
          ? await widget.onCreate!(result)
          : await widget.apiService.createUdhaari(result);
      // The balance list is derived from the entries, so reload it (not just
      // the reminder counts) or the new row looks like it was never saved.
      _load();
    } finally {
      if (context.mounted) AppDialogs.hideLoading(context);
    }

    // SMS_MODE=device: the API does not send; it returns the reserved message
    // and the phone sends it from its own SIM. Run this only after the loading
    // overlay is gone, otherwise the permission/composer sheet would sit on
    // top of it (or be popped by hideLoading).
    if (response == null || !context.mounted) return;
    final pending = response['pendingSms'];
    if (pending is Map) {
      await DeviceSmsDelivery(
        apiService: widget.apiService,
        chooseSim: (sims) => showSimPicker(context, sims),
      ).handle(Map<String, dynamic>.from(pending));
    }
  }

  Future<void> _showCustomerDetail(
    BuildContext context,
    UdhaariCustomer u,
    NumberFormat formatCurrency,
    DateFormat formatDate,
  ) async {
    final l = AppLocalizations.of(context)!;
    List<UdhaariEntry> entries = [];
    bool isLoading = true;
    String? error;
    AppDialogs.showLoading(context);
    try {
      entries = await widget.apiService.getUdhaariEntries(u.customerId);
    } catch (e) {
      error = e.toString();
    } finally {
      isLoading = false;
      if (context.mounted) {
        AppDialogs.hideLoading(context);
      }
    }

    if (!context.mounted) return;
    AppDialogs.showFormSheet<void>(
      context,
      title: u.name,
      subtitle: u.mobile,
      builder: (sheetContext) {
        return Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Align(
              alignment: Alignment.centerRight,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    formatCurrency.format(u.balance),
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Colors.orange.shade800,
                    ),
                  ),
                  Text(l.udhrBalance, style: const TextStyle(fontSize: 12, color: Colors.grey)),
                ],
              ),
            ),
            const SizedBox(height: 16),
            const Divider(),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(l.udhrLedgerEntries, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                if (u.balance.toDouble() > 0)
                  FilledButton.tonalIcon(
                    onPressed: () {
                      Navigator.pop(sheetContext);
                      _showReceivePayment(context, u, formatCurrency);
                    },
                    icon: const Icon(Icons.receipt_long_outlined),
                    label: Text(l.udhrRecordPayment),
                  ),
              ],
            ),
            const SizedBox(height: 8),
            if (isLoading)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 32),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (error != null)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 24),
                child: Center(
                  child: Text(l.udhrLoadEntriesFailed(error), style: const TextStyle(color: Colors.grey)),
                ),
              )
            else if (entries.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 24),
                child: Center(child: Text(l.udhrNoLedgerEntries, style: const TextStyle(color: Colors.grey))),
              )
            else
              ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: entries.length,
                separatorBuilder: (_, _) => const SizedBox(height: 8),
                itemBuilder: (_, i) {
                  final e = entries[i];
                  final paid = e.status.toLowerCase() == 'paid' || e.balance.toDouble() <= 0;
                  return Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.grey.shade50,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.grey.shade200),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: paid ? Colors.green.shade100 : Colors.orange.shade100,
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: Text(
                                localizedStatus(context, e.status),
                                style: TextStyle(
                                  fontWeight: FontWeight.w600,
                                  fontSize: 11,
                                  color: paid ? Colors.green.shade800 : Colors.orange.shade800,
                                ),
                              ),
                            ),
                            const Spacer(),
                            Text(
                              e.entryDate != null
                                  ? formatDate.format(DateTime.tryParse(e.entryDate!) ?? DateTime.now())
                                  : '',
                              style: TextStyle(color: Colors.grey.shade500, fontSize: 12),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Expanded(child: Text(l.udhrEntryAmount(formatCurrency.format(e.amount)), style: const TextStyle(fontWeight: FontWeight.w600))),
                            Text(l.udhrEntryBalance(formatCurrency.format(e.balance)), style: TextStyle(color: Colors.grey.shade700)),
                          ],
                        ),
                        if (e.note != null && e.note!.isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: Text(e.note!, style: TextStyle(color: Colors.grey.shade600, fontSize: 12)),
                          ),
                        if (e.payments.isNotEmpty) ...[
                          const SizedBox(height: 8),
                          ...e.payments.map((p) => Padding(
                                padding: const EdgeInsets.only(top: 2),
                                child: Text(
                                  (p.note != null && p.note!.isNotEmpty)
                                      ? l.udhrPaidViaNote(
                                          formatCurrency.format(p.amount),
                                          _modeLabel(l, p.mode),
                                          p.note!,
                                        )
                                      : l.udhrPaidVia(formatCurrency.format(p.amount), _modeLabel(l, p.mode)),
                                  style: TextStyle(color: Colors.green.shade700, fontSize: 12),
                                ),
                              )),
                        ],
                      ],
                    ),
                  );
                },
              ),
          ],
        );
      },
    );
  }

  Future<void> _showReceivePayment(BuildContext context, UdhaariCustomer u, NumberFormat formatCurrency) async {
    final l = AppLocalizations.of(context)!;
    final amountController = TextEditingController(text: u.balance.toString());
    final noteController = TextEditingController();
    String mode = 'CASH';

    final result = await AppDialogs.showFormSheet<Map<String, dynamic>>(
      context,
      title: l.udhrRecordPayment,
      subtitle: l.udhrReceivePaymentFrom(u.name),
      builder: (sheetContext) {
        return StatefulBuilder(
          builder: (_, setSheetState) {
            return Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l.udhrOutstandingBalance(formatCurrency.format(u.balance)),
                  style: TextStyle(color: Colors.orange.shade800, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 16),
                NumberField(
                  controller: amountController,
                  label: l.udhrAmountReceived,
                ),
                const SizedBox(height: 12),
                MdPickerField<String>(
                  selected: mode,
                  label: l.udhrPaymentMode,
                  prefixIcon: Icons.payments_outlined,
                  options: [
                    MdPickerOption(value: 'CASH', label: _modeLabel(l, 'CASH'), icon: Icons.currency_rupee_outlined),
                    MdPickerOption(value: 'UPI', label: _modeLabel(l, 'UPI'), icon: Icons.phone_iphone_outlined),
                    MdPickerOption(value: 'CARD', label: _modeLabel(l, 'CARD'), icon: Icons.credit_card_outlined),
                  ],
                  onChanged: (v) => setSheetState(() => mode = v),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: noteController,
                  decoration: InputDecoration(labelText: l.udhrNoteOptional),
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
                        final amount = num.tryParse(amountController.text.trim()) ?? 0;
                        if (amount.toDouble() <= 0) {
                          Navigator.pop(sheetContext);
                          return;
                        }
                        Navigator.pop(sheetContext, {
                          'customerId': u.customerId,
                          'amount': amount,
                          'mode': mode,
                          'note': noteController.text.trim().isNotEmpty ? noteController.text.trim() : null,
                        });
                      },
                      child: Text(l.udhrReceive),
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
    noteController.dispose();

    if (result == null || !context.mounted) return;
    if (widget.onPayment == null) return;
    AppDialogs.showLoading(context);
    Map<String, dynamic>? response;
    try {
      response = await widget.onPayment!(
        customerId: result['customerId'] as String,
        amount: result['amount'] as num,
        mode: result['mode'] as String? ?? 'CASH',
        note: result['note'] as String?,
      );
      // The outstanding balance changed, so refresh the list (and today's
      // reminder counts) before showing the confirmation.
      _load();
      if (context.mounted) {
        final l = AppLocalizations.of(context)!;
        AppDialogs.showSuccess(context, l.udhrPaymentReceived);
      }
    } finally {
      if (context.mounted) {
        AppDialogs.hideLoading(context);
      }
    }

    // SMS_MODE=device: the API reserved a thank-you message and returned it
    // instead of sending. Same handshake as a new entry: send from the phone's
    // own SIM once the loading overlay is gone, then report the outcome.
    if (response == null || !context.mounted) return;
    final pending = response['pendingSms'];
    if (pending is Map) {
      await DeviceSmsDelivery(
        apiService: widget.apiService,
        chooseSim: (sims) => showSimPicker(context, sims),
      ).handle(Map<String, dynamic>.from(pending));
    }
  }
}

class _DateField extends StatelessWidget {
  const _DateField({
    required this.label,
    required this.value,
    required this.icon,
    required this.onTap,
    this.clearable = false,
    this.onClear,
  });

  final String label;
  final DateTime? value;
  final IconData icon;
  final VoidCallback onTap;
  final bool clearable;
  final VoidCallback? onClear;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: onTap,
      child: Container(
        height: 52,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(
          color: MdColors.navy50,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: MdColors.border),
        ),
        child: Row(
          children: [
            Icon(icon, size: 20, color: MdColors.navy400),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: const TextStyle(fontSize: 11, color: MdColors.navy500),
                  ),
                  Text(
                    value != null
                        ? DateFormat('d MMM yy').format(value!)
                        : '--',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: value != null ? MdColors.foreground : MdColors.navy300,
                    ),
                  ),
                ],
              ),
            ),
            if (clearable && value != null)
              GestureDetector(
                onTap: onClear,
                child: const Icon(Icons.close, size: 16, color: MdColors.mutedForeground),
              )
            else
              const Icon(Icons.keyboard_arrow_down, size: 20, color: MdColors.navy300),
          ],
        ),
      ),
    );
  }
}