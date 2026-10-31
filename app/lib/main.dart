import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'dart:async';

import 'package:permission_handler/permission_handler.dart';

import 'l10n/generated/app_localizations.dart';
import 'l10n/locale_controller.dart';
import 'models/app_models.dart';
import 'screens/auth_screen.dart';
import 'screens/business_profile_screen.dart';
import 'screens/customer_screen.dart';
import 'screens/dashboard_screen.dart';
import 'screens/expenses_screen.dart';
import 'screens/inventory_screen.dart';
import 'screens/invoice_screen.dart';
import 'screens/payments_screen.dart';
import 'screens/product_screen.dart';
import 'screens/purchases_screen.dart';
import 'screens/register_screen.dart';
import 'screens/report_screen.dart';
import 'screens/supplier_invoice_screen.dart';
import 'screens/settings_screen.dart';
import 'screens/suppliers_screen.dart';
import 'screens/udhaari_screen.dart';
import 'screens/users_screen.dart';
import 'services/api_service.dart';
import 'theme/md_design.dart';
import 'services/device_sms.dart';
import 'widgets/app_dialogs.dart';
import 'widgets/navy_drawer.dart';
import 'widgets/profile_menu.dart';
import 'widgets/sim_picker.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Apply the persisted locale before the first frame renders.
  await LocaleController.instance.load();
  runApp(const MiDukandarApp());
}

class MiDukandarApp extends StatelessWidget {
  const MiDukandarApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: LocaleController.instance,
      builder: (context, _) {
        return MaterialApp(
          onGenerateTitle: (context) => AppLocalizations.of(context)!.appTitle,
          debugShowCheckedModeBanner: false,
          theme: buildMdTheme(),
          locale: LocaleController.instance.locale,
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          // Text size follows the phone's Display size / Font size setting
          // exactly as the user set it. Layouts must therefore absorb large
          // scales (wrapping, scrolling, ellipsis) instead of shrinking text.
          home: const _LanguageFirstGate(),
        );
      },
    );
  }
}

class AuthGate extends StatefulWidget {
  const AuthGate({super.key});

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _SimGate extends StatefulWidget {
  const _SimGate({required this.child});

  final Widget child;

  @override
  State<_SimGate> createState() => _SimGateState();
}

class _SimGateState extends State<_SimGate> {
  static const String _prefsKey = 'sim_checked_done';
  bool _checked = false;

  @override
  void initState() {
    super.initState();
    _check();
  }

  Future<void> _check() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final done = prefs.getBool(_prefsKey) ?? false;
      if (done) {
        if (!mounted) return;
        setState(() {
          _checked = true;
        });
        return;
      }
      final sims = await DeviceSms().activeSims();
      if (!mounted) return;
      if (sims.length >= 2) {
        final chosen = await showSimPicker(context, sims);
        try {
          final prefs2 = await SharedPreferences.getInstance();
          if (chosen != null) {
            await prefs2.setInt('sms_subscription_id', chosen);
          }
          await prefs2.setBool(_prefsKey, true);
        } catch (_) {}
        if (!mounted) return;
        setState(() {
          _checked = true;
        });
      } else {
        try {
          final prefs2 = await SharedPreferences.getInstance();
          await prefs2.setBool(_prefsKey, true);
        } catch (_) {}
        if (!mounted) return;
        setState(() {
          _checked = true;
        });
      }
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _checked = true;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!_checked) return const _SplashScreen();
    return widget.child;
  }
}

class _AuthGateState extends State<AuthGate> with WidgetsBindingObserver {
  late final ApiService _apiService;
  bool _isAuthenticated = false;
  bool _isBootstrapping = true;
  bool _isLoading = false;
  bool _showRegister = false;
  bool _expiryAlertShown = false;
  bool _lowStockAlertShown = false;
  bool _permissionsRequested = false;
  AuthUser? _user;
  Store? _store;

  DashboardStats _stats = const DashboardStats(
    todaySales: 0,
    todayPurchases: 0,
    todayProfit: 0,
    receivables: 0,
    payables: 0,
    lowStockCount: 0,
    recentTransactions: [],
  );

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _apiService = ApiService();
    // A rejected refresh token anywhere in the app must land the user back on
    // the login screen, not leave them stuck on a screen that only errors.
    ApiService.onSessionExpired = () async {
      if (!mounted) return;
      await _signOut(showError: true);
    };
    WidgetsBinding.instance.addPostFrameCallback((_) => _bootstrap());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  // The access token is short-lived and the app may sit backgrounded for hours.
  // On resume, silently exchange the persisted refresh token for a fresh access
  // token and refresh the dashboard so the first tap after returning never hits
  // an expired-token failure. A server rejection ends the session; a transient
  // network failure leaves the existing session intact.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    super.didChangeAppLifecycleState(state);
    if (state == AppLifecycleState.resumed && _isAuthenticated) {
      unawaited(_refreshOnResume());
    }
  }

  Future<void> _refreshOnResume() async {
    final ok = await _apiService.restoreSession();
    if (!ok) return;
    await _loadDashboardStats();
  }

  Future<void> _requestRequiredPermissions() async {
    if (_permissionsRequested) return;
    _permissionsRequested = true;
    try {
      await [
        Permission.contacts,
        Permission.phone,
        Permission.sms,
      ].request();
    } catch (_) {}
  }

  Future<void> _bootstrap() async {
    try {
      await _apiService.loadTokens();
      // Cold start: no access token exists yet (in-memory only). Silently
      // exchange the persisted refresh token for a fresh access token so a
      // returning user lands straight on the Dashboard.
      final restored = await _apiService.restoreSession();
      if (restored) {
        try {
          final me = await _apiService.getCurrentUser();
          final store = await _apiService.getStore();
          if (mounted) {
            setState(() {
              _user = me;
              _store = store;
            });
          }
          await _loadDashboardStats();
          if (mounted) {
            setState(() {
              _isAuthenticated = true;
            });
            unawaited(_maybeShowExpiryAlert());
            unawaited(_maybeShowLowStockAlert());
            unawaited(_requestRequiredPermissions());
          }
        } on SessionExpiredException {
          await _apiService.logout();
        } catch (_) {
          // Refresh succeeded but profile/data fetch failed (e.g. transient
          // network). Keep the session; dashboard renders with empty data and
          // the user can pull to refresh.
          if (mounted) {
            setState(() {
              _isAuthenticated = true;
            });
            unawaited(_requestRequiredPermissions());
          }
        }
      }
    } catch (_) {}
    if (mounted) {
      setState(() => _isBootstrapping = false);
    }
  }

  Future<void> _loadDashboardStats() async {
    try {
      final stats = await _apiService.getDashboardSummary();
      if (mounted) {
        setState(() {
          _stats = stats;
        });
      }
    } catch (_) {
      // Keep default empty stats
    }
  }

  // Shows the product expiry alert once per app session, after login. A failed
  // fetch is silent so it never blocks the dashboard.
  Future<void> _maybeShowExpiryAlert() async {
    if (_expiryAlertShown || !mounted) return;
    _expiryAlertShown = true;
    try {
      final alert = await _apiService.getExpiryAlerts();
      if (!mounted || !alert.hasAlerts) return;
      await showExpiryAlertDialog(context, alert);
    } catch (_) {
      // Silent: an expiry-alert failure must not disturb the session.
    }
  }

  // Shows the low-stock alert once per app session, after login. A failed
  // fetch is silent so it never blocks the dashboard.
  Future<void> _maybeShowLowStockAlert() async {
    if (_lowStockAlertShown || !mounted) return;
    _lowStockAlertShown = true;
    try {
      final items = await _apiService.getLowStockItems();
      if (!mounted || items.isEmpty) return;
      await showLowStockAlertDialog(context, items);
    } catch (_) {
      // Silent: a low-stock-alert failure must not disturb the session.
    }
  }

  Future<String> _handleRequestOtp(String email) async {
    return _apiService.requestLoginOtp(email: email);
  }

  Future<void> _handleVerifyOtp(String email, String otp) async {
    try {
      setState(() => _isLoading = true);
      final user = await _apiService.verifyLoginOtp(email: email, otp: otp);
      Store? store;
      try {
        store = await _apiService.getStore();
      } catch (_) {}
      if (!mounted) return;

      setState(() {
        _user = user;
        _store = store;
      });
      await _loadDashboardStats();
      if (!mounted) return;
      // Re-arm the "session expired" broadcast for this new session.
      ApiService.resetSessionExpiredFlag();
      setState(() {
        _isAuthenticated = true;
      });
      unawaited(_maybeShowExpiryAlert());
      unawaited(_maybeShowLowStockAlert());
      unawaited(_requestRequiredPermissions());
    } on SessionExpiredException {
      await _signOut(showError: false);
      rethrow;
    } catch (error) {
      rethrow;
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _handleRegister({
    required String email,
    required String ownerName,
    required String name,
    required String type,
    required String address,
    required String city,
    required String state,
    required String pincode,
    required String phone,
    required String gst,
    required String currency,
    required String language,
    required String invoicePrefix,
    required String otp,
    String? referralCode,
  }) async {
    try {
      setState(() => _isLoading = true);
      await _apiService.register(
        email: email,
        ownerName: ownerName,
        name: name,
        type: type,
        address: address,
        city: city,
        state: state,
        pincode: pincode,
        phone: phone,
        gst: gst,
        currency: currency,
        language: language,
        invoicePrefix: invoicePrefix,
        otp: otp,
        referralCode: referralCode,
      );
      if (!mounted) return;
      setState(() => _showRegister = false);
      AppDialogs.showSuccess(
        context,
        AppLocalizations.of(context)!.regSuccessMessage,
      );
    } on SessionExpiredException {
      await _signOut(showError: false);
    } catch (error) {
      if (!mounted) return;
      AppDialogs.showError(
        context,
        error.toString().replaceFirst('HttpException: ', ''),
      );
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  void _showRegisterScreen() {
    setState(() => _showRegister = true);
  }

  Future<void> _signOut({bool showError = false}) async {
    await _apiService.logout();
    if (!mounted) return;
    setState(() {
      _isAuthenticated = false;
      _user = null;
      _store = null;
    });
    if (showError) {
      AppDialogs.showError(
        context,
        AppLocalizations.of(context)!.errSessionExpired,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isBootstrapping) {
      return const _SplashScreen();
    }

    if (!_isAuthenticated) {
      if (_showRegister) {
        return RegisterScreen(
          apiService: _apiService,
          onRegister: _handleRegister,
          onBackToLogin: () => setState(() => _showRegister = false),
        );
      }
      return AuthScreen(
        onRequestOtp: _handleRequestOtp,
        onVerifyOtp: _handleVerifyOtp,
        isLoading: _isLoading,
        onRegister: _showRegisterScreen,
      );
    }

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && !_permissionsRequested) {
        _requestRequiredPermissions();
      }
    });
    return _SimGate(
      child: AppShell(
        apiService: _apiService,
        user: _user,
        store: _store,
        stats: _stats,
        onSignOut: _signOut,
      ),
    );
  }
}

class _SplashScreen extends StatelessWidget {
  const _SplashScreen();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Image.asset('assets/logo.png', height: 120),
            const SizedBox(height: 28),
            const SizedBox(
              width: 32,
              height: 32,
              child: CircularProgressIndicator(strokeWidth: 2.5),
            ),
          ],
        ),
      ),
    );
  }
}

class _LanguageFirstGate extends StatefulWidget {
  const _LanguageFirstGate();

  @override
  State<_LanguageFirstGate> createState() => _LanguageFirstGateState();
}

class _LanguageFirstGateState extends State<_LanguageFirstGate> {
  static const String _prefsKey = 'app_language_selected_first';
  bool _checked = false;
  bool _showPicker = false;

  @override
  void initState() {
    super.initState();
    _check();
  }

  Future<void> _check() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final done = prefs.getBool(_prefsKey) ?? false;
      if (!mounted) return;
      setState(() {
        _showPicker = !done;
        _checked = true;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _showPicker = true;
        _checked = true;
      });
    }
  }

  Future<void> _select(String code) async {
    await LocaleController.instance.setLocale(code);
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(_prefsKey, true);
    } catch (_) {}
    if (!mounted) return;
    setState(() => _showPicker = false);
  }

  @override
  Widget build(BuildContext context) {
    if (!_checked) return const _SplashScreen();
    if (_showPicker) {
      final l = AppLocalizations.of(context)!;
      return Scaffold(
        body: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: Card(
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(20),
                    side: BorderSide(color: Colors.grey.shade200),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(14),
                          child: Image.asset(
                            'assets/logo.png',
                            height: 80,
                            fit: BoxFit.contain,
                            errorBuilder: (_, _, _) => const Icon(
                              Icons.storefront,
                              size: 56,
                              color: Color(0xFF1F4E79),
                            ),
                          ),
                        ),
                        const SizedBox(height: 16),
                        Text(
                          l.settingsAppLanguage,
                          textAlign: TextAlign.center,
                          style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 12),
                        FilledButton(
                          onPressed: () => _select('en'),
                          child: const Text('English'),
                        ),
                        const SizedBox(height: 8),
                        FilledButton(
                          onPressed: () => _select('hi'),
                          child: const Text('हिन्दी'),
                        ),
                        const SizedBox(height: 8),
                        FilledButton(
                          onPressed: () => _select('mr'),
                          child: const Text('मराठी'),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      );
    }
    return const AuthGate();
  }
}

String formatINR(num value) {
  try {
    final fmt = NumberFormat.currency(
      locale: 'en_IN',
      symbol: '₹',
      decimalDigits: 0,
    );
    return fmt.format(value);
  } catch (_) {
    return '₹$value';
  }
}

class AppShell extends StatefulWidget {
  const AppShell({
    super.key,
    required this.apiService,
    required this.user,
    required this.store,
    required this.stats,
    required this.onSignOut,
  });

  final ApiService apiService;
  final AuthUser? user;
  final Store? store;
  final DashboardStats stats;
  final Future<void> Function({bool showError}) onSignOut;

  @override
  State<AppShell> createState() => _AppShellState();
}

/// All app sections reachable from the sidebar drawer. Key order mirrors the
/// web `Sidebar.tsx` MAIN_NAV / SYSTEM_NAV ordering.
enum AppSection {
  dashboard,
  products,
  invoices,
  customers,
  udhaari,
  suppliers,
  supplierInvoices,
  expenses,
  reports,
  settings,
  users,
  inventory,
  purchases,
  payments,
}

class _AppShellState extends State<AppShell> {
  AppSection _section = AppSection.dashboard;
  bool _inventoryLowOnly = false;
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();

  /// Dashboard figures are loaded by [AuthGate] once at sign-in. The shell keeps
  /// its own copy so it can re-fetch after every mutation; [widget.stats] is
  /// still the seed value and wins whenever the parent pushes a fresh snapshot
  /// (app resume, sign-in).
  late DashboardStats _stats = widget.stats;

  /// Bumped to rebuild the active section from scratch, which re-runs its
  /// `initState` → `_load()` and therefore shows server data immediately after
  /// a create/update/delete or when the user re-taps the current tab.
  int _sectionEpoch = 0;

  bool get _isOwner => widget.user?.role == 'OWNER';

  String get _sectionKey => switch (_section) {
    AppSection.dashboard => 'dashboard',
    AppSection.products => 'products',
    AppSection.invoices => 'invoices',
    AppSection.customers => 'customers',
    AppSection.udhaari => 'udhaari',
    AppSection.suppliers => 'suppliers',
    AppSection.supplierInvoices => 'supplierInvoices',
    AppSection.expenses => 'expenses',
    AppSection.reports => 'reports',
    AppSection.settings => 'settings',
    AppSection.users => 'users',
    AppSection.inventory => 'inventory',
    AppSection.purchases => 'purchases',
    AppSection.payments => 'payments',
  };

  int get _bottomNavIndex => switch (_section) {
    AppSection.invoices => 0,
    AppSection.customers => 1,
    AppSection.udhaari => 2,
    _ => 3,
  };

  @override
  void didUpdateWidget(covariant AppShell oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.stats != widget.stats) {
      _stats = widget.stats;
    }
  }

  Future<void> _reloadStats() async {
    try {
      final stats = await widget.apiService.getDashboardSummary();
      if (mounted) setState(() => _stats = stats);
    } catch (_) {
      // Keep the last good snapshot; the next refresh will retry.
    }
  }

  void _onBottomNavTap(int index) {
    if (index == 3) {
      _scaffoldKey.currentState?.openDrawer();
      return;
    }
    final section = switch (index) {
      0 => AppSection.invoices,
      1 => AppSection.customers,
      2 => AppSection.udhaari,
      _ => AppSection.invoices,
    };
    _selectSection(section);
  }

  Future<bool> _onWillPop() async {
    final scaffoldState = _scaffoldKey.currentState;
    final isDrawerOpen = scaffoldState?.isDrawerOpen ?? false;

    if (isDrawerOpen) {
      scaffoldState?.closeDrawer();
      return false;
    }

    if (_section != AppSection.dashboard) {
      setState(() {
        _section = AppSection.dashboard;
      });
      return false;
    }

    final l = AppLocalizations.of(context)!;
    final shouldExit = await AppDialogs.showConfirm(
      context,
      title: l.exitAppTitle,
      message: l.exitAppMessage,
      confirmLabel: l.exitApp,
      cancelLabel: l.cancel,
      destructive: true,
    );

    if (shouldExit && mounted) {
      await SystemNavigator.pop();
    }
    return false;
  }

  // ---------------- CRUD HANDLERS ----------------

  Future<void> _handleCreateProduct(Map<String, dynamic> payload) async {
    try {
      await widget.apiService.createProduct(payload);
      unawaited(_refreshCurrentSection());
    } catch (error) {
      if (!mounted) return;
      AppDialogs.showError(
        context,
        AppLocalizations.of(context)!.errCreateProduct(error.toString()),
      );
    }
  }

  Future<void> _handleUpdateProduct(
    String id,
    Map<String, dynamic> payload,
  ) async {
    try {
      await widget.apiService.updateProduct(id, payload);
      unawaited(_refreshCurrentSection());
    } catch (error) {
      if (!mounted) return;
      AppDialogs.showError(
        context,
        AppLocalizations.of(context)!.errUpdateProduct(error.toString()),
      );
    }
  }

  Future<void> _handleArchiveProduct(String id) async {
    try {
      await widget.apiService.archiveProduct(id);
      unawaited(_refreshCurrentSection());
    } catch (error) {
      if (!mounted) return;
      AppDialogs.showError(
        context,
        AppLocalizations.of(context)!.errArchiveProduct(error.toString()),
      );
    }
  }

  Future<void> _handleAdjustStock(String id, num qty, String reason) async {
    try {
      await widget.apiService.adjustStock(id, qty: qty, reason: reason);
      unawaited(_refreshCurrentSection());
    } catch (error) {
      if (!mounted) return;
      AppDialogs.showError(
        context,
        AppLocalizations.of(context)!.errAdjustStock(error.toString()),
      );
    }
  }

  Future<Map<String, dynamic>?> _handleFetchProductDetail(String id) async {
    try {
      return await widget.apiService.getProduct(id);
    } catch (_) {
      return null;
    }
  }

  Future<void> _handleCreateCustomer(Map<String, dynamic> payload) async {
    try {
      await widget.apiService.createCustomer(payload);
      unawaited(_refreshCurrentSection());
      unawaited(_reloadStats());
    } catch (error) {
      if (!mounted) return;
      AppDialogs.showError(
        context,
        AppLocalizations.of(context)!.errCreateCustomer(error.toString()),
      );
    }
  }

  Future<void> _handleUpdateCustomer(
    String id,
    Map<String, dynamic> payload,
  ) async {
    try {
      await widget.apiService.updateCustomer(id, payload);
      unawaited(_refreshCurrentSection());
      unawaited(_reloadStats());
    } catch (error) {
      if (!mounted) return;
      AppDialogs.showError(
        context,
        AppLocalizations.of(context)!.errUpdateCustomer(error.toString()),
      );
    }
  }

  Future<void> _handleDeleteCustomer(String id) async {
    try {
      await widget.apiService.deleteCustomer(id);
      unawaited(_refreshCurrentSection());
      unawaited(_reloadStats());
    } catch (error) {
      if (!mounted) return;
      AppDialogs.showError(
        context,
        AppLocalizations.of(context)!.errDeleteCustomer(error.toString()),
      );
    }
  }

  Future<void> _handleCreateInvoice(Map<String, dynamic> payload) async {
    try {
      await widget.apiService.createSale(payload);
      unawaited(_refreshCurrentSection());
    } catch (error) {
      if (!mounted) return;
      AppDialogs.showError(
        context,
        AppLocalizations.of(context)!.errCreateInvoice(error.toString()),
      );
    }
  }

  Future<void> _handleMarkInvoicePaid(InvoiceRecord invoice) async {
    try {
      await widget.apiService.markSalePaid(
        invoice.id,
        amount: invoice.dueAmount,
      );
      unawaited(_refreshCurrentSection());
    } catch (error) {
      if (!mounted) return;
      AppDialogs.showError(
        context,
        AppLocalizations.of(context)!.errMarkPaid(error.toString()),
      );
    }
  }

  Future<void> _handleCreatePurchase(Map<String, dynamic> payload) async {
    try {
      await widget.apiService.createPurchase(payload);
      unawaited(_refreshCurrentSection());
    } catch (error) {
      if (!mounted) return;
      AppDialogs.showError(
        context,
        AppLocalizations.of(context)!.errCreatePurchase(error.toString()),
      );
    }
  }

  Future<void> _handleCreateExpense(Map<String, dynamic> payload) async {
    try {
      await widget.apiService.createExpense(payload);
      unawaited(_refreshCurrentSection());
    } catch (error) {
      if (!mounted) return;
      AppDialogs.showError(
        context,
        AppLocalizations.of(context)!.errCreateExpense(error.toString()),
      );
    }
  }

  Future<void> _handleCreateSupplier(Map<String, dynamic> payload) async {
    try {
      await widget.apiService.createSupplier(payload);
      unawaited(_refreshCurrentSection());
    } catch (error) {
      if (!mounted) return;
      AppDialogs.showError(
        context,
        AppLocalizations.of(context)!.errCreateSupplier(error.toString()),
      );
    }
  }

  Future<Map<String, dynamic>?> _handleCreateUdhaari(Map<String, dynamic> payload) async {
    try {
      final result = await widget.apiService.createUdhaari(payload);
      unawaited(_refreshCurrentSection());
      unawaited(_reloadStats());
      return result;
    } catch (error) {
      if (!mounted) return null;
      AppDialogs.showError(
        context,
        AppLocalizations.of(context)!.errCreateUdhaari(error.toString()),
      );
      return null;
    }
  }

  Future<Map<String, dynamic>?> _handleReceivePayment({
    required String customerId,
    required num amount,
    String mode = 'CASH',
    String? note,
  }) async {
    try {
      final result = await widget.apiService.receiveCustomerPayment(
        customerId: customerId,
        amount: amount,
        mode: mode,
        note: note,
      );
      unawaited(_refreshCurrentSection());
      unawaited(_reloadStats());
      return result;
    } catch (error) {
      if (!mounted) return null;
      AppDialogs.showError(
        context,
        AppLocalizations.of(context)!.errRecordPayment(error.toString()),
      );
      return null;
    }
  }

  Future<void> _handleUpdateSupplier(
    String id,
    Map<String, dynamic> payload,
  ) async {
    try {
      await widget.apiService.updateSupplier(id, payload);
      unawaited(_refreshCurrentSection());
    } catch (error) {
      if (!mounted) return;
      AppDialogs.showError(
        context,
        AppLocalizations.of(context)!.errUpdateSupplier(error.toString()),
      );
    }
  }

  Future<void> _handleDeleteSupplier(String id) async {
    try {
      await widget.apiService.deleteSupplier(id);
      unawaited(_refreshCurrentSection());
    } catch (error) {
      if (!mounted) return;
      AppDialogs.showError(
        context,
        AppLocalizations.of(context)!.errDeleteSupplier(error.toString()),
      );
    }
  }

  Future<void> _handleUpdateExpense(
    String id,
    Map<String, dynamic> payload,
  ) async {
    try {
      await widget.apiService.updateExpense(id, payload);
      unawaited(_refreshCurrentSection());
    } catch (error) {
      if (!mounted) return;
      AppDialogs.showError(
        context,
        AppLocalizations.of(context)!.errUpdateExpense(error.toString()),
      );
    }
  }

  Future<void> _handleDeleteExpense(String id) async {
    try {
      await widget.apiService.deleteExpense(id);
      unawaited(_refreshCurrentSection());
    } catch (error) {
      if (!mounted) return;
      AppDialogs.showError(
        context,
        AppLocalizations.of(context)!.errDeleteExpense(error.toString()),
      );
    }
  }

  Future<void> _handleReverseInvoice(
    InvoiceRecord invoice,
    String reason,
  ) async {
    try {
      await widget.apiService.reverseSale(invoice.id, reason: reason);
      unawaited(_refreshCurrentSection());
    } catch (error) {
      if (!mounted) return;
      AppDialogs.showError(
        context,
        AppLocalizations.of(context)!.errReverseInvoice(error.toString()),
      );
    }
  }

  Future<void> _handleUpdateInvoice(InvoiceRecord invoice, Map<String, dynamic> payload) async {
    try {
      await widget.apiService.updateSale(invoice.id, payload);
      unawaited(_refreshCurrentSection());
    } catch (error) {
      if (!mounted) return;
      AppDialogs.showError(
        context,
        AppLocalizations.of(context)!.errCreateInvoice(error.toString()),
      );
    }
  }

  Future<void> _handleUpdateUserStatus(String id, bool isActive) async {
    try {
      await widget.apiService.updateUserStatus(id, isActive: isActive);
      unawaited(_refreshCurrentSection());
    } catch (error) {
      if (!mounted) return;
      AppDialogs.showError(
        context,
        AppLocalizations.of(context)!.errUpdateUserStatus(error.toString()),
      );
    }
  }

  Future<void> _handleUpdateUserRole(String id, String role) async {
    try {
      await widget.apiService.updateUserRole(id, role: role);
      unawaited(_refreshCurrentSection());
    } catch (error) {
      if (!mounted) return;
      AppDialogs.showError(
        context,
        AppLocalizations.of(context)!.errUpdateUserRole(error.toString()),
      );
    }
  }

  Future<String?> _handleInviteUser({
    required String name,
    String? email,
    String? phone,
    required String role,
  }) async {
    try {
      final data = await widget.apiService.inviteUser(
        name: name,
        email: email,
        phone: phone,
        role: role,
      );
      unawaited(_refreshCurrentSection());
      final link = data['inviteLink']?.toString();
      return (link == null || link.isEmpty) ? null : link;
    } catch (error) {
      if (!mounted) return null;
      AppDialogs.showError(
        context,
        AppLocalizations.of(context)!.errInviteUser(error.toString()),
      );
      return null;
    }
  }

  // ---------------- NAVIGATION ----------------

  void _selectSection(AppSection section, {bool lowOnly = false}) {
    setState(() {
      // Selecting the tab you are already on is the mobile convention for
      // "refresh this screen": give it a new epoch so it re-fetches.
      if (_section == section) _sectionEpoch++;
      _section = section;
      _inventoryLowOnly = lowOnly;
    });
    if (section == AppSection.dashboard) unawaited(_reloadStats());
  }

  void _onDrawerSelect(String key) {
    Navigator.of(context).pop(); // close the drawer
    switch (key) {
      case 'dashboard':
        return _selectSection(AppSection.dashboard);
      case 'products':
        return _selectSection(AppSection.products);
      case 'invoices':
        return _selectSection(AppSection.invoices);
      case 'customers':
        return _selectSection(AppSection.customers);
      case 'udhaari':
        return _selectSection(AppSection.udhaari);
      case 'suppliers':
        return _selectSection(AppSection.suppliers);
      case 'expenses':
        return _selectSection(AppSection.expenses);
      case 'reports':
        return _selectSection(AppSection.reports);
      case 'settings':
        return _selectSection(AppSection.settings);
      case 'users':
        return _selectSection(AppSection.users);
      case 'inventory':
        return _selectSection(AppSection.inventory);
      case 'purchases':
        return _selectSection(AppSection.purchases);
      case 'payments':
        return _selectSection(AppSection.payments);
    case 'supplierInvoices':
        return _selectSection(AppSection.supplierInvoices);
    }
  }

  void _openBusinessProfile() {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => BusinessProfileScreen(
          apiService: widget.apiService,
          user: widget.user,
          initialStore: widget.store,
        ),
      ),
    );
  }

  Future<void> _confirmSignOut() async {
    final l = AppLocalizations.of(context)!;
    final confirmed = await AppDialogs.showConfirm(
      context,
      title: l.signOutConfirmTitle,
      message: l.signOutConfirmMessage,
      confirmLabel: l.signOut,
      cancelLabel: l.cancel,
      destructive: true,
    );
    if (!confirmed || !mounted) return;
    await widget.onSignOut();
  }

  // ---------------- BUILD ----------------

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final user = widget.user;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) async {
        if (didPop) return;
        final shouldPop = await _onWillPop();
        if (shouldPop && context.mounted) {
          Navigator.of(context).pop();
        }
      },
      child: Scaffold(
        key: _scaffoldKey,
        appBar: AppBar(
          leading: Builder(
            builder: (context) => IconButton(
              icon: const Icon(Icons.menu),
              tooltip: l.moreTitle,
              onPressed: () => Scaffold.of(context).openDrawer(),
            ),
          ),
          title: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                widget.store?.name ?? l.myStore,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: MdColors.navy900,
                ),
              ),
              if (user?.name != null)
                Text(
                  user!.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 12,
                    color: MdColors.mutedForeground,
                  ),
                ),
            ],
          ),
          actions: [
            ProfileMenu(
              user: user,
              onBusinessProfile: _openBusinessProfile,
              onSettings: () => _selectSection(AppSection.settings),
              onSignOut: _confirmSignOut,
            ),
          ],
        ),
        bottomNavigationBar: _MdBottomBar(
          selectedIndex: _bottomNavIndex,
          onTap: _onBottomNavTap,
          items: [
            _MdBottomBarItem(
              icon: Icons.receipt_long_outlined,
              activeIcon: Icons.receipt_long,
              label: l.billInvoices,
            ),
            _MdBottomBarItem(
              icon: Icons.people_alt_outlined,
              activeIcon: Icons.people_alt,
              label: l.navCustomers,
            ),
            _MdBottomBarItem(
              icon: Icons.payments_outlined,
              activeIcon: Icons.payments,
              label: l.tabUdhari,
            ),
            _MdBottomBarItem(
              icon: Icons.more_horiz,
              activeIcon: Icons.more_horiz,
              label: l.moreTitle,
            ),
          ],
        ),
        drawer: Drawer(
          backgroundColor: MdColors.navy950,
          child: NavyDrawer(
            current: _sectionKey,
            role: user?.role,
            onSelect: _onDrawerSelect,
            width: MediaQuery.sizeOf(context).width * 0.8,
          ),
        ),
        // One pull-to-refresh for every section: the indicator listens to the
        // vertical scrollable each screen already owns, and the rebuild gives
        // that screen a fresh epoch so it re-fetches from the server.
        body: RefreshIndicator(
          onRefresh: _handlePullRefresh,
          child: KeyedSubtree(
            key: ValueKey('${_sectionKey}_$_sectionEpoch'),
            child: _buildSection(_section),
          ),
        ),
      ),
    );
  }

  Widget _buildSection(AppSection section) {
    final l = AppLocalizations.of(context)!;
    switch (section) {
      case AppSection.dashboard:
        return DashboardScreen(
          stats: _stats,
          storeName: widget.store?.name ?? l.myStore,
          onNavigate: _selectSection,
          onLowStockTap: () =>
              _selectSection(AppSection.inventory, lowOnly: true),
          onInvoiceDetailTap: () => _selectSection(AppSection.invoices),
        );
      case AppSection.invoices:
        return InvoiceScreen(
          apiService: widget.apiService,
          onCreate: _handleCreateInvoice,
          onMarkPaid: _handleMarkInvoicePaid,
          onReverse: _handleReverseInvoice,
          onUpdate: _handleUpdateInvoice,
        );
      case AppSection.customers:
        return CustomerScreen(
          apiService: widget.apiService,
          onCreate: _handleCreateCustomer,
          onUpdate: _handleUpdateCustomer,
          onDelete: _handleDeleteCustomer,
        );
      case AppSection.udhaari:
        return UdhaariScreen(
          apiService: widget.apiService,
          onPayment: _handleReceivePayment,
          onCreate: _handleCreateUdhaari,
        );
      case AppSection.inventory:
        return InventoryScreen(
          apiService: widget.apiService,
          onChanged: _refreshCurrentSection,
          lowOnly: _inventoryLowOnly,
        );
      case AppSection.products:
        return ProductScreen(
          apiService: widget.apiService,
          onCreate: _handleCreateProduct,
          onUpdate: _handleUpdateProduct,
          onArchive: _handleArchiveProduct,
          onAdjust: _handleAdjustStock,
          onFetchDetail: _handleFetchProductDetail,
        );
case AppSection.purchases:
        return PurchaseScreen(
          apiService: widget.apiService,
          onCreate: _handleCreatePurchase,
        );
      case AppSection.supplierInvoices:
        return SupplierInvoiceScreen(
          apiService: widget.apiService,
          onCreate: _handleCreateSupplierInvoice,
        );
      case AppSection.suppliers:
        return SuppliersScreen(
          apiService: widget.apiService,
          onCreate: _handleCreateSupplier,
          onUpdate: _handleUpdateSupplier,
          onDelete: _handleDeleteSupplier,
          onRefresh: _refreshCurrentSection,
        );
      case AppSection.expenses:
        return ExpensesScreen(
          apiService: widget.apiService,
          onCreate: _handleCreateExpense,
          onUpdate: _handleUpdateExpense,
          onDelete: _handleDeleteExpense,
        );
      case AppSection.payments:
        return PaymentsScreen(apiService: widget.apiService);
      case AppSection.reports:
        return ReportScreen(
          apiService: widget.apiService,
          stats: _stats,
        );
      case AppSection.settings:
        return SettingsScreen(
          apiService: widget.apiService,
          store: widget.store,
          onChanged: _refreshCurrentSection,
          userRole: widget.user?.role,
        );
      case AppSection.users:
        return UsersScreen(
          apiService: widget.apiService,
          user: widget.user,
          onInvite: _isOwner ? _handleInviteUser : null,
          onStatusChange: _isOwner ? _handleUpdateUserStatus : null,
          onRoleChange: _isOwner ? _handleUpdateUserRole : null,
        );
    }
  }

  Future<void> _refreshCurrentSection() async {
    if (!mounted) return;
    // Rebuild after the current frame so the caller can finish closing its
    // sheet/dialog and show its success message before the screen is recycled.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) setState(() => _sectionEpoch++);
    });
    unawaited(_reloadStats());
  }

  /// Pull-to-refresh: fetch the dashboard numbers, then recycle the active
  /// section so it re-reads its own list from the server.
  Future<void> _handlePullRefresh() async {
    await _reloadStats();
    if (mounted) setState(() => _sectionEpoch++);
  }

  Future<void> _handleCreateSupplierInvoice(String supplierId, Map<String, dynamic> payload) async {
    if (!mounted) return;
    AppDialogs.showLoading(context);
    try {
      await widget.apiService.createSupplierInvoice(supplierId, payload);
      if (!mounted) return;
      AppDialogs.hideLoading(context);
      AppDialogs.showSuccess(context, 'Supplier invoice created successfully');
      _refreshCurrentSection();
    } catch (error) {
      if (!mounted) return;
      AppDialogs.showError(context, 'Failed to create supplier invoice: ${error.toString()}');
    }
  }
}

/// Items for the app's bottom bar. Kept as plain data so the bar itself can
/// guarantee single-line, ellipsized labels (Material's BottomNavigationBar
/// wraps and can split a word down the middle on narrow screens).
class _MdBottomBarItem {
  const _MdBottomBarItem({
    required this.icon,
    required this.activeIcon,
    required this.label,
  });

  final IconData icon;
  final IconData activeIcon;
  final String label;
}

class _MdBottomBar extends StatelessWidget {
  const _MdBottomBar({
    required this.selectedIndex,
    required this.onTap,
    required this.items,
  });

  final int selectedIndex;
  final ValueChanged<int> onTap;
  final List<_MdBottomBarItem> items;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: MdColors.surface,
      child: SafeArea(
        top: false,
        child: Container(
          decoration: const BoxDecoration(
            border: Border(top: BorderSide(color: MdColors.border)),
          ),
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Row(
            children: [
              for (var i = 0; i < items.length; i++)
                Expanded(
                  child: _MdBottomBarButton(
                    item: items[i],
                    selected: i == selectedIndex,
                    onTap: () => onTap(i),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MdBottomBarButton extends StatelessWidget {
  const _MdBottomBarButton({
    required this.item,
    required this.selected,
    required this.onTap,
  });

  final _MdBottomBarItem item;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = selected ? MdColors.navy900 : MdColors.mutedForeground;
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(selected ? item.activeIcon : item.icon, size: 22, color: color),
            const SizedBox(height: 3),
            Text(
              item.label,
              maxLines: 1,
              softWrap: false,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 11,
                height: 1.15,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
