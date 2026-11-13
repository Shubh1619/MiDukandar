import 'package:app/core/config/app_config.dart';
import 'package:app/l10n/generated/app_localizations.dart';
import 'package:app/main.dart';
import 'package:app/models/app_models.dart';
import 'package:app/screens/auth_screen.dart';
import 'package:app/screens/customer_screen.dart';
import 'package:app/screens/dashboard_screen.dart';
import 'package:app/screens/product_screen.dart';
import 'package:app/services/api_service.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// Expected English strings resolved from the generated localizations, so the
/// assertions track the real copy instead of hardcoded literals.
final _l = lookupAppLocalizations(const Locale('en'));

const _user = AuthUser(
  id: 'u1',
  name: 'Demo Owner',
  email: 'owner@midukandar.com',
  phone: '9876543210',
  role: 'OWNER',
  storeId: 'store-1',
);

const _store = Store(
  id: 'store-1',
  name: 'Demo Store',
  type: 'Retail',
  currency: 'INR',
  language: 'en',
  invoicePrefix: 'INV',
);

/// Mirrors the Free plan: sales, products and udhaari included; suppliers,
/// purchases, expenses, GST reports and user management excluded.
const _freeStore = Store(
  id: 'store-1',
  name: 'Demo Store',
  type: 'Retail',
  currency: 'INR',
  language: 'en',
  invoicePrefix: 'INV',
  plan: 'FREE',
  planStatus: 'TRIAL',
  planDetails: StorePlanDetails(
    adsEnabled: true,
    adsTier: 'STANDARD',
    status: 'ACTIVE',
    modules: {
      'DASHBOARD': true,
      'BILLING': true,
      'PRODUCTS': true,
      'INVENTORY': true,
      'SALES_INVOICES': true,
      'CUSTOMERS_UDHAARI': true,
      'SUPPLIERS': false,
      'PURCHASES': false,
      'EXPENSES': false,
      'GST_REPORTS': false,
      'USERS_ROLES': false,
      'MULTI_STORE': false,
      'ADVANCED_ANALYTICS': false,
      'BARCODE_HARDWARE': false,
      'WHATSAPP_SHARING': false,
      'API_ACCESS': false,
    },
  ),
);

const _stats = DashboardStats(
  todaySales: 12000,
  todayPurchases: 5000,
  todayProfit: 3000,
  receivables: 3400,
  payables: 1200,
  lowStockCount: 3,
  recentTransactions: [],
);

Widget _testApp(Widget home) {
  return MaterialApp(
    home: home,
    locale: const Locale('en'),
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
  );
}

Widget _buildShell({
  Future<void> Function({bool showError})? onSignOut,
}) {
  return _testApp(
    AppShell(
      apiService: ApiService(baseUrl: AppConfig.localBaseUrl),
      user: _user,
      store: _store,
      stats: _stats,
      onSignOut: onSignOut ?? ({bool showError = false}) async {},
    ),
  );
}

void main() {
  test('AppConfig defaults to the production API URL and normalizes URLs', () {
    // No --dart-define=API_URL in tests, so the production default is used.
    expect(AppConfig.baseUrl, AppConfig.productionBaseUrl);
    expect(AppConfig.productionBaseUrl, 'https://midukandar.onrender.com');
    expect(AppConfig.localBaseUrl, 'http://localhost:4000');
    expect(AppConfig.normalize('https://example.com///'), 'https://example.com');
    expect(AppConfig.normalize('  https://example.com/  '), 'https://example.com');
  });

  testWidgets('login hides raw network exceptions and offers a retry', (
    tester,
  ) async {
    var attempts = 0;
    await tester.pumpWidget(
      _testApp(
        AuthScreen(
          onRequestOtp: (_) async {
            attempts += 1;
            throw const NetworkException();
          },
          onVerifyOtp: (_, _) async {},
        ),
      ),
    );

    // The primary action starts as "Get OTP".
    expect(find.text(_l.authGetOtp), findsOneWidget);

    await tester.enterText(find.byType(TextFormField), 'owner@example.com');
    await tester.tap(find.text(_l.authGetOtp));
    await tester.pump();

    expect(attempts, 1);
    expect(find.text(_l.authUnableToConnect), findsOneWidget);
    expect(find.textContaining('Exception'), findsNothing);
    expect(find.text(_l.authTryAgain), findsWidgets);

    // The retry affordance re-issues the request.
    await tester.tap(find.text(_l.authTryAgain).last);
    await tester.pump();
    expect(attempts, 2);

    // Dispose so the OTP countdown timer is cancelled before teardown.
    await tester.pumpWidget(const SizedBox.shrink());
  });

  testWidgets('login layout fits a narrow Android viewport', (tester) async {
    tester.view.physicalSize = const Size(320 * 3, 640 * 3);
    tester.view.devicePixelRatio = 3.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      _testApp(
        AuthScreen(
          onRequestOtp: (_) async => '',
          onVerifyOtp: (_, _) async {},
        ),
      ),
    );
    await tester.pump();

    expect(tester.takeException(), isNull);
    expect(find.byType(TextFormField), findsOneWidget);

    await tester.pumpWidget(const SizedBox.shrink());
  });

  testWidgets('AppShell exposes the full navigation set in the drawer', (
    tester,
  ) async {
    await tester.pumpWidget(_buildShell());
    await tester.pumpAndSettle();

    expect(find.text('Demo Store'), findsOneWidget);
    expect(find.text(_l.dashTitle), findsWidgets);

    await tester.tap(find.byIcon(Icons.menu));
    await tester.pumpAndSettle();

    final drawer = find.byType(Drawer);

    // MAIN_NAV mirrors the web sidebar.
    for (final label in [
      _l.navDashboard,
      _l.navProductsStock,
      _l.navSalesInvoices,
      _l.navCustomers,
      _l.sectionSuppliers,
      _l.sectionExpenses,
      _l.sectionReports,
    ]) {
      expect(
        find.descendant(of: drawer, matching: find.text(label)),
        findsOneWidget,
        reason: 'drawer should list "$label"',
      );
    }
  });

  testWidgets('Profile menu shows the signed-in user and confirms sign out', (
    tester,
  ) async {
    var signedOut = false;
    await tester.pumpWidget(
      _buildShell(
        onSignOut: ({bool showError = false}) async {
          signedOut = true;
        },
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('profile-menu-trigger')));
    await tester.pumpAndSettle();

    expect(find.text('Demo Owner'), findsWidgets);
    expect(find.text('owner@midukandar.com'), findsOneWidget);
    expect(find.text(_l.menuViewBusinessProfile), findsOneWidget);
    expect(find.text(_l.moreSettings), findsOneWidget);
    expect(find.text(_l.signOut), findsOneWidget);

    // Sign out asks for confirmation first; cancelling keeps the session.
    await tester.tap(find.text(_l.signOut));
    await tester.pumpAndSettle();
    expect(find.text(_l.signOutConfirmTitle), findsOneWidget);
    await tester.tap(find.text(_l.cancel));
    await tester.pumpAndSettle();
    expect(signedOut, isFalse);

    // Confirming the destructive dialog signs out.
    await tester.tap(find.byKey(const Key('profile-menu-trigger')));
    await tester.pumpAndSettle();
    await tester.tap(find.text(_l.signOut));
    await tester.pumpAndSettle();
    await tester.tap(find.text(_l.signOut).last);
    await tester.pumpAndSettle();
    expect(signedOut, isTrue);
  });

  testWidgets('Product screen exposes its add action', (tester) async {
    await tester.pumpWidget(
      _testApp(
        Scaffold(
          body: ProductScreen(
            apiService: ApiService(baseUrl: AppConfig.localBaseUrl),
            onCreate: (_) async {},
            onUpdate: (_, _) async {},
            onArchive: (_) async {},
            onAdjust: (_, _, _) async {},
          ),
        ),
      ),
    );
    await tester.pump();

    expect(find.text(_l.prodAddTitle), findsOneWidget);
    expect(tester.takeException(), isNull);

    await tester.pumpWidget(const SizedBox.shrink());
  });

  testWidgets('Customer screen exposes its add action', (tester) async {
    await tester.pumpWidget(
      _testApp(
        Scaffold(
          body: CustomerScreen(
            apiService: ApiService(baseUrl: AppConfig.localBaseUrl),
            onCreate: (_) async {},
            onUpdate: (_, _) async {},
            onDelete: (_) async {},
          ),
        ),
      ),
    );
    await tester.pump();

    expect(find.text(_l.custAddTitle), findsOneWidget);
    expect(tester.takeException(), isNull);

    await tester.pumpWidget(const SizedBox.shrink());
  });

  test('StorePlanDetails parses plan modules and gates unknown keys', () {
    final plan = StorePlanDetails.fromJson({
      'adsEnabled': true,
      'adsTier': 'STANDARD',
      'status': 'ACTIVE',
      'modules': [
        {'moduleKey': 'DASHBOARD', 'enabled': true},
        {'module_key': 'INVENTORY', 'enabled': true},
        {'moduleKey': 'SUPPLIERS', 'enabled': false},
      ],
    });

    expect(plan.allowsModule('dashboard'), isTrue);
    expect(plan.allowsModule('inventory'), isTrue);
    expect(plan.allowsModule('SUPPLIERS'), isFalse);
    // A missing key means the plan does not include the module.
    expect(plan.allowsModule('GST_REPORTS'), isFalse);

    // Legacy payloads without a module list keep every screen visible.
    const legacy = StorePlanDetails(
      adsEnabled: false,
      adsTier: 'STANDARD',
      status: 'ACTIVE',
    );
    expect(legacy.allowsModule('SUPPLIERS'), isTrue);
  });

  test('AuthUser parses superadmin page grants and restrictions', () {
    final user = AuthUser.fromJson({
      'id': 'u1',
      'name': 'Demo Owner',
      'email': 'owner@midukandar.com',
      'role': 'OWNER',
      'store_id': 'store-1',
      'access': {
        'grantedPages': ['suppliers'],
        'disabled_pages': ['reports'],
      },
    });

    expect(user.storeId, 'store-1');
    expect(user.grantedPages, contains('suppliers'));
    expect(user.disabledPages, contains('reports'));
  });

  testWidgets('AppShell keeps a superadmin-granted module visible', (
    tester,
  ) async {
    const grantedUser = AuthUser(
      id: 'u1',
      name: 'Demo Owner',
      email: 'owner@midukandar.com',
      phone: '9876543210',
      role: 'OWNER',
      storeId: 'store-1',
      grantedPages: {'suppliers'},
    );

    await tester.pumpWidget(
      _testApp(
        AppShell(
          apiService: ApiService(baseUrl: AppConfig.localBaseUrl),
          user: grantedUser,
          store: _freeStore,
          stats: _stats,
          onSignOut: ({bool showError = false}) async {},
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byIcon(Icons.menu));
    await tester.pumpAndSettle();

    final drawer = find.byType(Drawer);
    expect(
      find.descendant(of: drawer, matching: find.text(_l.sectionSuppliers)),
      findsOneWidget,
    );
    expect(
      find.descendant(of: drawer, matching: find.text(_l.sectionExpenses)),
      findsNothing,
    );
  });

  testWidgets('AppShell hides drawer modules the store plan excludes', (
    tester,
  ) async {
    await tester.pumpWidget(
      _testApp(
        AppShell(
          apiService: ApiService(baseUrl: AppConfig.localBaseUrl),
          user: _user,
          store: _freeStore,
          stats: _stats,
          onSignOut: ({bool showError = false}) async {},
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byIcon(Icons.menu));
    await tester.pumpAndSettle();

    final drawer = find.byType(Drawer);
    for (final label in [
      _l.navDashboard,
      _l.navProductsStock,
      _l.navSalesInvoices,
      _l.navCustomers,
    ]) {
      expect(
        find.descendant(of: drawer, matching: find.text(label)),
        findsOneWidget,
        reason: 'drawer should keep "$label"',
      );
    }
    for (final label in [
      _l.sectionSuppliers,
      _l.sectionSupplierInvoices,
      _l.sectionExpenses,
      _l.sectionReports,
      _l.sectionUsers,
    ]) {
      expect(
        find.descendant(of: drawer, matching: find.text(label)),
        findsNothing,
        reason: 'drawer should hide "$label"',
      );
    }
  });

  testWidgets('Dashboard hides cards and shortcuts outside the plan', (
    tester,
  ) async {
    bool canAccess(AppSection section) =>
        section != AppSection.purchases &&
        section != AppSection.suppliers &&
        section != AppSection.reports;

    await tester.pumpWidget(
      _testApp(
        DashboardScreen(
          stats: _stats,
          storeName: 'Demo Store',
          onNavigate: (_) {},
          canAccess: canAccess,
        ),
      ),
    );
    await tester.pumpAndSettle();

    // Included modules keep their cards.
    expect(find.text(_l.dashSalesToday.toUpperCase()), findsOneWidget);
    expect(find.text(_l.dashLowStock), findsOneWidget);
    expect(find.text(_l.dashQuickInvoices), findsOneWidget);

    // Excluded modules disappear from the dashboard too.
    expect(find.text(_l.dashPurchasesToday.toUpperCase()), findsNothing);
    expect(find.text(_l.dashSupplierPayables), findsNothing);
    expect(find.text(_l.dashQuickReports), findsNothing);
  });

  testWidgets('idle ad appears after 30s on every page and activity resets it', (
    tester,
  ) async {
    var shown = 0;
    await tester.pumpWidget(
      _testApp(
        AppShell(
          apiService: ApiService(baseUrl: AppConfig.localBaseUrl),
          user: _user,
          store: _freeStore,
          stats: _stats,
          onSignOut: ({bool showError = false}) async {},
          idleAdPresenter: (_) async => shown++,
        ),
      ),
    );
    await tester.pumpAndSettle();

    // Nothing happens before the window elapses.
    await tester.pump(const Duration(seconds: 25));
    expect(shown, 0);
    await tester.pump(const Duration(seconds: 6));
    expect(shown, 1, reason: 'Dashboard should idle out after 30 seconds');

    // Opening another page arms a fresh window for that page.
    await tester.tap(find.text(_l.tabUdhari));
    await tester.pumpAndSettle();

    await tester.pump(const Duration(seconds: 25));
    expect(shown, 1, reason: 'Udhaari gets its own 30-second window');

    // Activity inside the window postpones the ad.
    await tester.tapAt(const Offset(200, 30));
    await tester.pump(const Duration(seconds: 20));
    expect(shown, 1, reason: 'a tap must restart the idle window');

    await tester.pump(const Duration(seconds: 11));
    expect(shown, 2, reason: 'Udhaari should show its own idle ad');

    // Dispose so the idle timer is cancelled before teardown.
    await tester.pumpWidget(const SizedBox.shrink());
  });

  testWidgets('idle ad stays hidden when the plan disables ads', (
    tester,
  ) async {
    var shown = 0;
    await tester.pumpWidget(
      _testApp(
        AppShell(
          apiService: ApiService(baseUrl: AppConfig.localBaseUrl),
          user: _user,
          store: _store,
          stats: _stats,
          onSignOut: ({bool showError = false}) async {},
          idleAdPresenter: (_) async => shown++,
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.pump(const Duration(seconds: 35));
    expect(shown, 0);

    await tester.pumpWidget(const SizedBox.shrink());
  });
}
