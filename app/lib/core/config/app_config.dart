/// Central runtime configuration for the Flutter app.
///
/// The API base URL is injected at build/run time and is never hardcoded:
///
///   flutter run --dart-define=API_URL=http://localhost:4000
///   flutter run --dart-define=API_URL=https://<service>.onrender.com   # Render
///
/// When `API_URL` is not supplied, [baseUrl] falls back to [localBaseUrl].
/// Android emulators cannot reach the host via `localhost`; use
/// [androidEmulatorBaseUrl] (`--dart-define=API_URL=http://10.0.2.2:4000`).
class AppConfig {
  AppConfig._();

  static const String _configuredApiUrl = String.fromEnvironment('API_URL');

  /// Desktop / web / iOS-simulator default.
  static const String localBaseUrl = 'http://localhost:4000';

  /// The host machine as seen from inside the Android emulator.
  static const String androidEmulatorBaseUrl = 'http://10.0.2.2:4000';

  static String get baseUrl {
    final configured = _configuredApiUrl.trim();
    return normalize(configured.isEmpty ? localBaseUrl : configured);
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
