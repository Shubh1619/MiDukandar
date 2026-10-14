import 'package:app/core/config/api_config.dart';
import 'package:app/l10n/generated/app_localizations.dart';
import 'package:app/main.dart';
import 'package:app/models/app_models.dart';
import 'package:app/screens/auth_screen.dart';
import 'package:app/screens/customer_screen.dart';
import 'package:app/screens/product_screen.dart';
import 'package:app/services/api_service.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

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
  Store? store,
}) {
  return _testApp(
    AppShell(
      apiService: ApiService(baseUrl: ApiConfig.testBaseUrl),
      user: const AuthUser(
        id: 'u1',
        name: 'Demo Owner',
        email: 'owner@midukandar.com',
        phone: '9876543210',
        role: 'OWNER',
        storeId: 'store-1',
      ),
      store:
          store ??
          const Store(
            id: 'store-1',
            name: 'Demo Store',
            type: 'Retail',
            currency: 'INR',
            language: 'en',
            invoicePrefix: 'INV',
          ),
      stats: const DashboardStats(
        todaySales: 12000,
        todayPurchases: 5000,
        todayProfit: 3000,
        receivables: 3400,
        payables: 1200,
        lowStockCount: 3,
        recentTransactions: [],
      ),
      products: const [],
      customers: const [],
      invoices: const [],
      purchases: const [],
      suppliers: const [],
      expenses: const [],
      udhaari: const [],
      payments: const [],
      users: const [],
      salesRows: const [],
      purchaseRows: const [],
      expenseSummary: const ExpenseSummary(
        thisMonth: 0,
        lastMonth: 0,
        byCategory: [],
      ),
      onRefresh: () async {},
      onSignOut: onSignOut ?? ({bool showError = false}) async {},
    ),
  );
}

void main() {
  testWidgets('MiDukandar app root widget builds without exceptions', (
    tester,
  ) async {
    await tester.pumpWidget(const MiDukandarApp());
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.byType(MaterialApp), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  test('uses the verified production API origin by default', () {
    expect(ApiConfig.defaultBaseUrl, 'https://mazedukan.onrender.com');
    expect(ApiConfig.baseUrl, 'https://mazedukan.onrender.com');
    expect(
      ApiConfig.normalize('https://example.com///'),
      'https://example.com',
    );
  });

  testWidgets('login hides network exceptions and offers retry', (
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
          onVerifyOtp: (_, __) async {},
        ),
      ),
    );

    await tester.enterText(find.byType(TextFormField), 'owner@example.com');
    await tester.tap(find.text('Get OTP'));
    await tester.pump();

    expect(
      find.text(
        'Unable to connect to MiDukandar. Please check your internet connection and try again.',
      ),
      findsOneWidget,
    );
    expect(find.textContaining('SocketException'), findsNothing);
    expect(find.text('Try Again'), findsWidgets);

    await tester.tap(find.text('Try Again').first);
    await tester.pump();
    expect(attempts, 2);
  });

  testWidgets('login layout fits a narrow Android viewport', (tester) async {
    tester.view.physicalSize = const Size(320 * 3, 640 * 3);
    tester.view.devicePixelRatio = 3.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      _testApp(
        AuthScreen(
          onRequestOtp: (_) async => '',
          onVerifyOtp: (_, __) async {},
        ),
      ),
    );
    await tester.pump();

    expect(tester.takeException(), isNull);
    expect(find.byType(TextFormField), findsOneWidget);
  });

  testWidgets('App shell exposes the full production navigation set', (
    tester,
  ) async {
    await tester.pumpWidget(
      _testApp(
        AppShell(
          apiService: ApiService(baseUrl: ApiConfig.testBaseUrl),
          user: const AuthUser(
            id: 'u1',
            name: 'Demo Owner',
            email: 'owner@midukandar.com',
            phone: '9876543210',
            role: 'OWNER',
            storeId: 'store-1',
          ),
          store: const Store(
            id: 'store-1',
            name: 'Demo Store',
            type: 'Retail',
            currency: 'INR',
            language: 'en',
            invoicePrefix: 'INV',
          ),
          stats: const DashboardStats(
            todaySales: 12000,
            todayPurchases: 5000,
            todayProfit: 3000,
            receivables: 3400,
            payables: 1200,
            lowStockCount: 3,
            recentTransactions: [],
          ),
          products: const [
            Product(
              id: 'p1',
              name: 'Rice 5kg',
              category: 'Groceries',
              unit: 'Bag',
              sellingPrice: 320,
              stock: 18,
              isLow: false,
            ),
          ],
          customers: const [
            Customer(
              id: 'c1',
              name: 'Raman Sharma',
              mobile: '9876543210',
              address: 'Delhi',
              outstanding: 1200,
            ),
          ],
          invoices: const [
            InvoiceRecord(
              id: 'i1',
              invoiceNumber: 'INV-1001',
              customerName: 'Raman Sharma',
              amount: 1200,
              dueAmount: 0,
              paidAmount: 1200,
              paymentMode: 'UPI',
              status: 'PAID',
              createdAt: '2026-09-23',
              items: [
                InvoiceItem(name: 'Rice 5kg', qty: 1, price: 320, amount: 320),
              ],
            ),
          ],
          purchases: const [],
          suppliers: const [],
          expenses: const [],
          udhaari: const [],
          payments: const [],
          users: const [],
          salesRows: const [],
          purchaseRows: const [],
          expenseSummary: const ExpenseSummary(
            thisMonth: 0,
            lastMonth: 0,
            byCategory: [],
          ),
          onRefresh: () async {},
          onSignOut: ({bool showError = false}) async {},
        ),
      ),
    );

    expect(find.text('Demo Store'), findsOneWidget);
    expect(find.text('Dashboard'), findsWidgets);

    // Open the web-style sidebar drawer.
    await tester.tap(find.byIcon(Icons.menu));
    await tester.pumpAndSettle();

    final drawer = find.byType(Drawer);

    // MAIN_NAV mirrors the web sidebar.
    expect(
      find.descendant(of: drawer, matching: find.text('Products & Stock')),
      findsOneWidget,
    );
    expect(
      find.descendant(of: drawer, matching: find.text('Sales & Invoices')),
      findsOneWidget,
    );
    expect(
      find.descendant(of: drawer, matching: find.text('Customers')),
      findsWidgets,
    );
    expect(
      find.descendant(of: drawer, matching: find.text('Suppliers')),
      findsOneWidget,
    );
    expect(
      find.descendant(of: drawer, matching: find.text('Expenses')),
      findsOneWidget,
    );
    expect(
      find.descendant(of: drawer, matching: find.text('GST & Reports')),
      findsOneWidget,
    );

    // Udhaari is now in the More section - need to scroll to find it
    final drawerScrollable = find.descendant(
      of: drawer,
      matching: find.byType(Scrollable),
    );
    await tester.scrollUntilVisible(
      find.text('Udhaari'),
      400,
      scrollable: drawerScrollable,
    );
    await tester.pumpAndSettle();
    // Search globally since the text should only appear once
    expect(find.text('Udhaari'), findsWidgets);
  });

  testWidgets('Sidebar drawer fits and scrolls at 360px width', (tester) async {
    tester.view.physicalSize = const Size(360 * 3, 800 * 3);
    tester.view.devicePixelRatio = 3.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      _testApp(
        AppShell(
          apiService: ApiService(baseUrl: ApiConfig.testBaseUrl),
          user: const AuthUser(
            id: 'u1',
            name: 'Demo Owner',
            email: 'owner@midukandar.com',
            phone: '9876543210',
            role: 'OWNER',
            storeId: 'store-1',
          ),
          store: const Store(
            id: 'store-1',
            name: 'Demo Store',
            type: 'Retail',
            currency: 'INR',
            language: 'en',
            invoicePrefix: 'INV',
          ),
          stats: const DashboardStats(
            todaySales: 12000,
            todayPurchases: 5000,
            todayProfit: 3000,
            receivables: 3400,
            payables: 1200,
            lowStockCount: 3,
            recentTransactions: [],
          ),
          products: const [],
          customers: const [],
          invoices: const [],
          purchases: const [],
          suppliers: const [],
          expenses: const [],
          udhaari: const [],
          payments: const [],
          users: const [],
          salesRows: const [],
          purchaseRows: const [],
          expenseSummary: const ExpenseSummary(
            thisMonth: 0,
            lastMonth: 0,
            byCategory: [],
          ),
          onRefresh: () async {},
          onSignOut: ({bool showError = false}) async {},
        ),
      ),
    );

    await tester.pumpAndSettle();

    await tester.tap(find.byIcon(Icons.menu));
    await tester.pumpAndSettle();

    final drawer = find.byType(Drawer);

    expect(
      find.descendant(of: drawer, matching: find.text('Sales & Invoices')),
      findsOneWidget,
    );

    // Udhaari is now in the More section - need to scroll to find it
    final drawerScrollable = find.descendant(
      of: drawer,
      matching: find.byType(Scrollable),
    );
    await tester.scrollUntilVisible(
      find.text('Udhaari'),
      400,
      scrollable: drawerScrollable,
    );
    await tester.pumpAndSettle();
    // Search globally since the text should only appear once
    expect(find.text('Udhaari'), findsWidgets);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Sidebar drawer exposes all secondary modules', (tester) async {
    await tester.pumpWidget(
      _testApp(
        AppShell(
          apiService: ApiService(baseUrl: ApiConfig.testBaseUrl),
          user: const AuthUser(
            id: 'u1',
            name: 'Demo Owner',
            email: 'owner@midukandar.com',
            phone: '9876543210',
            role: 'OWNER',
            storeId: 'store-1',
          ),
          store: const Store(
            id: 'store-1',
            name: 'Demo Store',
            type: 'Retail',
            currency: 'INR',
            language: 'en',
            invoicePrefix: 'INV',
          ),
          stats: const DashboardStats(
            todaySales: 12000,
            todayPurchases: 5000,
            todayProfit: 3000,
            receivables: 3400,
            payables: 1200,
            lowStockCount: 3,
            recentTransactions: [],
          ),
          products: const [],
          customers: const [],
          invoices: const [],
          purchases: const [],
          suppliers: const [],
          expenses: const [],
          udhaari: const [],
          payments: const [],
          users: const [],
          salesRows: const [],
          purchaseRows: const [],
          expenseSummary: const ExpenseSummary(
            thisMonth: 0,
            lastMonth: 0,
            byCategory: [],
          ),
          onRefresh: () async {},
          onSignOut: ({bool showError = false}) async {},
        ),
      ),
    );

    await tester.tap(find.byIcon(Icons.menu));
    await tester.pumpAndSettle();

    final drawer = find.byType(Drawer);
    final drawerScrollable = find.descendant(
      of: drawer,
      matching: find.byType(Scrollable),
    );

    // MAIN_NAV mirrors the web sidebar.
    expect(
      find.descendant(of: drawer, matching: find.text('Products & Stock')),
      findsOneWidget,
    );
    expect(
      find.descendant(of: drawer, matching: find.text('Sales & Invoices')),
      findsOneWidget,
    );
    expect(
      find.descendant(of: drawer, matching: find.text('Customers')),
      findsWidgets,
    );
    expect(
      find.descendant(of: drawer, matching: find.text('Suppliers')),
      findsOneWidget,
    );
    expect(
      find.descendant(of: drawer, matching: find.text('Expenses')),
      findsOneWidget,
    );
    expect(
      find.descendant(of: drawer, matching: find.text('GST & Reports')),
      findsOneWidget,
    );

    // Udhaari is now in the More section - need to scroll to find it
    await tester.scrollUntilVisible(
      find.text('Udhaari'),
      400,
      scrollable: drawerScrollable,
    );
    await tester.pumpAndSettle();
    // Search globally since the text should only appear once
    expect(find.text('Udhaari'), findsWidgets);

    // System + More nav entries at the bottom of the scrolled drawer.
    await tester.scrollUntilVisible(
      find.text('Settings'),
      200,
      scrollable: drawerScrollable,
    );
    await tester.pumpAndSettle();
    expect(
      find.descendant(of: drawer, matching: find.text('Settings')),
      findsOneWidget,
    );
    expect(
      find.descendant(of: drawer, matching: find.text('Users & Roles')),
      findsOneWidget,
    );
    expect(
      find.descendant(of: drawer, matching: find.text('System')),
      findsOneWidget,
    );

    await tester.scrollUntilVisible(
      find.text('Purchases'),
      120,
      scrollable: drawerScrollable,
    );
    expect(find.text('Purchases'), findsOneWidget);

    await tester.scrollUntilVisible(
      find.text('Payments'),
      120,
      scrollable: drawerScrollable,
    );
    expect(find.text('Payments'), findsOneWidget);
  });

  testWidgets('Profile menu shows user header and opens Business Profile', (
    tester,
  ) async {
    await tester.pumpWidget(_buildShell());
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('profile-menu-trigger')));
    await tester.pumpAndSettle();

    expect(find.text('Demo Owner'), findsWidgets);
    expect(find.text('owner@midukandar.com'), findsOneWidget);
    expect(find.text('View Business Profile'), findsOneWidget);
    expect(find.text('Settings'), findsOneWidget);
    expect(find.text('Sign out'), findsOneWidget);

    await tester.tap(find.text('View Business Profile'));
    await tester.pumpAndSettle();

    expect(find.text('Business Profile'), findsWidgets);
    expect(find.text('Demo Store'), findsWidgets);
    expect(find.text('Owner'), findsOneWidget);
    expect(find.text('GSTIN'), findsOneWidget);
    expect(find.text('Registered on'), findsOneWidget);

    await tester.scrollUntilVisible(
      find.text('Edit'),
      100,
      scrollable: find.byType(Scrollable).last,
    );
    expect(find.text('Edit'), findsOneWidget);
  });

  testWidgets('Sign out from profile menu requires confirmation', (
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

    // Cancelling the confirmation dialog does not sign out.
    await tester.tap(find.byKey(const Key('profile-menu-trigger')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Sign out'));
    await tester.pumpAndSettle();
    expect(find.text('Sign out?'), findsOneWidget);
    expect(find.text('Cancel'), findsOneWidget);
    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();
    expect(signedOut, isFalse);

    // Confirming the destructive dialog signs out.
    await tester.tap(find.byKey(const Key('profile-menu-trigger')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Sign out'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Sign out').last);
    await tester.pumpAndSettle();
    expect(signedOut, isTrue);
  });

  testWidgets('Product and customer screens expose add actions', (
    tester,
  ) async {
    await tester.pumpWidget(
      _testApp(
        Scaffold(
          body: SingleChildScrollView(
            child: Column(
              children: [
                SizedBox(
                  height: 320,
                  child: ProductScreen(
                    products: const [
                      Product(
                        id: 'p1',
                        name: 'Rice 5kg',
                        category: 'Groceries',
                        unit: 'Bag',
                        sellingPrice: 320,
                        stock: 18,
                        isLow: false,
                      ),
                    ],
                    onCreate: (_) async {},
                    onUpdate: (_, __) async {},
                    onArchive: (_) async {},
                    onAdjust: (_, __, ___) async {},
                  ),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  height: 320,
                  child: CustomerScreen(
                    customers: const [
                      Customer(
                        id: 'c1',
                        name: 'Raman Sharma',
                        mobile: '9876543210',
                        address: 'Delhi',
                        outstanding: 1200,
                      ),
                    ],
                    onCreate: (_) async {},
                    onUpdate: (_, __) async {},
                    onDelete: (_) async {},
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );

    expect(find.text('Add product'), findsOneWidget);
    expect(find.text('Add customer'), findsOneWidget);
  });
}
