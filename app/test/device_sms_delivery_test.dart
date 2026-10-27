import 'package:app/services/api_service.dart';
import 'package:app/services/device_sms.dart';
import 'package:app/services/device_sms_delivery.dart';
import 'package:flutter_test/flutter_test.dart';

class _FakeDeviceSms extends DeviceSms {
  _FakeDeviceSms({required this.permission, this.sendError});

  bool permission;
  Object? sendError;
  final List<(String, String)> sent = [];

  @override
  Future<bool> hasPermission() async => permission;

  @override
  Future<bool> requestPermission() async => permission;

  @override
  Future<void> send({required String to, required String body}) async {
    final error = sendError;
    if (error != null) throw error;
    sent.add((to, body));
  }
}

class _FakeApiService extends ApiService {
  _FakeApiService() : super(baseUrl: 'http://localhost:1');

  final List<(String, String)> reports = [];

  @override
  Future<void> reportSmsDelivery(String messageId, String status) async {
    reports.add((messageId, status));
  }
}

Map<String, dynamic> _pending() => {
      'id': 'msg-1',
      'to': '+919322652826',
      'body': 'Dear Darshan, Rs.500 udhaari added.',
    };

void main() {
  test('sends silently and reports SENT when SEND_SMS is granted', () async {
    final sms = _FakeDeviceSms(permission: true);
    final api = _FakeApiService();
    final opened = <Uri>[];

    await DeviceSmsDelivery(
      apiService: api,
      deviceSms: sms,
      openComposer: (uri) async {
        opened.add(uri);
        return true;
      },
    ).handle(_pending());

    expect(sms.sent, [('+919322652826', 'Dear Darshan, Rs.500 udhaari added.')]);
    expect(opened, isEmpty);
    expect(api.reports, [('msg-1', 'SENT')]);
  });

  test('opens the composer and reports HANDED_OFF when permission is denied', () async {
    final sms = _FakeDeviceSms(permission: false);
    final api = _FakeApiService();
    final opened = <Uri>[];

    await DeviceSmsDelivery(
      apiService: api,
      deviceSms: sms,
      openComposer: (uri) async {
        opened.add(uri);
        return true;
      },
    ).handle(_pending());

    expect(sms.sent, isEmpty);
    expect(opened, hasLength(1));
    expect(opened.single.scheme, 'sms');
    expect(opened.single.path, '+919322652826');
    expect(opened.single.queryParameters['body'], 'Dear Darshan, Rs.500 udhaari added.');
    expect(api.reports, [('msg-1', 'HANDED_OFF')]);
  });

  test('reports FAILED when the composer cannot be opened', () async {
    final sms = _FakeDeviceSms(permission: false);
    final api = _FakeApiService();

    await DeviceSmsDelivery(
      apiService: api,
      deviceSms: sms,
      openComposer: (_) async => false,
    ).handle(_pending());

    expect(api.reports, [('msg-1', 'FAILED')]);
  });

  test('falls back to the composer when the silent send throws', () async {
    final sms = _FakeDeviceSms(permission: true, sendError: StateError('no SIM'));
    final api = _FakeApiService();

    await DeviceSmsDelivery(
      apiService: api,
      deviceSms: sms,
      openComposer: (_) async => true,
    ).handle(_pending());

    expect(api.reports, [('msg-1', 'HANDED_OFF')]);
  });

  test('does nothing when the API returned no pending message', () async {
    final sms = _FakeDeviceSms(permission: true);
    final api = _FakeApiService();

    await DeviceSmsDelivery(
      apiService: api,
      deviceSms: sms,
      openComposer: (_) async => true,
    ).handle({'id': 'msg-1'});

    expect(sms.sent, isEmpty);
    expect(api.reports, isEmpty);
  });
}
