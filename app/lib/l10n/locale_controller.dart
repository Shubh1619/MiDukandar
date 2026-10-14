import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// App-wide locale state.
///
/// The language switcher (and app startup) go through this controller so the
/// chosen locale (en / hi / mr) is applied instantly app-wide and persisted
/// across restarts.
class LocaleController extends ChangeNotifier {
  LocaleController._();

  static final LocaleController instance = LocaleController._();

  static const String _prefsKey = 'app_locale';
  static const List<String> supportedLanguageCodes = ['en', 'hi', 'mr'];

  Locale _locale = const Locale('en');
  bool _loaded = false;

  Locale get locale => _locale;
  bool get isLoaded => _loaded;

  /// Loads the persisted locale. Must be awaited before [runApp] so the very
  /// first frame renders in the user's language.
  Future<void> load() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final saved = prefs.getString(_prefsKey);
      if (saved != null && supportedLanguageCodes.contains(saved)) {
        _locale = Locale(saved);
      }
    } catch (_) {
      // Fall back to English if storage is unavailable.
    }
    _loaded = true;
  }

  /// Switches the app locale immediately and persists the choice.
  Future<void> setLocale(String languageCode) async {
    if (!supportedLanguageCodes.contains(languageCode)) return;
    if (_locale.languageCode == languageCode) return;
    _locale = Locale(languageCode);
    notifyListeners();
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_prefsKey, languageCode);
    } catch (_) {
      // Persisting is best-effort; the in-memory switch already applied.
    }
  }
}