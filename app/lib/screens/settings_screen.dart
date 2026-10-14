import 'package:flutter/material.dart';

import '../l10n/generated/app_localizations.dart';
import '../l10n/locale_controller.dart';
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
  });

  final ApiService apiService;
  final Store? store;
  final Future<void> Function()? onChanged;

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
                value: _language,
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
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: _save,
                icon: const Icon(Icons.save_outlined, size: 18),
                label: Text(AppLocalizations.of(context)!.settingsSave),
              ),
            ),
            const SizedBox(height: 16),
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