import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../l10n/generated/app_localizations.dart';
import '../l10n/status_labels.dart';
import '../models/app_models.dart';
import '../services/api_service.dart';
import '../theme/md_design.dart';

class PaymentsScreen extends StatefulWidget {
  const PaymentsScreen({super.key, required this.apiService});

  final ApiService apiService;

  @override
  State<PaymentsScreen> createState() => _PaymentsScreenState();
}

class _PaymentsScreenState extends State<PaymentsScreen> {
  bool _loading = true;
  String? _error;
  List<Payment> _payments = const [];

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
      final payments = await widget.apiService.getPayments();
      if (!mounted) return;
      setState(() {
        _payments = payments;
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
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final formatCurrency = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
    final formatDate = DateFormat('d MMM yy • HH:mm');

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

    final totalReceived = _payments.where((p) => p.type.toUpperCase() == 'RECEIVED').fold<num>(0, (sum, p) => sum + p.amount);
    final totalSent = _payments.where((p) => p.type.toUpperCase() == 'SENT').fold<num>(0, (sum, p) => sum + p.amount);

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(l.sectionPayments, style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold)),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _SummaryCard(title: l.statusReceived, value: formatCurrency.format(totalReceived), color: Colors.green.shade700, icon: Icons.arrow_downward),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _SummaryCard(title: l.statusSent, value: formatCurrency.format(totalSent), color: Colors.red.shade700, icon: Icons.arrow_upward),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Expanded(
            child: _payments.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.receipt_long_outlined, size: 64, color: Colors.grey),
                        const SizedBox(height: 12),
                        Text(l.paymEmpty, style: const TextStyle(color: Colors.grey)),
                      ],
                    ),
                  )
                : ListView.separated(
                    itemCount: _payments.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (context, index) {
                      final p = _payments[index];
                      final isReceived = p.type.toUpperCase() == 'RECEIVED';
                      return Card(
                        elevation: 2,
                        shadowColor: MdColors.cardShadow,
                        shape: RoundedRectangleBorder(
                          side: BorderSide(color: Colors.grey.shade200),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.all(14),
                          child: Row(
                            children: [
                              CircleAvatar(
                                backgroundColor: isReceived ? Colors.green.shade100 : Colors.red.shade100,
                                child: Icon(
                                  isReceived ? Icons.arrow_downward : Icons.arrow_upward,
                                  color: isReceived ? Colors.green.shade700 : Colors.red.shade700,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                          decoration: BoxDecoration(
                                            color: isReceived ? Colors.green.shade50 : Colors.red.shade50,
                                            borderRadius: BorderRadius.circular(999),
                                            border: Border.all(color: isReceived ? Colors.green.shade200 : Colors.red.shade200),
                                          ),
                                          child: Text(
                                            localizedStatus(context, p.type),
                                            style: TextStyle(
                                              color: isReceived ? Colors.green.shade800 : Colors.red.shade800,
                                              fontWeight: FontWeight.w600,
                                              fontSize: 10,
                                            ),
                                          ),
                                        ),
                                        const SizedBox(width: 8),
                                        Text(
                                          p.mode,
                                          style: TextStyle(color: Colors.grey.shade600, fontSize: 12, fontWeight: FontWeight.w500),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 4),
                                    if (p.customerName != null && p.customerName!.isNotEmpty)
                                      Text(p.customerName!, style: const TextStyle(fontWeight: FontWeight.w700))
                                    else
                                      Text(
                                        p.referenceType != null
                                            ? l.paymReference(p.referenceType!, _shortPaymentId(p.referenceId))
                                            : l.paymPayment,
                                        style: const TextStyle(fontWeight: FontWeight.w700),
                                      ),
                                    const SizedBox(height: 2),
                                    if (p.note != null && p.note!.isNotEmpty)
                                      Text(p.note!, style: TextStyle(color: Colors.grey.shade600, fontSize: 12)),
                                  ],
                                ),
                              ),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  Text(
                                    (isReceived ? '+' : '-') + formatCurrency.format(p.amount),
                                    style: TextStyle(
                                      fontWeight: FontWeight.bold,
                                      color: isReceived ? Colors.green.shade700 : Colors.red.shade700,
                                      fontSize: 16,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    formatDate.format(DateTime.tryParse(p.createdAt) ?? DateTime.now()),
                                    style: TextStyle(color: Colors.grey.shade500, fontSize: 11),
                                  ),
                                ],
                              ),
                            ],
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
  const _SummaryCard({required this.title, required this.value, required this.color, required this.icon});

  final String title;
  final String value;
  final Color color;
  final IconData icon;

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
          Row(
            children: [
              Icon(icon, size: 16, color: color),
              const SizedBox(width: 6),
              Text(title, style: TextStyle(color: color, fontWeight: FontWeight.w600)),
            ],
          ),
          const SizedBox(height: 8),
          Text(value, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }
}

/// Human-friendly payment reference: short, readable, stable per record
/// (last 6 chars of the UUID, uppercased) instead of the raw database UUID.
String _shortPaymentId(String? raw) {
  if (raw == null || raw.isEmpty) return '';
  final trimmed = raw.trim();
  if (trimmed.length <= 8) return trimmed.toUpperCase();
  return trimmed.substring(trimmed.length - 6).toUpperCase();
}