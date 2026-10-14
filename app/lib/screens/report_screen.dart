import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../l10n/generated/app_localizations.dart';
import '../models/app_models.dart';
import '../services/api_service.dart';
import '../theme/md_design.dart';

class ReportScreen extends StatefulWidget {
  const ReportScreen({
    super.key,
    required this.apiService,
    required this.stats,
  });

  final DashboardStats stats;
  final ApiService apiService;

  @override
  State<ReportScreen> createState() => _ReportScreenState();
}

class _ReportScreenState extends State<ReportScreen> {
  List<ReportSalesRow> _salesRows = const [];
  List<ReportPurchaseRow> _purchaseRows = const [];
  List<ProductSummary> _summaries = [];
  final Map<String, InventoryStock> _lowStock = {};
  bool _loading = true;
  String? _error;

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
        widget.apiService.getSalesReport(),
        widget.apiService.getPurchaseReport(),
        widget.apiService.getProductSummary(),
        widget.apiService.getInventoryStock(lowOnly: true).catchError((_) => <InventoryStock>[]),
      ]);
      if (!mounted) return;
      setState(() {
        _salesRows = results[0] as List<ReportSalesRow>;
        _purchaseRows = results[1] as List<ReportPurchaseRow>;
        _summaries = [results[2] as ProductSummary];
        for (final item in results[3] as List<InventoryStock>) {
          _lowStock[item.name] = item;
        }
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

    final totalSales = _salesRows.fold<num>(0, (sum, r) => sum + r.total);
    final totalPurchases = _purchaseRows.fold<num>(0, (sum, r) => sum + r.total);
    final totalTaxOut = _salesRows.fold<num>(0, (sum, r) => sum + r.tax);
    final totalTaxIn = _purchaseRows.fold<num>(0, (sum, r) => sum + r.tax);
    final totalInvoices = _salesRows.fold<num>(0, (sum, r) => sum + r.invoiceCount);
    final estimatedProfit = widget.stats.todayProfit + (totalSales - totalPurchases);
    final inventoryValue = _summaries.isNotEmpty ? _summaries.first.value : 0;

    final chartData = _buildChartData(_salesRows, _purchaseRows);
    final maxChartValue = chartData.fold<num>(0, (max, d) => d.sales > max ? d.sales : max).toDouble();
    final safeMax = maxChartValue <= 0 ? 1 : maxChartValue;

    return Padding(
      padding: const EdgeInsets.all(16),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(l.reptTitle, style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(child: _SummaryCard(title: l.reptSales, value: formatCurrency.format(totalSales), color: const Color(0xFF1F4E79))),
                const SizedBox(width: 12),
                Expanded(child: _SummaryCard(title: l.sectionPurchases, value: formatCurrency.format(totalPurchases), color: Colors.blue.shade700)),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(child: _SummaryCard(title: l.reptEstProfit, value: formatCurrency.format(estimatedProfit), color: Colors.green.shade700)),
                const SizedBox(width: 12),
                Expanded(child: _SummaryCard(title: l.reptInvoices, value: totalInvoices.toString(), color: Colors.purple.shade700)),
              ],
            ),
            const SizedBox(height: 20),
            Text(l.reptGstSummary, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: MdCard(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(l.reptOutputGst, style: const TextStyle(fontSize: 12, color: MdColors.mutedForeground, fontWeight: FontWeight.w600)),
                        const SizedBox(height: 6),
                        Text(formatCurrency.format(totalTaxOut), style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: MdCard(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(l.reptInputGst, style: const TextStyle(fontSize: 12, color: MdColors.mutedForeground, fontWeight: FontWeight.w600)),
                        const SizedBox(height: 6),
                        Text(formatCurrency.format(totalTaxIn), style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                      ],
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            MdCard(
              padding: const EdgeInsets.all(14),
              color: MdColors.navy950,
              borderColor: MdColors.navy900,
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(l.reptNetGstPayable, style: const TextStyle(fontSize: 12, color: MdColors.navy200, fontWeight: FontWeight.w600)),
                        const SizedBox(height: 6),
                        Text(
                          formatCurrency.format(totalTaxOut - totalTaxIn),
                          style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Colors.white),
                        ),
                      ],
                    ),
                  ),
                  const Icon(Icons.request_quote_outlined, color: MdColors.royal400),
                ],
              ),
            ),
            const SizedBox(height: 20),
            Text(l.reptProfitLossPeriod, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
            const SizedBox(height: 8),
            MdCard(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  _row(context, l.reptTotalSales, formatCurrency.format(totalSales)),
                  _row(context, l.reptLessTotalPurchases, formatCurrency.format(totalPurchases)),
                  _row(context, l.reptEstimatedProfit, formatCurrency.format(estimatedProfit), emphasize: true, green: true),
                  const Divider(height: 20),
                  _row(context, l.reptInventoryValue, formatCurrency.format(inventoryValue)),
                ],
              ),
            ),
            const SizedBox(height: 20),
            Text(l.reptSalesVsPurchasesPeriod, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.grey.shade50,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.grey.shade200),
              ),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      _LegendDot(color: const Color(0xFF1F4E79), label: l.reptSales),
                      const SizedBox(width: 12),
                      _LegendDot(color: Colors.orange, label: l.sectionPurchases),
                    ],
                  ),
                  const SizedBox(height: 12),
                  if (chartData.isEmpty)
                    Padding(
                      padding: const EdgeInsets.all(24),
                      child: Text(l.reptNoChartData, style: const TextStyle(color: Colors.grey)),
                    )
                  else
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: chartData.map((point) {
                        final salesHeight = point.sales.toDouble() / safeMax * 150;
                        final purchHeight = point.purchases.toDouble() / safeMax * 150;
                        return Expanded(
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 3),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.end,
                              children: [
                                Row(
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Container(
                                      width: 12,
                                      height: salesHeight < 1 ? 0 : salesHeight,
                                      decoration: BoxDecoration(
                                        color: const Color(0xFF1F4E79),
                                        borderRadius: const BorderRadius.vertical(top: Radius.circular(6)),
                                      ),
                                    ),
                                    const SizedBox(width: 3),
                                    Container(
                                      width: 12,
                                      height: purchHeight < 1 ? 0 : purchHeight,
                                      decoration: BoxDecoration(
                                        color: Colors.orange,
                                        borderRadius: const BorderRadius.vertical(top: Radius.circular(6)),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 8),
                                Text(point.label, style: const TextStyle(fontSize: 10)),
                              ],
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            Text(l.reptRecentSalesRows, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            const SizedBox(height: 8),
            if (_salesRows.isEmpty)
              Text(l.reptNoSalesRows, style: const TextStyle(color: Colors.grey))
            else
              Container(
                decoration: BoxDecoration(
                  border: Border.all(color: Colors.grey.shade200),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      decoration: BoxDecoration(
                        color: Colors.grey.shade100,
                        borderRadius: const BorderRadius.vertical(top: Radius.circular(11)),
                      ),
                      child: Row(
                        children: [
                          Expanded(flex: 2, child: Text(l.date, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12))),
                          Expanded(child: Text(l.reptBills, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12), textAlign: TextAlign.center)),
                          Expanded(child: Text(l.total, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12), textAlign: TextAlign.right)),
                        ],
                      ),
                    ),
                    ..._salesRows.take(10).map((row) {
                      return Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        child: Row(
                          children: [
                            Expanded(flex: 2, child: Text(row.date, style: const TextStyle(fontSize: 12))),
                            Expanded(child: Text('${row.invoiceCount}', style: const TextStyle(fontSize: 12), textAlign: TextAlign.center)),
                            Expanded(child: Text(formatCurrency.format(row.total), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600), textAlign: TextAlign.right)),
                          ],
                        ),
                      );
                    }),
                  ],
                ),
              ),
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }

  Widget _row(
    BuildContext context,
    String label,
    String value, {
    bool emphasize = false,
    bool green = false,
  }) {
    final color = emphasize
        ? (green ? MdColors.green700 : MdColors.foreground)
        : MdColors.foreground;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                color: emphasize ? color : MdColors.mutedForeground,
                fontWeight: emphasize ? FontWeight.w700 : FontWeight.w500,
                fontSize: emphasize ? 14 : 13,
              ),
            ),
          ),
          Text(
            value,
            style: TextStyle(
              color: color,
              fontWeight: emphasize ? FontWeight.w800 : FontWeight.w700,
              fontSize: emphasize ? 16 : 14,
            ),
          ),
        ],
      ),
    );
  }

  List<_ChartPoint> _buildChartData(List<ReportSalesRow> sales, List<ReportPurchaseRow> purchases) {
    final dateIndex = <String, _ChartPoint>{};
    for (final s in sales) {
      final key = s.date;
      dateIndex[key] = _ChartPoint(label: _shortLabel(key), sales: s.total, purchases: dateIndex[key]?.purchases ?? 0);
    }
    for (final p in purchases) {
      final key = p.date;
      if (dateIndex.containsKey(key)) {
        dateIndex[key] = _ChartPoint(label: dateIndex[key]!.label, sales: dateIndex[key]!.sales, purchases: p.total);
      } else {
        dateIndex[key] = _ChartPoint(label: _shortLabel(key), sales: 0, purchases: p.total);
      }
    }
    final list = dateIndex.entries.map((e) => e.value).toList();
    list.sort((a, b) => a.label.compareTo(b.label));
    return list.take(14).toList();
  }

  String _shortLabel(String raw) {
    try {
      final dt = DateTime.parse(raw);
      return DateFormat('d/M').format(dt);
    } catch (_) {
      return raw.length > 5 ? raw.substring(raw.length - 5) : raw;
    }
  }
}

class _ChartPoint {
  const _ChartPoint({required this.label, required this.sales, required this.purchases});
  final String label;
  final num sales;
  final num purchases;
}

class _LegendDot extends StatelessWidget {
  const _LegendDot({required this.color, required this.label});
  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(width: 10, height: 10, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 4),
        Text(label, style: const TextStyle(fontSize: 11, color: Colors.grey)),
      ],
    );
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
        color: color.withOpacity(0.08),
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
