import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';

import '../l10n/generated/app_localizations.dart';
import '../l10n/locale_controller.dart';
import '../l10n/status_labels.dart';
import '../models/app_models.dart';
import '../services/api_service.dart';
import '../theme/md_design.dart';
import '../widgets/app_dialogs.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({
    super.key,
    required this.apiService,
    required this.store,
    this.onChanged,
    this.userRole,
  });

  final ApiService apiService;
  final Store? store;
  final Future<void> Function()? onChanged;
  final String? userRole;

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _name;
  late final TextEditingController _type;
  late final TextEditingController _address;
  late final TextEditingController _city;
  late final TextEditingController _state;
  late final TextEditingController _pincode;
  late final TextEditingController _phone;
  late final TextEditingController _gst;
  late final TextEditingController _invoicePrefix;
  String _language = 'en';
  SmsUsage? _sms;
  List<SmsMessage> _smsMessages = const [];
  bool _smsLoading = true;
  bool _smsBusy = false;

  bool get _canManageSms =>
      widget.userRole == 'OWNER' || widget.userRole == 'MANAGER';

  static const Map<String, String> _languageLabels = {
    'en': 'English',
    'hi': 'हिन्दी',
    'mr': 'मराठी',
  };

  @override
  void initState() {
    super.initState();
    final store = widget.store ?? const Store(
      id: '', name: 'My Store', type: 'Retail',
      currency: 'INR', language: 'en', invoicePrefix: 'INV',
    );
    _name = TextEditingController(text: store.name);
    _type = TextEditingController(text: store.type);
    _address = TextEditingController(text: store.address ?? '');
    _city = TextEditingController(text: store.city ?? '');
    _state = TextEditingController(text: store.state ?? '');
    _pincode = TextEditingController(text: store.pincode ?? '');
    _phone = TextEditingController(text: store.phone ?? '');
    _gst = TextEditingController(text: store.gst ?? '');
    _invoicePrefix = TextEditingController(text: store.invoicePrefix);
    _language = store.language;
    _loadSms();
  }

  @override
  void dispose() {
    _name.dispose();
    _type.dispose();
    _address.dispose();
    _city.dispose();
    _state.dispose();
    _pincode.dispose();
    _phone.dispose();
    _gst.dispose();
    _invoicePrefix.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    AppDialogs.showLoading(context);
    try {
      final payload = <String, dynamic>{
        'name': _name.text.trim(),
        'type': _type.text.trim(),
        'address': _address.text.trim(),
        'city': _city.text.trim(),
        'state': _state.text.trim(),
        'pincode': _pincode.text.trim(),
        'phone': _phone.text.trim(),
        'gst': _gst.text.trim(),
        'invoicePrefix': _invoicePrefix.text.trim(),
      };
      await widget.apiService.updateStore(payload);
      if (_language != widget.store?.language) {
        await widget.apiService.updateLanguage(_language);
      }
      if (!mounted) return;
      AppDialogs.showSuccess(
        context,
        AppLocalizations.of(context)!.settingsSaved,
      );
      await widget.onChanged?.call();
    } catch (error) {
      if (!mounted) return;
      AppDialogs.showError(
        context,
        AppLocalizations.of(context)!.settingsSaveFailed(error.toString()),
      );
    } finally {
      if (mounted) {
        AppDialogs.hideLoading(context);
      }
    }
  }

  Future<void> _showReferral() async {
    final l = AppLocalizations.of(context)!;
    AppDialogs.showLoading(context);
    Map<String, dynamic> data;
    try {
      data = await widget.apiService.getReferral();
    } catch (_) {
      if (mounted) {
        AppDialogs.hideLoading(context);
        AppDialogs.showError(context, l.referOnlyOwner);
      }
      return;
    }
    if (!mounted) return;
    AppDialogs.hideLoading(context);
    final code = data['code']?.toString() ?? '';
    final count = data['referredCount']?.toString() ?? '0';
    await AppDialogs.showFormSheet<void>(
      context,
      title: l.referTitle,
      builder: (sheetContext) => Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(l.referYourCode, style: TextStyle(color: Colors.grey.shade600, fontSize: 13)),
          const SizedBox(height: 6),
          Text(
            code,
            style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold, letterSpacing: 3),
          ),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: () async {
              await Clipboard.setData(ClipboardData(text: code));
              if (mounted) AppDialogs.showSuccess(context, l.referCopied);
            },
            icon: const Icon(Icons.copy_all_outlined, size: 18),
            label: Text(l.referCopy),
          ),
          const SizedBox(height: 16),
          Text('${l.referReferred}: $count', style: const TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton(
              onPressed: () => Navigator.pop(sheetContext),
              child: Text(l.close),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _loadSms() async {
    try {
      final usage = await widget.apiService.getSmsUsage();
      var messages = const <SmsMessage>[];
      if (_canManageSms) {
        try {
          messages = await widget.apiService.getSmsMessages(limit: 5);
        } catch (_) {
          // The usage meter is still useful without the delivery log.
        }
      }
      if (!mounted) return;
      setState(() {
        _sms = usage;
        _smsMessages = messages;
        _smsLoading = false;
      });
    } catch (_) {
      // SMS is an optional channel; never block the rest of Settings on it.
      if (mounted) setState(() => _smsLoading = false);
    }
  }

  Future<void> _toggleSms(bool enabled) async {
    final l = AppLocalizations.of(context)!;
    setState(() => _smsBusy = true);
    try {
      final value = await widget.apiService.updateSmsSettings(enabled);
      if (!mounted) return;
      setState(() => _sms = _sms?.copyWith(enabled: value));
      AppDialogs.showSuccess(
        context,
        enabled ? l.smsEnabledToast : l.smsDisabledToast,
      );
    } catch (error) {
      if (!mounted) return;
      AppDialogs.showError(context, l.smsUpdateFailed(error.toString()));
    } finally {
      if (mounted) setState(() => _smsBusy = false);
    }
  }

  String _smsDate(String? raw) {
    if (raw == null || raw.isEmpty) return '';
    final dt = DateTime.tryParse(raw)?.toLocal();
    return dt == null ? '' : DateFormat('d MMM, HH:mm').format(dt);
  }

  Widget _smsMessageTile(AppLocalizations l, SmsMessage message) {
    final failed = message.status == 'FAILED';
    final sent = message.status == 'SENT';
    final name = message.customerName?.trim() ?? '';
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name.isEmpty ? message.toPhone : name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 13,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  [message.toPhone, _smsDate(message.createdAt)]
                      .where((part) => part.isNotEmpty)
                      .join(' · '),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 11,
                    color: MdColors.mutedForeground,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          MdChip(
            label: localizedSmsStatus(context, message.status),
            background: failed
                ? MdColors.red50
                : sent
                    ? MdColors.green100
                    : MdColors.navy100,
            foreground: failed
                ? MdColors.red700
                : sent
                    ? MdColors.green700
                    : MdColors.navy600,
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    String? requiredValidator(String? v) =>
        (v == null || v.trim().isEmpty) ? l.required : null;
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            MdHeader(
              title: l.settingsTitle,
              subtitle: l.settingsSubtitle,
            ),
            const SizedBox(height: 20),
            _SectionTitle(l.settingsStoreProfile, Icons.storefront_outlined),
            const SizedBox(height: 12),
            MdCard(
              child: Column(
                children: [
                  _field(
                    _name,
                    l.settingsBusinessName,
                    validator: (v) => (v == null || v.trim().length < 2)
                        ? l.required
                        : null,
                  ),
                  _field(
                    _type,
                    l.settingsBusinessType,
                    validator: requiredValidator,
                  ),
                  _field(_phone, l.phone, keyboard: TextInputType.phone),
                  _field(_gst, l.settingsGstin),
                  _field(_invoicePrefix, l.settingsInvoicePrefix),
                ],
              ),
            ),
            const SizedBox(height: 20),
            _SectionTitle(l.settingsAddressSection, Icons.location_on_outlined),
            const SizedBox(height: 12),
            MdCard(
              child: Column(
                children: [
                  _field(_address, l.address, multiline: true),
                  _field(_city, l.city),
                  _field(_state, l.state),
                  _field(_pincode, l.pincode, keyboard: TextInputType.number),
                ],
              ),
            ),
            const SizedBox(height: 20),
            _SectionTitle(l.settingsLanguageSection, Icons.translate),
            const SizedBox(height: 12),
            MdCard(
              child: DropdownButtonFormField<String>(
                initialValue: _language,
                decoration:
                    InputDecoration(labelText: l.settingsAppLanguage),
                items: _languageLabels.entries
                    .map((e) =>
                        DropdownMenuItem(value: e.key, child: Text(e.value)))
                    .toList(),
                onChanged: (v) {
                  final code = v ?? 'en';
                  setState(() => _language = code);
                  // Switch the whole app instantly (MaterialApp rebuilds via
                  // LocaleController) and persist for the next launch.
                  LocaleController.instance.setLocale(code);
                },
              ),
            ),
            const SizedBox(height: 20),
            _SectionTitle(l.smsSectionTitle, Icons.sms_outlined),
            const SizedBox(height: 12),
            MdCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Text(
                          l.smsSectionSubtitle,
                          style: TextStyle(
                            color: Colors.grey.shade600,
                            fontSize: 13,
                          ),
                        ),
                      ),
                      if (_sms != null && _sms!.mode == 'log')
                        Padding(
                          padding: const EdgeInsets.only(top: 2, right: 4),
                          child: MdChip(label: l.smsLogOnly),
                        ),
                      Switch(
                        value: _sms?.enabled ?? false,
                        onChanged: (!_canManageSms || _smsBusy || _sms == null)
                            ? null
                            : _toggleSms,
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  if (_smsLoading)
                    const LinearProgressIndicator(minHeight: 3)
                  else if (_sms == null)
                    Text(
                      l.smsLoadFailed,
                      style: const TextStyle(
                        fontSize: 12,
                        color: MdColors.mutedForeground,
                      ),
                    )
                  else ...[
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            l.smsTodayFree,
                            style: const TextStyle(
                              fontWeight: FontWeight.w600,
                              fontSize: 13,
                            ),
                          ),
                        ),
                        Text(
                          l.smsUsageCount(
                            _sms!.used.toString(),
                            _sms!.limit.toString(),
                            _sms!.remaining.toString(),
                          ),
                          style: const TextStyle(
                            fontSize: 12,
                            color: MdColors.mutedForeground,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(999),
                      child: LinearProgressIndicator(
                        value: _sms!.progress,
                        minHeight: 8,
                        backgroundColor: MdColors.navy100,
                        valueColor: AlwaysStoppedAnimation<Color>(
                          _sms!.remaining == 0
                              ? MdColors.red500
                              : MdColors.royal600,
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      l.smsResetNote,
                      style: const TextStyle(
                        fontSize: 12,
                        color: MdColors.mutedForeground,
                      ),
                    ),
                  ],
                  if (!_canManageSms) ...[
                    const SizedBox(height: 10),
                    Text(
                      l.smsManagerOnly,
                      style: const TextStyle(
                        fontSize: 12,
                        color: MdColors.mutedForeground,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            if (_canManageSms) ...[
              const SizedBox(height: 20),
              _SectionTitle(l.smsRecentTitle, Icons.history),
              const SizedBox(height: 12),
              MdCard(
                padding: EdgeInsets.zero,
                child: _smsMessages.isEmpty
                    ? Padding(
                        padding: const EdgeInsets.all(20),
                        child: Center(
                          child: Text(
                            l.smsEmpty,
                            style: const TextStyle(
                              fontSize: 12,
                              color: MdColors.mutedForeground,
                            ),
                          ),
                        ),
                      )
                    : Column(
                        children: [
                          for (var i = 0; i < _smsMessages.length; i++) ...[
                            if (i > 0) const Divider(height: 1),
                            _smsMessageTile(l, _smsMessages[i]),
                          ],
                        ],
                      ),
              ),
            ],
            const SizedBox(height: 20),
            _SectionTitle(l.referTitle, Icons.card_giftcard_outlined),
            const SizedBox(height: 12),
            MdCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    l.referOnlyOwner,
                    style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
                  ),
                  const SizedBox(height: 12),
                  OutlinedButton.icon(
                    onPressed: _showReferral,
                    icon: const Icon(Icons.share_outlined, size: 18),
                    label: Text(l.referTitle),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: _save,
                icon: const Icon(Icons.save_outlined, size: 18),
                label: Text(AppLocalizations.of(context)!.settingsSave),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _field(
    TextEditingController controller,
    String label, {
    String? hint,
    TextInputType? keyboard,
    bool multiline = false,
    String? Function(String?)? validator,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextFormField(
        controller: controller,
        keyboardType: keyboard,
        maxLines: multiline ? 2 : 1,
        decoration: InputDecoration(labelText: label, hintText: hint),
        validator: validator,
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.title, this.icon);

  final String title;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 16, color: MdColors.navy600),
        const SizedBox(width: 8),
        Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: MdColors.navy800)),
      ],
    );
  }
}