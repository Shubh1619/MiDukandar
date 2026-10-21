import 'package:flutter_test/flutter_test.dart';
import 'package:app/models/app_models.dart';

/// Regression test for the mobile product expiry alert model. The backend
/// returns expired vs expiringSoon groups plus the store's warningDays; the
/// model must parse snake_case and camelCase, classify an overdue product as
/// expired, and report hasAlerts/total correctly.
void main() {
  test('parses groups, warningDays and classifies overdue as expired', () {
    final alert = ExpiryAlert.fromJson({
      'warningDays': 15,
      'expired': [
        {'id': 'a', 'name': 'Milk', 'unit': 'Litre', 'expiry_date': '2026-01-01', 'days_left': -4},
      ],
      'expiringSoon': [
        {'id': 'b', 'name': 'Curd', 'unit': 'Piece', 'expiryDate': '2026-01-10', 'daysLeft': 5},
      ],
    });

    expect(alert.warningDays, 15);
    expect(alert.expired.length, 1);
    expect(alert.expiringSoon.length, 1);
    expect(alert.total, 2);
    expect(alert.hasAlerts, isTrue);
    expect(alert.expired.first.isExpired, isTrue);
    expect(alert.expired.first.expiryDate, '2026-01-01');
    expect(alert.expired.first.daysLeft, -4);
    expect(alert.expiringSoon.first.isExpired, isFalse);
    expect(alert.expiringSoon.first.expiryDate, '2026-01-10');
  });

  test('empty groups report no alerts', () {
    final alert = ExpiryAlert.fromJson({'expired': [], 'expiringSoon': [], 'warningDays': 30});
    expect(alert.hasAlerts, isFalse);
    expect(alert.total, 0);
    expect(alert.warningDays, 30);
  });

  test('defaults warningDays to 30 when absent', () {
    final alert = ExpiryAlert.fromJson({'expired': [], 'expiringSoon': []});
    expect(alert.warningDays, 30);
  });

  test('truncates a timestamp expiryDate to the date part', () {
    final alert = ExpiryAlert.fromJson({
      'expiringSoon': [
        {'id': 'c', 'name': 'Bread', 'expiryDate': '2026-02-03T00:00:00.000Z', 'daysLeft': 2},
      ],
      'warningDays': 7,
    });
    expect(alert.expiringSoon.first.expiryDate, '2026-02-03');
  });
}
