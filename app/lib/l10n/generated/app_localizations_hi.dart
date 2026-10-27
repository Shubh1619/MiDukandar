// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Hindi (`hi`).
class AppLocalizationsHi extends AppLocalizations {
  AppLocalizationsHi([String locale = 'hi']) : super(locale);

  @override
  String get add => 'जोड़ें';

  @override
  String get address => 'पता';

  @override
  String get amount => 'राशि';

  @override
  String get appTitle => 'स्मार्ट बिज़नेस';

  @override
  String get authChangeEmail => 'ईमेल बदलें';

  @override
  String get authCodeSentNotice =>
      'लॉगिन कोड भेज दिया गया है। सत्यापन कोड के लिए अपना ईमेल देखें।';

  @override
  String authCodeSentTo(String email) {
    return '$email पर लॉगिन कोड भेज दिया गया है।';
  }

  @override
  String authDevMode(String masterCode) {
    return 'डेव मोड: मास्टर कोड $masterCode है। कोई ईमेल नहीं भेजा गया।';
  }

  @override
  String get authEmail => 'ईमेल पता';

  @override
  String get authEnterEmail => 'अपना ईमेल पता दर्ज करें।';

  @override
  String get authEnterOtp => 'सत्यापन कोड दर्ज करें';

  @override
  String get authErrSendOtp => 'OTP नहीं भेजा जा सका। कृपया पुनः प्रयास करें।';

  @override
  String get authErrVerify => 'सत्यापन विफल रहा। कृपया पुनः प्रयास करें।';

  @override
  String get authUnableToConnect =>
      'MiDukandar से कनेक्ट नहीं हो सका। कृपया अपना इंटरनेट कनेक्शन जाँचें और फिर कोशिश करें।';

  @override
  String get authServiceUnavailable =>
      'MiDukandar सेवा अस्थायी रूप से उपलब्ध नहीं है। कृपया थोड़ी देर बाद फिर कोशिश करें।';

  @override
  String get authConnectionTimeout =>
      'कनेक्शन समय समाप्त हो गया। कृपया फिर कोशिश करें।';

  @override
  String get authAccountNotFound =>
      'खाता नहीं मिला। कृपया अपना ईमेल जाँचें या व्यवसाय पंजीकृत करें।';

  @override
  String get authTryAgain => 'फिर कोशिश करें';

  @override
  String get authOtpSent => 'OTP भेजा गया';

  @override
  String get authGetOtp => 'OTP प्राप्त करें';

  @override
  String get authInvalidEmail => 'मान्य ईमेल पता दर्ज करें।';

  @override
  String get authNoAccount => 'क्या आपके पास खाता नहीं है?';

  @override
  String authOtpInstructions(String time) {
    return 'अपने ईमेल से 6-अंकीय कोड टाइप करें। कोड $time में समाप्त हो जाएगा।';
  }

  @override
  String get authOtpPlaceholder => '• • • • • •';

  @override
  String get authOtpTooShort =>
      'कृपया वह 4-6 अंकीय कोड दर्ज करें जो हमने भेजा था।';

  @override
  String get authRegisterBusiness => 'अपना व्यवसाय पंजीकृत करें';

  @override
  String get authResendCode => 'कोड पुनः भेजें';

  @override
  String authResendIn(String time) {
    return '$time में कोड पुनः भेजें';
  }

  @override
  String get authSendingOtp => 'OTP भेजा जा रहा है...';

  @override
  String get authSignInBadge => 'साइन इन';

  @override
  String get authSignInSubtitle =>
      'अपनी दुकान प्रबंधित करने और अपना व्यवसाय आगे बढ़ाने के लिए साइन इन करें।';

  @override
  String get authSigningIn => 'साइन इन हो रहा है...';

  @override
  String get authVerifyAndSignIn => 'सत्यापित करें और साइन इन करें';

  @override
  String get authWelcomeBack => 'वापसी पर स्वागत है';

  @override
  String get back => 'वापस';

  @override
  String get billAddInvoice => 'इनवॉइस जोड़ें';

  @override
  String get billAll => 'सभी';

  @override
  String get billFilter => 'फ़िल्टर';

  @override
  String get billCreatedFromMobileApp => 'मोबाइल ऐप से बनाया गया';

  @override
  String billCustomerLine(String name) {
    return 'ग्राहक: $name';
  }

  @override
  String get billCustomerName => 'ग्राहक का नाम';

  @override
  String billDateLine(String date) {
    return 'तारीख: $date';
  }

  @override
  String get billDue => 'बकाया';

  @override
  String billDueAmount(String amount) {
    return 'बकाया $amount';
  }

  @override
  String get billEditInvoice => 'इनवॉइस संपादित करें';

  @override
  String get billGenericItem => 'सामान्य वस्तु';

  @override
  String get billHeldBills => 'होल्ड बिल';

  @override
  String get billHeldSaved => 'बिल होल्ड हो गया';

  @override
  String get billHold => 'होल्ड करें';

  @override
  String get billNoHeldBills => 'कोई होल्ड बिल नहीं';

  @override
  String get billResume => 'फिर शुरू करें';

  @override
  String get billInvoices => 'इनवॉइस';

  @override
  String billLineItem(String name, String qty) {
    return '$name x $qty';
  }

  @override
  String billMobileLine(String number) {
    return 'मोबाइल: $number';
  }

  @override
  String get billMode => 'तरीका';

  @override
  String get billModeBank => 'बैंक';

  @override
  String get billModeCard => 'कार्ड';

  @override
  String get billModeCash => 'नकद';

  @override
  String billModeLine(String mode) {
    return 'तरीका: $mode';
  }

  @override
  String get billModeUpi => 'UPI';

  @override
  String get billNewInvoice => 'नया इनवॉइस';

  @override
  String get billNoLineItems => 'कोई आइटम नहीं';

  @override
  String get billNoMatchingInvoices => 'कोई मिलता-जुलता इनवॉइस नहीं';

  @override
  String billNoteLine(String note) {
    return 'नोट: $note';
  }

  @override
  String get billPaidAmount => 'भुगतान राशि';

  @override
  String billPayAmount(String amount) {
    return '$amount भुगतान करें';
  }

  @override
  String get billQty => 'मात्रा';

  @override
  String get billRevenue => 'राजस्व';

  @override
  String get billSearchPlaceholder => 'ग्राहक या इनवॉइस खोजें';

  @override
  String get billUdhaar => 'उधार';

  @override
  String get billUnitPrice => 'यूनिट मूल्य';

  @override
  String get billWalkInCustomer => 'वॉक-इन ग्राहक';

  @override
  String get cancel => 'रद्द करें';

  @override
  String get city => 'शहर';

  @override
  String get close => 'बंद करें';

  @override
  String get confirm => 'पुष्टि करें';

  @override
  String get custAddTitle => 'ग्राहक जोड़ें';

  @override
  String custDeleteConfirm(String name) {
    return 'ग्राहक \"$name\" हटाएं? इसे पूर्ववत नहीं किया जा सकता।';
  }

  @override
  String get custDeleteTitle => 'ग्राहक हटाएं';

  @override
  String get custEditTitle => 'ग्राहक संपादित करें';

  @override
  String get custNameLabel => 'ग्राहक का नाम';

  @override
  String get custNoMobile => 'कोई मोबाइल नंबर नहीं';

  @override
  String get dashCustomerUdhaari => 'ग्राहक उधारी';

  @override
  String get dashCustomerUdhaariSub => 'कुल बकाया लेजर';

  @override
  String dashHeaderSubtitle(String storeName) {
    return '$storeName का आज का प्रदर्शन';
  }

  @override
  String get dashLowStock => 'कम स्टॉक';

  @override
  String get dashLowStockSub => 'न्यूनतम स्टॉक स्तर से नीचे उत्पाद';

  @override
  String get dashNoTransactions => 'अभी कोई लेन-देन नहीं';

  @override
  String get dashNoTransactionsSub => 'सेल्स टैब से अपनी पहली बिक्री बनाएं।';

  @override
  String get dashProfitToday => 'आज का अनुमानित लाभ';

  @override
  String get dashProfitTodaySub => 'कर से पहले आज का मार्जिन';

  @override
  String get dashPurchasesToday => 'आज की खरीद';

  @override
  String get dashPurchasesTodaySub => 'आज की स्टॉक खरीद';

  @override
  String get dashQuickControls => 'त्वरित नियंत्रण';

  @override
  String get dashQuickInvoices => 'इनवॉइस';

  @override
  String get dashQuickReports => 'रिपोर्ट';

  @override
  String get dashRecentTransactions => 'हाल के लेन-देन';

  @override
  String get dashSalesToday => 'आज की बिक्री';

  @override
  String get dashSalesTodaySub => 'आज पक्के बिल';

  @override
  String get dashSupplierPayables => 'आपूर्तिकर्ता देय राशि';

  @override
  String get dashSupplierPayablesSub => 'खुले खरीद बिलों पर देय';

  @override
  String get dashTimeAm => 'पूर्वाह्न';

  @override
  String get dashTimePm => 'अपराह्न';

  @override
  String get dashTitle => 'डैशबोर्ड';

  @override
  String get dashTypePayment => 'भुगतान';

  @override
  String get dashTypePurchase => 'खरीद';

  @override
  String get dashTypeSale => 'बिक्री';

  @override
  String get dashViewAll => 'सभी देखें';

  @override
  String get date => 'तारीख';

  @override
  String get delete => 'हटाएं';

  @override
  String get done => 'हो गया';

  @override
  String get edit => 'संपादित करें';

  @override
  String errAdjustStock(String error) {
    return 'स्टॉक समायोजित नहीं हो सका: $error';
  }

  @override
  String errArchiveProduct(String error) {
    return 'उत्पाद संग्रहित नहीं हो सका: $error';
  }

  @override
  String errCreateCustomer(String error) {
    return 'ग्राहक नहीं बनाया जा सका: $error';
  }

  @override
  String errCreateExpense(String error) {
    return 'खर्च नहीं बनाया जा सका: $error';
  }

  @override
  String errCreateInvoice(String error) {
    return 'चालान नहीं बनाया जा सका: $error';
  }

  @override
  String errCreateProduct(String error) {
    return 'उत्पाद नहीं बनाया जा सका: $error';
  }

  @override
  String errCreatePurchase(String error) {
    return 'खरीद नहीं बनाई जा सकी: $error';
  }

  @override
  String errCreateSupplier(String error) {
    return 'आपूर्तिकर्ता नहीं बनाया जा सका: $error';
  }

  @override
  String errDeleteCustomer(String error) {
    return 'ग्राहक नहीं हटाया जा सका: $error';
  }

  @override
  String errInviteUser(String error) {
    return 'उपयोगकर्ता आमंत्रित नहीं हो सका: $error';
  }

  @override
  String errMarkPaid(String error) {
    return 'चालान को भुगतान चिह्नित नहीं किया जा सका: $error';
  }

  @override
  String errRecordPayment(String error) {
    return 'भुगतान दर्ज नहीं हो सका: $error';
  }

  @override
  String errRefreshFailed(String error) {
    return 'रीफ्रेश विफल: $error';
  }

  @override
  String get errSessionExpired =>
      'आपका सत्र समाप्त हो गया है। कृपया फिर से साइन इन करें।';

  @override
  String errUpdateCustomer(String error) {
    return 'ग्राहक अपडेट नहीं हो सका: $error';
  }

  @override
  String errUpdateProduct(String error) {
    return 'उत्पाद अपडेट नहीं हो सका: $error';
  }

  @override
  String get expnAddExpense => 'खर्च जोड़ें';

  @override
  String get expnByCategory => 'श्रेणी के अनुसार';

  @override
  String get expnCategoryOptional => 'श्रेणी (वैकल्पिक)';

  @override
  String get expnDefaultTitle => 'खर्च';

  @override
  String get expnExpenseTitle => 'खर्च का शीर्षक';

  @override
  String get expnGeneral => 'सामान्य';

  @override
  String get expnLastMonth => 'पिछले महीने';

  @override
  String get expnNoExpenses => 'अभी कोई खर्च नहीं';

  @override
  String get expnNoteFromApp => 'मोबाइल ऐप से बनाया गया';

  @override
  String get expnOther => 'अन्य';

  @override
  String get expnPaymentBank => 'बैंक';

  @override
  String get expnPaymentCard => 'कार्ड';

  @override
  String get expnPaymentCash => 'नकद';

  @override
  String get expnPaymentMode => 'भुगतान का तरीका';

  @override
  String get expnPaymentUpi => 'UPI';

  @override
  String get expnThisMonth => 'इस महीने';

  @override
  String get invnAddPlus => 'जोड़ें (+)';

  @override
  String invnAdjustFailed(String error) {
    return 'समायोजन विफल: $error';
  }

  @override
  String invnAdjustStockTitle(String product) {
    return '$product — स्टॉक समायोजित करें';
  }

  @override
  String get invnAll => 'सभी';

  @override
  String get invnBal => 'शेष';

  @override
  String invnCurrentBalance(String value) {
    return 'वर्तमान शेष: $value';
  }

  @override
  String get invnGeneral => 'सामान्य';

  @override
  String get invnHeaderSubtitle => 'आवागमन लेजर से लाइव स्टॉक';

  @override
  String get invnLoadError => 'इन्वेंटरी लोड नहीं हो सकी';

  @override
  String get invnLowOnly => 'केवल कम';

  @override
  String get invnLowStock => 'कम स्टॉक';

  @override
  String get invnManualAdjustment => 'मैन्युअल समायोजन';

  @override
  String get invnMovements => 'आवागमन';

  @override
  String get invnMovementsSubtitle => 'केवल-जोड़ें आवागमन लेजर';

  @override
  String get invnMovementsTitle => 'स्टॉक आवागमन';

  @override
  String invnMrp(String price) {
    return 'MRP $price';
  }

  @override
  String get invnNoMovements => 'अभी कोई आवागमन नहीं';

  @override
  String get invnNoMovementsSub => 'बिक्री, खरीद और समायोजन यहां दिखाई देंगे।';

  @override
  String get invnNoSku => 'कोई SKU नहीं';

  @override
  String get invnNoStock => 'कोई स्टॉक नहीं मिला';

  @override
  String get invnNoStockSub =>
      'शुरुआत करने के लिए उत्पाद जोड़ें या स्टॉक समायोजित करें।';

  @override
  String get invnQuantity => 'मात्रा';

  @override
  String get invnReason => 'कारण';

  @override
  String get invnRemoveMinus => 'हटाएं (−)';

  @override
  String get invnSearchHint => 'उत्पाद खोजें...';

  @override
  String get invnStockUpdated => 'स्टॉक अपडेट हो गया';

  @override
  String get invnValueLabel => 'इन्वेंटरी मूल्य';

  @override
  String get loading => 'लोड हो रहा है...';

  @override
  String get mobile => 'मोबाइल';

  @override
  String get moreExpenses => 'खर्च';

  @override
  String get moreExpensesSub => 'रजिस्टर और श्रेणी विभाजन';

  @override
  String get moreInventory => 'इन्वेंटरी';

  @override
  String get moreInventorySub => 'स्टॉक स्तर, कम स्टॉक और आवागमन';

  @override
  String get morePayments => 'भुगतान';

  @override
  String get morePaymentsSub => 'ग्राहक रसीद इतिहास';

  @override
  String get morePurchases => 'खरीद';

  @override
  String get morePurchasesSub => 'खरीद रजिस्टर और भुगतान';

  @override
  String get moreReports => 'जीएसटी और रिपोर्ट';

  @override
  String get moreReportsSub => 'बिक्री, खरीद, लाभ-हानि और जीएसटी';

  @override
  String get moreSettings => 'सेटिंग्स';

  @override
  String get moreSettingsSub => 'दुकान प्रोफ़ाइल और भाषा';

  @override
  String get moreSignOut => 'साइन आउट';

  @override
  String get moreSignOutSub => 'यह सत्र समाप्त करें';

  @override
  String get moreSubtitle => 'सभी सेवाएं';

  @override
  String get moreSuppliers => 'आपूर्तिकर्ता';

  @override
  String get moreSuppliersSub => 'विक्रेता, देय भुगतान और विवरण';

  @override
  String get moreTitle => 'और';

  @override
  String get moreUsers => 'उपयोगकर्ता और भूमिकाएं';

  @override
  String get moreUsersSub => 'टीम सदस्य और आमंत्रण';

  @override
  String get myStore => 'मेरी दुकान';

  @override
  String get name => 'नाम';

  @override
  String get no => 'नहीं';

  @override
  String get ok => 'ठीक';

  @override
  String get paymEmpty => 'अभी तक कोई भुगतान नहीं';

  @override
  String get paymPayment => 'भुगतान';

  @override
  String paymReference(String type, String id) {
    return '$type #$id';
  }

  @override
  String get phone => 'फ़ोन';

  @override
  String get pincode => 'पिनकोड';

  @override
  String get pleaseWait => 'कृपया प्रतीक्षा करें...';

  @override
  String get prodAbbrevCrore => 'करोड़';

  @override
  String get prodAbbrevLakh => 'लाख';

  @override
  String get prodAbbrevThousand => 'हज़ार';

  @override
  String get prodActionsTitle => 'उत्पाद क्रियाएँ';

  @override
  String get prodAddLabel => 'जोड़ें (+)';

  @override
  String get prodAddTitle => 'उत्पाद जोड़ें';

  @override
  String get prodAdjustStock => 'स्टॉक समायोजित करें';

  @override
  String prodAdjustStockTitle(String productName) {
    return 'स्टॉक समायोजित करें · $productName';
  }

  @override
  String get prodAll => 'सभी';

  @override
  String get prodApply => 'लागू करें';

  @override
  String get prodArchive => 'संग्रहित करें';

  @override
  String get prodArchiveConfirmTitle => 'उत्पाद संग्रहित करें?';

  @override
  String prodArchiveMessage(String productName) {
    return '\"$productName\" बिक्री और सूचियों से छिपाया जाएगा। रिकॉर्ड के लिए मूवमेंट बरकरार रहेंगे।';
  }

  @override
  String get prodArchiveProduct => 'उत्पाद संग्रहित करें';

  @override
  String get prodCategory => 'श्रेणी';

  @override
  String prodCurrently(String stock, String unit) {
    return 'वर्तमान में: $stock $unit';
  }

  @override
  String get prodEditProduct => 'उत्पाद संपादित करें';

  @override
  String get prodEmptySubtitle => 'अलग खोज आज़माएँ या नया उत्पाद जोड़ें।';

  @override
  String get prodEmptyTitle => 'कोई उत्पाद नहीं मिला';

  @override
  String get prodGeneral => 'सामान्य';

  @override
  String get prodGstPercent => 'GST %';

  @override
  String prodLowQty(String qty) {
    return 'कम · $qty';
  }

  @override
  String get prodManualAdjustment => 'मैनुअल समायोजन';

  @override
  String get prodMinStock => 'न्यूनतम स्टॉक';

  @override
  String get prodNoMovements => 'अभी तक कोई मूवमेंट दर्ज नहीं';

  @override
  String get prodOpeningStock => 'शुरुआती स्टॉक';

  @override
  String prodProductMeta(String category, String unit) {
    return '$category · $unit';
  }

  @override
  String prodProductMetaSku(String category, String unit, String sku) {
    return '$category · $unit · SKU $sku';
  }

  @override
  String get prodProductName => 'उत्पाद का नाम';

  @override
  String get prodPurchase => 'क्रय';

  @override
  String get prodPurchasePrice => 'क्रय मूल्य';

  @override
  String get prodQuantity => 'मात्रा';

  @override
  String get prodReason => 'कारण';

  @override
  String get prodRemoveLabel => 'हटाएँ (−)';

  @override
  String get prodSearchHint => 'नाम, SKU या बारकोड से खोजें...';

  @override
  String get prodSelling => 'विक्रय';

  @override
  String get prodSellingPrice => 'विक्रय मूल्य';

  @override
  String get prodStockMovements => 'स्टॉक मूवमेंट';

  @override
  String prodStockQty(String qty) {
    return '$qty स्टॉक में';
  }

  @override
  String get prodSubtitle => 'कैटलॉग, कीमत और स्टॉक';

  @override
  String get prodTitle => 'उत्पाद';

  @override
  String get prodUnit => 'इकाई';

  @override
  String get prodValue => 'मूल्य';

  @override
  String get purchAddPurchase => 'खरीद जोड़ें';

  @override
  String purchDueAmount(String amount) {
    return 'बकाया: $amount';
  }

  @override
  String get purchFromMobileApp => 'मोबाइल ऐप से बनाया गया';

  @override
  String get purchNoPurchasesYet => 'अभी कोई खरीद नहीं';

  @override
  String get purchPurchaseItem => 'खरीद वस्तु';

  @override
  String get purchSupplierName => 'आपूर्तिकर्ता का नाम';

  @override
  String get purchTotalAmount => 'कुल राशि';

  @override
  String get purchTotalBilled => 'कुल बिल';

  @override
  String get purchUnknownSupplier => 'अज्ञात आपूर्तिकर्ता';

  @override
  String get refresh => 'ताज़ा करें';

  @override
  String get reptBills => 'बिल';

  @override
  String get reptEstProfit => 'अनुमानित लाभ';

  @override
  String get reptEstimatedProfit => 'अनुमानित लाभ';

  @override
  String get reptGstSummary => 'जीएसटी सारांश';

  @override
  String get reptInputGst => 'इनपुट जीएसटी (खरीद)';

  @override
  String get reptInventoryValue => 'इन्वेंटरी मूल्य (लागत)';

  @override
  String get reptInvoices => 'इनवॉइस';

  @override
  String get reptLessTotalPurchases => 'घटाएँ: कुल खरीद';

  @override
  String get reptNetGstPayable => 'शुद्ध जीएसटी देय';

  @override
  String get reptNoChartData => 'चार्ट के लिए अभी तक कोई डेटा नहीं';

  @override
  String get reptNoSalesRows => 'अभी तक कोई बिक्री पंक्ति नहीं';

  @override
  String get reptOutputGst => 'आउटपुट जीएसटी (बिक्री)';

  @override
  String get reptProfitLossPeriod => 'लाभ-हानि (अवधि)';

  @override
  String get reptRecentSalesRows => 'हाल की बिक्री पंक्तियाँ';

  @override
  String get reptSales => 'बिक्री';

  @override
  String get reptSalesVsPurchasesPeriod => 'बिक्री बनाम खरीद (अवधि)';

  @override
  String get reptTitle => 'रिपोर्ट';

  @override
  String get reptTotalSales => 'कुल बिक्री';

  @override
  String get reptCogs => 'सीओजीएस (बेचे गए माल की लागत)';

  @override
  String get reptGrossMargin => 'सकल मार्जिन';

  @override
  String get reptGrossProfit => 'सकल लाभ';

  @override
  String get reptGstBreakup => 'जीएसटी दर विभाजन';

  @override
  String get reptNetMargin => 'शुद्ध मार्जिन';

  @override
  String get reptNetProfit => 'शुद्ध लाभ';

  @override
  String get reptNoData => 'इस अवधि के लिए कोई डेटा नहीं';

  @override
  String get reptRate => 'दर';

  @override
  String get reptRealPnl => 'लाभ-हानि (वास्तविक)';

  @override
  String get reptRevenue => 'राजस्व';

  @override
  String get reptTax => 'कर';

  @override
  String get reptTaxable => 'कर योग्य';

  @override
  String get required => 'आवश्यक';

  @override
  String get retry => 'पुनः प्रयास करें';

  @override
  String get referTitle => 'रेफर करें और कमाएँ';

  @override
  String get referYourCode => 'आपका रेफरल कोड';

  @override
  String get referCopy => 'कोड कॉपी करें';

  @override
  String get referCopied => 'रेफरल कोड कॉपी हो गया';

  @override
  String get referOnlyOwner => 'केवल दुकान का मालिक रेफरल देख सकता है';

  @override
  String get referReferred => 'रेफर की गई दुकानें';

  @override
  String get save => 'सहेजें';

  @override
  String get searchHint => 'खोजें...';

  @override
  String get sectionExpenses => 'खर्च';

  @override
  String get sectionInventory => 'इन्वेंटरी';

  @override
  String get sectionPayments => 'भुगतान';

  @override
  String get sectionProducts => 'उत्पाद';

  @override
  String get sectionPurchases => 'खरीद';

  @override
  String get sectionReports => 'जीएसटी और रिपोर्ट';

  @override
  String get sectionSettings => 'सेटिंग्स';

  @override
  String get sectionSuppliers => 'आपूर्तिकर्ता';

  @override
  String get sectionSupplierInvoices => 'आपूर्तिकर्ता इनवॉइस';

  @override
  String get sectionUdhaari => 'उधारी';

  @override
  String get sectionUsers => 'उपयोगकर्ता और भूमिकाएं';

  @override
  String get settingsAddressSection => 'पता';

  @override
  String get settingsAppLanguage => 'ऐप की भाषा';

  @override
  String get settingsBusinessName => 'व्यवसाय का नाम';

  @override
  String get settingsBusinessType => 'व्यवसाय प्रकार (जैसे किराना, फ़ार्मेसी)';

  @override
  String get settingsGstin => 'जीएसटीआईएन';

  @override
  String get settingsInvoicePrefix => 'चालान उपसर्ग';

  @override
  String get settingsLanguageSection => 'भाषा';

  @override
  String get settingsSave => 'सेटिंग्स सहेजें';

  @override
  String settingsSaveFailed(String error) {
    return 'सेटिंग्स सहेजी नहीं जा सकीं: $error';
  }

  @override
  String get settingsSaved => 'सेटिंग्स सहेजी गईं';

  @override
  String get settingsSaving => 'सहेजा जा रहा है...';

  @override
  String get settingsStoreProfile => 'दुकान प्रोफ़ाइल';

  @override
  String get settingsSubtitle => 'दुकान प्रोफ़ाइल और प्राथमिकताएं';

  @override
  String get settingsTitle => 'सेटिंग्स';

  @override
  String get signOut => 'साइन आउट';

  @override
  String signedInAs(String email) {
    return '$email के रूप में साइन इन';
  }

  @override
  String get smsSectionTitle => 'उधारी एसएमएस';

  @override
  String get smsSectionSubtitle =>
      'जब उधारी प्रविष्टि बनती है या भुगतान मिलता है तो ग्राहक को संदेश भेजें, ताकि उन्हें पता रहे कि उन्हें कितना देना है।';

  @override
  String get smsLogOnly => 'केवल लॉग';

  @override
  String get smsDeviceMode => 'फ़ोन सिम';

  @override
  String get smsTodayFree => 'आज का मुफ़्त एसएमएस';

  @override
  String smsUsageCount(String used, String limit, String remaining) {
    return '$used / $limit उपयोग · $remaining बाकी';
  }

  @override
  String get smsResetNote =>
      'आधी रात IST पर रीसेट होता है। दैनिक सीमा खत्म होने के बाद उधारी संदेश नहीं भेजे जाएंगे।';

  @override
  String get smsDeviceNote =>
      'इस फ़ोन की सिम से भेजा जाता है। किसी दूसरे डिवाइस या वेब पर बनाई गई प्रविष्टियों या दर्ज किए गए भुगतानों के लिए संदेश नहीं जाता।';

  @override
  String get smsChooseSimTitle => 'एसएमएस किस सिम से भेजें?';

  @override
  String get smsChooseSimBody =>
      'वह सिम चुनें जिसमें एसएमएस रिचार्ज है। यह फ़ोन उधारी संदेशों के लिए इसे याद रखेगा।';

  @override
  String smsSimSlot(int slot) {
    return 'सिम $slot';
  }

  @override
  String get smsRecentTitle => 'हाल के संदेश';

  @override
  String get smsEmpty => 'अभी तक कोई एसएमएस नहीं भेजा गया';

  @override
  String get smsManagerOnly =>
      'केवल मालिक या मैनेजर ही यह सेटिंग बदल सकते हैं।';

  @override
  String get smsLoadFailed => 'एसएमएस उपयोग लोड नहीं हो सका।';

  @override
  String get smsEnabledToast => 'उधारी एसएमएस चालू किया गया';

  @override
  String get smsDisabledToast => 'उधारी एसएमएस बंद किया गया';

  @override
  String smsUpdateFailed(String error) {
    return 'एसएमएस सेटिंग्स अपडेट नहीं हो सकीं: $error';
  }

  @override
  String get smsStatusQueued => 'कतार में';

  @override
  String get smsStatusSending => 'भेजा जा रहा है';

  @override
  String get smsStatusFailed => 'विफल';

  @override
  String get smsStatusHandedOff => 'एसएमएस ऐप से भेजा';

  @override
  String get smsStatusSkippedQuota => 'दैनिक सीमा पूरी';

  @override
  String get smsStatusSkippedNoMobile => 'मोबाइल नंबर नहीं';

  @override
  String get smsStatusSkippedOptOut => 'इनकार किया';

  @override
  String get smsStatusSkippedDisabled => 'एसएमएस बंद है';

  @override
  String get state => 'राज्य';

  @override
  String get status => 'स्थिति';

  @override
  String get statusActive => 'सक्रिय';

  @override
  String get statusCancelled => 'रद्द';

  @override
  String get statusClosed => 'बंद';

  @override
  String get statusCompleted => 'पूर्ण';

  @override
  String get statusDelivered => 'वितरित';

  @override
  String get statusDraft => 'मसौदा';

  @override
  String get statusInStock => 'स्टॉक में';

  @override
  String get statusInactive => 'निष्क्रिय';

  @override
  String get statusLow => 'कम';

  @override
  String get statusOpen => 'खुला';

  @override
  String get statusOutOfStock => 'स्टॉक खत्म';

  @override
  String get statusOutstanding => 'बकाया';

  @override
  String get statusOverdue => 'अतिदेय';

  @override
  String get statusPaid => 'भुगतान किया';

  @override
  String get statusPartial => 'आंशिक';

  @override
  String get statusPending => 'लंबित';

  @override
  String get statusReceived => 'प्राप्त';

  @override
  String get statusSent => 'भेजा गया';

  @override
  String get statusSettled => 'निपटाया';

  @override
  String get statusUnpaid => 'अवैतनिक';

  @override
  String get statusVoid => 'शून्य';

  @override
  String suppAcrossOpenAccounts(String count) {
    return '$count खुले खातों पर';
  }

  @override
  String get suppAddSupplier => 'विक्रेता जोड़ें';

  @override
  String get suppAddressOptional => 'पता (वैकल्पिक)';

  @override
  String get suppEmailOptional => 'ईमेल (वैकल्पिक)';

  @override
  String get suppGstinOptional => 'GSTIN (वैकल्पिक)';

  @override
  String suppLastDate(String date) {
    return 'अंतिम: $date';
  }

  @override
  String get suppNoSuppliers => 'अभी कोई विक्रेता नहीं';

  @override
  String get suppNoSuppliersSub =>
      'खरीद और बकाया ट्रैक करने के लिए अपना पहला विक्रेता जोड़ें।';

  @override
  String suppPayableAmount(String amount) {
    return 'देय: $amount';
  }

  @override
  String suppPurchasesAmount(String amount) {
    return 'खरीद: $amount';
  }

  @override
  String get suppSubtitle => 'विक्रेता और बकाया प्रबंधित करें';

  @override
  String get suppSupplierName => 'विक्रेता का नाम';

  @override
  String get suppTotalPayable => 'कुल देय राशि';

  @override
  String get suppTotalRegisteredVendors => 'कुल पंजीकृत विक्रेता';

  @override
  String suppXOutstanding(String count) {
    return '$count बकाया';
  }

  @override
  String suppXOverdue(String count) {
    return '$count अतिदेय';
  }

  @override
  String suppXSettled(String count) {
    return '$count निपटाए गए';
  }

  @override
  String get suppViewDetails => 'विवरण देखें';

  @override
  String get suppPayments => 'भुगतान';

  @override
  String get suppPurchaseOrders => 'खरीद ऑर्डर';

  @override
  String get suppNoPayments => 'कोई भुगतान दर्ज नहीं';

  @override
  String get suppNoPOs => 'कोई खरीद ऑर्डर नहीं';

  @override
  String get tabCustomers => 'ग्राहक';

  @override
  String get tabHome => 'होम';

  @override
  String get tabInvoice => 'चालान';

  @override
  String get tabMore => 'और';

  @override
  String get tabStock => 'स्टॉक';

  @override
  String get tabUdhari => 'उधारी';

  @override
  String get total => 'कुल';

  @override
  String get udhrAmountReceived => 'प्राप्त राशि';

  @override
  String get udhrBalance => 'शेष राशि';

  @override
  String get udhrDueToday => 'आज देय';

  @override
  String udhrEntryAmount(String amount) {
    return 'राशि: $amount';
  }

  @override
  String udhrEntryBalance(String balance) {
    return 'शेष राशि: $balance';
  }

  @override
  String udhrLastEntry(String date) {
    return 'अंतिम प्रविष्टि: $date';
  }

  @override
  String get udhrLedgerEntries => 'लेजर प्रविष्टियाँ';

  @override
  String udhrLoadEntriesFailed(String error) {
    return 'प्रविष्टियाँ लोड नहीं हो सकीं: $error';
  }

  @override
  String get udhrModeBank => 'बैंक';

  @override
  String get udhrModeCard => 'कार्ड';

  @override
  String get udhrModeCash => 'नकद';

  @override
  String get udhrModeUpi => 'यूपीआई';

  @override
  String get udhrNoLedgerEntries => 'कोई लेजर प्रविष्टि नहीं';

  @override
  String get udhrNoRecords => 'अभी कोई उधारी रिकॉर्ड नहीं';

  @override
  String get udhrNoteOptional => 'नोट (वैकल्पिक)';

  @override
  String udhrOutstandingBalance(String amount) {
    return 'बकाया राशि: $amount';
  }

  @override
  String udhrPaidVia(String amount, String mode) {
    return '✓ $mode से $amount प्राप्त किया गया';
  }

  @override
  String udhrPaidViaNote(String amount, String mode, String note) {
    return '✓ $mode से $amount प्राप्त किया गया · $note';
  }

  @override
  String get udhrPaymentMode => 'भुगतान का तरीका';

  @override
  String get udhrPaymentReceived => 'उधारी भुगतान सफलतापूर्वक प्राप्त हुआ।';

  @override
  String get udhrReceive => 'प्राप्त करें';

  @override
  String udhrReceivePaymentFrom(String name) {
    return '$name से भुगतान प्राप्त करें';
  }

  @override
  String get udhrRecordPayment => 'भुगतान प्राप्त करें';

  @override
  String get udhrTitle => 'ग्राहक उधारी';

  @override
  String udhrTotalAmount(String amount) {
    return 'कुल: $amount';
  }

  @override
  String get udhrTotalReceivables => 'कुल बकाया राशि';

  @override
  String get udhrUpcoming => 'आगामी';

  @override
  String userAllUsers(String count) {
    return 'सभी उपयोगकर्ता ($count)';
  }

  @override
  String get userEmailOptional => 'ईमेल (वैकल्पिक)';

  @override
  String get userEmailRequired => 'ईमेल';

  @override
  String get userFullName => 'पूरा नाम';

  @override
  String get userInvite => 'आमंत्रित करें';

  @override
  String get userInviteHint =>
      'टीम में शामिल होने के लिए यह आमंत्रण लिंक उनके साथ साझा करें।';

  @override
  String get copyInviteLink => 'लिंक कॉपी करें';

  @override
  String get userInviteMember => 'सदस्य को आमंत्रित करें';

  @override
  String get userInviteTitle => 'टीम सदस्य को आमंत्रित करें';

  @override
  String userJoinedAt(String date) {
    return 'शामिल: $date';
  }

  @override
  String get userMobileOptional => 'मोबाइल (वैकल्पिक)';

  @override
  String get userNoUsers => 'अभी तक कोई अन्य उपयोगकर्ता नहीं';

  @override
  String get userRole => 'भूमिका';

  @override
  String get userRoleAdmin => 'एडमिन';

  @override
  String get userRoleCashier => 'कैशियर';

  @override
  String get userRoleManager => 'प्रबंधक';

  @override
  String get userRoleOwner => 'मालिक';

  @override
  String get userRoleStaff => 'स्टाफ';

  @override
  String get userTitle => 'टीम और उपयोगकर्ता';

  @override
  String get userYou => 'आप';

  @override
  String userYouLabel(String name) {
    return '$name (आप)';
  }

  @override
  String get yes => 'हाँ';

  @override
  String get mobileNumber => 'मोबाइल नंबर';

  @override
  String get udhrAdd => 'उधारी जोड़ें';

  @override
  String get udhrAddNewCustomer => 'नया ग्राहक जोड़ें';

  @override
  String get udhrAmountLabel => 'राशि';

  @override
  String get udhrAmountRequired => 'सही राशि दर्ज करें (0 से अधिक)';

  @override
  String get udhrCustomer => 'ग्राहक';

  @override
  String get udhrDueDate => 'देय तिथि';

  @override
  String get udhrEntryDate => 'प्रविष्टि तिथि';

  @override
  String get udhrNewEntry => 'नई उधारी प्रविष्टि';

  @override
  String get udhrSelectCustomer => 'ग्राहक चुनें';

  @override
  String get validationMobileNumber => 'सही मोबाइल नंबर दर्ज करें (10-12 अंक)';

  @override
  String errCreateUdhaari(Object error) {
    return 'उधारी जोड़ी नहीं जा सकी: $error';
  }

  @override
  String get menuViewBusinessProfile => 'व्यवसाय प्रोफाइल पहा';

  @override
  String get bizProfileTitle => 'व्यवसाय प्रोफाइल';

  @override
  String get bizProfileSubtitle => 'आपकी व्यवसाय जानकारी और योजना';

  @override
  String get bizOwnerName => 'स्वामी';

  @override
  String get bizGstin => 'GSTIN';

  @override
  String get bizAddress => 'पता';

  @override
  String get bizMobile => 'मोबाइल';

  @override
  String get bizCategory => 'श्रेणी';

  @override
  String get bizRegisteredOn => 'पंजीकरण तिथि';

  @override
  String get bizPlan => 'योजना';

  @override
  String get bizPlanStatus => 'स्थिति';

  @override
  String get bizPlanFree => 'फ्री';

  @override
  String get bizPlanTrial => 'ट्रायल';

  @override
  String get bizStatusSuspended => 'निलंबित';

  @override
  String get signOutConfirmTitle => 'साइन आउट करें?';

  @override
  String get signOutConfirmMessage =>
      'क्या आप साइन आउट करना चाहते हैं? अगली बार साइन इन करने के लिए आपको OTP सत्यापित करना होगा।';

  @override
  String get navDashboard => 'डैशबोर्ड';

  @override
  String get navProductsStock => 'उत्पाद और स्टॉक';

  @override
  String get navSalesInvoices => 'बिक्री और बिल';

  @override
  String get navCustomers => 'ग्राहक';

  @override
  String get navSystem => 'सिस्टम';

  @override
  String get userRoleStockManager => 'स्टॉक मैनेजर';

  @override
  String get userRolePlatformAdmin => 'प्लेटफ़ॉर्म एडमिन';

  @override
  String get roleAccessFull => 'Full Access / संपूर्ण प्रवेश';

  @override
  String get roleAccessLimited => 'मर्यादित दृश्यता / Limited Visibility';

  @override
  String get roleAccessPlatform => 'Platform Access / प्रशासक';

  @override
  String get syncOnline => 'ऑनलाइन';

  @override
  String get syncOffline => 'ऑफ़लाइन';

  @override
  String get appTagline => 'मी दुकानदार - स्मार्ट व्यवसाय व्यवस्थापन';

  @override
  String get exitAppTitle => 'MiDukandar से बाहर निकलें?';

  @override
  String get exitAppMessage => 'क्या आप वाकई ऐप से बाहर निकलना चाहते हैं?';

  @override
  String get exitApp => 'बाहर निकलें';

  @override
  String get billReverseTitle => 'बिल रद्द/वापस लें';

  @override
  String billReverseMessage(Object invoiceNumber) {
    return 'क्या आप बिल \"$invoiceNumber\" को रद्द/वापस करना चाहते हैं? यह एक वापसी प्रविष्टि बनाता है और मूल बिल को रद्द के रूप में चिह्नित करता है। एक कारण आवश्यक है।';
  }

  @override
  String get billReverse => 'रद्द/वापस';

  @override
  String errReverseInvoice(Object error) {
    return 'बिल रद्द नहीं कर सके: $error';
  }

  @override
  String errUpdateInvoice(Object error) {
    return 'इनवॉइस अपडेट नहीं कर सके: $error';
  }

  @override
  String get suppEditSupplier => 'आपूर्तिकर्ता संपादित करें';

  @override
  String get suppDeleteTitle => 'आपूर्तिकर्ता हटाएं?';

  @override
  String suppDeleteMessage(Object name) {
    return 'आपूर्तिकर्ता \"$name\" को हटाएं? यह आपूर्तिकर्ता को संग्रहीत करता है और सूचियों से हटा देता है। बकाया खरीद ऑर्डर पहले रद्द होने चाहिए।';
  }

  @override
  String errUpdateSupplier(Object error) {
    return 'आपूर्तिकर्ता अपडेट नहीं कर सके: $error';
  }

  @override
  String errDeleteSupplier(Object error) {
    return 'आपूर्तिकर्ता हटा नहीं सके: $error';
  }

  @override
  String get expnEditExpense => 'खर्च संपादित करें';

  @override
  String get expnDeleteTitle => 'खर्च हटाएं?';

  @override
  String expnDeleteMessage(Object title) {
    return 'खर्च \"$title\" हटाएं? यह पूर्ववत नहीं किया जा सकता।';
  }

  @override
  String errUpdateExpense(Object error) {
    return 'खर्च अपडेट नहीं कर सके: $error';
  }

  @override
  String errDeleteExpense(Object error) {
    return 'खर्च हटा नहीं सके: $error';
  }

  @override
  String get purchPayTitle => 'भुगतान रिकॉर्ड करें';

  @override
  String get userChangeRole => 'भूमिका बदलें';

  @override
  String get userDeactivate => 'निष्क्रिय करें';

  @override
  String get userActivate => 'सक्रिय करें';

  @override
  String get userCannotManage =>
      'केवल स्वामी अन्य टीम सदस्यों का प्रबंधन कर सकते हैं।';

  @override
  String errUpdateUserStatus(Object error) {
    return 'उपयोगकर्ता स्थिति अपडेट नहीं कर सके: $error';
  }

  @override
  String errUpdateUserRole(Object error) {
    return 'उपयोगकर्ता भूमिका अपडेट नहीं कर सके: $error';
  }

  @override
  String get regTitle => 'अपना खाता बनाएं';

  @override
  String get regSubtitle => 'एक ही चरण में अपना खाता और दुकान पंजीकृत करें।';

  @override
  String get regEmailLabel => 'खाता ईमेल';

  @override
  String get regEmailRequired => 'अपने खाते के लिए एक ईमेल पता दर्ज करें।';

  @override
  String get regEmailInvalid => 'एक वैध ईमेल पता दर्ज करें।';

  @override
  String get regOwnerNameLabel => 'दुकान मालिक का नाम';

  @override
  String get regOwnerNameRequired => 'दुकान मालिक का नाम दर्ज करें';

  @override
  String get regShopNameLabel => 'दुकान / व्यवसाय का नाम';

  @override
  String get regShopNameRequired => 'अपनी दुकान का नाम दर्ज करें';

  @override
  String get regStoreTypeLabel => 'दुकान का प्रकार';

  @override
  String get regPhoneLabel => 'मोबाइल नंबर';

  @override
  String get regGstLabel => 'GSTIN (वैकल्पिक)';

  @override
  String get regGstHint => '27ABCDE1234F1Z5';

  @override
  String get regLanguageLabel => 'ऐप भाषा';

  @override
  String get regAddressLabel => 'पता';

  @override
  String get regAddressHint => 'दुकान नंबर, गली, क्षेत्र';

  @override
  String get regAddressRequired => 'अपनी दुकान का पता दर्ज करें';

  @override
  String get regCityLabel => 'शहर';

  @override
  String get regCityRequired => 'अपना शहर दर्ज करें';

  @override
  String get regStateLabel => 'राज्य';

  @override
  String get regPincodeLabel => 'पिनकोड';

  @override
  String get regPincodeHint => '411001';

  @override
  String get regPincodeRequired => 'एक वैध 6-अंकीय पिनकोड दर्ज करें';

  @override
  String get regPincodeInvalid => 'पिनकोड 6 अंकों का होना चाहिए';

  @override
  String get regCurrencyLabel => 'मुद्रा';

  @override
  String get regInvoicePrefixLabel => 'इनवॉइस प्रीफिक्स';

  @override
  String get regInvoicePrefixHint => 'उदा. INV → INV-0001';

  @override
  String get regCreateAccount => 'खाता बनाएं';

  @override
  String get regSubmitting => 'खाता बनाया जा रहा है...';

  @override
  String get regSuccessMessage =>
      'खाता बनाया गया! जारी रखने के लिए साइन इन करें।';

  @override
  String get regBackToLogin => 'लॉगिन पर वापस';

  @override
  String get regSecureNotice =>
      'आपका डेटा एन्क्रिप्टेड और सुरक्षित रूप से संग्रहीत है।';

  @override
  String get regSecureBadge => 'सुरक्षित और निजी';

  @override
  String get regGstBadge => 'GST-तैयार इनवॉइसिंग';

  @override
  String get regOfflineBadge => 'ऑफलाइन बिलिंग समर्थन';

  @override
  String get regSectionAccountDetails => 'खाता विवरण';

  @override
  String get regSectionStoreDetails => 'दुकान का विवरण';

  @override
  String get regSectionLocation => 'स्थान';

  @override
  String get regSectionPreferences => 'प्राथमिकताएं';
}
