import 'package:app/services/api_service.dart';
import 'package:app/services/device_sms.dart';
import 'package:app/services/device_sms_delivery.dart';
import 'package:flutter_test/flutter_test.dart';

class _FakeDeviceSms extends DeviceSms {
  _FakeDeviceSms({
    required this.permission,
    this.sendError,
    this.sims = const [
      DeviceSim(subscriptionId: 1, slotIndex: 0, label: 'Jio'),
    ],
  });

  bool permission;
  Object? sendError;
  List<DeviceSim> sims;
  final List<(String, String, int?)> sent = [];

  @override
  Future<bool> hasPermission() async => permission;

  @override
  Future<bool> requestPermission() async => permission;

  @override
  Future<List<DeviceSim>> activeSims() async => sims;

  @override
  Future<void> send({
    required String to,
    required String body,
    int? subscriptionId,
  }) async {
    final error = sendError;
    if (error != null) throw error;
    sent.add((to, body, subscriptionId));
  }
}

class _FakeSimPreference implements SimPreference {
  _FakeSimPreference(this._value, this._onSave);

  final int? Function() _value;
  final void Function(int?) _onSave;

  @override
  Future<int?> load() async => _value();

  @override
  Future<void> save(int subscriptionId) async => _onSave(subscriptionId);

  @override
  Future<void> clear() async => _onSave(null);
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

const _dualSim = [
  DeviceSim(subscriptionId: 11, slotIndex: 0, label: 'Jio'),
  DeviceSim(subscriptionId: 22, slotIndex: 1, label: 'Airtel'),
];

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

    expect(sms.sent, [
      ('+919322652826', 'Dear Darshan, Rs.500 udhaari added.', 1),
    ]);
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

  test('dual SIM: asks once, sends through the picked SIM and remembers it', () async {
    final sms = _FakeDeviceSms(permission: true, sims: _dualSim);
    final api = _FakeApiService();
    final asked = <List<DeviceSim>>[];
    int? saved;

    await DeviceSmsDelivery(
      apiService: api,
      deviceSms: sms,
      simPreference: _FakeSimPreference(() => saved, (id) => saved = id),
      chooseSim: (sims) async {
        asked.add(sims);
        return 22;
      },
    ).handle(_pending());

    expect(asked, hasLength(1));
    expect(asked.single.map((s) => s.subscriptionId), [11, 22]);
    expect(sms.sent.single.$3, 22);
    expect(saved, 22);
    expect(api.reports, [('msg-1', 'SENT')]);
  });

  test('dual SIM: reuses the remembered SIM without asking again', () async {
    final sms = _FakeDeviceSms(permission: true, sims: _dualSim);
    final api = _FakeApiService();
    var asked = false;

    await DeviceSmsDelivery(
      apiService: api,
      deviceSms: sms,
      simPreference: _FakeSimPreference(() => 11, (_) {}),
      chooseSim: (_) async {
        asked = true;
        return 22;
      },
    ).handle(_pending());

    expect(asked, isFalse);
    expect(sms.sent.single.$3, 11);
    expect(api.reports, [('msg-1', 'SENT')]);
  });

  test('dual SIM: remembers a new SIM when the saved one is gone', () async {
    final sms = _FakeDeviceSms(permission: true, sims: _dualSim);
    final api = _FakeApiService();
    int? saved = 99;

    await DeviceSmsDelivery(
      apiService: api,
      deviceSms: sms,
      simPreference: _FakeSimPreference(() => saved, (id) => saved = id),
      chooseSim: (_) async => 11,
    ).handle(_pending());

    expect(saved, 11);
    expect(sms.sent.single.$3, 11);
  });

  test('dual SIM: dismissing the picker sends through the phone default', () async {
    final sms = _FakeDeviceSms(permission: true, sims: _dualSim);
    final api = _FakeApiService();

    await DeviceSmsDelivery(
      apiService: api,
      deviceSms: sms,
      simPreference: _FakeSimPreference(() => null, (_) {}),
      chooseSim: (_) async => null,
    ).handle(_pending());

    expect(sms.sent.single.$3, isNull);
    expect(api.reports, [('msg-1', 'SENT')]);
  });

  test('a failed send forgets the remembered SIM so the owner is asked again', () async {
    final sms = _FakeDeviceSms(
      permission: true,
      sims: _dualSim,
      sendError: StateError('no recharge'),
    );
    final api = _FakeApiService();
    int? saved = 22;

    await DeviceSmsDelivery(
      apiService: api,
      deviceSms: sms,
      simPreference: _FakeSimPreference(() => saved, (id) => saved = id),
      chooseSim: (_) async => 22,
      openComposer: (_) async => true,
    ).handle(_pending());

    expect(saved, isNull);
    expect(api.reports, [('msg-1', 'HANDED_OFF')]);
  });
}
