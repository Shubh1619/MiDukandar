import 'package:flutter_test/flutter_test.dart';
import 'package:app/models/app_models.dart';

/// Regression test for the low-stock alert model. The backend low-stock feed
/// returns lightweight { id, name, balance, minStock } rows; the model must
/// parse camelCase and snake_case and keep numeric values.
void main() {
  test('parses a camelCase low-stock row', () {
    final item = LowStockProduct.fromJson({
      'id': 'p1',
      'name': 'Sugar',
      'balance': 2,
      'minStock': 10,
    });
    expect(item.id, 'p1');
    expect(item.name, 'Sugar');
    expect(item.balance, 2);
    expect(item.minStock, 10);
  });

  test('parses snake_case and string numbers', () {
    final item = LowStockProduct.fromJson({
      'product_id': 'p2',
      'product_name': 'Tea',
      'balance': '0',
      'min_stock': '5.5',
    });
    expect(item.id, 'p2');
    expect(item.name, 'Tea');
    expect(item.balance, 0);
    expect(item.minStock, 5.5);
  });

  test('defaults missing numbers to zero', () {
    final item = LowStockProduct.fromJson({'id': 'p3', 'name': 'Salt'});
    expect(item.balance, 0);
    expect(item.minStock, 0);
  });
}
