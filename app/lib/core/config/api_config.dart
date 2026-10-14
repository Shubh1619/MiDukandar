class ApiConfig {
  ApiConfig._();

  static const defaultBaseUrl = 'https://mazedukan.onrender.com';
  static const developmentBaseUrl = 'http://10.0.2.2:4000';
  static const testBaseUrl = 'http://localhost:3000';

  static const _configuredBaseUrl = String.fromEnvironment('API_BASE_URL');

  static String get baseUrl {
    final configured = _configuredBaseUrl.trim();
    return normalize(configured.isEmpty ? defaultBaseUrl : configured);
  }

  static String normalize(String value) {
    var normalized = value.trim();
    while (normalized.endsWith('/')) {
      normalized = normalized.substring(0, normalized.length - 1);
    }
    return normalized;
  }

  static Uri uri(String path, {String? baseUrl}) {
    final root = normalize(baseUrl ?? ApiConfig.baseUrl);
    final suffix = path.startsWith('/') ? path : '/$path';
    return Uri.parse('$root$suffix');
  }
}
