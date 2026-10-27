import 'package:flutter_test/flutter_test.dart';
import 'package:app/models/app_models.dart';

/// Regression tests for parsing the exact JSON shapes the backend returns, so a
/// backend key rename can never silently render zeros on a screen again.
///
/// - /api/expenses/summary returns thisMonthTotal / lastMonthTotal /
///   categoryBreakdown (NOT thisMonth / lastMonth / byCategory).
/// - `/api/udhaari/<customerId>` entry rows carry `paid` and `remaining`
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

  group('SmsUsage', () {
    test('reads the /api/sms/usage shape', () {
      final usage = SmsUsage.fromJson({
        'date': '2026-10-27',
        'used': 12,
        'limit': 100,
        'remaining': 88,
        'enabled': true,
        'mode': 'log',
      });

      expect(usage.used, 12);
      expect(usage.limit, 100);
      expect(usage.remaining, 88);
      expect(usage.enabled, isTrue);
      expect(usage.mode, 'log');
      expect(usage.progress, closeTo(0.12, 0.0001));
    });

    test('progress never exceeds one when the allowance is overdrawn', () {
      final usage = SmsUsage.fromJson({'used': 130, 'limit': 100});
      expect(usage.progress, 1);
    });

    test('copyWith keeps the counter and updates only enabled', () {
      final usage = SmsUsage.fromJson(
        {'used': 3, 'limit': 100, 'remaining': 97, 'enabled': false},
      );
      final updated = usage.copyWith(enabled: true);

      expect(updated.enabled, isTrue);
      expect(updated.used, 3);
      expect(updated.remaining, 97);
    });
  });

  group('SmsMessage', () {
    test('reads the masked delivery-log row', () {
      final message = SmsMessage.fromJson({
        'id': 'm1',
        'customerName': 'Asha',
        'toPhone': '98******10',
        'status': 'SENT',
        'errorCode': null,
        'templateKey': 'udhaari_created',
        'provider': 'msg91',
        'attempts': 1,
        'createdAt': '2026-10-27T05:30:00.000Z',
      });

      expect(message.customerName, 'Asha');
      expect(message.toPhone, '98******10');
      expect(message.status, 'SENT');
      expect(message.attempts, 1);
    });

    test('missing optional fields fall back without crashing', () {
      final message = SmsMessage.fromJson(const {});

      expect(message.id, '');
      expect(message.status, 'QUEUED');
      expect(message.attempts, 0);
    });
  });
}
