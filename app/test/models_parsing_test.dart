import 'package:flutter_test/flutter_test.dart';
import 'package:app/models/app_models.dart';

/// Regression tests for parsing the exact JSON shapes the backend returns, so a
/// backend key rename can never silently render zeros on a screen again.
///
/// - /api/expenses/summary returns thisMonthTotal / lastMonthTotal /
///   categoryBreakdown (NOT thisMonth / lastMonth / byCategory).
/// - /api/udhaari/<customerId> entry rows carry `paid` and `remaining`
///   (NOT paidAmount / balance).
void main() {
  group('ExpenseSummary', () {
    test('reads the real backend keys (thisMonthTotal/lastMonthTotal/categoryBreakdown)', () {
      final summary = ExpenseSummary.fromJson({
        'todayTotal': 100,
        'thisMonthTotal': 2450.5,
        'lastMonthTotal': 3000,
        'pctChangeVsLastMonth': -18.3,
        'topCategory': {'name': 'Rent', 'total': 2000},
        'categoryBreakdown': [
          {'categoryId': 'c1', 'categoryName': 'Rent', 'total': 2000, 'percentage': 81.6},
          {'categoryId': null, 'categoryName': 'Uncategorized', 'total': 450.5, 'percentage': 18.4},
        ],
      });

      expect(summary.thisMonth, 2450.5);
      expect(summary.lastMonth, 3000);
      expect(summary.byCategory.length, 2);
      expect(summary.byCategory.first.categoryName, 'Rent');
      expect(summary.byCategory.first.total, 2000);
    });

    test('still accepts the legacy alias keys', () {
      final summary = ExpenseSummary.fromJson({
        'thisMonth': 10,
        'lastMonth': 20,
        'byCategory': [
          {'categoryName': 'A', 'total': 5},
        ],
      });
      expect(summary.thisMonth, 10);
      expect(summary.lastMonth, 20);
      expect(summary.byCategory.single.total, 5);
    });

    test('missing keys fall back to zero, not a crash', () {
      final summary = ExpenseSummary.fromJson(const {});
      expect(summary.thisMonth, 0);
      expect(summary.lastMonth, 0);
      expect(summary.byCategory, isEmpty);
    });
  });

  group('UdhaariEntry', () {
    test('reads paid and remaining from the backend entry shape', () {
      final entry = UdhaariEntry.fromJson({
        'id': 'e1',
        'amount': 500,
        'entryDate': '2026-01-02',
        'dueDate': '2026-01-12',
        'reminderDate': null,
        'saleId': null,
        'invoiceNumber': null,
        'note': 'credit sale',
        'createdAt': '2026-01-02T10:00:00.000Z',
        'paid': 200,
        'remaining': 300,
        'status': 'PARTIAL',
        'payments': [
          {'id': 'p1', 'amount': 200, 'mode': 'CASH', 'createdAt': '2026-01-03T10:00:00.000Z'},
        ],
      });

      expect(entry.amount, 500);
      expect(entry.paidAmount, 200);
      expect(entry.balance, 300);
      expect(entry.status, 'PARTIAL');
      expect(entry.payments.single.amount, 200);
    });

    test('still accepts the legacy alias keys', () {
      final entry = UdhaariEntry.fromJson({
        'id': 'e2',
        'amount': 100,
        'paidAmount': 40,
        'balance': 60,
        'status': 'PENDING',
      });
      expect(entry.paidAmount, 40);
      expect(entry.balance, 60);
    });
  });
}
