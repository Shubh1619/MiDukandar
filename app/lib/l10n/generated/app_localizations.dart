import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_en.dart';
import 'app_localizations_hi.dart';
import 'app_localizations_mr.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'generated/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations? of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations);
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('en'),
    Locale('hi'),
    Locale('mr'),
  ];

  /// No description provided for @add.
  ///
  /// In en, this message translates to:
  /// **'Add'**
  String get add;

  /// No description provided for @address.
  ///
  /// In en, this message translates to:
  /// **'Address'**
  String get address;

  /// No description provided for @amount.
  ///
  /// In en, this message translates to:
  /// **'Amount'**
  String get amount;

  /// No description provided for @appTitle.
  ///
  /// In en, this message translates to:
  /// **'Smart Business'**
  String get appTitle;

  /// No description provided for @authChangeEmail.
  ///
  /// In en, this message translates to:
  /// **'Change email'**
  String get authChangeEmail;

  /// No description provided for @authCodeSentNotice.
  ///
  /// In en, this message translates to:
  /// **'Login code sent. Check your email for the verification code.'**
  String get authCodeSentNotice;

  /// No description provided for @authCodeSentTo.
  ///
  /// In en, this message translates to:
  /// **'Login code sent to {email}.'**
  String authCodeSentTo(String email);

  /// No description provided for @authDevMode.
  ///
  /// In en, this message translates to:
  /// **'Dev mode: master code is {masterCode}. No email was sent.'**
  String authDevMode(String masterCode);

  /// No description provided for @authEmail.
  ///
  /// In en, this message translates to:
  /// **'Email address'**
  String get authEmail;

  /// No description provided for @authEnterEmail.
  ///
  /// In en, this message translates to:
  /// **'Enter your email address.'**
  String get authEnterEmail;

  /// No description provided for @authEnterOtp.
  ///
  /// In en, this message translates to:
  /// **'Enter verification code'**
  String get authEnterOtp;

  /// No description provided for @authErrSendOtp.
  ///
  /// In en, this message translates to:
  /// **'Could not send OTP. Please try again.'**
  String get authErrSendOtp;

  /// No description provided for @authErrVerify.
  ///
  /// In en, this message translates to:
  /// **'Verification failed. Please try again.'**
  String get authErrVerify;

  /// No description provided for @authUnableToConnect.
  ///
  /// In en, this message translates to:
  /// **'Unable to connect to MiDukandar. Please check your internet connection and try again.'**
  String get authUnableToConnect;

  /// No description provided for @authServiceUnavailable.
  ///
  /// In en, this message translates to:
  /// **'MiDukandar service is temporarily unavailable. Please try again shortly.'**
  String get authServiceUnavailable;

  /// No description provided for @authConnectionTimeout.
  ///
  /// In en, this message translates to:
  /// **'Connection timed out. Please try again.'**
  String get authConnectionTimeout;

  /// No description provided for @authAccountNotFound.
  ///
  /// In en, this message translates to:
  /// **'Account not found. Please check your email or register your business.'**
  String get authAccountNotFound;

  /// No description provided for @authTryAgain.
  ///
  /// In en, this message translates to:
  /// **'Try Again'**
  String get authTryAgain;

  /// No description provided for @authOtpSent.
  ///
  /// In en, this message translates to:
  /// **'OTP Sent'**
  String get authOtpSent;

  /// No description provided for @authGetOtp.
  ///
  /// In en, this message translates to:
  /// **'Get OTP'**
  String get authGetOtp;

  /// No description provided for @authInvalidEmail.
  ///
  /// In en, this message translates to:
  /// **'Enter a valid email address.'**
  String get authInvalidEmail;

  /// No description provided for @authNoAccount.
  ///
  /// In en, this message translates to:
  /// **'Don\'t have an account?'**
  String get authNoAccount;

  /// No description provided for @authOtpInstructions.
  ///
  /// In en, this message translates to:
  /// **'Type the 6-digit code from your email. The code expires in {time}.'**
  String authOtpInstructions(String time);

  /// No description provided for @authOtpPlaceholder.
  ///
  /// In en, this message translates to:
  /// **'• • • • • •'**
  String get authOtpPlaceholder;

  /// No description provided for @authOtpTooShort.
  ///
  /// In en, this message translates to:
  /// **'Please enter the 4-6 digit code we sent.'**
  String get authOtpTooShort;

  /// No description provided for @authRegisterBusiness.
  ///
  /// In en, this message translates to:
  /// **'Register your business'**
  String get authRegisterBusiness;

  /// No description provided for @authResendCode.
  ///
  /// In en, this message translates to:
  /// **'Resend code'**
  String get authResendCode;

  /// No description provided for @authResendIn.
  ///
  /// In en, this message translates to:
  /// **'Resend code in {time}'**
  String authResendIn(String time);

  /// No description provided for @authSendingOtp.
  ///
  /// In en, this message translates to:
  /// **'Sending OTP...'**
  String get authSendingOtp;

  /// No description provided for @authSignInBadge.
  ///
  /// In en, this message translates to:
  /// **'SIGN IN'**
  String get authSignInBadge;

  /// No description provided for @authSignInSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Sign in to manage your shop and keep your business moving.'**
  String get authSignInSubtitle;

  /// No description provided for @authSigningIn.
  ///
  /// In en, this message translates to:
  /// **'Signing in...'**
  String get authSigningIn;

  /// No description provided for @authVerifyAndSignIn.
  ///
  /// In en, this message translates to:
  /// **'Verify & Sign in'**
  String get authVerifyAndSignIn;

  /// No description provided for @authWelcomeBack.
  ///
  /// In en, this message translates to:
  /// **'Welcome back'**
  String get authWelcomeBack;

  /// No description provided for @back.
  ///
  /// In en, this message translates to:
  /// **'Back'**
  String get back;

  /// No description provided for @billAddInvoice.
  ///
  /// In en, this message translates to:
  /// **'Add invoice'**
  String get billAddInvoice;

  /// No description provided for @billAll.
  ///
  /// In en, this message translates to:
  /// **'All'**
  String get billAll;

  /// No description provided for @billFilter.
  ///
  /// In en, this message translates to:
  /// **'Filter'**
  String get billFilter;

  /// No description provided for @billCreatedFromMobileApp.
  ///
  /// In en, this message translates to:
  /// **'Created from mobile app'**
  String get billCreatedFromMobileApp;

  /// No description provided for @billCustomerLine.
  ///
  /// In en, this message translates to:
  /// **'Customer: {name}'**
  String billCustomerLine(String name);

  /// No description provided for @billCustomerName.
  ///
  /// In en, this message translates to:
  /// **'Customer name'**
  String get billCustomerName;

  /// No description provided for @billDateLine.
  ///
  /// In en, this message translates to:
  /// **'Date: {date}'**
  String billDateLine(String date);

  /// No description provided for @billDue.
  ///
  /// In en, this message translates to:
  /// **'Due'**
  String get billDue;

  /// No description provided for @billDueAmount.
  ///
  /// In en, this message translates to:
  /// **'Due {amount}'**
  String billDueAmount(String amount);

  /// No description provided for @billEditInvoice.
  ///
  /// In en, this message translates to:
  /// **'Edit Invoice'**
  String get billEditInvoice;

  /// No description provided for @billGenericItem.
  ///
  /// In en, this message translates to:
  /// **'Generic item'**
  String get billGenericItem;

  /// No description provided for @billHeldBills.
  ///
  /// In en, this message translates to:
  /// **'Held bills'**
  String get billHeldBills;

  /// No description provided for @billHeldSaved.
  ///
  /// In en, this message translates to:
  /// **'Bill held'**
  String get billHeldSaved;

  /// No description provided for @billHold.
  ///
  /// In en, this message translates to:
  /// **'Hold'**
  String get billHold;

  /// No description provided for @billNoHeldBills.
  ///
  /// In en, this message translates to:
  /// **'No held bills'**
  String get billNoHeldBills;

  /// No description provided for @billResume.
  ///
  /// In en, this message translates to:
  /// **'Resume'**
  String get billResume;

  /// No description provided for @billInvoices.
  ///
  /// In en, this message translates to:
  /// **'Invoices'**
  String get billInvoices;

  /// No description provided for @billLineItem.
  ///
  /// In en, this message translates to:
  /// **'{name} x {qty}'**
  String billLineItem(String name, String qty);

  /// No description provided for @billMobileLine.
  ///
  /// In en, this message translates to:
  /// **'Mobile: {number}'**
  String billMobileLine(String number);

  /// No description provided for @billMode.
  ///
  /// In en, this message translates to:
  /// **'Mode'**
  String get billMode;

  /// No description provided for @billModeBank.
  ///
  /// In en, this message translates to:
  /// **'Bank'**
  String get billModeBank;

  /// No description provided for @billModeCard.
  ///
  /// In en, this message translates to:
  /// **'Card'**
  String get billModeCard;

  /// No description provided for @billModeCash.
  ///
  /// In en, this message translates to:
  /// **'Cash'**
  String get billModeCash;

  /// No description provided for @billModeLine.
  ///
  /// In en, this message translates to:
  /// **'Mode: {mode}'**
  String billModeLine(String mode);

  /// No description provided for @billModeUpi.
  ///
  /// In en, this message translates to:
  /// **'UPI'**
  String get billModeUpi;

  /// No description provided for @billNewInvoice.
  ///
  /// In en, this message translates to:
  /// **'New Invoice'**
  String get billNewInvoice;

  /// No description provided for @billNoLineItems.
  ///
  /// In en, this message translates to:
  /// **'No line items'**
  String get billNoLineItems;

  /// No description provided for @billNoMatchingInvoices.
  ///
  /// In en, this message translates to:
  /// **'No matching invoices'**
  String get billNoMatchingInvoices;

  /// No description provided for @billNoteLine.
  ///
  /// In en, this message translates to:
  /// **'Note: {note}'**
  String billNoteLine(String note);

  /// No description provided for @billPaidAmount.
  ///
  /// In en, this message translates to:
  /// **'Paid amount'**
  String get billPaidAmount;

  /// No description provided for @billPayAmount.
  ///
  /// In en, this message translates to:
  /// **'Pay {amount}'**
  String billPayAmount(String amount);

  /// No description provided for @billQty.
  ///
  /// In en, this message translates to:
  /// **'Qty'**
  String get billQty;

  /// No description provided for @billRevenue.
  ///
  /// In en, this message translates to:
  /// **'Revenue'**
  String get billRevenue;

  /// No description provided for @billSearchPlaceholder.
  ///
  /// In en, this message translates to:
  /// **'Search customer or invoice'**
  String get billSearchPlaceholder;

  /// No description provided for @billUdhaar.
  ///
  /// In en, this message translates to:
  /// **'Udhaar'**
  String get billUdhaar;

  /// No description provided for @billUnitPrice.
  ///
  /// In en, this message translates to:
  /// **'Unit price'**
  String get billUnitPrice;

  /// No description provided for @billWalkInCustomer.
  ///
  /// In en, this message translates to:
  /// **'Walk-in customer'**
  String get billWalkInCustomer;

  /// No description provided for @cancel.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get cancel;

  /// No description provided for @city.
  ///
  /// In en, this message translates to:
  /// **'City'**
  String get city;

  /// No description provided for @close.
  ///
  /// In en, this message translates to:
  /// **'Close'**
  String get close;

  /// No description provided for @confirm.
  ///
  /// In en, this message translates to:
  /// **'Confirm'**
  String get confirm;

  /// No description provided for @custAddTitle.
  ///
  /// In en, this message translates to:
  /// **'Add customer'**
  String get custAddTitle;

  /// No description provided for @custDeleteConfirm.
  ///
  /// In en, this message translates to:
  /// **'Delete \"{name}\"? This cannot be undone.'**
  String custDeleteConfirm(String name);

  /// No description provided for @custDeleteTitle.
  ///
  /// In en, this message translates to:
  /// **'Delete customer'**
  String get custDeleteTitle;

  /// No description provided for @custEditTitle.
  ///
  /// In en, this message translates to:
  /// **'Edit customer'**
  String get custEditTitle;

  /// No description provided for @custNameLabel.
  ///
  /// In en, this message translates to:
  /// **'Customer name'**
  String get custNameLabel;

  /// No description provided for @custNoMobile.
  ///
  /// In en, this message translates to:
  /// **'No mobile'**
  String get custNoMobile;

  /// No description provided for @dashCustomerUdhaari.
  ///
  /// In en, this message translates to:
  /// **'Customer Udhaari'**
  String get dashCustomerUdhaari;

  /// No description provided for @dashCustomerUdhaariSub.
  ///
  /// In en, this message translates to:
  /// **'Total outstanding ledger'**
  String get dashCustomerUdhaariSub;

  /// No description provided for @dashHeaderSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Today\'s performance across {storeName}'**
  String dashHeaderSubtitle(String storeName);

  /// No description provided for @dashLowStock.
  ///
  /// In en, this message translates to:
  /// **'Low Stock'**
  String get dashLowStock;

  /// No description provided for @dashLowStockSub.
  ///
  /// In en, this message translates to:
  /// **'Products below min stock level'**
  String get dashLowStockSub;

  /// No description provided for @dashNoTransactions.
  ///
  /// In en, this message translates to:
  /// **'No transactions yet'**
  String get dashNoTransactions;

  /// No description provided for @dashNoTransactionsSub.
  ///
  /// In en, this message translates to:
  /// **'Create your first sale from the Sales tab.'**
  String get dashNoTransactionsSub;

  /// No description provided for @dashProfitToday.
  ///
  /// In en, this message translates to:
  /// **'Est. Profit Today'**
  String get dashProfitToday;

  /// No description provided for @dashProfitTodaySub.
  ///
  /// In en, this message translates to:
  /// **'Margin before tax today'**
  String get dashProfitTodaySub;

  /// No description provided for @dashPurchasesToday.
  ///
  /// In en, this message translates to:
  /// **'Purchases Today'**
  String get dashPurchasesToday;

  /// No description provided for @dashPurchasesTodaySub.
  ///
  /// In en, this message translates to:
  /// **'Stock purchases today'**
  String get dashPurchasesTodaySub;

  /// No description provided for @dashQuickControls.
  ///
  /// In en, this message translates to:
  /// **'Quick Controls'**
  String get dashQuickControls;

  /// No description provided for @dashQuickInvoices.
  ///
  /// In en, this message translates to:
  /// **'Invoices'**
  String get dashQuickInvoices;

  /// No description provided for @dashQuickReports.
  ///
  /// In en, this message translates to:
  /// **'Reports'**
  String get dashQuickReports;

  /// No description provided for @dashRecentTransactions.
  ///
  /// In en, this message translates to:
  /// **'Recent Transactions'**
  String get dashRecentTransactions;

  /// No description provided for @dashSalesToday.
  ///
  /// In en, this message translates to:
  /// **'Sales Today'**
  String get dashSalesToday;

  /// No description provided for @dashSalesTodaySub.
  ///
  /// In en, this message translates to:
  /// **'Confirmed bills today'**
  String get dashSalesTodaySub;

  /// No description provided for @dashSupplierPayables.
  ///
  /// In en, this message translates to:
  /// **'Supplier Payables'**
  String get dashSupplierPayables;

  /// No description provided for @dashSupplierPayablesSub.
  ///
  /// In en, this message translates to:
  /// **'Due on open purchase invoices'**
  String get dashSupplierPayablesSub;

  /// No description provided for @dashTimeAm.
  ///
  /// In en, this message translates to:
  /// **'AM'**
  String get dashTimeAm;

  /// No description provided for @dashTimePm.
  ///
  /// In en, this message translates to:
  /// **'PM'**
  String get dashTimePm;

  /// No description provided for @dashTitle.
  ///
  /// In en, this message translates to:
  /// **'Dashboard'**
  String get dashTitle;

  /// No description provided for @dashTypePayment.
  ///
  /// In en, this message translates to:
  /// **'Payment'**
  String get dashTypePayment;

  /// No description provided for @dashTypePurchase.
  ///
  /// In en, this message translates to:
  /// **'Purchase'**
  String get dashTypePurchase;

  /// No description provided for @dashTypeSale.
  ///
  /// In en, this message translates to:
  /// **'Sale'**
  String get dashTypeSale;

  /// No description provided for @dashViewAll.
  ///
  /// In en, this message translates to:
  /// **'View all'**
  String get dashViewAll;

  /// No description provided for @date.
  ///
  /// In en, this message translates to:
  /// **'Date'**
  String get date;

  /// No description provided for @delete.
  ///
  /// In en, this message translates to:
  /// **'Delete'**
  String get delete;

  /// No description provided for @done.
  ///
  /// In en, this message translates to:
  /// **'Done'**
  String get done;

  /// No description provided for @edit.
  ///
  /// In en, this message translates to:
  /// **'Edit'**
  String get edit;

  /// No description provided for @errAdjustStock.
  ///
  /// In en, this message translates to:
  /// **'Could not adjust stock: {error}'**
  String errAdjustStock(String error);

  /// No description provided for @errArchiveProduct.
  ///
  /// In en, this message translates to:
  /// **'Could not archive product: {error}'**
  String errArchiveProduct(String error);

  /// No description provided for @errCreateCustomer.
  ///
  /// In en, this message translates to:
  /// **'Could not create customer: {error}'**
  String errCreateCustomer(String error);

  /// No description provided for @errCreateExpense.
  ///
  /// In en, this message translates to:
  /// **'Could not create expense: {error}'**
  String errCreateExpense(String error);

  /// No description provided for @errCreateInvoice.
  ///
  /// In en, this message translates to:
  /// **'Could not create invoice: {error}'**
  String errCreateInvoice(String error);

  /// No description provided for @errCreateProduct.
  ///
  /// In en, this message translates to:
  /// **'Could not create product: {error}'**
  String errCreateProduct(String error);

  /// No description provided for @errCreatePurchase.
  ///
  /// In en, this message translates to:
  /// **'Could not create purchase: {error}'**
  String errCreatePurchase(String error);

  /// No description provided for @errCreateSupplier.
  ///
  /// In en, this message translates to:
  /// **'Could not create supplier: {error}'**
  String errCreateSupplier(String error);

  /// No description provided for @errDeleteCustomer.
  ///
  /// In en, this message translates to:
  /// **'Could not delete customer: {error}'**
  String errDeleteCustomer(String error);

  /// No description provided for @errInviteUser.
  ///
  /// In en, this message translates to:
  /// **'Could not invite user: {error}'**
  String errInviteUser(String error);

  /// No description provided for @errMarkPaid.
  ///
  /// In en, this message translates to:
  /// **'Could not mark invoice paid: {error}'**
  String errMarkPaid(String error);

  /// No description provided for @errRecordPayment.
  ///
  /// In en, this message translates to:
  /// **'Could not record payment: {error}'**
  String errRecordPayment(String error);

  /// No description provided for @errRefreshFailed.
  ///
  /// In en, this message translates to:
  /// **'Refresh failed: {error}'**
  String errRefreshFailed(String error);

  /// No description provided for @errSessionExpired.
  ///
  /// In en, this message translates to:
  /// **'Your session expired. Please sign in again.'**
  String get errSessionExpired;

  /// No description provided for @errUpdateCustomer.
  ///
  /// In en, this message translates to:
  /// **'Could not update customer: {error}'**
  String errUpdateCustomer(String error);

  /// No description provided for @errUpdateProduct.
  ///
  /// In en, this message translates to:
  /// **'Could not update product: {error}'**
  String errUpdateProduct(String error);

  /// No description provided for @expnAddExpense.
  ///
  /// In en, this message translates to:
  /// **'Add expense'**
  String get expnAddExpense;

  /// No description provided for @expnByCategory.
  ///
  /// In en, this message translates to:
  /// **'By category'**
  String get expnByCategory;

  /// No description provided for @expnCategoryOptional.
  ///
  /// In en, this message translates to:
  /// **'Category (optional)'**
  String get expnCategoryOptional;

  /// No description provided for @expnDefaultTitle.
  ///
  /// In en, this message translates to:
  /// **'Expense'**
  String get expnDefaultTitle;

  /// No description provided for @expnExpenseTitle.
  ///
  /// In en, this message translates to:
  /// **'Expense title'**
  String get expnExpenseTitle;

  /// No description provided for @expnGeneral.
  ///
  /// In en, this message translates to:
  /// **'General'**
  String get expnGeneral;

  /// No description provided for @expnLastMonth.
  ///
  /// In en, this message translates to:
  /// **'Last month'**
  String get expnLastMonth;

  /// No description provided for @expnNoExpenses.
  ///
  /// In en, this message translates to:
  /// **'No expenses yet'**
  String get expnNoExpenses;

  /// No description provided for @expnNoteFromApp.
  ///
  /// In en, this message translates to:
  /// **'Created from mobile app'**
  String get expnNoteFromApp;

  /// No description provided for @expnOther.
  ///
  /// In en, this message translates to:
  /// **'Other'**
  String get expnOther;

  /// No description provided for @expnPaymentBank.
  ///
  /// In en, this message translates to:
  /// **'Bank'**
  String get expnPaymentBank;

  /// No description provided for @expnPaymentCard.
  ///
  /// In en, this message translates to:
  /// **'Card'**
  String get expnPaymentCard;

  /// No description provided for @expnPaymentCash.
  ///
  /// In en, this message translates to:
  /// **'Cash'**
  String get expnPaymentCash;

  /// No description provided for @expnPaymentMode.
  ///
  /// In en, this message translates to:
  /// **'Payment mode'**
  String get expnPaymentMode;

  /// No description provided for @expnPaymentUpi.
  ///
  /// In en, this message translates to:
  /// **'UPI'**
  String get expnPaymentUpi;

  /// No description provided for @expnThisMonth.
  ///
  /// In en, this message translates to:
  /// **'This month'**
  String get expnThisMonth;

  /// No description provided for @invnAddPlus.
  ///
  /// In en, this message translates to:
  /// **'Add (+)'**
  String get invnAddPlus;

  /// No description provided for @invnAdjustFailed.
  ///
  /// In en, this message translates to:
  /// **'Adjust failed: {error}'**
  String invnAdjustFailed(String error);

  /// No description provided for @invnAdjustStockTitle.
  ///
  /// In en, this message translates to:
  /// **'Adjust stock — {product}'**
  String invnAdjustStockTitle(String product);

  /// No description provided for @invnAll.
  ///
  /// In en, this message translates to:
  /// **'All'**
  String get invnAll;

  /// No description provided for @invnBal.
  ///
  /// In en, this message translates to:
  /// **'bal'**
  String get invnBal;

  /// No description provided for @invnCurrentBalance.
  ///
  /// In en, this message translates to:
  /// **'Current balance: {value}'**
  String invnCurrentBalance(String value);

  /// No description provided for @invnGeneral.
  ///
  /// In en, this message translates to:
  /// **'General'**
  String get invnGeneral;

  /// No description provided for @invnHeaderSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Live stock from the movement ledger'**
  String get invnHeaderSubtitle;

  /// No description provided for @invnLoadError.
  ///
  /// In en, this message translates to:
  /// **'Could not load inventory'**
  String get invnLoadError;

  /// No description provided for @invnLowOnly.
  ///
  /// In en, this message translates to:
  /// **'Low only'**
  String get invnLowOnly;

  /// No description provided for @invnLowStock.
  ///
  /// In en, this message translates to:
  /// **'Low stock'**
  String get invnLowStock;

  /// No description provided for @invnManualAdjustment.
  ///
  /// In en, this message translates to:
  /// **'Manual adjustment'**
  String get invnManualAdjustment;

  /// No description provided for @invnMovements.
  ///
  /// In en, this message translates to:
  /// **'Movements'**
  String get invnMovements;

  /// No description provided for @invnMovementsSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Append-only movement ledger'**
  String get invnMovementsSubtitle;

  /// No description provided for @invnMovementsTitle.
  ///
  /// In en, this message translates to:
  /// **'Stock Movements'**
  String get invnMovementsTitle;

  /// No description provided for @invnMrp.
  ///
  /// In en, this message translates to:
  /// **'MRP {price}'**
  String invnMrp(String price);

  /// No description provided for @invnNoMovements.
  ///
  /// In en, this message translates to:
  /// **'No movements yet'**
  String get invnNoMovements;

  /// No description provided for @invnNoMovementsSub.
  ///
  /// In en, this message translates to:
  /// **'Sales, purchases and adjustments will appear here.'**
  String get invnNoMovementsSub;

  /// No description provided for @invnNoSku.
  ///
  /// In en, this message translates to:
  /// **'no SKU'**
  String get invnNoSku;

  /// No description provided for @invnNoStock.
  ///
  /// In en, this message translates to:
  /// **'No stock found'**
  String get invnNoStock;

  /// No description provided for @invnNoStockSub.
  ///
  /// In en, this message translates to:
  /// **'Add products or adjust stock to get started.'**
  String get invnNoStockSub;

  /// No description provided for @invnQuantity.
  ///
  /// In en, this message translates to:
  /// **'Quantity'**
  String get invnQuantity;

  /// No description provided for @invnReason.
  ///
  /// In en, this message translates to:
  /// **'Reason'**
  String get invnReason;

  /// No description provided for @invnRemoveMinus.
  ///
  /// In en, this message translates to:
  /// **'Remove (−)'**
  String get invnRemoveMinus;

  /// No description provided for @invnSearchHint.
  ///
  /// In en, this message translates to:
  /// **'Search products...'**
  String get invnSearchHint;

  /// No description provided for @invnStockUpdated.
  ///
  /// In en, this message translates to:
  /// **'Stock updated'**
  String get invnStockUpdated;

  /// No description provided for @invnValueLabel.
  ///
  /// In en, this message translates to:
  /// **'Inventory value'**
  String get invnValueLabel;

  /// No description provided for @loading.
  ///
  /// In en, this message translates to:
  /// **'Loading...'**
  String get loading;

  /// No description provided for @mobile.
  ///
  /// In en, this message translates to:
  /// **'Mobile'**
  String get mobile;

  /// No description provided for @moreExpenses.
  ///
  /// In en, this message translates to:
  /// **'Expenses'**
  String get moreExpenses;

  /// No description provided for @moreExpensesSub.
  ///
  /// In en, this message translates to:
  /// **'Register & category breakdown'**
  String get moreExpensesSub;

  /// No description provided for @moreInventory.
  ///
  /// In en, this message translates to:
  /// **'Inventory'**
  String get moreInventory;

  /// No description provided for @moreInventorySub.
  ///
  /// In en, this message translates to:
  /// **'Stock levels, low stock & movements'**
  String get moreInventorySub;

  /// No description provided for @morePayments.
  ///
  /// In en, this message translates to:
  /// **'Payments'**
  String get morePayments;

  /// No description provided for @morePaymentsSub.
  ///
  /// In en, this message translates to:
  /// **'Customer receipts history'**
  String get morePaymentsSub;

  /// No description provided for @morePurchases.
  ///
  /// In en, this message translates to:
  /// **'Purchases'**
  String get morePurchases;

  /// No description provided for @morePurchasesSub.
  ///
  /// In en, this message translates to:
  /// **'Purchase register & payments'**
  String get morePurchasesSub;

  /// No description provided for @moreReports.
  ///
  /// In en, this message translates to:
  /// **'GST & Reports'**
  String get moreReports;

  /// No description provided for @moreReportsSub.
  ///
  /// In en, this message translates to:
  /// **'Sales, purchases, P&L and GST'**
  String get moreReportsSub;

  /// No description provided for @moreSettings.
  ///
  /// In en, this message translates to:
  /// **'Settings'**
  String get moreSettings;

  /// No description provided for @moreSettingsSub.
  ///
  /// In en, this message translates to:
  /// **'Store profile & language'**
  String get moreSettingsSub;

  /// No description provided for @moreSignOut.
  ///
  /// In en, this message translates to:
  /// **'Sign out'**
  String get moreSignOut;

  /// No description provided for @moreSignOutSub.
  ///
  /// In en, this message translates to:
  /// **'End this session'**
  String get moreSignOutSub;

  /// No description provided for @moreSubtitle.
  ///
  /// In en, this message translates to:
  /// **'All services'**
  String get moreSubtitle;

  /// No description provided for @moreSuppliers.
  ///
  /// In en, this message translates to:
  /// **'Suppliers'**
  String get moreSuppliers;

  /// No description provided for @moreSuppliersSub.
  ///
  /// In en, this message translates to:
  /// **'Vendors, due payments & details'**
  String get moreSuppliersSub;

  /// No description provided for @moreTitle.
  ///
  /// In en, this message translates to:
  /// **'More'**
  String get moreTitle;

  /// No description provided for @moreUsers.
  ///
  /// In en, this message translates to:
  /// **'Users & Roles'**
  String get moreUsers;

  /// No description provided for @moreUsersSub.
  ///
  /// In en, this message translates to:
  /// **'Team members & invites'**
  String get moreUsersSub;

  /// No description provided for @myStore.
  ///
  /// In en, this message translates to:
  /// **'My Store'**
  String get myStore;

  /// No description provided for @name.
  ///
  /// In en, this message translates to:
  /// **'Name'**
  String get name;

  /// No description provided for @no.
  ///
  /// In en, this message translates to:
  /// **'No'**
  String get no;

  /// No description provided for @ok.
  ///
  /// In en, this message translates to:
  /// **'OK'**
  String get ok;

  /// No description provided for @paymEmpty.
  ///
  /// In en, this message translates to:
  /// **'No payments yet'**
  String get paymEmpty;

  /// No description provided for @paymPayment.
  ///
  /// In en, this message translates to:
  /// **'Payment'**
  String get paymPayment;

  /// No description provided for @paymReference.
  ///
  /// In en, this message translates to:
  /// **'{type} #{id}'**
  String paymReference(String type, String id);

  /// No description provided for @phone.
  ///
  /// In en, this message translates to:
  /// **'Phone'**
  String get phone;

  /// No description provided for @pincode.
  ///
  /// In en, this message translates to:
  /// **'Pincode'**
  String get pincode;

  /// No description provided for @pleaseWait.
  ///
  /// In en, this message translates to:
  /// **'Please wait...'**
  String get pleaseWait;

  /// No description provided for @prodAbbrevCrore.
  ///
  /// In en, this message translates to:
  /// **'Cr'**
  String get prodAbbrevCrore;

  /// No description provided for @prodAbbrevLakh.
  ///
  /// In en, this message translates to:
  /// **'L'**
  String get prodAbbrevLakh;

  /// No description provided for @prodAbbrevThousand.
  ///
  /// In en, this message translates to:
  /// **'k'**
  String get prodAbbrevThousand;

  /// No description provided for @prodActionsTitle.
  ///
  /// In en, this message translates to:
  /// **'Product actions'**
  String get prodActionsTitle;

  /// No description provided for @prodAddLabel.
  ///
  /// In en, this message translates to:
  /// **'Add (+)'**
  String get prodAddLabel;

  /// No description provided for @prodAddTitle.
  ///
  /// In en, this message translates to:
  /// **'Add product'**
  String get prodAddTitle;

  /// No description provided for @prodAdjustStock.
  ///
  /// In en, this message translates to:
  /// **'Adjust stock'**
  String get prodAdjustStock;

  /// No description provided for @prodAdjustStockTitle.
  ///
  /// In en, this message translates to:
  /// **'Adjust stock · {productName}'**
  String prodAdjustStockTitle(String productName);

  /// No description provided for @prodAll.
  ///
  /// In en, this message translates to:
  /// **'All'**
  String get prodAll;

  /// No description provided for @prodApply.
  ///
  /// In en, this message translates to:
  /// **'Apply'**
  String get prodApply;

  /// No description provided for @prodArchive.
  ///
  /// In en, this message translates to:
  /// **'Archive'**
  String get prodArchive;

  /// No description provided for @prodArchiveConfirmTitle.
  ///
  /// In en, this message translates to:
  /// **'Archive product?'**
  String get prodArchiveConfirmTitle;

  /// No description provided for @prodArchiveMessage.
  ///
  /// In en, this message translates to:
  /// **'\"{productName}\" will be hidden from sales and listings. Movements are kept for records.'**
  String prodArchiveMessage(String productName);

  /// No description provided for @prodArchiveProduct.
  ///
  /// In en, this message translates to:
  /// **'Archive product'**
  String get prodArchiveProduct;

  /// No description provided for @prodCategory.
  ///
  /// In en, this message translates to:
  /// **'Category'**
  String get prodCategory;

  /// No description provided for @prodCurrently.
  ///
  /// In en, this message translates to:
  /// **'Currently: {stock} {unit}'**
  String prodCurrently(String stock, String unit);

  /// No description provided for @prodEditProduct.
  ///
  /// In en, this message translates to:
  /// **'Edit product'**
  String get prodEditProduct;

  /// No description provided for @prodEmptySubtitle.
  ///
  /// In en, this message translates to:
  /// **'Try a different search or add a new product.'**
  String get prodEmptySubtitle;

  /// No description provided for @prodEmptyTitle.
  ///
  /// In en, this message translates to:
  /// **'No products found'**
  String get prodEmptyTitle;

  /// No description provided for @prodGeneral.
  ///
  /// In en, this message translates to:
  /// **'General'**
  String get prodGeneral;

  /// No description provided for @prodGstPercent.
  ///
  /// In en, this message translates to:
  /// **'GST %'**
  String get prodGstPercent;

  /// No description provided for @prodLowQty.
  ///
  /// In en, this message translates to:
  /// **'LOW · {qty}'**
  String prodLowQty(String qty);

  /// No description provided for @prodManualAdjustment.
  ///
  /// In en, this message translates to:
  /// **'Manual adjustment'**
  String get prodManualAdjustment;

  /// No description provided for @prodMinStock.
  ///
  /// In en, this message translates to:
  /// **'Min stock'**
  String get prodMinStock;

  /// No description provided for @prodNoMovements.
  ///
  /// In en, this message translates to:
  /// **'No movements recorded yet'**
  String get prodNoMovements;

  /// No description provided for @prodOpeningStock.
  ///
  /// In en, this message translates to:
  /// **'Opening stock'**
  String get prodOpeningStock;

  /// No description provided for @prodProductMeta.
  ///
  /// In en, this message translates to:
  /// **'{category} · {unit}'**
  String prodProductMeta(String category, String unit);

  /// No description provided for @prodProductMetaSku.
  ///
  /// In en, this message translates to:
  /// **'{category} · {unit} · SKU {sku}'**
  String prodProductMetaSku(String category, String unit, String sku);

  /// No description provided for @prodProductName.
  ///
  /// In en, this message translates to:
  /// **'Product name'**
  String get prodProductName;

  /// No description provided for @prodPurchase.
  ///
  /// In en, this message translates to:
  /// **'Purchase'**
  String get prodPurchase;

  /// No description provided for @prodPurchasePrice.
  ///
  /// In en, this message translates to:
  /// **'Purchase price'**
  String get prodPurchasePrice;

  /// No description provided for @prodQuantity.
  ///
  /// In en, this message translates to:
  /// **'Quantity'**
  String get prodQuantity;

  /// No description provided for @prodReason.
  ///
  /// In en, this message translates to:
  /// **'Reason'**
  String get prodReason;

  /// No description provided for @prodRemoveLabel.
  ///
  /// In en, this message translates to:
  /// **'Remove (−)'**
  String get prodRemoveLabel;

  /// No description provided for @prodSearchHint.
  ///
  /// In en, this message translates to:
  /// **'Search by name, SKU or barcode...'**
  String get prodSearchHint;

  /// No description provided for @prodSelling.
  ///
  /// In en, this message translates to:
  /// **'Selling'**
  String get prodSelling;

  /// No description provided for @prodSellingPrice.
  ///
  /// In en, this message translates to:
  /// **'Selling price'**
  String get prodSellingPrice;

  /// No description provided for @prodStockMovements.
  ///
  /// In en, this message translates to:
  /// **'Stock movements'**
  String get prodStockMovements;

  /// No description provided for @prodStockQty.
  ///
  /// In en, this message translates to:
  /// **'{qty} in stock'**
  String prodStockQty(String qty);

  /// No description provided for @prodSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Catalog, pricing and stock'**
  String get prodSubtitle;

  /// No description provided for @prodTitle.
  ///
  /// In en, this message translates to:
  /// **'Products'**
  String get prodTitle;

  /// No description provided for @prodUnit.
  ///
  /// In en, this message translates to:
  /// **'Unit'**
  String get prodUnit;

  /// No description provided for @prodValue.
  ///
  /// In en, this message translates to:
  /// **'Value'**
  String get prodValue;

  /// No description provided for @purchAddPurchase.
  ///
  /// In en, this message translates to:
  /// **'Add purchase'**
  String get purchAddPurchase;

  /// No description provided for @purchDueAmount.
  ///
  /// In en, this message translates to:
  /// **'Due: {amount}'**
  String purchDueAmount(String amount);

  /// No description provided for @purchFromMobileApp.
  ///
  /// In en, this message translates to:
  /// **'Created from mobile app'**
  String get purchFromMobileApp;

  /// No description provided for @purchNoPurchasesYet.
  ///
  /// In en, this message translates to:
  /// **'No purchases yet'**
  String get purchNoPurchasesYet;

  /// No description provided for @purchPurchaseItem.
  ///
  /// In en, this message translates to:
  /// **'Purchase item'**
  String get purchPurchaseItem;

  /// No description provided for @purchSupplierName.
  ///
  /// In en, this message translates to:
  /// **'Supplier name'**
  String get purchSupplierName;

  /// No description provided for @purchTotalAmount.
  ///
  /// In en, this message translates to:
  /// **'Total amount'**
  String get purchTotalAmount;

  /// No description provided for @purchTotalBilled.
  ///
  /// In en, this message translates to:
  /// **'Total billed'**
  String get purchTotalBilled;

  /// No description provided for @purchUnknownSupplier.
  ///
  /// In en, this message translates to:
  /// **'Unknown supplier'**
  String get purchUnknownSupplier;

  /// No description provided for @refresh.
  ///
  /// In en, this message translates to:
  /// **'Refresh'**
  String get refresh;

  /// No description provided for @reptBills.
  ///
  /// In en, this message translates to:
  /// **'Bills'**
  String get reptBills;

  /// No description provided for @reptEstProfit.
  ///
  /// In en, this message translates to:
  /// **'Est. Profit'**
  String get reptEstProfit;

  /// No description provided for @reptEstimatedProfit.
  ///
  /// In en, this message translates to:
  /// **'Estimated Profit'**
  String get reptEstimatedProfit;

  /// No description provided for @reptGstSummary.
  ///
  /// In en, this message translates to:
  /// **'GST Summary'**
  String get reptGstSummary;

  /// No description provided for @reptInputGst.
  ///
  /// In en, this message translates to:
  /// **'Input GST (purchases)'**
  String get reptInputGst;

  /// No description provided for @reptInventoryValue.
  ///
  /// In en, this message translates to:
  /// **'Inventory Value (cost)'**
  String get reptInventoryValue;

  /// No description provided for @reptInvoices.
  ///
  /// In en, this message translates to:
  /// **'Invoices'**
  String get reptInvoices;

  /// No description provided for @reptLessTotalPurchases.
  ///
  /// In en, this message translates to:
  /// **'Less: Total Purchases'**
  String get reptLessTotalPurchases;

  /// No description provided for @reptNetGstPayable.
  ///
  /// In en, this message translates to:
  /// **'Net GST Payable'**
  String get reptNetGstPayable;

  /// No description provided for @reptNoChartData.
  ///
  /// In en, this message translates to:
  /// **'No data yet for chart'**
  String get reptNoChartData;

  /// No description provided for @reptNoSalesRows.
  ///
  /// In en, this message translates to:
  /// **'No sales rows yet'**
  String get reptNoSalesRows;

  /// No description provided for @reptOutputGst.
  ///
  /// In en, this message translates to:
  /// **'Output GST (sales)'**
  String get reptOutputGst;

  /// No description provided for @reptProfitLossPeriod.
  ///
  /// In en, this message translates to:
  /// **'Profit & Loss (period)'**
  String get reptProfitLossPeriod;

  /// No description provided for @reptRecentSalesRows.
  ///
  /// In en, this message translates to:
  /// **'Recent sales rows'**
  String get reptRecentSalesRows;

  /// No description provided for @reptSales.
  ///
  /// In en, this message translates to:
  /// **'Sales'**
  String get reptSales;

  /// No description provided for @reptSalesVsPurchasesPeriod.
  ///
  /// In en, this message translates to:
  /// **'Sales vs Purchases (period)'**
  String get reptSalesVsPurchasesPeriod;

  /// No description provided for @reptTitle.
  ///
  /// In en, this message translates to:
  /// **'Reports'**
  String get reptTitle;

  /// No description provided for @reptTotalSales.
  ///
  /// In en, this message translates to:
  /// **'Total Sales'**
  String get reptTotalSales;

  /// No description provided for @reptCogs.
  ///
  /// In en, this message translates to:
  /// **'COGS (cost of goods sold)'**
  String get reptCogs;

  /// No description provided for @reptGrossMargin.
  ///
  /// In en, this message translates to:
  /// **'Gross Margin'**
  String get reptGrossMargin;

  /// No description provided for @reptGrossProfit.
  ///
  /// In en, this message translates to:
  /// **'Gross Profit'**
  String get reptGrossProfit;

  /// No description provided for @reptGstBreakup.
  ///
  /// In en, this message translates to:
  /// **'GST Rate Breakup'**
  String get reptGstBreakup;

  /// No description provided for @reptNetMargin.
  ///
  /// In en, this message translates to:
  /// **'Net Margin'**
  String get reptNetMargin;

  /// No description provided for @reptNetProfit.
  ///
  /// In en, this message translates to:
  /// **'Net Profit'**
  String get reptNetProfit;

  /// No description provided for @reptNoData.
  ///
  /// In en, this message translates to:
  /// **'No data for this period'**
  String get reptNoData;

  /// No description provided for @reptRate.
  ///
  /// In en, this message translates to:
  /// **'Rate'**
  String get reptRate;

  /// No description provided for @reptRealPnl.
  ///
  /// In en, this message translates to:
  /// **'Profit & Loss (actual)'**
  String get reptRealPnl;

  /// No description provided for @reptRevenue.
  ///
  /// In en, this message translates to:
  /// **'Revenue'**
  String get reptRevenue;

  /// No description provided for @reptTax.
  ///
  /// In en, this message translates to:
  /// **'Tax'**
  String get reptTax;

  /// No description provided for @reptTaxable.
  ///
  /// In en, this message translates to:
  /// **'Taxable'**
  String get reptTaxable;

  /// No description provided for @required.
  ///
  /// In en, this message translates to:
  /// **'Required'**
  String get required;

  /// No description provided for @retry.
  ///
  /// In en, this message translates to:
  /// **'Try again'**
  String get retry;

  /// No description provided for @referTitle.
  ///
  /// In en, this message translates to:
  /// **'Refer & Earn'**
  String get referTitle;

  /// No description provided for @referYourCode.
  ///
  /// In en, this message translates to:
  /// **'Your referral code'**
  String get referYourCode;

  /// No description provided for @referCopy.
  ///
  /// In en, this message translates to:
  /// **'Copy code'**
  String get referCopy;

  /// No description provided for @referCopied.
  ///
  /// In en, this message translates to:
  /// **'Referral code copied'**
  String get referCopied;

  /// No description provided for @referOnlyOwner.
  ///
  /// In en, this message translates to:
  /// **'Only the shop owner can view referrals'**
  String get referOnlyOwner;

  /// No description provided for @referReferred.
  ///
  /// In en, this message translates to:
  /// **'Referred shops'**
  String get referReferred;

  /// No description provided for @save.
  ///
  /// In en, this message translates to:
  /// **'Save'**
  String get save;

  /// No description provided for @searchHint.
  ///
  /// In en, this message translates to:
  /// **'Search...'**
  String get searchHint;

  /// No description provided for @sectionExpenses.
  ///
  /// In en, this message translates to:
  /// **'Expenses'**
  String get sectionExpenses;

  /// No description provided for @sectionInventory.
  ///
  /// In en, this message translates to:
  /// **'Inventory'**
  String get sectionInventory;

  /// No description provided for @sectionPayments.
  ///
  /// In en, this message translates to:
  /// **'Payments'**
  String get sectionPayments;

  /// No description provided for @sectionProducts.
  ///
  /// In en, this message translates to:
  /// **'Products'**
  String get sectionProducts;

  /// No description provided for @sectionPurchases.
  ///
  /// In en, this message translates to:
  /// **'Purchases'**
  String get sectionPurchases;

  /// No description provided for @sectionReports.
  ///
  /// In en, this message translates to:
  /// **'GST & Reports'**
  String get sectionReports;

  /// No description provided for @sectionSettings.
  ///
  /// In en, this message translates to:
  /// **'Settings'**
  String get sectionSettings;

  /// No description provided for @sectionSuppliers.
  ///
  /// In en, this message translates to:
  /// **'Suppliers'**
  String get sectionSuppliers;

  /// No description provided for @sectionSupplierInvoices.
  ///
  /// In en, this message translates to:
  /// **'Supplier Invoices'**
  String get sectionSupplierInvoices;

  /// No description provided for @sectionUdhaari.
  ///
  /// In en, this message translates to:
  /// **'Udhaari'**
  String get sectionUdhaari;

  /// No description provided for @sectionUsers.
  ///
  /// In en, this message translates to:
  /// **'Users & Roles'**
  String get sectionUsers;

  /// No description provided for @settingsAddressSection.
  ///
  /// In en, this message translates to:
  /// **'Address'**
  String get settingsAddressSection;

  /// No description provided for @settingsAppLanguage.
  ///
  /// In en, this message translates to:
  /// **'App language'**
  String get settingsAppLanguage;

  /// No description provided for @settingsBusinessName.
  ///
  /// In en, this message translates to:
  /// **'Business name'**
  String get settingsBusinessName;

  /// No description provided for @settingsBusinessType.
  ///
  /// In en, this message translates to:
  /// **'Business type (e.g. Grocery, Pharmacy)'**
  String get settingsBusinessType;

  /// No description provided for @settingsGstin.
  ///
  /// In en, this message translates to:
  /// **'GSTIN'**
  String get settingsGstin;

  /// No description provided for @settingsInvoicePrefix.
  ///
  /// In en, this message translates to:
  /// **'Invoice prefix'**
  String get settingsInvoicePrefix;

  /// No description provided for @settingsLanguageSection.
  ///
  /// In en, this message translates to:
  /// **'Language'**
  String get settingsLanguageSection;

  /// No description provided for @settingsSave.
  ///
  /// In en, this message translates to:
  /// **'Save settings'**
  String get settingsSave;

  /// No description provided for @settingsSaveFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not save settings: {error}'**
  String settingsSaveFailed(String error);

  /// No description provided for @settingsSaved.
  ///
  /// In en, this message translates to:
  /// **'Settings saved'**
  String get settingsSaved;

  /// No description provided for @settingsSaving.
  ///
  /// In en, this message translates to:
  /// **'Saving...'**
  String get settingsSaving;

  /// No description provided for @settingsStoreProfile.
  ///
  /// In en, this message translates to:
  /// **'Store profile'**
  String get settingsStoreProfile;

  /// No description provided for @settingsSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Store profile and preferences'**
  String get settingsSubtitle;

  /// No description provided for @settingsTitle.
  ///
  /// In en, this message translates to:
  /// **'Settings'**
  String get settingsTitle;

  /// No description provided for @signOut.
  ///
  /// In en, this message translates to:
  /// **'Sign out'**
  String get signOut;

  /// No description provided for @signedInAs.
  ///
  /// In en, this message translates to:
  /// **'Signed in as {email}'**
  String signedInAs(String email);

  /// No description provided for @smsSectionTitle.
  ///
  /// In en, this message translates to:
  /// **'Udhaari SMS'**
  String get smsSectionTitle;

  /// No description provided for @smsSectionSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Text the customer when a udhaari entry is created or a payment is received, so they always know what they owe.'**
  String get smsSectionSubtitle;

  /// No description provided for @smsLogOnly.
  ///
  /// In en, this message translates to:
  /// **'Log only'**
  String get smsLogOnly;

  /// No description provided for @smsDeviceMode.
  ///
  /// In en, this message translates to:
  /// **'Phone SIM'**
  String get smsDeviceMode;

  /// No description provided for @smsTodayFree.
  ///
  /// In en, this message translates to:
  /// **'Today\'s free SMS'**
  String get smsTodayFree;

  /// No description provided for @smsUsageCount.
  ///
  /// In en, this message translates to:
  /// **'{used} / {limit} used · {remaining} left'**
  String smsUsageCount(String used, String limit, String remaining);

  /// No description provided for @smsResetNote.
  ///
  /// In en, this message translates to:
  /// **'Resets at midnight IST. Once the daily allowance is used, further udhaari messages are not sent.'**
  String get smsResetNote;

  /// No description provided for @smsDeviceNote.
  ///
  /// In en, this message translates to:
  /// **'Sent from this phone\'s SIM. Entries created or payments recorded on another device or on the web are not texted.'**
  String get smsDeviceNote;

  /// No description provided for @smsChooseSimTitle.
  ///
  /// In en, this message translates to:
  /// **'Which SIM should send the SMS?'**
  String get smsChooseSimTitle;

  /// No description provided for @smsChooseSimBody.
  ///
  /// In en, this message translates to:
  /// **'Pick the SIM that has SMS recharge. This phone remembers it for udhaari messages.'**
  String get smsChooseSimBody;

  /// No description provided for @smsSimSlot.
  ///
  /// In en, this message translates to:
  /// **'SIM {slot}'**
  String smsSimSlot(int slot);

  /// No description provided for @smsRecentTitle.
  ///
  /// In en, this message translates to:
  /// **'Recent messages'**
  String get smsRecentTitle;

  /// No description provided for @smsEmpty.
  ///
  /// In en, this message translates to:
  /// **'No SMS sent yet'**
  String get smsEmpty;

  /// No description provided for @smsManagerOnly.
  ///
  /// In en, this message translates to:
  /// **'Only the owner or a manager can change this setting.'**
  String get smsManagerOnly;

  /// No description provided for @smsLoadFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not load SMS usage.'**
  String get smsLoadFailed;

  /// No description provided for @smsEnabledToast.
  ///
  /// In en, this message translates to:
  /// **'Udhaari SMS enabled'**
  String get smsEnabledToast;

  /// No description provided for @smsDisabledToast.
  ///
  /// In en, this message translates to:
  /// **'Udhaari SMS disabled'**
  String get smsDisabledToast;

  /// No description provided for @smsUpdateFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not update SMS settings: {error}'**
  String smsUpdateFailed(String error);

  /// No description provided for @smsStatusQueued.
  ///
  /// In en, this message translates to:
  /// **'Queued'**
  String get smsStatusQueued;

  /// No description provided for @smsStatusSending.
  ///
  /// In en, this message translates to:
  /// **'Sending'**
  String get smsStatusSending;

  /// No description provided for @smsStatusFailed.
  ///
  /// In en, this message translates to:
  /// **'Failed'**
  String get smsStatusFailed;

  /// No description provided for @smsStatusHandedOff.
  ///
  /// In en, this message translates to:
  /// **'Sent from SMS app'**
  String get smsStatusHandedOff;

  /// No description provided for @smsStatusSkippedQuota.
  ///
  /// In en, this message translates to:
  /// **'Daily limit reached'**
  String get smsStatusSkippedQuota;

  /// No description provided for @smsStatusSkippedNoMobile.
  ///
  /// In en, this message translates to:
  /// **'No mobile number'**
  String get smsStatusSkippedNoMobile;

  /// No description provided for @smsStatusSkippedOptOut.
  ///
  /// In en, this message translates to:
  /// **'Opted out'**
  String get smsStatusSkippedOptOut;

  /// No description provided for @smsStatusSkippedDisabled.
  ///
  /// In en, this message translates to:
  /// **'SMS turned off'**
  String get smsStatusSkippedDisabled;

  /// No description provided for @state.
  ///
  /// In en, this message translates to:
  /// **'State'**
  String get state;

  /// No description provided for @status.
  ///
  /// In en, this message translates to:
  /// **'Status'**
  String get status;

  /// No description provided for @statusActive.
  ///
  /// In en, this message translates to:
  /// **'Active'**
  String get statusActive;

  /// No description provided for @statusCancelled.
  ///
  /// In en, this message translates to:
  /// **'Cancelled'**
  String get statusCancelled;

  /// No description provided for @statusClosed.
  ///
  /// In en, this message translates to:
  /// **'Closed'**
  String get statusClosed;

  /// No description provided for @statusCompleted.
  ///
  /// In en, this message translates to:
  /// **'Completed'**
  String get statusCompleted;

  /// No description provided for @statusDelivered.
  ///
  /// In en, this message translates to:
  /// **'Delivered'**
  String get statusDelivered;

  /// No description provided for @statusDraft.
  ///
  /// In en, this message translates to:
  /// **'Draft'**
  String get statusDraft;

  /// No description provided for @statusInStock.
  ///
  /// In en, this message translates to:
  /// **'In stock'**
  String get statusInStock;

  /// No description provided for @statusInactive.
  ///
  /// In en, this message translates to:
  /// **'Inactive'**
  String get statusInactive;

  /// No description provided for @statusLow.
  ///
  /// In en, this message translates to:
  /// **'Low'**
  String get statusLow;

  /// No description provided for @statusOpen.
  ///
  /// In en, this message translates to:
  /// **'Open'**
  String get statusOpen;

  /// No description provided for @statusOutOfStock.
  ///
  /// In en, this message translates to:
  /// **'Out of stock'**
  String get statusOutOfStock;

  /// No description provided for @statusOutstanding.
  ///
  /// In en, this message translates to:
  /// **'Outstanding'**
  String get statusOutstanding;

  /// No description provided for @statusOverdue.
  ///
  /// In en, this message translates to:
  /// **'Overdue'**
  String get statusOverdue;

  /// No description provided for @statusPaid.
  ///
  /// In en, this message translates to:
  /// **'Paid'**
  String get statusPaid;

  /// No description provided for @statusPartial.
  ///
  /// In en, this message translates to:
  /// **'Partial'**
  String get statusPartial;

  /// No description provided for @statusPending.
  ///
  /// In en, this message translates to:
  /// **'Pending'**
  String get statusPending;

  /// No description provided for @statusReceived.
  ///
  /// In en, this message translates to:
  /// **'Received'**
  String get statusReceived;

  /// No description provided for @statusSent.
  ///
  /// In en, this message translates to:
  /// **'Sent'**
  String get statusSent;

  /// No description provided for @statusSettled.
  ///
  /// In en, this message translates to:
  /// **'Settled'**
  String get statusSettled;

  /// No description provided for @statusUnpaid.
  ///
  /// In en, this message translates to:
  /// **'Unpaid'**
  String get statusUnpaid;

  /// No description provided for @statusVoid.
  ///
  /// In en, this message translates to:
  /// **'Void'**
  String get statusVoid;

  /// No description provided for @suppAcrossOpenAccounts.
  ///
  /// In en, this message translates to:
  /// **'Across {count} open accounts'**
  String suppAcrossOpenAccounts(String count);

  /// No description provided for @suppAddSupplier.
  ///
  /// In en, this message translates to:
  /// **'Add supplier'**
  String get suppAddSupplier;

  /// No description provided for @suppAddressOptional.
  ///
  /// In en, this message translates to:
  /// **'Address (optional)'**
  String get suppAddressOptional;

  /// No description provided for @suppEmailOptional.
  ///
  /// In en, this message translates to:
  /// **'Email (optional)'**
  String get suppEmailOptional;

  /// No description provided for @suppGstinOptional.
  ///
  /// In en, this message translates to:
  /// **'GSTIN (optional)'**
  String get suppGstinOptional;

  /// No description provided for @suppLastDate.
  ///
  /// In en, this message translates to:
  /// **'Last: {date}'**
  String suppLastDate(String date);

  /// No description provided for @suppNoSuppliers.
  ///
  /// In en, this message translates to:
  /// **'No suppliers yet'**
  String get suppNoSuppliers;

  /// No description provided for @suppNoSuppliersSub.
  ///
  /// In en, this message translates to:
  /// **'Add your first supplier to track purchases and dues.'**
  String get suppNoSuppliersSub;

  /// No description provided for @suppPayableAmount.
  ///
  /// In en, this message translates to:
  /// **'Payable: {amount}'**
  String suppPayableAmount(String amount);

  /// No description provided for @suppPurchasesAmount.
  ///
  /// In en, this message translates to:
  /// **'Purchases: {amount}'**
  String suppPurchasesAmount(String amount);

  /// No description provided for @suppSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Manage vendors and dues'**
  String get suppSubtitle;

  /// No description provided for @suppSupplierName.
  ///
  /// In en, this message translates to:
  /// **'Supplier name'**
  String get suppSupplierName;

  /// No description provided for @suppTotalPayable.
  ///
  /// In en, this message translates to:
  /// **'Total Payable'**
  String get suppTotalPayable;

  /// No description provided for @suppTotalRegisteredVendors.
  ///
  /// In en, this message translates to:
  /// **'Total registered vendors'**
  String get suppTotalRegisteredVendors;

  /// No description provided for @suppXOutstanding.
  ///
  /// In en, this message translates to:
  /// **'{count} outstanding'**
  String suppXOutstanding(String count);

  /// No description provided for @suppXOverdue.
  ///
  /// In en, this message translates to:
  /// **'{count} overdue'**
  String suppXOverdue(String count);

  /// No description provided for @suppXSettled.
  ///
  /// In en, this message translates to:
  /// **'{count} settled'**
  String suppXSettled(String count);

  /// No description provided for @suppViewDetails.
  ///
  /// In en, this message translates to:
  /// **'View details'**
  String get suppViewDetails;

  /// No description provided for @suppPayments.
  ///
  /// In en, this message translates to:
  /// **'Payments'**
  String get suppPayments;

  /// No description provided for @suppPurchaseOrders.
  ///
  /// In en, this message translates to:
  /// **'Purchase Orders'**
  String get suppPurchaseOrders;

  /// No description provided for @suppNoPayments.
  ///
  /// In en, this message translates to:
  /// **'No payments recorded'**
  String get suppNoPayments;

  /// No description provided for @suppNoPOs.
  ///
  /// In en, this message translates to:
  /// **'No purchase orders'**
  String get suppNoPOs;

  /// No description provided for @tabCustomers.
  ///
  /// In en, this message translates to:
  /// **'Customers'**
  String get tabCustomers;

  /// No description provided for @tabHome.
  ///
  /// In en, this message translates to:
  /// **'Home'**
  String get tabHome;

  /// No description provided for @tabInvoice.
  ///
  /// In en, this message translates to:
  /// **'Invoice'**
  String get tabInvoice;

  /// No description provided for @tabMore.
  ///
  /// In en, this message translates to:
  /// **'More'**
  String get tabMore;

  /// No description provided for @tabStock.
  ///
  /// In en, this message translates to:
  /// **'Stock'**
  String get tabStock;

  /// No description provided for @tabUdhari.
  ///
  /// In en, this message translates to:
  /// **'Udhari'**
  String get tabUdhari;

  /// No description provided for @total.
  ///
  /// In en, this message translates to:
  /// **'Total'**
  String get total;

  /// No description provided for @udhrAmountReceived.
  ///
  /// In en, this message translates to:
  /// **'Amount received'**
  String get udhrAmountReceived;

  /// No description provided for @udhrBalance.
  ///
  /// In en, this message translates to:
  /// **'Balance'**
  String get udhrBalance;

  /// No description provided for @udhrDueToday.
  ///
  /// In en, this message translates to:
  /// **'Due today'**
  String get udhrDueToday;

  /// No description provided for @udhrEntryAmount.
  ///
  /// In en, this message translates to:
  /// **'Amount: {amount}'**
  String udhrEntryAmount(String amount);

  /// No description provided for @udhrEntryBalance.
  ///
  /// In en, this message translates to:
  /// **'Balance: {balance}'**
  String udhrEntryBalance(String balance);

  /// No description provided for @udhrLastEntry.
  ///
  /// In en, this message translates to:
  /// **'Last: {date}'**
  String udhrLastEntry(String date);

  /// No description provided for @udhrLedgerEntries.
  ///
  /// In en, this message translates to:
  /// **'Ledger entries'**
  String get udhrLedgerEntries;

  /// No description provided for @udhrLoadEntriesFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not load entries: {error}'**
  String udhrLoadEntriesFailed(String error);

  /// No description provided for @udhrModeBank.
  ///
  /// In en, this message translates to:
  /// **'Bank'**
  String get udhrModeBank;

  /// No description provided for @udhrModeCard.
  ///
  /// In en, this message translates to:
  /// **'Card'**
  String get udhrModeCard;

  /// No description provided for @udhrModeCash.
  ///
  /// In en, this message translates to:
  /// **'Cash'**
  String get udhrModeCash;

  /// No description provided for @udhrModeUpi.
  ///
  /// In en, this message translates to:
  /// **'UPI'**
  String get udhrModeUpi;

  /// No description provided for @udhrNoLedgerEntries.
  ///
  /// In en, this message translates to:
  /// **'No ledger entries'**
  String get udhrNoLedgerEntries;

  /// No description provided for @udhrNoRecords.
  ///
  /// In en, this message translates to:
  /// **'No udhaar records yet'**
  String get udhrNoRecords;

  /// No description provided for @udhrNoteOptional.
  ///
  /// In en, this message translates to:
  /// **'Note (optional)'**
  String get udhrNoteOptional;

  /// No description provided for @udhrOutstandingBalance.
  ///
  /// In en, this message translates to:
  /// **'Outstanding balance: {amount}'**
  String udhrOutstandingBalance(String amount);

  /// No description provided for @udhrPaidVia.
  ///
  /// In en, this message translates to:
  /// **'✓ Paid {amount} via {mode}'**
  String udhrPaidVia(String amount, String mode);

  /// No description provided for @udhrPaidViaNote.
  ///
  /// In en, this message translates to:
  /// **'✓ Paid {amount} via {mode} · {note}'**
  String udhrPaidViaNote(String amount, String mode, String note);

  /// No description provided for @udhrPaymentMode.
  ///
  /// In en, this message translates to:
  /// **'Payment mode'**
  String get udhrPaymentMode;

  /// No description provided for @udhrPaymentReceived.
  ///
  /// In en, this message translates to:
  /// **'Udhari payment received successfully.'**
  String get udhrPaymentReceived;

  /// No description provided for @udhrReceive.
  ///
  /// In en, this message translates to:
  /// **'Receive'**
  String get udhrReceive;

  /// No description provided for @udhrReceivePaymentFrom.
  ///
  /// In en, this message translates to:
  /// **'Receive payment from {name}'**
  String udhrReceivePaymentFrom(String name);

  /// No description provided for @udhrRecordPayment.
  ///
  /// In en, this message translates to:
  /// **'Receive payment'**
  String get udhrRecordPayment;

  /// No description provided for @udhrTitle.
  ///
  /// In en, this message translates to:
  /// **'Customer Udhaar'**
  String get udhrTitle;

  /// No description provided for @udhrTotalAmount.
  ///
  /// In en, this message translates to:
  /// **'Total: {amount}'**
  String udhrTotalAmount(String amount);

  /// No description provided for @udhrTotalReceivables.
  ///
  /// In en, this message translates to:
  /// **'Total Receivables'**
  String get udhrTotalReceivables;

  /// No description provided for @udhrUpcoming.
  ///
  /// In en, this message translates to:
  /// **'Upcoming'**
  String get udhrUpcoming;

  /// No description provided for @userAllUsers.
  ///
  /// In en, this message translates to:
  /// **'All users ({count})'**
  String userAllUsers(String count);

  /// No description provided for @userEmailOptional.
  ///
  /// In en, this message translates to:
  /// **'Email (optional)'**
  String get userEmailOptional;

  /// No description provided for @userEmailRequired.
  ///
  /// In en, this message translates to:
  /// **'Email'**
  String get userEmailRequired;

  /// No description provided for @userFullName.
  ///
  /// In en, this message translates to:
  /// **'Full name'**
  String get userFullName;

  /// No description provided for @userInvite.
  ///
  /// In en, this message translates to:
  /// **'Invite'**
  String get userInvite;

  /// No description provided for @userInviteHint.
  ///
  /// In en, this message translates to:
  /// **'Share this invite link with them so they can join the team.'**
  String get userInviteHint;

  /// No description provided for @copyInviteLink.
  ///
  /// In en, this message translates to:
  /// **'Copy link'**
  String get copyInviteLink;

  /// No description provided for @userInviteMember.
  ///
  /// In en, this message translates to:
  /// **'Invite member'**
  String get userInviteMember;

  /// No description provided for @userInviteTitle.
  ///
  /// In en, this message translates to:
  /// **'Invite team member'**
  String get userInviteTitle;

  /// No description provided for @userJoinedAt.
  ///
  /// In en, this message translates to:
  /// **'Joined: {date}'**
  String userJoinedAt(String date);

  /// No description provided for @userMobileOptional.
  ///
  /// In en, this message translates to:
  /// **'Mobile (optional)'**
  String get userMobileOptional;

  /// No description provided for @userNoUsers.
  ///
  /// In en, this message translates to:
  /// **'No other users yet'**
  String get userNoUsers;

  /// No description provided for @userRole.
  ///
  /// In en, this message translates to:
  /// **'Role'**
  String get userRole;

  /// No description provided for @userRoleAdmin.
  ///
  /// In en, this message translates to:
  /// **'Admin'**
  String get userRoleAdmin;

  /// No description provided for @userRoleCashier.
  ///
  /// In en, this message translates to:
  /// **'Cashier'**
  String get userRoleCashier;

  /// No description provided for @userRoleManager.
  ///
  /// In en, this message translates to:
  /// **'Manager'**
  String get userRoleManager;

  /// No description provided for @userRoleOwner.
  ///
  /// In en, this message translates to:
  /// **'Owner'**
  String get userRoleOwner;

  /// No description provided for @userRoleStaff.
  ///
  /// In en, this message translates to:
  /// **'Staff'**
  String get userRoleStaff;

  /// No description provided for @userTitle.
  ///
  /// In en, this message translates to:
  /// **'Team & Users'**
  String get userTitle;

  /// No description provided for @userYou.
  ///
  /// In en, this message translates to:
  /// **'You'**
  String get userYou;

  /// No description provided for @userYouLabel.
  ///
  /// In en, this message translates to:
  /// **'{name} (you)'**
  String userYouLabel(String name);

  /// No description provided for @yes.
  ///
  /// In en, this message translates to:
  /// **'Yes'**
  String get yes;

  /// No description provided for @mobileNumber.
  ///
  /// In en, this message translates to:
  /// **'Mobile number'**
  String get mobileNumber;

  /// No description provided for @udhrAdd.
  ///
  /// In en, this message translates to:
  /// **'Add Udhari'**
  String get udhrAdd;

  /// No description provided for @udhrAddNewCustomer.
  ///
  /// In en, this message translates to:
  /// **'Add new customer'**
  String get udhrAddNewCustomer;

  /// No description provided for @udhrAmountLabel.
  ///
  /// In en, this message translates to:
  /// **'Amount'**
  String get udhrAmountLabel;

  /// No description provided for @udhrAmountRequired.
  ///
  /// In en, this message translates to:
  /// **'Enter an amount greater than 0'**
  String get udhrAmountRequired;

  /// No description provided for @udhrCustomer.
  ///
  /// In en, this message translates to:
  /// **'Customer'**
  String get udhrCustomer;

  /// No description provided for @udhrDueDate.
  ///
  /// In en, this message translates to:
  /// **'Due date'**
  String get udhrDueDate;

  /// No description provided for @udhrEntryDate.
  ///
  /// In en, this message translates to:
  /// **'Entry date'**
  String get udhrEntryDate;

  /// No description provided for @udhrNewEntry.
  ///
  /// In en, this message translates to:
  /// **'New Udhari Entry'**
  String get udhrNewEntry;

  /// No description provided for @udhrSelectCustomer.
  ///
  /// In en, this message translates to:
  /// **'Select customer'**
  String get udhrSelectCustomer;

  /// No description provided for @validationMobileNumber.
  ///
  /// In en, this message translates to:
  /// **'Enter a valid mobile number (10-12 digits)'**
  String get validationMobileNumber;

  /// No description provided for @errCreateUdhaari.
  ///
  /// In en, this message translates to:
  /// **'Could not add udhaari: {error}'**
  String errCreateUdhaari(Object error);

  /// No description provided for @menuViewBusinessProfile.
  ///
  /// In en, this message translates to:
  /// **'View Business Profile'**
  String get menuViewBusinessProfile;

  /// No description provided for @bizProfileTitle.
  ///
  /// In en, this message translates to:
  /// **'Business Profile'**
  String get bizProfileTitle;

  /// No description provided for @bizProfileSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Your business details & plan'**
  String get bizProfileSubtitle;

  /// No description provided for @bizOwnerName.
  ///
  /// In en, this message translates to:
  /// **'Owner'**
  String get bizOwnerName;

  /// No description provided for @bizGstin.
  ///
  /// In en, this message translates to:
  /// **'GSTIN'**
  String get bizGstin;

  /// No description provided for @bizAddress.
  ///
  /// In en, this message translates to:
  /// **'Address'**
  String get bizAddress;

  /// No description provided for @bizMobile.
  ///
  /// In en, this message translates to:
  /// **'Mobile'**
  String get bizMobile;

  /// No description provided for @bizCategory.
  ///
  /// In en, this message translates to:
  /// **'Category'**
  String get bizCategory;

  /// No description provided for @bizRegisteredOn.
  ///
  /// In en, this message translates to:
  /// **'Registered on'**
  String get bizRegisteredOn;

  /// No description provided for @bizPlan.
  ///
  /// In en, this message translates to:
  /// **'Plan'**
  String get bizPlan;

  /// No description provided for @bizPlanStatus.
  ///
  /// In en, this message translates to:
  /// **'Plan status'**
  String get bizPlanStatus;

  /// No description provided for @bizPlanFree.
  ///
  /// In en, this message translates to:
  /// **'Free'**
  String get bizPlanFree;

  /// No description provided for @bizPlanTrial.
  ///
  /// In en, this message translates to:
  /// **'Trial'**
  String get bizPlanTrial;

  /// No description provided for @bizStatusSuspended.
  ///
  /// In en, this message translates to:
  /// **'Suspended'**
  String get bizStatusSuspended;

  /// No description provided for @signOutConfirmTitle.
  ///
  /// In en, this message translates to:
  /// **'Sign out?'**
  String get signOutConfirmTitle;

  /// No description provided for @signOutConfirmMessage.
  ///
  /// In en, this message translates to:
  /// **'Are you sure you want to sign out? You\'ll be asked to verify an OTP again the next time you sign in.'**
  String get signOutConfirmMessage;

  /// No description provided for @navDashboard.
  ///
  /// In en, this message translates to:
  /// **'Dashboard'**
  String get navDashboard;

  /// No description provided for @navProductsStock.
  ///
  /// In en, this message translates to:
  /// **'Products & Stock'**
  String get navProductsStock;

  /// No description provided for @navSalesInvoices.
  ///
  /// In en, this message translates to:
  /// **'Sales & Invoices'**
  String get navSalesInvoices;

  /// No description provided for @navCustomers.
  ///
  /// In en, this message translates to:
  /// **'Customers'**
  String get navCustomers;

  /// No description provided for @navSystem.
  ///
  /// In en, this message translates to:
  /// **'System'**
  String get navSystem;

  /// No description provided for @userRoleStockManager.
  ///
  /// In en, this message translates to:
  /// **'Stock Manager'**
  String get userRoleStockManager;

  /// No description provided for @userRolePlatformAdmin.
  ///
  /// In en, this message translates to:
  /// **'Platform Admin'**
  String get userRolePlatformAdmin;

  /// No description provided for @roleAccessFull.
  ///
  /// In en, this message translates to:
  /// **'Full Access / संपूर्ण प्रवेश'**
  String get roleAccessFull;

  /// No description provided for @roleAccessLimited.
  ///
  /// In en, this message translates to:
  /// **'मर्यादित दृश्यता / Limited Visibility'**
  String get roleAccessLimited;

  /// No description provided for @roleAccessPlatform.
  ///
  /// In en, this message translates to:
  /// **'Platform Access / प्रशासक'**
  String get roleAccessPlatform;

  /// No description provided for @syncOnline.
  ///
  /// In en, this message translates to:
  /// **'Online'**
  String get syncOnline;

  /// No description provided for @syncOffline.
  ///
  /// In en, this message translates to:
  /// **'Offline'**
  String get syncOffline;

  /// No description provided for @appTagline.
  ///
  /// In en, this message translates to:
  /// **'मी दुकानदार - स्मार्ट व्यवसाय व्यवस्थापन'**
  String get appTagline;

  /// No description provided for @exitAppTitle.
  ///
  /// In en, this message translates to:
  /// **'Exit MiDukandar?'**
  String get exitAppTitle;

  /// No description provided for @exitAppMessage.
  ///
  /// In en, this message translates to:
  /// **'Are you sure you want to exit the app?'**
  String get exitAppMessage;

  /// No description provided for @exitApp.
  ///
  /// In en, this message translates to:
  /// **'Exit'**
  String get exitApp;

  /// No description provided for @billReverseTitle.
  ///
  /// In en, this message translates to:
  /// **'Void / Reverse Sale'**
  String get billReverseTitle;

  /// No description provided for @billReverseMessage.
  ///
  /// In en, this message translates to:
  /// **'Reverse invoice \"{invoiceNumber}\"? This creates a reversing entry and marks the original as void. A reason is required.'**
  String billReverseMessage(Object invoiceNumber);

  /// No description provided for @billReverse.
  ///
  /// In en, this message translates to:
  /// **'Void/Reverse'**
  String get billReverse;

  /// No description provided for @errReverseInvoice.
  ///
  /// In en, this message translates to:
  /// **'Could not reverse invoice: {error}'**
  String errReverseInvoice(Object error);

  /// No description provided for @errUpdateInvoice.
  ///
  /// In en, this message translates to:
  /// **'Could not update invoice: {error}'**
  String errUpdateInvoice(Object error);

  /// No description provided for @suppEditSupplier.
  ///
  /// In en, this message translates to:
  /// **'Edit supplier'**
  String get suppEditSupplier;

  /// No description provided for @suppDeleteTitle.
  ///
  /// In en, this message translates to:
  /// **'Delete supplier?'**
  String get suppDeleteTitle;

  /// No description provided for @suppDeleteMessage.
  ///
  /// In en, this message translates to:
  /// **'Delete supplier \"{name}\"? This archives the supplier and removes them from lists. Outstanding purchase orders must be cancelled first.'**
  String suppDeleteMessage(Object name);

  /// No description provided for @errUpdateSupplier.
  ///
  /// In en, this message translates to:
  /// **'Could not update supplier: {error}'**
  String errUpdateSupplier(Object error);

  /// No description provided for @errDeleteSupplier.
  ///
  /// In en, this message translates to:
  /// **'Could not delete supplier: {error}'**
  String errDeleteSupplier(Object error);

  /// No description provided for @expnEditExpense.
  ///
  /// In en, this message translates to:
  /// **'Edit expense'**
  String get expnEditExpense;

  /// No description provided for @expnDeleteTitle.
  ///
  /// In en, this message translates to:
  /// **'Delete expense?'**
  String get expnDeleteTitle;

  /// No description provided for @expnDeleteMessage.
  ///
  /// In en, this message translates to:
  /// **'Delete expense \"{title}\"? This cannot be undone.'**
  String expnDeleteMessage(Object title);

  /// No description provided for @errUpdateExpense.
  ///
  /// In en, this message translates to:
  /// **'Could not update expense: {error}'**
  String errUpdateExpense(Object error);

  /// No description provided for @errDeleteExpense.
  ///
  /// In en, this message translates to:
  /// **'Could not delete expense: {error}'**
  String errDeleteExpense(Object error);

  /// No description provided for @purchPayTitle.
  ///
  /// In en, this message translates to:
  /// **'Record payment'**
  String get purchPayTitle;

  /// No description provided for @userChangeRole.
  ///
  /// In en, this message translates to:
  /// **'Change role'**
  String get userChangeRole;

  /// No description provided for @userDeactivate.
  ///
  /// In en, this message translates to:
  /// **'Deactivate'**
  String get userDeactivate;

  /// No description provided for @userActivate.
  ///
  /// In en, this message translates to:
  /// **'Activate'**
  String get userActivate;

  /// No description provided for @userCannotManage.
  ///
  /// In en, this message translates to:
  /// **'Only the Owner can manage other team members.'**
  String get userCannotManage;

  /// No description provided for @errUpdateUserStatus.
  ///
  /// In en, this message translates to:
  /// **'Could not update user status: {error}'**
  String errUpdateUserStatus(Object error);

  /// No description provided for @errUpdateUserRole.
  ///
  /// In en, this message translates to:
  /// **'Could not update user role: {error}'**
  String errUpdateUserRole(Object error);

  /// No description provided for @regTitle.
  ///
  /// In en, this message translates to:
  /// **'Create your account'**
  String get regTitle;

  /// No description provided for @regSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Register your account and store in one step.'**
  String get regSubtitle;

  /// No description provided for @regEmailLabel.
  ///
  /// In en, this message translates to:
  /// **'Account Email'**
  String get regEmailLabel;

  /// No description provided for @regEmailRequired.
  ///
  /// In en, this message translates to:
  /// **'Enter an email address for your account.'**
  String get regEmailRequired;

  /// No description provided for @regEmailInvalid.
  ///
  /// In en, this message translates to:
  /// **'Enter a valid email address.'**
  String get regEmailInvalid;

  /// No description provided for @regOwnerNameLabel.
  ///
  /// In en, this message translates to:
  /// **'Shop Owner Name'**
  String get regOwnerNameLabel;

  /// No description provided for @regOwnerNameRequired.
  ///
  /// In en, this message translates to:
  /// **'Enter the shop owner\'s name'**
  String get regOwnerNameRequired;

  /// No description provided for @regShopNameLabel.
  ///
  /// In en, this message translates to:
  /// **'Shop / Business Name'**
  String get regShopNameLabel;

  /// No description provided for @regShopNameRequired.
  ///
  /// In en, this message translates to:
  /// **'Enter your shop name'**
  String get regShopNameRequired;

  /// No description provided for @regStoreTypeLabel.
  ///
  /// In en, this message translates to:
  /// **'Store Type'**
  String get regStoreTypeLabel;

  /// No description provided for @regPhoneLabel.
  ///
  /// In en, this message translates to:
  /// **'Mobile Number'**
  String get regPhoneLabel;

  /// No description provided for @regGstLabel.
  ///
  /// In en, this message translates to:
  /// **'GSTIN (Optional)'**
  String get regGstLabel;

  /// No description provided for @regGstHint.
  ///
  /// In en, this message translates to:
  /// **'27ABCDE1234F1Z5'**
  String get regGstHint;

  /// No description provided for @regLanguageLabel.
  ///
  /// In en, this message translates to:
  /// **'App Language'**
  String get regLanguageLabel;

  /// No description provided for @regAddressLabel.
  ///
  /// In en, this message translates to:
  /// **'Address'**
  String get regAddressLabel;

  /// No description provided for @regAddressHint.
  ///
  /// In en, this message translates to:
  /// **'Shop no, street, area'**
  String get regAddressHint;

  /// No description provided for @regAddressRequired.
  ///
  /// In en, this message translates to:
  /// **'Enter your shop address'**
  String get regAddressRequired;

  /// No description provided for @regCityLabel.
  ///
  /// In en, this message translates to:
  /// **'City'**
  String get regCityLabel;

  /// No description provided for @regCityRequired.
  ///
  /// In en, this message translates to:
  /// **'Enter your city'**
  String get regCityRequired;

  /// No description provided for @regStateLabel.
  ///
  /// In en, this message translates to:
  /// **'State'**
  String get regStateLabel;

  /// No description provided for @regPincodeLabel.
  ///
  /// In en, this message translates to:
  /// **'Pincode'**
  String get regPincodeLabel;

  /// No description provided for @regPincodeHint.
  ///
  /// In en, this message translates to:
  /// **'411001'**
  String get regPincodeHint;

  /// No description provided for @regPincodeRequired.
  ///
  /// In en, this message translates to:
  /// **'Enter a valid 6-digit pincode'**
  String get regPincodeRequired;

  /// No description provided for @regPincodeInvalid.
  ///
  /// In en, this message translates to:
  /// **'Pincode must be 6 digits'**
  String get regPincodeInvalid;

  /// No description provided for @regCurrencyLabel.
  ///
  /// In en, this message translates to:
  /// **'Currency'**
  String get regCurrencyLabel;

  /// No description provided for @regInvoicePrefixLabel.
  ///
  /// In en, this message translates to:
  /// **'Invoice Prefix'**
  String get regInvoicePrefixLabel;

  /// No description provided for @regInvoicePrefixHint.
  ///
  /// In en, this message translates to:
  /// **'e.g. INV → INV-0001'**
  String get regInvoicePrefixHint;

  /// No description provided for @regCreateAccount.
  ///
  /// In en, this message translates to:
  /// **'Create Account'**
  String get regCreateAccount;

  /// No description provided for @regSubmitting.
  ///
  /// In en, this message translates to:
  /// **'Creating account...'**
  String get regSubmitting;

  /// No description provided for @regSuccessMessage.
  ///
  /// In en, this message translates to:
  /// **'Account created! Sign in to continue.'**
  String get regSuccessMessage;

  /// No description provided for @regBackToLogin.
  ///
  /// In en, this message translates to:
  /// **'Back to login'**
  String get regBackToLogin;

  /// No description provided for @regSecureNotice.
  ///
  /// In en, this message translates to:
  /// **'Your data is encrypted and stored securely.'**
  String get regSecureNotice;

  /// No description provided for @regSecureBadge.
  ///
  /// In en, this message translates to:
  /// **'Secure & private'**
  String get regSecureBadge;

  /// No description provided for @regGstBadge.
  ///
  /// In en, this message translates to:
  /// **'GST-ready invoicing'**
  String get regGstBadge;

  /// No description provided for @regOfflineBadge.
  ///
  /// In en, this message translates to:
  /// **'Offline billing support'**
  String get regOfflineBadge;

  /// No description provided for @regSectionAccountDetails.
  ///
  /// In en, this message translates to:
  /// **'Account Details'**
  String get regSectionAccountDetails;

  /// No description provided for @regSectionStoreDetails.
  ///
  /// In en, this message translates to:
  /// **'Store Details'**
  String get regSectionStoreDetails;

  /// No description provided for @regSectionLocation.
  ///
  /// In en, this message translates to:
  /// **'Location'**
  String get regSectionLocation;

  /// No description provided for @regSectionPreferences.
  ///
  /// In en, this message translates to:
  /// **'Preferences'**
  String get regSectionPreferences;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['en', 'hi', 'mr'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en':
      return AppLocalizationsEn();
    case 'hi':
      return AppLocalizationsHi();
    case 'mr':
      return AppLocalizationsMr();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
