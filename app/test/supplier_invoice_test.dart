import 'dart:convert';

import 'package:app/services/api_service.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

/// P2-01 regression: the app must call `POST /api/suppliers/<id>/invoice`.
///
/// BEFORE the fix `createSupplierInvoice` took no supplier id and posted to
/// `/api/suppliers/invoice` (404 at runtime, no such route). AFTER the fix it
/// takes the supplier id and posts to `/api/suppliers/<id>/invoice`.
void main() {
  test('createSupplierInvoice targets /api/suppliers/<id>/invoice', () async {
    late Uri captured;
    late String capturedMethod;
    final client = MockClient((request) async {
      captured = request.url;
      capturedMethod = request.method;
      return http.Response(
        jsonEncode({
          'purchase': {'id': 'p1', 'purchaseNumber': 'PUR-1'},
        }),
        201,
        headers: {'content-type': 'application/json'},
      );
    });

    final api = ApiService(baseUrl: 'https://example.com', client: client);
    final purchase = await api.createSupplierInvoice('sup-123', {
      'lines': [
        {'productName': 'Item', 'qty': 1, 'unitPrice': 10},
      ],
    });

    expect(capturedMethod, 'POST');
    expect(captured.path, '/api/suppliers/sup-123/invoice');
    expect(purchase['id'], 'p1');
  });
}
