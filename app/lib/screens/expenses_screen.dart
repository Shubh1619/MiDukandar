import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../l10n/generated/app_localizations.dart';
import '../models/app_models.dart';
import '../services/api_service.dart';
import '../widgets/app_dialogs.dart';

class ExpensesScreen extends StatefulWidget {
  const ExpensesScreen({super.key, required this.apiService, this.onCreate, this.onUpdate, this.onDelete});

  final ApiService apiService;
  final Future<void> Function(Map<String, dynamic>)? onCreate;
  final Future<void> Function(String id, Map<String, dynamic>)? onUpdate;
  final Future<void> Function(String id)? onDelete;

  @override
  State<ExpensesScreen> createState() => _ExpensesScreenState();
}

class _ExpensesScreenState extends State<ExpensesScreen> {
  bool _loading = true;
  String? _error;
  List<Expense> _expenses = const [];
  ExpenseSummary _summary = const ExpenseSummary(thisMonth: 0, lastMonth: 0, byCategory: []);

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
        widget.apiService.getExpenses(),
        widget.apiService.getExpenseSummary(),
        widget.apiService.getExpenseCategories(),
      ]);
      if (!mounted) return;
      setState(() {
        _expenses = results[0] as List<Expense>;
        _summary = results[1] as ExpenseSummary;
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
    final titleController = TextEditingController();
    final amountController = TextEditingController();
    final categoryController = TextEditingController();
    String paymentMode = 'CASH';

    final result = await AppDialogs.showFormSheet<Map<String, dynamic>>(
      context,
      title: l.expnAddExpense,
      builder: (sheetContext) {
        return StatefulBuilder(
          builder: (ctx, setDialogState) {
            return Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextField(
                  controller: titleController,
                  decoration: InputDecoration(labelText: l.expnExpenseTitle),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: categoryController,
                  decoration: InputDecoration(labelText: l.expnCategoryOptional),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: amountController,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: InputDecoration(labelText: l.amount),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: paymentMode,
                  decoration: InputDecoration(labelText: l.expnPaymentMode),
                  items: const ['CASH', 'UPI', 'CARD', 'BANK']
                      .map((m) => DropdownMenuItem(value: m, child: Text(_paymentModeLabel(l, m))))
                      .toList(),
                  onChanged: (v) => setDialogState(() => paymentMode = v ?? 'CASH'),
                ),
                const SizedBox(height: 20),
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    TextButton(onPressed: () => Navigator.pop(sheetContext), child: Text(l.cancel)),
                    const SizedBox(width: 8),
                    FilledButton(
                      onPressed: () {
                        final payload = {
                          'title': titleController.text.trim().isNotEmpty ? titleController.text.trim() : l.expnDefaultTitle,
                          'amount': num.tryParse(amountController.text.trim()) ?? 0,
                          'categoryName': categoryController.text.trim().isNotEmpty ? categoryController.text.trim() : null,
                          'paymentMode': paymentMode,
                          'note': l.expnNoteFromApp,
                          'expenseDate': DateTime.now().toIso8601String().split('T').first,
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
    // Owned by this method; the sheet is their only consumer. Disposing on the
    // way out stops each dialog open/close from leaking the controllers.
    titleController.dispose();
    amountController.dispose();
    categoryController.dispose();

    if (result != null && widget.onCreate != null) {
      if (!context.mounted) return;
      AppDialogs.showLoading(context);
      try {
        await widget.onCreate!(result);
      } catch (error) {
        if (!context.mounted) return;
        AppDialogs.showError(context, l.errCreateExpense(error.toString()));
      } finally {
        if (context.mounted) {
          AppDialogs.hideLoading(context);
        }
      }
    }
  }

  Future<void> _showEditDialog(BuildContext context, Expense item) async {
    final l = AppLocalizations.of(context)!;
    final titleController = TextEditingController(text: item.title);
    final amountController = TextEditingController(text: item.amount.toString());
    final categoryController = TextEditingController(text: item.categoryName ?? '');
    String paymentMode = item.paymentMode;

    final result = await AppDialogs.showFormSheet<Map<String, dynamic>>(
      context,
      title: l.expnEditExpense,
      builder: (sheetContext) {
        return StatefulBuilder(
          builder: (ctx, setDialogState) {
            return Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextField(
                  controller: titleController,
                  decoration: InputDecoration(labelText: l.expnExpenseTitle),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: categoryController,
                  decoration: InputDecoration(labelText: l.expnCategoryOptional),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: amountController,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: InputDecoration(labelText: l.amount),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: paymentMode,
                  decoration: InputDecoration(labelText: l.expnPaymentMode),
                  items: const ['CASH', 'UPI', 'CARD', 'BANK']
                      .map((m) => DropdownMenuItem(value: m, child: Text(_paymentModeLabel(l, m))))
                      .toList(),
                  onChanged: (v) => setDialogState(() => paymentMode = v ?? 'CASH'),
                ),
                const SizedBox(height: 20),
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    TextButton(onPressed: () => Navigator.pop(sheetContext), child: Text(l.cancel)),
                    const SizedBox(width: 8),
                    FilledButton(
                      onPressed: () {
                        Navigator.pop(sheetContext, {
                          'title': titleController.text.trim().isNotEmpty ? titleController.text.trim() : item.title,
                          'amount': num.tryParse(amountController.text.trim()) ?? item.amount,
                          'categoryName': categoryController.text.trim().isNotEmpty ? categoryController.text.trim() : null,
                          'paymentMode': paymentMode,
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
    // Owned by this method; the sheet is their only consumer. Disposing on the
    // way out stops each dialog open/close from leaking the controllers.
    titleController.dispose();
    amountController.dispose();
    categoryController.dispose();

    if (result != null && widget.onUpdate != null) {
      if (!context.mounted) return;
      AppDialogs.showLoading(context);
      try {
        await widget.onUpdate!(item.id, result);
      } catch (error) {
        if (!context.mounted) return;
        AppDialogs.showError(context, l.errUpdateExpense(error.toString()));
      } finally {
        if (context.mounted) {
          AppDialogs.hideLoading(context);
        }
      }
    }
  }

  Future<void> _confirmDelete(BuildContext context, Expense item) async {
    final l = AppLocalizations.of(context)!;
    final confirmed = await AppDialogs.showConfirm(
      context,
      title: l.expnDeleteTitle,
      message: l.expnDeleteMessage(item.title),
      confirmLabel: l.delete,
      destructive: true,
    );
    if (confirmed != true || widget.onDelete == null) return;
    if (!context.mounted) return;
    AppDialogs.showLoading(context);
    try {
      await widget.onDelete!(item.id);
    } catch (error) {
      if (!context.mounted) return;
      AppDialogs.showError(context, l.errDeleteExpense(error.toString()));
    } finally {
      if (context.mounted) AppDialogs.hideLoading(context);
    }
  }

  void _showActions(BuildContext context, Expense item) {
    final l = AppLocalizations.of(context)!;
    AppDialogs.showFormSheet<void>(
      context,
      title: item.title,
      builder: (sheetContext) {
        return Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (widget.onUpdate != null)
              ListTile(
                leading: const Icon(Icons.edit_outlined),
                title: Text(l.edit),
                onTap: () {
                  Navigator.pop(sheetContext);
                  _showEditDialog(context, item);
                },
              ),
            if (widget.onDelete != null)
              ListTile(
                leading: Icon(Icons.delete_outline, color: Colors.red.shade700),
                title: Text(l.delete, style: TextStyle(color: Colors.red.shade700)),
                onTap: () {
                  Navigator.pop(sheetContext);
                  _confirmDelete(context, item);
                },
              ),
          ],
        );
      },
    );
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
          Row(
            children: [
              Expanded(child: Text(l.sectionExpenses, style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold))),
              if (widget.onCreate != null)
                FilledButton.icon(
                  onPressed: () => _showCreateDialog(context),
                  icon: const Icon(Icons.add),
                  label: Text(l.expnAddExpense),
                ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _SummaryCard(title: l.expnThisMonth, value: formatCurrency.format(_summary.thisMonth), color: Colors.orange.shade700),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _SummaryCard(title: l.expnLastMonth, value: formatCurrency.format(_summary.lastMonth), color: const Color(0xFF1F4E79)),
              ),
            ],
          ),
          if (_summary.byCategory.isNotEmpty) ...[
            const SizedBox(height: 16),
            Text(l.expnByCategory, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _summary.byCategory.map((c) {
                return Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: Colors.purple.shade50,
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: Colors.purple.shade200),
                  ),
                  child: Text(
                    '${c.categoryName ?? l.expnOther} • ${formatCurrency.format(c.total)}',
                    style: TextStyle(color: Colors.purple.shade800, fontSize: 12, fontWeight: FontWeight.w500),
                  ),
                );
              }).toList(),
            ),
          ],
          const SizedBox(height: 16),
          Expanded(
            child: _expenses.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.payments_outlined, size: 64, color: Colors.grey),
                        const SizedBox(height: 12),
                        Text(l.expnNoExpenses, style: const TextStyle(color: Colors.grey)),
                      ],
                    ),
                  )
                : ListView.separated(
                    itemCount: _expenses.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (context, index) {
                      final item = _expenses[index];
                      return Card(
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          side: BorderSide(color: Colors.grey.shade200),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: InkWell(
                          borderRadius: BorderRadius.circular(16),
                          onTap: widget.onUpdate != null || widget.onDelete != null
                              ? () => _showActions(context, item)
                              : null,
                          child: Padding(
                            padding: const EdgeInsets.all(14),
                            child: Row(
                              children: [
                                CircleAvatar(
                                  backgroundColor: Colors.orange.shade100,
                                  child: Icon(Icons.payments_outlined, color: Colors.orange.shade700),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(item.title, style: const TextStyle(fontWeight: FontWeight.w700)),
                                      const SizedBox(height: 4),
                                      Text(
                                        '${item.categoryName ?? l.expnGeneral} • ${_paymentModeLabel(l, item.paymentMode)}',
                                        style: TextStyle(color: Colors.grey.shade600),
                                      ),
                                      if (item.note != null && item.note!.isNotEmpty)
                                        Text(item.note!, style: TextStyle(color: Colors.grey.shade500, fontSize: 12)),
                                    ],
                                  ),
                                ),
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    Text(formatCurrency.format(item.amount), style: const TextStyle(fontWeight: FontWeight.bold)),
                                    const SizedBox(height: 4),
                                    Text(
                                      formatDate.format(DateTime.tryParse(item.expenseDate) ?? DateTime.now()),
                                      style: TextStyle(color: Colors.grey.shade500, fontSize: 12),
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

String _paymentModeLabel(AppLocalizations l, String mode) => switch (mode) {
      'CASH' => l.expnPaymentCash,
      'UPI' => l.expnPaymentUpi,
      'CARD' => l.expnPaymentCard,
      'BANK' => l.expnPaymentBank,
      _ => mode,
    };

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
        color: color.withOpacity(0.08),
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