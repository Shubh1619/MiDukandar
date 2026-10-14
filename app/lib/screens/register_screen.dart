import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../l10n/generated/app_localizations.dart';
import '../services/api_service.dart';
import '../theme/md_design.dart';
import '../widgets/app_dialogs.dart';
import '../widgets/md_inputs.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({
    super.key,
    required this.apiService,
    this.onRegister,
    this.onBackToLogin,
  });

  final ApiService apiService;
  final Future<void> Function({
    required String email,
    required String ownerName,
    required String name,
    required String type,
    required String address,
    required String city,
    required String state,
    required String pincode,
    required String phone,
    required String gst,
    required String currency,
    required String language,
    required String invoicePrefix,
  })? onRegister;
  final VoidCallback? onBackToLogin;

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  static const _storeTypeOptions = [
    MdPickerOption(value: 'Kirana & General Store', label: 'Kirana & General'),
    MdPickerOption(value: 'Supermarket / Grocery', label: 'Supermarket'),
    MdPickerOption(value: 'Convenience Store', label: 'Convenience'),
    MdPickerOption(value: 'Department Store', label: 'Department'),
    MdPickerOption(value: 'Pharmacy / Medical Store', label: 'Pharmacy'),
    MdPickerOption(value: 'Fruits & Vegetables', label: 'Fruits & Veg'),
    MdPickerOption(value: 'Bakery & Dairy', label: 'Bakery & Dairy'),
    MdPickerOption(value: 'Meat & Poultry Shop', label: 'Meat & Poultry'),
    MdPickerOption(value: 'Sweet Shop / Confectionery', label: 'Sweet Shop'),
    MdPickerOption(value: 'Tea / Coffee Shop', label: 'Tea / Coffee'),
    MdPickerOption(value: 'Restaurant / Cafe', label: 'Restaurant'),
    MdPickerOption(value: 'Electronics & Appliances', label: 'Electronics'),
    MdPickerOption(value: 'Mobile & Accessories', label: 'Mobile & Acc.'),
    MdPickerOption(value: 'Computers & Laptops', label: 'Computers'),
    MdPickerOption(value: 'Clothing & Fashion', label: 'Clothing & Fashion'),
    MdPickerOption(value: 'Footwear', label: 'Footwear'),
    MdPickerOption(value: 'Jewelry', label: 'Jewelry'),
    MdPickerOption(value: 'Beauty & Cosmetics', label: 'Beauty & Cosmetics'),
    MdPickerOption(value: 'Furniture & Home Decor', label: 'Furniture'),
    MdPickerOption(value: 'Kitchenware & Utensils', label: 'Kitchenware'),
    MdPickerOption(value: 'Hardware & Tools', label: 'Hardware & Tools'),
    MdPickerOption(value: 'Paint & Home Improvement', label: 'Paint & Home'),
    MdPickerOption(value: 'Electrical & Lighting', label: 'Electrical'),
    MdPickerOption(value: 'Plumbing & Sanitary', label: 'Plumbing'),
    MdPickerOption(value: 'Cement & Construction Materials', label: 'Cement & Const.'),
    MdPickerOption(value: 'Stationery & Books', label: 'Stationery'),
    MdPickerOption(value: 'Toys & Games', label: 'Toys & Games'),
    MdPickerOption(value: 'Sports & Fitness Equipment', label: 'Sports & Fitness'),
    MdPickerOption(value: 'Pet Store', label: 'Pet Store'),
    MdPickerOption(value: 'Optical Store', label: 'Optical'),
    MdPickerOption(value: 'Luggage & Bags', label: 'Luggage'),
    MdPickerOption(value: 'Gift & Novelty', label: 'Gift & Novelty'),
    MdPickerOption(value: 'Art & Craft Supplies', label: 'Art & Craft'),
    MdPickerOption(value: 'Auto Parts & Accessories', label: 'Auto Parts'),
    MdPickerOption(value: 'Two-Wheeler Showroom / Service', label: 'Two-Wheeler'),
    MdPickerOption(value: 'Florist', label: 'Florist'),
    MdPickerOption(value: 'Tailoring & Alterations', label: 'Tailoring'),
    MdPickerOption(value: 'Wholesale / Distributor', label: 'Wholesale'),
    MdPickerOption(value: 'Service Provider / Salon', label: 'Salon'),
    MdPickerOption(value: 'Other Retail', label: 'Other Retail'),
  ];

  static const _languages = {'en': 'English', 'hi': 'हिन्दी', 'mr': 'मराठी'};

  static const _states = [
    'Maharashtra',
    'Karnataka',
    'Gujarat',
    'Delhi',
    'Tamil Nadu',
    'Telangana',
    'Madhya Pradesh',
    'Rajasthan',
    'Uttar Pradesh',
    'West Bengal',
    'Other',
  ];

  static const _currencies = ['INR', 'USD', 'EUR'];

  static const _currencyLabels = {'INR': '₹ INR', 'USD': 'USD', 'EUR': 'EUR'};

  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _ownerNameController = TextEditingController();
  final _nameController = TextEditingController();
  final _addressController = TextEditingController();
  final _cityController = TextEditingController();
  final _pincodeController = TextEditingController();
  final _phoneController = TextEditingController();
  final _gstController = TextEditingController();
  final _invoicePrefixController = TextEditingController(text: 'INV');

  String _type = 'Kirana & General Store';
  String _state = 'Maharashtra';
  String _currency = 'INR';
  String _language = 'hi';

  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _emailController.dispose();
    _ownerNameController.dispose();
    _nameController.dispose();
    _addressController.dispose();
    _cityController.dispose();
    _pincodeController.dispose();
    _phoneController.dispose();
    _gstController.dispose();
    _invoicePrefixController.dispose();
    super.dispose();
  }

  void _setError(String? error) {
    if (!mounted) return;
    setState(() => _error = error);
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    final phoneText = _phoneController.text.trim();
    if (phoneText.isEmpty || !RegExp(r'^\d{10,12}$').hasMatch(phoneText)) {
      _setError(AppLocalizations.of(context)!.validationMobileNumber);
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      final l = AppLocalizations.of(context)!;

      await widget.onRegister!(
        email: _emailController.text.trim().toLowerCase(),
        ownerName: _ownerNameController.text.trim(),
        name: _nameController.text.trim(),
        type: _type,
        address: _addressController.text.trim(),
        city: _cityController.text.trim(),
        state: _state,
        pincode: _pincodeController.text.trim(),
        phone: phoneText,
        gst: _gstController.text.trim().toUpperCase(),
        currency: _currency,
        language: _language,
        invoicePrefix: _invoicePrefixController.text.trim().toUpperCase(),
      );

      if (!mounted) return;
      AppDialogs.showSuccess(context, l.regSuccessMessage);
      await Future.delayed(const Duration(milliseconds: 800));
      if (mounted) widget.onBackToLogin?.call();
    } catch (error) {
      if (!mounted) return;
      _setError(error.toString().replaceFirst('HttpException: ', ''));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  bool _isNarrow(BuildContext context) {
    return MediaQuery.of(context).size.width < 360;
  }

  Widget _buildField({
    required String label,
    required TextEditingController controller,
    required String? Function(String?)? validator,
    required IconData prefixIcon,
    TextInputType? keyboardType,
    List<TextInputFormatter>? inputFormatters,
    int? maxLength,
    bool enabled = true,
    String? hint,
    bool uppercase = false,
    bool monospace = false,
    int? maxLines,
    List<String>? autofillHints,
  }) {
    return TextFormField(
      controller: controller,
      enabled: enabled && !_submitting,
      keyboardType: keyboardType,
      inputFormatters: inputFormatters,
      maxLength: maxLength,
      maxLines: maxLines,
      autocorrect: false,
      textCapitalization: uppercase ? TextCapitalization.characters : TextCapitalization.none,
      autofillHints: autofillHints,
      style: TextStyle(
        fontSize: 16,
        fontFamily: monospace ? 'monospace' : null,
        letterSpacing: monospace ? 1.5 : 0,
      ),
      autovalidateMode: AutovalidateMode.onUserInteraction,
      validator: validator,
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        prefixIcon: Icon(prefixIcon, size: 20, color: MdColors.navy400),
        border: const OutlineInputBorder(),
        counterText: '',
      ),
    );
  }

  Widget _buildPhoneField() {
    return Row(
      children: [
        Container(
          height: 56,
          padding: const EdgeInsets.symmetric(horizontal: 14),
          decoration: BoxDecoration(
            color: MdColors.navy50,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: MdColors.border),
          ),
          child: const Align(
            alignment: Alignment.centerRight,
            child: Text('+91', style: TextStyle(fontSize: 16, color: MdColors.navy500, fontWeight: FontWeight.w500)),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: TextFormField(
            controller: _phoneController,
            enabled: !_submitting,
            keyboardType: TextInputType.phone,
            inputFormatters: [
              FilteringTextInputFormatter.digitsOnly,
              LengthLimitingTextInputFormatter(12),
            ],
            autocorrect: false,
            style: const TextStyle(fontSize: 16),
            autovalidateMode: AutovalidateMode.onUserInteraction,
            validator: (value) {
              final v = (value ?? '').trim();
              if (v.isEmpty) return AppLocalizations.of(context)!.validationMobileNumber;
              if (!RegExp(r'^\d{10,12}$').hasMatch(v)) return AppLocalizations.of(context)!.validationMobileNumber;
              return null;
            },
            decoration: const InputDecoration(
              labelText: 'Mobile Number',
              prefixIcon: Icon(Icons.phone_outlined, size: 20, color: MdColors.navy400),
              border: OutlineInputBorder(),
              counterText: '',
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildDropdown<T>({
    required String label,
    required T selected,
    required List<MdPickerOption<T>> options,
    required ValueChanged<T> onChanged,
    required IconData prefixIcon,
    required String pickerTitle,
  }) {
    return MdPickerField<T>(
      options: options,
      label: label,
      selected: selected,
      onChanged: onChanged,
      prefixIcon: prefixIcon,
      pickerTitle: pickerTitle,
      height: 56,
    );
  }

  Widget _buildSectionHeading(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Text(
        text,
        style: const TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w700,
          color: MdColors.navy700,
          letterSpacing: 0.5,
        ),
      ),
    );
  }

  Widget _buildTwoColumn(Widget left, Widget right) {
    return Row(
      children: [
        Expanded(child: left),
        const SizedBox(width: 12),
        Expanded(child: right),
      ],
    );
  }

  Widget _buildThreeColumn(Widget a, Widget b, Widget c) {
    return Row(
      children: [
        Expanded(child: a),
        const SizedBox(width: 8),
        Expanded(child: b),
        const SizedBox(width: 8),
        Expanded(child: c),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final narrow = _isNarrow(context);
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 20),
          onPressed: _submitting ? null : widget.onBackToLogin,
          tooltip: l.back,
        ),
        title: Text(l.regTitle, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
        centerTitle: false,
        elevation: 0,
        backgroundColor: MdColors.background,
        foregroundColor: MdColors.navy900,
        surfaceTintColor: Colors.transparent,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 8),
                Text(l.regTitle, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: MdColors.navy900)),
                const SizedBox(height: 4),
                Text(l.regSubtitle, style: TextStyle(fontSize: 14, color: MdColors.mutedForeground)),
                const SizedBox(height: 24),

                // ACCOUNT DETAILS
                _buildSectionHeading(l.regSectionAccountDetails),
                const SizedBox(height: 4),
                _buildField(
                  label: l.regEmailLabel,
                  controller: _emailController,
                  validator: (value) {
                    final v = (value ?? '').trim();
                    if (v.isEmpty) return l.regEmailRequired;
                    if (!RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(v)) return l.regEmailInvalid;
                    return null;
                  },
                  prefixIcon: Icons.email_outlined,
                  keyboardType: TextInputType.emailAddress,
                  autofillHints: const [AutofillHints.email],
                ),
                const SizedBox(height: 14),
                _buildField(
                  label: l.regOwnerNameLabel,
                  controller: _ownerNameController,
                  validator: (value) => (value ?? '').trim().length < 2 ? l.regOwnerNameRequired : null,
                  prefixIcon: Icons.person_outline,
                  autofillHints: const [AutofillHints.name],
                ),
                const SizedBox(height: 14),
                _buildField(
                  label: l.regShopNameLabel,
                  controller: _nameController,
                  validator: (value) => (value ?? '').trim().length < 2 ? l.regShopNameRequired : null,
                  prefixIcon: Icons.storefront_outlined,
                  autofillHints: const [AutofillHints.organizationName],
                ),

                const SizedBox(height: 20),

                // STORE DETAILS
                _buildSectionHeading(l.regSectionStoreDetails),
                const SizedBox(height: 4),
                _buildTwoColumn(
                  _buildDropdown(
                    label: l.regStoreTypeLabel,
                    selected: _type,
                    options: _storeTypeOptions,
                    onChanged: (v) => setState(() => _type = v),
                    prefixIcon: Icons.category_outlined,
                    pickerTitle: l.regStoreTypeLabel,
                  ),
                  _buildPhoneField(),
                ),
                const SizedBox(height: 14),
                _buildTwoColumn(
                  _buildField(
                    label: l.regGstLabel,
                    controller: _gstController,
                    validator: null,
                    prefixIcon: Icons.badge_outlined,
                    maxLength: 15,
                    monospace: true,
                    uppercase: true,
                    hint: l.regGstHint,
                  ),
                  _buildDropdown(
                    label: l.regLanguageLabel,
                    selected: _language,
                    options: _languages.entries.map((e) => MdPickerOption(value: e.key, label: e.value)).toList(),
                    onChanged: (v) => setState(() => _language = v),
                    prefixIcon: Icons.language_outlined,
                    pickerTitle: l.regLanguageLabel,
                  ),
                ),

                const SizedBox(height: 20),

                // LOCATION
                _buildSectionHeading(l.regSectionLocation),
                const SizedBox(height: 4),
                _buildField(
                  label: l.regAddressLabel,
                  controller: _addressController,
                  validator: (value) => (value ?? '').trim().isEmpty ? l.regAddressRequired : null,
                  prefixIcon: Icons.location_on_outlined,
                  hint: l.regAddressHint,
                  maxLines: 2,
                ),
                const SizedBox(height: 14),
                narrow
                    ? Column(
                        children: [
                          _buildField(
                            label: l.regCityLabel,
                            controller: _cityController,
                            validator: (value) => (value ?? '').trim().isEmpty ? l.regCityRequired : null,
                            prefixIcon: Icons.location_city_outlined,
                            autofillHints: const [AutofillHints.addressCity],
                          ),
                          const SizedBox(height: 14),
                          _buildDropdown(
                            label: l.regStateLabel,
                            selected: _state,
                            options: _states.map((s) => MdPickerOption(value: s, label: s)).toList(),
                            onChanged: (v) => setState(() => _state = v),
                            prefixIcon: Icons.map_outlined,
                            pickerTitle: l.regStateLabel,
                          ),
                          const SizedBox(height: 14),
                          _buildField(
                            label: l.regPincodeLabel,
                            controller: _pincodeController,
                            validator: (value) {
                              final v = (value ?? '').trim();
                              if (v.isEmpty) return l.regPincodeRequired;
                              if (v.length != 6) return l.regPincodeInvalid;
                              return null;
                            },
                            prefixIcon: Icons.pin_drop_outlined,
                            keyboardType: TextInputType.number,
                            inputFormatters: [
                              FilteringTextInputFormatter.digitsOnly,
                              LengthLimitingTextInputFormatter(6),
                            ],
                            maxLength: 6,
                            autofillHints: const [AutofillHints.postalCode],
                            hint: l.regPincodeHint,
                          ),
                        ],
                      )
                    : _buildThreeColumn(
                        _buildField(
                          label: l.regCityLabel,
                          controller: _cityController,
                          validator: (value) => (value ?? '').trim().isEmpty ? l.regCityRequired : null,
                          prefixIcon: Icons.location_city_outlined,
                          autofillHints: const [AutofillHints.addressCity],
                        ),
                        _buildDropdown(
                          label: l.regStateLabel,
                          selected: _state,
                          options: _states.map((s) => MdPickerOption(value: s, label: s)).toList(),
                          onChanged: (v) => setState(() => _state = v),
                          prefixIcon: Icons.map_outlined,
                          pickerTitle: l.regStateLabel,
                        ),
                        _buildField(
                          label: l.regPincodeLabel,
                          controller: _pincodeController,
                          validator: (value) {
                            final v = (value ?? '').trim();
                            if (v.isEmpty) return l.regPincodeRequired;
                            if (v.length != 6) return l.regPincodeInvalid;
                            return null;
                          },
                          prefixIcon: Icons.pin_drop_outlined,
                          keyboardType: TextInputType.number,
                          inputFormatters: [
                            FilteringTextInputFormatter.digitsOnly,
                            LengthLimitingTextInputFormatter(6),
                          ],
                          maxLength: 6,
                          autofillHints: const [AutofillHints.postalCode],
                          hint: l.regPincodeHint,
                        ),
                      ),

                const SizedBox(height: 20),

                // PREFERENCES
                _buildSectionHeading(l.regSectionPreferences),
                const SizedBox(height: 4),
                _buildTwoColumn(
                  _buildDropdown(
                    label: l.regCurrencyLabel,
                    selected: _currency,
                    options: _currencies.map((c) => MdPickerOption(value: c, label: _currencyLabels[c] ?? c)).toList(),
                    onChanged: (v) => setState(() => _currency = v),
                    prefixIcon: Icons.currency_rupee_outlined,
                    pickerTitle: l.regCurrencyLabel,
                  ),
                  _buildField(
                    label: l.regInvoicePrefixLabel,
                    controller: _invoicePrefixController,
                    validator: null,
                    prefixIcon: Icons.receipt_long_outlined,
                    maxLength: 6,
                    uppercase: true,
                    monospace: true,
                    hint: l.regInvoicePrefixHint,
                  ),
                ),

                const SizedBox(height: 16),
                if (_error != null) ...[
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    decoration: BoxDecoration(
                      color: Colors.red.shade50,
                      border: Border.all(color: Colors.red.shade200),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.error_outline, color: Colors.red.shade700, size: 18),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            _error!,
                            style: TextStyle(color: Colors.red.shade800, fontSize: 12),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                ],

                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
                  height: 54,
                  child: FilledButton.icon(
                    onPressed: _submitting ? null : _submit,
                    icon: _submitting
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : const Icon(Icons.arrow_forward_rounded, size: 20),
                    label: Text(_submitting ? l.regSubmitting : l.regCreateAccount, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                    style: FilledButton.styleFrom(
                      backgroundColor: MdColors.navy900,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Center(
                  child: TextButton(
                    onPressed: _submitting ? null : widget.onBackToLogin,
                    child: Text(l.regBackToLogin, style: const TextStyle(fontSize: 14)),
                  ),
                ),
                const SizedBox(height: 24),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
