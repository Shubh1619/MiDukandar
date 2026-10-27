import 'package:flutter/material.dart';

import '../l10n/generated/app_localizations.dart';
import '../main.dart';
import '../models/app_models.dart';
import '../services/api_service.dart';
import '../widgets/app_dialogs.dart';
import '../widgets/md_inputs.dart';

class CustomerScreen extends StatefulWidget {
  const CustomerScreen({super.key, required this.apiService, this.onCreate, this.onDelete, this.onUpdate});

  final ApiService apiService;
  final Future<void> Function(Map<String, dynamic>)? onCreate;
  final Future<void> Function(String id)? onDelete;
  final Future<void> Function(String id, Map<String, dynamic>)? onUpdate;

  @override
  State<CustomerScreen> createState() => _CustomerScreenState();
}

class _CustomerScreenState extends State<CustomerScreen> {
  bool _loading = true;
  String? _error;
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
      final customers = await widget.apiService.getCustomers();
      if (!mounted) return;
      setState(() {
        _customers = customers;
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
    final nameController = TextEditingController();
    final mobileController = TextEditingController();
    final mobileKey = GlobalKey<MobileNumberFieldState>();
    final addressController = TextEditingController();

    final result = await AppDialogs.showFormSheet<Map<String, dynamic>>(
      context,
      title: l.custAddTitle,
      builder: (sheetContext) {
        return Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              controller: nameController,
              decoration: InputDecoration(labelText: l.custNameLabel),
            ),
            const SizedBox(height: 12),
            MobileNumberField(
              key: mobileKey,
              controller: mobileController,
              allowEmpty: true,
            ),
            const SizedBox(height: 12),
            TextField(
              controller: addressController,
              minLines: 2,
              maxLines: 3,
              decoration: InputDecoration(labelText: l.address),
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
                    final name = nameController.text.trim();
                    if (name.isEmpty || widget.onCreate == null) {
                      Navigator.pop(sheetContext);
                      return;
                    }
                    if (mobileKey.currentState?.validate() != null) return;

                    final payload = {
                      'name': name,
                      'mobile': mobileController.text.trim(),
                      'address': addressController.text.trim(),
                      'city': '',
                      'state': '',
                      'pincode': '',
                      'gst': '',
                      'creditLimit': 0,
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
    // The controllers above are function-locals owned by this method, and the
    // sheet is their only consumer. Without disposing them here, every
    // open/close of the dialog leaks a TextEditingController and its listeners.
    nameController.dispose();
    mobileController.dispose();
    addressController.dispose();

    if (result == null || !context.mounted) return;
    AppDialogs.showLoading(context, message: l.pleaseWait);
    try {
      await widget.onCreate?.call(result);
    } finally {
      if (context.mounted) AppDialogs.hideLoading(context);
    }
  }

  Future<void> _showEditDialog(BuildContext context, Customer customer) async {
    final l = AppLocalizations.of(context)!;
    final nameController = TextEditingController(text: customer.name);
    final mobileController = TextEditingController(text: customer.mobile ?? '');
    final mobileKey = GlobalKey<MobileNumberFieldState>();
    final addressController = TextEditingController(text: customer.address ?? '');

    final result = await AppDialogs.showFormSheet<Map<String, dynamic>>(
      context,
      title: l.custEditTitle,
      builder: (sheetContext) {
        return Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              controller: nameController,
              decoration: InputDecoration(labelText: l.custNameLabel),
            ),
            const SizedBox(height: 12),
            MobileNumberField(
              key: mobileKey,
              controller: mobileController,
              allowEmpty: true,
            ),
            const SizedBox(height: 12),
            TextField(
              controller: addressController,
              minLines: 2,
              maxLines: 3,
              decoration: InputDecoration(labelText: l.address),
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
                    final name = nameController.text.trim();
                    if (name.isEmpty || widget.onUpdate == null) {
                      Navigator.pop(sheetContext);
                      return;
                    }
                    if (mobileKey.currentState?.validate() != null) return;

                    final payload = {
                      'name': name,
                      'mobile': mobileController.text.trim(),
                      'address': addressController.text.trim(),
                      'city': '',
                      'state': '',
                      'pincode': '',
                      'gst': '',
                      'creditLimit': 0,
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
    // The controllers above are function-locals owned by this method, and the
    // sheet is their only consumer. Without disposing them here, every
    // open/close of the dialog leaks a TextEditingController and its listeners.
    nameController.dispose();
    mobileController.dispose();
    addressController.dispose();

    if (result == null || !context.mounted) return;
    AppDialogs.showLoading(context, message: l.pleaseWait);
    try {
      await widget.onUpdate?.call(customer.id, result);
    } finally {
      if (context.mounted) AppDialogs.hideLoading(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  l.tabCustomers,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold),
                ),
              ),
              if (widget.onCreate != null)
                FilledButton.icon(
                  onPressed: () => _showCreateDialog(context),
                  icon: const Icon(Icons.person_add_alt_1),
                  label: Text(l.custAddTitle),
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
                    : ListView.separated(
                        physics: const AlwaysScrollableScrollPhysics(),
                        itemCount: _customers.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 10),
                        itemBuilder: (context, index) {
                          final customer = _customers[index];
                return Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    border: Border.all(color: Colors.grey.shade200),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Row(
                    children: [
                      const CircleAvatar(child: Icon(Icons.person_outline)),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              customer.name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontWeight: FontWeight.w700),
                            ),
                            Text(
                              customer.mobile ?? l.custNoMobile,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(color: Colors.grey.shade600),
                            ),
                          ],
                        ),
                      ),
                      Text(formatINR(customer.outstanding), style: const TextStyle(fontWeight: FontWeight.w700)),
                      PopupMenuButton<String>(
                        onSelected: (value) async {
                          if (value == 'edit' && widget.onUpdate != null) {
                            await _showEditDialog(context, customer);
                          }
                          if (value == 'delete' && widget.onDelete != null) {
                            if (!context.mounted) return;
                            final confirmed = await AppDialogs.showConfirm(
                              context,
                              title: l.custDeleteTitle,
                              message: l.custDeleteConfirm(customer.name),
                              confirmLabel: l.delete,
                              destructive: true,
                            );
                            if (!confirmed || !context.mounted) return;
                            AppDialogs.showLoading(context, message: l.pleaseWait);
                            try {
                              await widget.onDelete!(customer.id);
                            } finally {
                              if (context.mounted) AppDialogs.hideLoading(context);
                            }
                          }
                        },
                        itemBuilder: (menuContext) => [
                          PopupMenuItem(value: 'edit', child: Text(l.edit)),
                          PopupMenuItem(value: 'delete', child: Text(l.delete)),
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