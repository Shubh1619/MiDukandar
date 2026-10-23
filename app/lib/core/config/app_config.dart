/// Central runtime configuration for the Flutter app.
///
/// By default the app talks to the hosted API at [productionBaseUrl]. The URL
/// can be overridden at build/run time (e.g. for local development):
///
///   flutter run --dart-define=API_URL=http://localhost:4000
///   flutter run --dart-define=API_URL=http://10.0.2.2:4000   # Android emulator
///
/// When `API_URL` is not supplied, [baseUrl] falls back to [productionBaseUrl].
class AppConfig {
  AppConfig._();

  static const String _configuredApiUrl = String.fromEnvironment('API_URL');

  /// Hosted backend (Render).
  static const String productionBaseUrl = 'https://midukandar.onrender.com';

  /// Desktop / web / iOS-simulator local default (opt-in via `API_URL`).
  static const String localBaseUrl = 'http://localhost:4000';

  /// The host machine as seen from inside the Android emulator.
  static const String androidEmulatorBaseUrl = 'http://10.0.2.2:4000';

  static String get baseUrl {
    final configured = _configuredApiUrl.trim();
    return normalize(configured.isEmpty ? productionBaseUrl : configured);
  }

  static String normalize(String value) {
    var normalized = value.trim();
    while (normalized.endsWith('/')) {
      normalized = normalized.substring(0, normalized.length - 1);
    }
    return normalized;
  }

  static Uri uri(String path, {String? baseUrl}) {
    final root = normalize(baseUrl ?? AppConfig.baseUrl);
    final suffix = path.startsWith('/') ? path : '/$path';
    return Uri.parse('$root$suffix');
  }
}
