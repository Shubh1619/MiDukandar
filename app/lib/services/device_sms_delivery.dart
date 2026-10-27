import 'package:url_launcher/url_launcher.dart';

import 'api_service.dart';
import 'device_sms.dart';

/// Opens the SMS app prefilled. Injected in tests so no real intent is fired.
typedef SmsComposer = Future<bool> Function(Uri uri);

/// Sends the udhaari SMS that the API returned as `pendingSms`.
///
/// Flow:
///   1. Ask for `SEND_SMS` (Android runtime permission).
///   2. If granted, send silently and report `SENT`.
///   3. If denied or sending fails, open the SMS app prefilled and report
///      `HANDED_OFF` so the owner can still send it with one tap.
///
/// The backend already reserved the daily allowance and recorded the message,
/// so every outcome is reported back. Reporting failures are swallowed: the
/// udhaari entry is saved and the sweeper expires an unreported row.
class DeviceSmsDelivery {
  DeviceSmsDelivery({
    required this.apiService,
    DeviceSms? deviceSms,
    SmsComposer? openComposer,
  })  : _deviceSms = deviceSms ?? DeviceSms(),
        _openComposer = openComposer ?? _launchComposer;

  final ApiService apiService;
  final DeviceSms _deviceSms;
  final SmsComposer _openComposer;

  Future<void> handle(Map<String, dynamic>? pending) async {
    if (!_isValid(pending)) return;
    final id = pending!['id'] as String;
    final to = pending['to'] as String;
    final body = pending['body'] as String;

    var granted = await _deviceSms.hasPermission();
    if (!granted) granted = await _deviceSms.requestPermission();

    if (granted) {
      try {
        await _deviceSms.send(to: to, body: body);
        await _report(id, 'SENT');
        return;
      } catch (_) {
        // No SIM, no signal, or the radio refused it. Fall through to the
        // composer so the message still has a chance.
      }
    }

    final opened = await _openComposerWith(to, body);
    await _report(id, opened ? 'HANDED_OFF' : 'FAILED');
  }

  bool _isValid(Map<String, dynamic>? pending) {
    if (pending == null) return false;
    final id = pending['id'];
    final to = pending['to'];
    final body = pending['body'];
    return id is String &&
        id.isNotEmpty &&
        to is String &&
        to.isNotEmpty &&
        body is String &&
        body.isNotEmpty;
  }

  Future<bool> _openComposerWith(String to, String body) async {
    final uri = Uri(
      scheme: 'sms',
      path: to,
      queryParameters: {'body': body},
    );
    return _openComposer(uri);
  }

  static Future<bool> _launchComposer(Uri uri) async {
    try {
      return await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {
      return false;
    }
  }

  Future<void> _report(String id, String status) async {
    try {
      await apiService.reportSmsDelivery(id, status);
    } catch (_) {
      // Never surface this to the shop owner: the credit entry already saved.
    }
  }
}
