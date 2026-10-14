import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../l10n/generated/app_localizations.dart';
import '../theme/md_design.dart';

/// Shared option model for [MdPickerField].
class MdPickerOption<T> {
  const MdPickerOption({required this.value, required this.label, this.icon, this.trailing});

  final T value;
  final String label;
  final IconData? icon;
  final Widget? trailing;
}

/// Polished dropdown replacement: a rounded, bordered field in the app's
/// input language that opens a modal bottom-sheet picker instead of the raw
/// Material OS dropdown. Mirrors `MdPickerField` on web (`<MobileInput>` is
/// separate for mobile numbers).
class MdPickerField<T> extends StatelessWidget {
  const MdPickerField({
    super.key,
    required this.options,
    required this.label,
    required this.onChanged,
    required this.selected,
    this.prefixIcon,
    this.pickerTitle,
    this.height = 52,
  });

  final List<MdPickerOption<T>> options;
  final String label;
  final ValueChanged<T> onChanged;
  final T? selected;
  final IconData? prefixIcon;
  final String? pickerTitle;
  final double height;

  MdPickerOption<T>? get _selectedOption {
    for (final o in options) {
      if (o.value == selected) return o;
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final option = _selectedOption;
    final foreground = option != null ? MdColors.foreground : MdColors.navy300;

    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: () async {
        final picked = await showModalBottomSheet<T>(
          context: context,
          builder: (sheetContext) {
            return SafeArea(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
                    child: Text(
                      pickerTitle ?? label,
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: MdColors.navy900),
                    ),
                  ),
                  Flexible(
                    child: ListView.separated(
                      shrinkWrap: true,
                      itemCount: options.length,
                      separatorBuilder: (_, _) => const Divider(height: 1, indent: 20, endIndent: 20),
                      itemBuilder: (_, i) {
                        final o = options[i];
                        final isSelected = o.value == selected;
                        return ListTile(
                          shape: isSelected
                              ? RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))
                              : null,
                          selectedTileColor: MdColors.navy50,
                          leading: o.icon != null
                              ? Container(
                                  width: 34,
                                  height: 34,
                                  decoration: BoxDecoration(
                                    color: MdColors.navy50,
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: Icon(o.icon, size: 18, color: MdColors.navy600),
                                )
                              : null,
                          title: Text(
                            o.label,
                            style: TextStyle(
                              fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                              color: isSelected ? MdColors.navy900 : MdColors.foreground,
                            ),
                          ),
                          trailing: o.trailing ?? (isSelected ? const Icon(Icons.check, color: MdColors.royal600, size: 20) : null),
                          onTap: () => Navigator.pop(sheetContext, o.value),
                        );
                      },
                    ),
                  ),
                  const SizedBox(height: 8),
                ],
              ),
            );
          },
        );
        if (picked != null) onChanged(picked);
      },
      child: Container(
        height: height,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(
          color: MdColors.navy50,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: MdColors.border),
        ),
        child: Row(
          children: [
            if (prefixIcon != null) ...[
              Icon(prefixIcon, size: 20, color: MdColors.navy400),
              const SizedBox(width: 10),
            ],
            Expanded(
              child: Text(
                option?.label ?? label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontWeight: FontWeight.w500, color: foreground),
              ),
            ),
            const SizedBox(width: 8),
            Icon(Icons.unfold_more, size: 20, color: MdColors.navy300),
          ],
        ),
      ),
    );
  }
}

/// Shared mobile-number input used everywhere a phone number is collected
/// (invoice, udhaari, customer, supplier, user invite...).
///
/// - Blocks every non-digit character (`FilteringTextInputFormatter.digitsOnly`)
/// - Caps input at 12 digits (allows an optional country code like `91`)
/// - Shows an inline error when the entered value is not 10-12 digits
/// - [validate] can be called on submit when the field is embedded in a sheet
class MobileNumberField extends StatefulWidget {
  const MobileNumberField({
    super.key,
    required this.controller,
    this.label,
    this.allowEmpty = true,
    this.onChanged,
  });

  final TextEditingController controller;
  final String? label;
  final bool allowEmpty;
  final ValueChanged<String>? onChanged;

  @override
  MobileNumberFieldState createState() => MobileNumberFieldState();
}

class MobileNumberFieldState extends State<MobileNumberField> {
  String? _error;

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_revalidate);
  }

  @override
  void didUpdateWidget(covariant MobileNumberField oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.controller != widget.controller) {
      oldWidget.controller.removeListener(_revalidate);
      widget.controller.addListener(_revalidate);
    }
  }

  @override
  void dispose() {
    widget.controller.removeListener(_revalidate);
    super.dispose();
  }

  String? _computeError() {
    final text = widget.controller.text.trim();
    if (text.isEmpty) return widget.allowEmpty ? null : AppLocalizations.of(context)!.validationMobileNumber;
    if (!RegExp(r'^\d{10,12}$').hasMatch(text)) {
      return AppLocalizations.of(context)!.validationMobileNumber;
    }
    return null;
  }

  void _revalidate() {
    final error = _computeError();
    if (error != _error) {
      setState(() => _error = error);
    }
  }

  /// Returns the current validation error (or null when valid) and forces the
  /// error to render — call this from a submit handler before popping a sheet.
  String? validate() {
    final error = _computeError();
    if (error != _error) {
      setState(() => _error = error);
    }
    return error;
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    return TextField(
      controller: widget.controller,
      keyboardType: TextInputType.phone,
      inputFormatters: [
        FilteringTextInputFormatter.digitsOnly,
        LengthLimitingTextInputFormatter(12),
      ],
      onChanged: widget.onChanged,
      decoration: InputDecoration(
        labelText: widget.label ?? l.mobileNumber,
        prefixIcon: const Icon(Icons.phone_outlined, size: 20, color: MdColors.navy400),
        errorText: _error,
        counterText: '',
      ),
    );
  }
}