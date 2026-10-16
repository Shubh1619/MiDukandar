// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get add => 'Add';

  @override
  String get address => 'Address';

  @override
  String get amount => 'Amount';

  @override
  String get appTitle => 'Smart Business';

  @override
  String get authChangeEmail => 'Change email';

  @override
  String get authCodeSentNotice =>
      'Login code sent. Check your email for the verification code.';

  @override
  String authCodeSentTo(String email) {
    return 'Login code sent to $email.';
  }

  @override
  String authDevMode(String masterCode) {
    return 'Dev mode: master code is $masterCode. No email was sent.';
  }

  @override
  String get authEmail => 'Email address';

  @override
  String get authEnterEmail => 'Enter your email address.';

  @override
  String get authEnterOtp => 'Enter verification code';

  @override
  String get authErrSendOtp => 'Could not send OTP. Please try again.';

  @override
  String get authErrVerify => 'Verification failed. Please try again.';

  @override
  String get authUnableToConnect =>
      'Unable to connect to MiDukandar. Please check your internet connection and try again.';

  @override
  String get authServiceUnavailable =>
      'MiDukandar service is temporarily unavailable. Please try again shortly.';

  @override
  String get authConnectionTimeout => 'Connection timed out. Please try again.';

  @override
  String get authAccountNotFound =>
      'Account not found. Please check your email or register your business.';

  @override
  String get authTryAgain => 'Try Again';

  @override
  String get authOtpSent => 'OTP Sent';

  @override
  String get authGetOtp => 'Get OTP';

  @override
  String get authInvalidEmail => 'Enter a valid email address.';

  @override
  String get authNoAccount => 'Don\'t have an account?';

  @override
  String authOtpInstructions(String time) {
    return 'Type the 6-digit code from your email. The code expires in $time.';
  }

  @override
  String get authOtpPlaceholder => '• • • • • •';

  @override
  String get authOtpTooShort => 'Please enter the 4-6 digit code we sent.';

  @override
  String get authRegisterBusiness => 'Register your business';

  @override
  String get authResendCode => 'Resend code';

  @override
  String authResendIn(String time) {
    return 'Resend code in $time';
  }

  @override
  String get authSendingOtp => 'Sending OTP...';

  @override
  String get authSignInBadge => 'SIGN IN';

  @override
  String get authSignInSubtitle =>
      'Sign in to manage your shop and keep your business moving.';

  @override
  String get authSigningIn => 'Signing in...';

  @override
  String get authVerifyAndSignIn => 'Verify & Sign in';

  @override
  String get authWelcomeBack => 'Welcome back';

  @override
  String get back => 'Back';

  @override
  String get billAddInvoice => 'Add invoice';

  @override
  String get billAll => 'All';

  @override
  String get billCreatedFromMobileApp => 'Created from mobile app';

  @override
  String billCustomerLine(String name) {
    return 'Customer: $name';
  }

  @override
  String get billCustomerName => 'Customer name';

  @override
  String billDateLine(String date) {
    return 'Date: $date';
  }

  @override
  String get billDue => 'Due';

  @override
  String billDueAmount(String amount) {
    return 'Due $amount';
  }

  @override
  String get billEditInvoice => 'Edit Invoice';

  @override
  String get billGenericItem => 'Generic item';

  @override
  String get billHeldBills => 'Held bills';

  @override
  String get billHeldSaved => 'Bill held';

  @override
  String get billHold => 'Hold';

  @override
  String get billNoHeldBills => 'No held bills';

  @override
  String get billResume => 'Resume';

  @override
  String get billInvoices => 'Invoices';

  @override
  String billLineItem(String name, String qty) {
    return '$name x $qty';
  }

  @override
  String billMobileLine(String number) {
    return 'Mobile: $number';
  }

  @override
  String get billMode => 'Mode';

  @override
  String get billModeBank => 'Bank';

  @override
  String get billModeCard => 'Card';

  @override
  String get billModeCash => 'Cash';

  @override
  String billModeLine(String mode) {
    return 'Mode: $mode';
  }

  @override
  String get billModeUpi => 'UPI';

  @override
  String get billNewInvoice => 'New Invoice';

  @override
  String get billNoLineItems => 'No line items';

  @override
  String get billNoMatchingInvoices => 'No matching invoices';

  @override
  String billNoteLine(String note) {
    return 'Note: $note';
  }

  @override
  String get billPaidAmount => 'Paid amount';

  @override
  String billPayAmount(String amount) {
    return 'Pay $amount';
  }

  @override
  String get billQty => 'Qty';

  @override
  String get billRevenue => 'Revenue';

  @override
  String get billSearchPlaceholder => 'Search customer or invoice';

  @override
  String get billUdhaar => 'Udhaar';

  @override
  String get billUnitPrice => 'Unit price';

  @override
  String get billWalkInCustomer => 'Walk-in customer';

  @override
  String get cancel => 'Cancel';

  @override
  String get city => 'City';

  @override
  String get close => 'Close';

  @override
  String get confirm => 'Confirm';

  @override
  String get custAddTitle => 'Add customer';

  @override
  String custDeleteConfirm(String name) {
    return 'Delete \"$name\"? This cannot be undone.';
  }

  @override
  String get custDeleteTitle => 'Delete customer';

  @override
  String get custEditTitle => 'Edit customer';

  @override
  String get custNameLabel => 'Customer name';

  @override
  String get custNoMobile => 'No mobile';

  @override
  String get dashCustomerUdhaari => 'Customer Udhaari';

  @override
  String get dashCustomerUdhaariSub => 'Total outstanding ledger';

  @override
  String dashHeaderSubtitle(String storeName) {
    return 'Today\'s performance across $storeName';
  }

  @override
  String get dashLowStock => 'Low Stock';

  @override
  String get dashLowStockSub => 'Products below min stock level';

  @override
  String get dashNoTransactions => 'No transactions yet';

  @override
  String get dashNoTransactionsSub =>
      'Create your first sale from the Sales tab.';

  @override
  String get dashProfitToday => 'Est. Profit Today';

  @override
  String get dashProfitTodaySub => 'Margin before tax today';

  @override
  String get dashPurchasesToday => 'Purchases Today';

  @override
  String get dashPurchasesTodaySub => 'Stock purchases today';

  @override
  String get dashQuickControls => 'Quick Controls';

  @override
  String get dashQuickInvoices => 'Invoices';

  @override
  String get dashQuickReports => 'Reports';

  @override
  String get dashRecentTransactions => 'Recent Transactions';

  @override
  String get dashSalesToday => 'Sales Today';

  @override
  String get dashSalesTodaySub => 'Confirmed bills today';

  @override
  String get dashSupplierPayables => 'Supplier Payables';

  @override
  String get dashSupplierPayablesSub => 'Due on open purchase invoices';

  @override
  String get dashTimeAm => 'AM';

  @override
  String get dashTimePm => 'PM';

  @override
  String get dashTitle => 'Dashboard';

  @override
  String get dashTypePayment => 'Payment';

  @override
  String get dashTypePurchase => 'Purchase';

  @override
  String get dashTypeSale => 'Sale';

  @override
  String get dashViewAll => 'View all';

  @override
  String get date => 'Date';

  @override
  String get delete => 'Delete';

  @override
  String get done => 'Done';

  @override
  String get edit => 'Edit';

  @override
  String errAdjustStock(String error) {
    return 'Could not adjust stock: $error';
  }

  @override
  String errArchiveProduct(String error) {
    return 'Could not archive product: $error';
  }

  @override
  String errCreateCustomer(String error) {
    return 'Could not create customer: $error';
  }

  @override
  String errCreateExpense(String error) {
    return 'Could not create expense: $error';
  }

  @override
  String errCreateInvoice(String error) {
    return 'Could not create invoice: $error';
  }

  @override
  String errCreateProduct(String error) {
    return 'Could not create product: $error';
  }

  @override
  String errCreatePurchase(String error) {
    return 'Could not create purchase: $error';
  }

  @override
  String errCreateSupplier(String error) {
    return 'Could not create supplier: $error';
  }

  @override
  String errDeleteCustomer(String error) {
    return 'Could not delete customer: $error';
  }

  @override
  String errInviteUser(String error) {
    return 'Could not invite user: $error';
  }

  @override
  String errMarkPaid(String error) {
    return 'Could not mark invoice paid: $error';
  }

  @override
  String errRecordPayment(String error) {
    return 'Could not record payment: $error';
  }

  @override
  String errRefreshFailed(String error) {
    return 'Refresh failed: $error';
  }

  @override
  String get errSessionExpired => 'Your session expired. Please sign in again.';

  @override
  String errUpdateCustomer(String error) {
    return 'Could not update customer: $error';
  }

  @override
  String errUpdateProduct(String error) {
    return 'Could not update product: $error';
  }

  @override
  String get expnAddExpense => 'Add expense';

  @override
  String get expnByCategory => 'By category';

  @override
  String get expnCategoryOptional => 'Category (optional)';

  @override
  String get expnDefaultTitle => 'Expense';

  @override
  String get expnExpenseTitle => 'Expense title';

  @override
  String get expnGeneral => 'General';

  @override
  String get expnLastMonth => 'Last month';

  @override
  String get expnNoExpenses => 'No expenses yet';

  @override
  String get expnNoteFromApp => 'Created from mobile app';

  @override
  String get expnOther => 'Other';

  @override
  String get expnPaymentBank => 'Bank';

  @override
  String get expnPaymentCard => 'Card';

  @override
  String get expnPaymentCash => 'Cash';

  @override
  String get expnPaymentMode => 'Payment mode';

  @override
  String get expnPaymentUpi => 'UPI';

  @override
  String get expnThisMonth => 'This month';

  @override
  String get invnAddPlus => 'Add (+)';

  @override
  String invnAdjustFailed(String error) {
    return 'Adjust failed: $error';
  }

  @override
  String invnAdjustStockTitle(String product) {
    return 'Adjust stock — $product';
  }

  @override
  String get invnAll => 'All';

  @override
  String get invnBal => 'bal';

  @override
  String invnCurrentBalance(String value) {
    return 'Current balance: $value';
  }

  @override
  String get invnGeneral => 'General';

  @override
  String get invnHeaderSubtitle => 'Live stock from the movement ledger';

  @override
  String get invnLoadError => 'Could not load inventory';

  @override
  String get invnLowOnly => 'Low only';

  @override
  String get invnLowStock => 'Low stock';

  @override
  String get invnManualAdjustment => 'Manual adjustment';

  @override
  String get invnMovements => 'Movements';

  @override
  String get invnMovementsSubtitle => 'Append-only movement ledger';

  @override
  String get invnMovementsTitle => 'Stock Movements';

  @override
  String invnMrp(String price) {
    return 'MRP $price';
  }

  @override
  String get invnNoMovements => 'No movements yet';

  @override
  String get invnNoMovementsSub =>
      'Sales, purchases and adjustments will appear here.';

  @override
  String get invnNoSku => 'no SKU';

  @override
  String get invnNoStock => 'No stock found';

  @override
  String get invnNoStockSub => 'Add products or adjust stock to get started.';

  @override
  String get invnQuantity => 'Quantity';

  @override
  String get invnReason => 'Reason';

  @override
  String get invnRemoveMinus => 'Remove (−)';

  @override
  String get invnSearchHint => 'Search products...';

  @override
  String get invnStockUpdated => 'Stock updated';

  @override
  String get invnValueLabel => 'Inventory value';

  @override
  String get loading => 'Loading...';

  @override
  String get mobile => 'Mobile';

  @override
  String get moreExpenses => 'Expenses';

  @override
  String get moreExpensesSub => 'Register & category breakdown';

  @override
  String get moreInventory => 'Inventory';

  @override
  String get moreInventorySub => 'Stock levels, low stock & movements';

  @override
  String get morePayments => 'Payments';

  @override
  String get morePaymentsSub => 'Customer receipts history';

  @override
  String get morePurchases => 'Purchases';

  @override
  String get morePurchasesSub => 'Purchase register & payments';

  @override
  String get moreReports => 'GST & Reports';

  @override
  String get moreReportsSub => 'Sales, purchases, P&L and GST';

  @override
  String get moreSettings => 'Settings';

  @override
  String get moreSettingsSub => 'Store profile & language';

  @override
  String get moreSignOut => 'Sign out';

  @override
  String get moreSignOutSub => 'End this session';

  @override
  String get moreSubtitle => 'All services';

  @override
  String get moreSuppliers => 'Suppliers';

  @override
  String get moreSuppliersSub => 'Vendors, due payments & details';

  @override
  String get moreTitle => 'More';

  @override
  String get moreUsers => 'Users & Roles';

  @override
  String get moreUsersSub => 'Team members & invites';

  @override
  String get myStore => 'My Store';

  @override
  String get name => 'Name';

  @override
  String get no => 'No';

  @override
  String get ok => 'OK';

  @override
  String get paymEmpty => 'No payments yet';

  @override
  String get paymPayment => 'Payment';

  @override
  String paymReference(String type, String id) {
    return '$type #$id';
  }

  @override
  String get phone => 'Phone';

  @override
  String get pincode => 'Pincode';

  @override
  String get pleaseWait => 'Please wait...';

  @override
  String get prodAbbrevCrore => 'Cr';

  @override
  String get prodAbbrevLakh => 'L';

  @override
  String get prodAbbrevThousand => 'k';

  @override
  String get prodActionsTitle => 'Product actions';

  @override
  String get prodAddLabel => 'Add (+)';

  @override
  String get prodAddTitle => 'Add product';

  @override
  String get prodAdjustStock => 'Adjust stock';

  @override
  String prodAdjustStockTitle(String productName) {
    return 'Adjust stock · $productName';
  }

  @override
  String get prodAll => 'All';

  @override
  String get prodApply => 'Apply';

  @override
  String get prodArchive => 'Archive';

  @override
  String get prodArchiveConfirmTitle => 'Archive product?';

  @override
  String prodArchiveMessage(String productName) {
    return '\"$productName\" will be hidden from sales and listings. Movements are kept for records.';
  }

  @override
  String get prodArchiveProduct => 'Archive product';

  @override
  String get prodCategory => 'Category';

  @override
  String prodCurrently(String stock, String unit) {
    return 'Currently: $stock $unit';
  }

  @override
  String get prodEditProduct => 'Edit product';

  @override
  String get prodEmptySubtitle =>
      'Try a different search or add a new product.';

  @override
  String get prodEmptyTitle => 'No products found';

  @override
  String get prodGeneral => 'General';

  @override
  String get prodGstPercent => 'GST %';

  @override
  String prodLowQty(String qty) {
    return 'LOW · $qty';
  }

  @override
  String get prodManualAdjustment => 'Manual adjustment';

  @override
  String get prodMinStock => 'Min stock';

  @override
  String get prodNoMovements => 'No movements recorded yet';

  @override
  String get prodOpeningStock => 'Opening stock';

  @override
  String prodProductMeta(String category, String unit) {
    return '$category · $unit';
  }

  @override
  String prodProductMetaSku(String category, String unit, String sku) {
    return '$category · $unit · SKU $sku';
  }

  @override
  String get prodProductName => 'Product name';

  @override
  String get prodPurchase => 'Purchase';

  @override
  String get prodPurchasePrice => 'Purchase price';

  @override
  String get prodQuantity => 'Quantity';

  @override
  String get prodReason => 'Reason';

  @override
  String get prodRemoveLabel => 'Remove (−)';

  @override
  String get prodSearchHint => 'Search by name, SKU or barcode...';

  @override
  String get prodSelling => 'Selling';

  @override
  String get prodSellingPrice => 'Selling price';

  @override
  String get prodStockMovements => 'Stock movements';

  @override
  String prodStockQty(String qty) {
    return '$qty in stock';
  }

  @override
  String get prodSubtitle => 'Catalog, pricing and stock';

  @override
  String get prodTitle => 'Products';

  @override
  String get prodUnit => 'Unit';

  @override
  String get prodValue => 'Value';

  @override
  String get purchAddPurchase => 'Add purchase';

  @override
  String purchDueAmount(String amount) {
    return 'Due: $amount';
  }

  @override
  String get purchFromMobileApp => 'Created from mobile app';

  @override
  String get purchNoPurchasesYet => 'No purchases yet';

  @override
  String get purchPurchaseItem => 'Purchase item';

  @override
  String get purchSupplierName => 'Supplier name';

  @override
  String get purchTotalAmount => 'Total amount';

  @override
  String get purchTotalBilled => 'Total billed';

  @override
  String get purchUnknownSupplier => 'Unknown supplier';

  @override
  String get refresh => 'Refresh';

  @override
  String get reptBills => 'Bills';

  @override
  String get reptEstProfit => 'Est. Profit';

  @override
  String get reptEstimatedProfit => 'Estimated Profit';

  @override
  String get reptGstSummary => 'GST Summary';

  @override
  String get reptInputGst => 'Input GST (purchases)';

  @override
  String get reptInventoryValue => 'Inventory Value (cost)';

  @override
  String get reptInvoices => 'Invoices';

  @override
  String get reptLessTotalPurchases => 'Less: Total Purchases';

  @override
  String get reptNetGstPayable => 'Net GST Payable';

  @override
  String get reptNoChartData => 'No data yet for chart';

  @override
  String get reptNoSalesRows => 'No sales rows yet';

  @override
  String get reptOutputGst => 'Output GST (sales)';

  @override
  String get reptProfitLossPeriod => 'Profit & Loss (period)';

  @override
  String get reptRecentSalesRows => 'Recent sales rows';

  @override
  String get reptSales => 'Sales';

  @override
  String get reptSalesVsPurchasesPeriod => 'Sales vs Purchases (period)';

  @override
  String get reptTitle => 'Reports';

  @override
  String get reptTotalSales => 'Total Sales';

  @override
  String get reptCogs => 'COGS (cost of goods sold)';

  @override
  String get reptGrossMargin => 'Gross Margin';

  @override
  String get reptGrossProfit => 'Gross Profit';

  @override
  String get reptGstBreakup => 'GST Rate Breakup';

  @override
  String get reptNetMargin => 'Net Margin';

  @override
  String get reptNetProfit => 'Net Profit';

  @override
  String get reptNoData => 'No data for this period';

  @override
  String get reptRate => 'Rate';

  @override
  String get reptRealPnl => 'Profit & Loss (actual)';

  @override
  String get reptRevenue => 'Revenue';

  @override
  String get reptTax => 'Tax';

  @override
  String get reptTaxable => 'Taxable';

  @override
  String get required => 'Required';

  @override
  String get retry => 'Try again';

  @override
  String get referTitle => 'Refer & Earn';

  @override
  String get referYourCode => 'Your referral code';

  @override
  String get referCopy => 'Copy code';

  @override
  String get referCopied => 'Referral code copied';

  @override
  String get referOnlyOwner => 'Only the shop owner can view referrals';

  @override
  String get referReferred => 'Referred shops';

  @override
  String get save => 'Save';

  @override
  String get searchHint => 'Search...';

  @override
  String get sectionExpenses => 'Expenses';

  @override
  String get sectionInventory => 'Inventory';

  @override
  String get sectionPayments => 'Payments';

  @override
  String get sectionProducts => 'Products';

  @override
  String get sectionPurchases => 'Purchases';

  @override
  String get sectionReports => 'GST & Reports';

  @override
  String get sectionSettings => 'Settings';

  @override
  String get sectionSuppliers => 'Suppliers';

  @override
  String get sectionSupplierInvoices => 'Supplier Invoices';

  @override
  String get sectionUdhaari => 'Udhaari';

  @override
  String get sectionUsers => 'Users & Roles';

  @override
  String get settingsAddressSection => 'Address';

  @override
  String get settingsAppLanguage => 'App language';

  @override
  String get settingsBusinessName => 'Business name';

  @override
  String get settingsBusinessType => 'Business type (e.g. Grocery, Pharmacy)';

  @override
  String get settingsGstin => 'GSTIN';

  @override
  String get settingsInvoicePrefix => 'Invoice prefix';

  @override
  String get settingsLanguageSection => 'Language';

  @override
  String get settingsSave => 'Save settings';

  @override
  String settingsSaveFailed(String error) {
    return 'Could not save settings: $error';
  }

  @override
  String get settingsSaved => 'Settings saved';

  @override
  String get settingsSaving => 'Saving...';

  @override
  String get settingsStoreProfile => 'Store profile';

  @override
  String get settingsSubtitle => 'Store profile and preferences';

  @override
  String get settingsTitle => 'Settings';

  @override
  String get signOut => 'Sign out';

  @override
  String signedInAs(String email) {
    return 'Signed in as $email';
  }

  @override
  String get state => 'State';

  @override
  String get status => 'Status';

  @override
  String get statusActive => 'Active';

  @override
  String get statusCancelled => 'Cancelled';

  @override
  String get statusClosed => 'Closed';

  @override
  String get statusCompleted => 'Completed';

  @override
  String get statusDelivered => 'Delivered';

  @override
  String get statusDraft => 'Draft';

  @override
  String get statusInStock => 'In stock';

  @override
  String get statusInactive => 'Inactive';

  @override
  String get statusLow => 'Low';

  @override
  String get statusOpen => 'Open';

  @override
  String get statusOutOfStock => 'Out of stock';

  @override
  String get statusOutstanding => 'Outstanding';

  @override
  String get statusOverdue => 'Overdue';

  @override
  String get statusPaid => 'Paid';

  @override
  String get statusPartial => 'Partial';

  @override
  String get statusPending => 'Pending';

  @override
  String get statusReceived => 'Received';

  @override
  String get statusSent => 'Sent';

  @override
  String get statusSettled => 'Settled';

  @override
  String get statusUnpaid => 'Unpaid';

  @override
  String get statusVoid => 'Void';

  @override
  String suppAcrossOpenAccounts(String count) {
    return 'Across $count open accounts';
  }

  @override
  String get suppAddSupplier => 'Add supplier';

  @override
  String get suppAddressOptional => 'Address (optional)';

  @override
  String get suppEmailOptional => 'Email (optional)';

  @override
  String get suppGstinOptional => 'GSTIN (optional)';

  @override
  String suppLastDate(String date) {
    return 'Last: $date';
  }

  @override
  String get suppNoSuppliers => 'No suppliers yet';

  @override
  String get suppNoSuppliersSub =>
      'Add your first supplier to track purchases and dues.';

  @override
  String suppPayableAmount(String amount) {
    return 'Payable: $amount';
  }

  @override
  String suppPurchasesAmount(String amount) {
    return 'Purchases: $amount';
  }

  @override
  String get suppSubtitle => 'Manage vendors and dues';

  @override
  String get suppSupplierName => 'Supplier name';

  @override
  String get suppTotalPayable => 'Total Payable';

  @override
  String get suppTotalRegisteredVendors => 'Total registered vendors';

  @override
  String suppXOutstanding(String count) {
    return '$count outstanding';
  }

  @override
  String suppXOverdue(String count) {
    return '$count overdue';
  }

  @override
  String suppXSettled(String count) {
    return '$count settled';
  }

  @override
  String get suppViewDetails => 'View details';

  @override
  String get suppPayments => 'Payments';

  @override
  String get suppPurchaseOrders => 'Purchase Orders';

  @override
  String get suppNoPayments => 'No payments recorded';

  @override
  String get suppNoPOs => 'No purchase orders';

  @override
  String get tabCustomers => 'Customers';

  @override
  String get tabHome => 'Home';

  @override
  String get tabInvoice => 'Invoice';

  @override
  String get tabMore => 'More';

  @override
  String get tabStock => 'Stock';

  @override
  String get tabUdhari => 'Udhari';

  @override
  String get total => 'Total';

  @override
  String get udhrAmountReceived => 'Amount received';

  @override
  String get udhrBalance => 'Balance';

  @override
  String get udhrDueToday => 'Due today';

  @override
  String udhrEntryAmount(String amount) {
    return 'Amount: $amount';
  }

  @override
  String udhrEntryBalance(String balance) {
    return 'Balance: $balance';
  }

  @override
  String udhrLastEntry(String date) {
    return 'Last: $date';
  }

  @override
  String get udhrLedgerEntries => 'Ledger entries';

  @override
  String udhrLoadEntriesFailed(String error) {
    return 'Could not load entries: $error';
  }

  @override
  String get udhrModeBank => 'Bank';

  @override
  String get udhrModeCard => 'Card';

  @override
  String get udhrModeCash => 'Cash';

  @override
  String get udhrModeUpi => 'UPI';

  @override
  String get udhrNoLedgerEntries => 'No ledger entries';

  @override
  String get udhrNoRecords => 'No udhaar records yet';

  @override
  String get udhrNoteOptional => 'Note (optional)';

  @override
  String udhrOutstandingBalance(String amount) {
    return 'Outstanding balance: $amount';
  }

  @override
  String udhrPaidVia(String amount, String mode) {
    return '✓ Paid $amount via $mode';
  }

  @override
  String udhrPaidViaNote(String amount, String mode, String note) {
    return '✓ Paid $amount via $mode · $note';
  }

  @override
  String get udhrPaymentMode => 'Payment mode';

  @override
  String get udhrPaymentReceived => 'Udhari payment received successfully.';

  @override
  String get udhrReceive => 'Receive';

  @override
  String udhrReceivePaymentFrom(String name) {
    return 'Receive payment from $name';
  }

  @override
  String get udhrRecordPayment => 'Receive payment';

  @override
  String get udhrTitle => 'Customer Udhaar';

  @override
  String udhrTotalAmount(String amount) {
    return 'Total: $amount';
  }

  @override
  String get udhrTotalReceivables => 'Total Receivables';

  @override
  String get udhrUpcoming => 'Upcoming';

  @override
  String userAllUsers(String count) {
    return 'All users ($count)';
  }

  @override
  String get userEmailOptional => 'Email (optional)';

  @override
  String get userEmailRequired => 'Email';

  @override
  String get userFullName => 'Full name';

  @override
  String get userInvite => 'Invite';

  @override
  String get userInviteHint =>
      'Share this invite link with them so they can join the team.';

  @override
  String get copyInviteLink => 'Copy link';

  @override
  String get userInviteMember => 'Invite member';

  @override
  String get userInviteTitle => 'Invite team member';

  @override
  String userJoinedAt(String date) {
    return 'Joined: $date';
  }

  @override
  String get userMobileOptional => 'Mobile (optional)';

  @override
  String get userNoUsers => 'No other users yet';

  @override
  String get userRole => 'Role';

  @override
  String get userRoleAdmin => 'Admin';

  @override
  String get userRoleCashier => 'Cashier';

  @override
  String get userRoleManager => 'Manager';

  @override
  String get userRoleOwner => 'Owner';

  @override
  String get userRoleStaff => 'Staff';

  @override
  String get userTitle => 'Team & Users';

  @override
  String get userYou => 'You';

  @override
  String userYouLabel(String name) {
    return '$name (you)';
  }

  @override
  String get yes => 'Yes';

  @override
  String get mobileNumber => 'Mobile number';

  @override
  String get udhrAdd => 'Add Udhari';

  @override
  String get udhrAddNewCustomer => 'Add new customer';

  @override
  String get udhrAmountLabel => 'Amount';

  @override
  String get udhrAmountRequired => 'Enter an amount greater than 0';

  @override
  String get udhrCustomer => 'Customer';

  @override
  String get udhrDueDate => 'Due date';

  @override
  String get udhrEntryDate => 'Entry date';

  @override
  String get udhrNewEntry => 'New Udhari Entry';

  @override
  String get udhrSelectCustomer => 'Select customer';

  @override
  String get validationMobileNumber =>
      'Enter a valid mobile number (10-12 digits)';

  @override
  String errCreateUdhaari(Object error) {
    return 'Could not add udhaari: $error';
  }

  @override
  String get menuViewBusinessProfile => 'View Business Profile';

  @override
  String get bizProfileTitle => 'Business Profile';

  @override
  String get bizProfileSubtitle => 'Your business details & plan';

  @override
  String get bizOwnerName => 'Owner';

  @override
  String get bizGstin => 'GSTIN';

  @override
  String get bizAddress => 'Address';

  @override
  String get bizMobile => 'Mobile';

  @override
  String get bizCategory => 'Category';

  @override
  String get bizRegisteredOn => 'Registered on';

  @override
  String get bizPlan => 'Plan';

  @override
  String get bizPlanStatus => 'Plan status';

  @override
  String get bizPlanFree => 'Free';

  @override
  String get bizPlanTrial => 'Trial';

  @override
  String get bizStatusSuspended => 'Suspended';

  @override
  String get signOutConfirmTitle => 'Sign out?';

  @override
  String get signOutConfirmMessage =>
      'Are you sure you want to sign out? You\'ll be asked to verify an OTP again the next time you sign in.';

  @override
  String get navDashboard => 'Dashboard';

  @override
  String get navProductsStock => 'Products & Stock';

  @override
  String get navSalesInvoices => 'Sales & Invoices';

  @override
  String get navCustomers => 'Customers';

  @override
  String get navSystem => 'System';

  @override
  String get userRoleStockManager => 'Stock Manager';

  @override
  String get userRolePlatformAdmin => 'Platform Admin';

  @override
  String get roleAccessFull => 'Full Access / संपूर्ण प्रवेश';

  @override
  String get roleAccessLimited => 'मर्यादित दृश्यता / Limited Visibility';

  @override
  String get roleAccessPlatform => 'Platform Access / प्रशासक';

  @override
  String get syncOnline => 'Online';

  @override
  String get syncOffline => 'Offline';

  @override
  String get appVersion => 'v3.4.2';

  @override
  String get appTagline => 'मी दुकानदार - स्मार्ट व्यवसाय व्यवस्थापन';

  @override
  String get exitAppTitle => 'Exit MiDukandar?';

  @override
  String get exitAppMessage => 'Are you sure you want to exit the app?';

  @override
  String get exitApp => 'Exit';

  @override
  String get billReverseTitle => 'Void / Reverse Sale';

  @override
  String billReverseMessage(Object invoiceNumber) {
    return 'Reverse invoice \"$invoiceNumber\"? This creates a reversing entry and marks the original as void. A reason is required.';
  }

  @override
  String get billReverse => 'Void/Reverse';

  @override
  String errReverseInvoice(Object error) {
    return 'Could not reverse invoice: $error';
  }

  @override
  String errUpdateInvoice(Object error) {
    return 'Could not update invoice: $error';
  }

  @override
  String get suppEditSupplier => 'Edit supplier';

  @override
  String get suppDeleteTitle => 'Delete supplier?';

  @override
  String suppDeleteMessage(Object name) {
    return 'Delete supplier \"$name\"? This archives the supplier and removes them from lists. Outstanding purchase orders must be cancelled first.';
  }

  @override
  String errUpdateSupplier(Object error) {
    return 'Could not update supplier: $error';
  }

  @override
  String errDeleteSupplier(Object error) {
    return 'Could not delete supplier: $error';
  }

  @override
  String get expnEditExpense => 'Edit expense';

  @override
  String get expnDeleteTitle => 'Delete expense?';

  @override
  String expnDeleteMessage(Object title) {
    return 'Delete expense \"$title\"? This cannot be undone.';
  }

  @override
  String errUpdateExpense(Object error) {
    return 'Could not update expense: $error';
  }

  @override
  String errDeleteExpense(Object error) {
    return 'Could not delete expense: $error';
  }

  @override
  String get purchPayTitle => 'Record payment';

  @override
  String get userChangeRole => 'Change role';

  @override
  String get userDeactivate => 'Deactivate';

  @override
  String get userActivate => 'Activate';

  @override
  String get userCannotManage =>
      'Only the Owner can manage other team members.';

  @override
  String errUpdateUserStatus(Object error) {
    return 'Could not update user status: $error';
  }

  @override
  String errUpdateUserRole(Object error) {
    return 'Could not update user role: $error';
  }

  @override
  String get regTitle => 'Create your account';

  @override
  String get regSubtitle => 'Register your account and store in one step.';

  @override
  String get regEmailLabel => 'Account Email';

  @override
  String get regEmailRequired => 'Enter an email address for your account.';

  @override
  String get regEmailInvalid => 'Enter a valid email address.';

  @override
  String get regOwnerNameLabel => 'Shop Owner Name';

  @override
  String get regOwnerNameRequired => 'Enter the shop owner\'s name';

  @override
  String get regShopNameLabel => 'Shop / Business Name';

  @override
  String get regShopNameRequired => 'Enter your shop name';

  @override
  String get regStoreTypeLabel => 'Store Type';

  @override
  String get regPhoneLabel => 'Mobile Number';

  @override
  String get regGstLabel => 'GSTIN (Optional)';

  @override
  String get regGstHint => '27ABCDE1234F1Z5';

  @override
  String get regLanguageLabel => 'App Language';

  @override
  String get regAddressLabel => 'Address';

  @override
  String get regAddressHint => 'Shop no, street, area';

  @override
  String get regAddressRequired => 'Enter your shop address';

  @override
  String get regCityLabel => 'City';

  @override
  String get regCityRequired => 'Enter your city';

  @override
  String get regStateLabel => 'State';

  @override
  String get regPincodeLabel => 'Pincode';

  @override
  String get regPincodeHint => '411001';

  @override
  String get regPincodeRequired => 'Enter a valid 6-digit pincode';

  @override
  String get regPincodeInvalid => 'Pincode must be 6 digits';

  @override
  String get regCurrencyLabel => 'Currency';

  @override
  String get regInvoicePrefixLabel => 'Invoice Prefix';

  @override
  String get regInvoicePrefixHint => 'e.g. INV → INV-0001';

  @override
  String get regCreateAccount => 'Create Account';

  @override
  String get regSubmitting => 'Creating account...';

  @override
  String get regSuccessMessage => 'Account created! Sign in to continue.';

  @override
  String get regBackToLogin => 'Back to login';

  @override
  String get regSecureNotice => 'Your data is encrypted and stored securely.';

  @override
  String get regSecureBadge => 'Secure & private';

  @override
  String get regGstBadge => 'GST-ready invoicing';

  @override
  String get regOfflineBadge => 'Offline billing support';

  @override
  String get regSectionAccountDetails => 'Account Details';

  @override
  String get regSectionStoreDetails => 'Store Details';

  @override
  String get regSectionLocation => 'Location';

  @override
  String get regSectionPreferences => 'Preferences';
}
