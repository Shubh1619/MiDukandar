import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api_service.dart';
import 'device_sms.dart';

/// Opens the SMS app prefilled. Injected in tests so no real intent is fired.
typedef SmsComposer = Future<bool> Function(Uri uri);

/// Asks the owner which SIM should send. Returns the chosen subscription id,
/// or null when the sheet was dismissed (the phone default is used then).
typedef SimChooser = Future<int?> Function(List<DeviceSim> sims);

/// Remembers which SIM the owner picked, so dual-SIM phones ask only once.
abstract class SimPreference {
  Future<int?> load();
  Future<void> save(int subscriptionId);

  /// Called when a send through the remembered SIM fails, so the owner is
  /// asked again instead of being stuck with a SIM that has no recharge.
  Future<void> clear();
}

class SharedPreferencesSimPreference implements SimPreference {
  static const String key = 'sms_subscription_id';

  @override
  Future<int?> load() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      return prefs.getInt(key);
    } catch (_) {
      return null;
    }
  }

  @override
  Future<void> save(int subscriptionId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setInt(key, subscriptionId);
    } catch (_) {
      // Not fatal: the owner is asked again next time.
    }
  }

  @override
  Future<void> clear() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(key);
    } catch (_) {
      // Not fatal.
    }
  }
}

/// Sends the udhaari SMS that the API returned as `pendingSms`.
///
/// Flow:
///   1. Ask for `SEND_SMS` + `READ_PHONE_STATE` (Android runtime permissions).
///   2. Pick the SIM: one SIM is used directly; with two or more the owner
///      chooses once and the choice is remembered (a SIM without recharge can
///      still have signal, so guessing the default would silently lose SMS).
///   3. Send silently through that SIM and report `SENT`.
///   4. If denied or sending fails, open the SMS app prefilled and report
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
    this.chooseSim,
    SimPreference? simPreference,
  })  : _deviceSms = deviceSms ?? DeviceSms(),
        _openComposer = openComposer ?? _launchComposer,
        _simPreference = simPreference ?? SharedPreferencesSimPreference();

  final ApiService apiService;
  final SimChooser? chooseSim;
  final DeviceSms _deviceSms;
  final SmsComposer _openComposer;
  final SimPreference _simPreference;

  Future<void> handle(Map<String, dynamic>? pending) async {
    if (!_isValid(pending)) return;
    final id = pending!['id'] as String;
    final to = pending['to'] as String;
    final body = pending['body'] as String;

    var granted = await _deviceSms.hasPermission();
    if (!granted) granted = await _deviceSms.requestPermission();

    if (granted) {
      final subscriptionId = await _resolveSim();
      try {
        await _deviceSms.send(
          to: to,
          body: body,
          subscriptionId: subscriptionId,
        );
        await _report(id, 'SENT');
        return;
      } catch (_) {
        // No SIM, no signal, wrong SIM, or the radio refused it. Forget the
        // remembered SIM so the owner is asked again (a SIM with no recharge
        // still has signal, so a wrong pick would otherwise stick forever),
        // then fall through to the composer.
        if (subscriptionId != null) await _simPreference.clear();
      }
    }

    final opened = await _openComposerWith(to, body);
    await _report(id, opened ? 'HANDED_OFF' : 'FAILED');
  }

  /// Subscription to send through, or null for the phone default.
  ///
  /// With two or more SIMs the remembered choice wins; otherwise the owner is
  /// asked. Dismissing the sheet falls back to the default SIM rather than
  /// dropping the message.
  Future<int?> _resolveSim() async {
    final sims = await _deviceSms.activeSims();
    if (sims.length <= 1) {
      return sims.isEmpty ? null : sims.single.subscriptionId;
    }

    final saved = await _simPreference.load();
    if (saved != null && sims.any((sim) => sim.subscriptionId == saved)) {
      return saved;
    }

    final choose = chooseSim;
    if (choose == null) return null;
    final chosen = await choose(sims);
    if (chosen == null || !sims.any((sim) => sim.subscriptionId == chosen)) {
      return null;
    }
    await _simPreference.save(chosen);
    return chosen;
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
