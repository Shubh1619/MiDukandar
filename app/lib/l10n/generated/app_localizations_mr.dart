// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Marathi (`mr`).
class AppLocalizationsMr extends AppLocalizations {
  AppLocalizationsMr([String locale = 'mr']) : super(locale);

  @override
  String get add => 'जोडा';

  @override
  String get address => 'पत्ता';

  @override
  String get amount => 'रक्कम';

  @override
  String get appTitle => 'स्मार्ट बिझनेस';

  @override
  String get authChangeEmail => 'ईमेल बदला';

  @override
  String get authCodeSentNotice =>
      'लॉगिन कोड पाठवला आहे. पडताळणी कोडसाठी तुमचा ईमेल तपासा.';

  @override
  String authCodeSentTo(String email) {
    return '$email वर लॉगिन कोड पाठवला आहे.';
  }

  @override
  String authDevMode(String masterCode) {
    return 'डेव्ह मोड: मास्टर कोड $masterCode आहे. कोणताही ईमेल पाठवला नाही.';
  }

  @override
  String get authEmail => 'ईमेल पत्ता';

  @override
  String get authEnterEmail => 'तुमचा ईमेल पत्ता प्रविष्ट करा.';

  @override
  String get authEnterOtp => 'पडताळणी कोड प्रविष्ट करा';

  @override
  String get authErrSendOtp => 'OTP पाठवता आला नाही. कृपया पुन्हा प्रयत्न करा.';

  @override
  String get authErrVerify => 'पडताळणी अयशस्वी झाली. कृपया पुन्हा प्रयत्न करा.';

  @override
  String get authUnableToConnect =>
      'MiDukandar ला कनेक्ट करता आले नाही. कृपया तुमचा इंटरनेट कनेक्शन तपासा आणि पुन्हा प्रयत्न करा.';

  @override
  String get authServiceUnavailable =>
      'MiDukandar सेवा तात्पुरती उपलब्ध नाही. कृपया थोड्या वेळाने पुन्हा प्रयत्न करा.';

  @override
  String get authConnectionTimeout =>
      'कनेक्शन वेळ संपले. कृपया पुन्हा प्रयत्न करा.';

  @override
  String get authAccountNotFound =>
      'खाते सापडले नाही. कृपया तुमचा ईमेल तपासा किंवा व्यवसाय नोंदवा.';

  @override
  String get authTryAgain => 'पुन्हा प्रयत्न करा';

  @override
  String get authOtpSent => 'OTP पाठवले';

  @override
  String get authGetOtp => 'OTP मिळवा';

  @override
  String get authInvalidEmail => 'वैध ईमेल पत्ता प्रविष्ट करा.';

  @override
  String get authNoAccount => 'तुमचे खाते नाही का?';

  @override
  String authOtpInstructions(String time) {
    return 'तुमच्या ईमेलमधील 6-अंकी कोड टाइप करा. कोड $time मध्ये संपेल.';
  }

  @override
  String get authOtpPlaceholder => '• • • • • •';

  @override
  String get authOtpTooShort =>
      'कृपया आम्ही पाठवलेला 4-6 अंकी कोड प्रविष्ट करा.';

  @override
  String get authRegisterBusiness => 'तुमचा व्यवसाय नोंदणी करा';

  @override
  String get authResendCode => 'कोड पुन्हा पाठवा';

  @override
  String authResendIn(String time) {
    return '$time मध्ये कोड पुन्हा पाठवा';
  }

  @override
  String get authSendingOtp => 'OTP पाठवले जात आहे...';

  @override
  String get authSignInBadge => 'साइन इन';

  @override
  String get authSignInSubtitle =>
      'तुमचे दुकान व्यवस्थापित करण्यासाठी आणि व्यवसाय पुढे नेण्यासाठी साइन इन करा.';

  @override
  String get authSigningIn => 'साइन इन होत आहे...';

  @override
  String get authVerifyAndSignIn => 'पडताळा करा आणि साइन इन करा';

  @override
  String get authWelcomeBack => 'पुन्हा स्वागत आहे';

  @override
  String get back => 'मागे';

  @override
  String get billAddInvoice => 'इनव्हॉइस जोडा';

  @override
  String get billAll => 'सर्व';

  @override
  String get billCreatedFromMobileApp => 'मोबाइल अ‍ॅपवरून तयार केले';

  @override
  String billCustomerLine(String name) {
    return 'ग्राहक: $name';
  }

  @override
  String get billCustomerName => 'ग्राहकाचे नाव';

  @override
  String billDateLine(String date) {
    return 'दिनांक: $date';
  }

  @override
  String get billDue => 'थकीत';

  @override
  String billDueAmount(String amount) {
    return 'थकीत $amount';
  }

  @override
  String get billEditInvoice => 'इनव्हॉइस संपादित करा';

  @override
  String get billGenericItem => 'सामान्य वस्तू';

  @override
  String get billHeldBills => 'होल्ड बिले';

  @override
  String get billHeldSaved => 'बिल होल्ड झाले';

  @override
  String get billHold => 'होल्ड करा';

  @override
  String get billNoHeldBills => 'कोणतीही होल्ड बिले नाहीत';

  @override
  String get billResume => 'पुन्हा सुरू करा';

  @override
  String get billInvoices => 'इनव्हॉइस';

  @override
  String billLineItem(String name, String qty) {
    return '$name x $qty';
  }

  @override
  String billMobileLine(String number) {
    return 'मोबाइल: $number';
  }

  @override
  String get billMode => 'पद्धत';

  @override
  String get billModeBank => 'बँक';

  @override
  String get billModeCard => 'कार्ड';

  @override
  String get billModeCash => 'रोख';

  @override
  String billModeLine(String mode) {
    return 'पद्धत: $mode';
  }

  @override
  String get billModeUpi => 'UPI';

  @override
  String get billNewInvoice => 'नवीन इनव्हॉइस';

  @override
  String get billNoLineItems => 'कोणत्याही वस्तू नाहीत';

  @override
  String get billNoMatchingInvoices => 'कोणतेही जुळणारे इनव्हॉइस नाहीत';

  @override
  String billNoteLine(String note) {
    return 'टीप: $note';
  }

  @override
  String get billPaidAmount => 'भरलेली रक्कम';

  @override
  String billPayAmount(String amount) {
    return '$amount भरा';
  }

  @override
  String get billQty => 'प्रमाण';

  @override
  String get billRevenue => 'महसूल';

  @override
  String get billSearchPlaceholder => 'ग्राहक किंवा इनव्हॉइस शोधा';

  @override
  String get billUdhaar => 'उधार';

  @override
  String get billUnitPrice => 'एकक किंमत';

  @override
  String get billWalkInCustomer => 'वॉक-इन ग्राहक';

  @override
  String get cancel => 'रद्द करा';

  @override
  String get city => 'शहर';

  @override
  String get close => 'बंद करा';

  @override
  String get confirm => 'पुष्टी करा';

  @override
  String get custAddTitle => 'ग्राहक जोडा';

  @override
  String custDeleteConfirm(String name) {
    return 'ग्राहक \"$name\" हटवायचा? हे पूर्ववत करता येणार नाही.';
  }

  @override
  String get custDeleteTitle => 'ग्राहक हटवा';

  @override
  String get custEditTitle => 'ग्राहक संपादित करा';

  @override
  String get custNameLabel => 'ग्राहकाचे नाव';

  @override
  String get custNoMobile => 'मोबाइल नंबर नाही';

  @override
  String get dashCustomerUdhaari => 'ग्राहक उधारी';

  @override
  String get dashCustomerUdhaariSub => 'एकूण थकीत लेजर';

  @override
  String dashHeaderSubtitle(String storeName) {
    return '$storeName ची आजची कामगिरी';
  }

  @override
  String get dashLowStock => 'कमी स्टॉक';

  @override
  String get dashLowStockSub => 'किमान स्टॉक पातळीच्या खाली उत्पादने';

  @override
  String get dashNoTransactions => 'अजून कोणतेही व्यवहार नाहीत';

  @override
  String get dashNoTransactionsSub =>
      'सेल्स टॅबवरून तुमची पहिली विक्री तयार करा.';

  @override
  String get dashProfitToday => 'आजचा अंदाजित नफा';

  @override
  String get dashProfitTodaySub => 'करापूर्वी आजचा मार्जिन';

  @override
  String get dashPurchasesToday => 'आजची खरेदी';

  @override
  String get dashPurchasesTodaySub => 'आजची स्टॉक खरेदी';

  @override
  String get dashQuickControls => 'क्विक कंट्रोल्स';

  @override
  String get dashQuickInvoices => 'इनव्हॉइस';

  @override
  String get dashQuickReports => 'अहवाल';

  @override
  String get dashRecentTransactions => 'अलीकडील व्यवहार';

  @override
  String get dashSalesToday => 'आजची विक्री';

  @override
  String get dashSalesTodaySub => 'आजचे पक्के बिल';

  @override
  String get dashSupplierPayables => 'पुरवठादार देय रक्कम';

  @override
  String get dashSupplierPayablesSub => 'खुल्या खरेदी बिलांवर देय';

  @override
  String get dashTimeAm => 'पूर्वाह्न';

  @override
  String get dashTimePm => 'अपराह्न';

  @override
  String get dashTitle => 'डॅशबोर्ड';

  @override
  String get dashTypePayment => 'पेमेंट';

  @override
  String get dashTypePurchase => 'खरेदी';

  @override
  String get dashTypeSale => 'विक्री';

  @override
  String get dashViewAll => 'सर्व पहा';

  @override
  String get date => 'दिनांक';

  @override
  String get delete => 'हटवा';

  @override
  String get done => 'झाले';

  @override
  String get edit => 'संपादित करा';

  @override
  String errAdjustStock(String error) {
    return 'स्टॉक दुरुस्त करता आले नाही: $error';
  }

  @override
  String errArchiveProduct(String error) {
    return 'उत्पादन संग्रहित करता आले नाही: $error';
  }

  @override
  String errCreateCustomer(String error) {
    return 'ग्राहक तयार करता आला नाही: $error';
  }

  @override
  String errCreateExpense(String error) {
    return 'खर्च नोंदवता आला नाही: $error';
  }

  @override
  String errCreateInvoice(String error) {
    return 'पावती तयार करता आली नाही: $error';
  }

  @override
  String errCreateProduct(String error) {
    return 'उत्पादन तयार करता आले नाही: $error';
  }

  @override
  String errCreatePurchase(String error) {
    return 'खरेदी तयार करता आली नाही: $error';
  }

  @override
  String errCreateSupplier(String error) {
    return 'पुरवठादार तयार करता आला नाही: $error';
  }

  @override
  String errDeleteCustomer(String error) {
    return 'ग्राहक हटवता आला नाही: $error';
  }

  @override
  String errInviteUser(String error) {
    return 'वापरकर्ता आमंत्रित करता आला नाही: $error';
  }

  @override
  String errMarkPaid(String error) {
    return 'पावती भरले म्हणून चिन्हांकित करता आली नाही: $error';
  }

  @override
  String errRecordPayment(String error) {
    return 'पेमेंट नोंदवता आले नाही: $error';
  }

  @override
  String errRefreshFailed(String error) {
    return 'रिफ्रेश अपयशी: $error';
  }

  @override
  String get errSessionExpired =>
      'तुमचे सत्र संपले आहे. कृपया पुन्हा साइन इन करा.';

  @override
  String errUpdateCustomer(String error) {
    return 'ग्राहक अपडेट करता आला नाही: $error';
  }

  @override
  String errUpdateProduct(String error) {
    return 'उत्पादन अपडेट करता आले नाही: $error';
  }

  @override
  String get expnAddExpense => 'खर्च जोडा';

  @override
  String get expnByCategory => 'श्रेणीनुसार';

  @override
  String get expnCategoryOptional => 'श्रेणी (ऐच्छिक)';

  @override
  String get expnDefaultTitle => 'खर्च';

  @override
  String get expnExpenseTitle => 'खर्चाचे शीर्षक';

  @override
  String get expnGeneral => 'सामान्य';

  @override
  String get expnLastMonth => 'मागील महिन्यात';

  @override
  String get expnNoExpenses => 'अजून खर्च नाही';

  @override
  String get expnNoteFromApp => 'मोबाइल अॅपवरून तयार केले';

  @override
  String get expnOther => 'इतर';

  @override
  String get expnPaymentBank => 'बँक';

  @override
  String get expnPaymentCard => 'कार्ड';

  @override
  String get expnPaymentCash => 'रोख';

  @override
  String get expnPaymentMode => 'पेमेंटची पद्धत';

  @override
  String get expnPaymentUpi => 'UPI';

  @override
  String get expnThisMonth => 'या महिन्यात';

  @override
  String get invnAddPlus => 'जोडा (+)';

  @override
  String invnAdjustFailed(String error) {
    return 'समायोजन अयशस्वी: $error';
  }

  @override
  String invnAdjustStockTitle(String product) {
    return '$product — स्टॉक समायोजित करा';
  }

  @override
  String get invnAll => 'सर्व';

  @override
  String get invnBal => 'शिल्लक';

  @override
  String invnCurrentBalance(String value) {
    return 'सध्याची शिल्लक: $value';
  }

  @override
  String get invnGeneral => 'सामान्य';

  @override
  String get invnHeaderSubtitle => 'हालचाल लेजरमधून लाइव्ह स्टॉक';

  @override
  String get invnLoadError => 'इन्व्हेंटरी लोड करता आली नाही';

  @override
  String get invnLowOnly => 'फक्त कमी';

  @override
  String get invnLowStock => 'कमी स्टॉक';

  @override
  String get invnManualAdjustment => 'मॅन्युअल समायोजन';

  @override
  String get invnMovements => 'हालचाली';

  @override
  String get invnMovementsSubtitle => 'फक्त-जोडा हालचाल लेजर';

  @override
  String get invnMovementsTitle => 'स्टॉक हालचाली';

  @override
  String invnMrp(String price) {
    return 'MRP $price';
  }

  @override
  String get invnNoMovements => 'अजून कोणत्याही हालचाली नाहीत';

  @override
  String get invnNoMovementsSub => 'विक्री, खरेदी आणि समायोजने येथे दिसतील.';

  @override
  String get invnNoSku => 'SKU नाही';

  @override
  String get invnNoStock => 'स्टॉक सापडला नाही';

  @override
  String get invnNoStockSub =>
      'सुरुवात करण्यासाठी उत्पादने जोडा किंवा स्टॉक समायोजित करा.';

  @override
  String get invnQuantity => 'प्रमाण';

  @override
  String get invnReason => 'कारण';

  @override
  String get invnRemoveMinus => 'काढा (−)';

  @override
  String get invnSearchHint => 'उत्पादने शोधा...';

  @override
  String get invnStockUpdated => 'स्टॉक अपडेट झाले';

  @override
  String get invnValueLabel => 'इन्व्हेंटरी मूल्य';

  @override
  String get loading => 'लोड होत आहे...';

  @override
  String get mobile => 'मोबाइल';

  @override
  String get moreExpenses => 'खर्च';

  @override
  String get moreExpensesSub => 'रजिस्टर आणि श्रेणी विभागणी';

  @override
  String get moreInventory => 'इन्व्हेंटरी';

  @override
  String get moreInventorySub => 'स्टॉक पातळ्या, कमी स्टॉक आणि हालचाली';

  @override
  String get morePayments => 'पेमेंट';

  @override
  String get morePaymentsSub => 'ग्राहक पावती इतिहास';

  @override
  String get morePurchases => 'खरेदी';

  @override
  String get morePurchasesSub => 'खरेदी रजिस्टर आणि पेमेंट';

  @override
  String get moreReports => 'जीएसटी आणि अहवाल';

  @override
  String get moreReportsSub => 'विक्री, खरेदी, नफा-तोटा आणि जीएसटी';

  @override
  String get moreSettings => 'सेटिंग्ज';

  @override
  String get moreSettingsSub => 'दुकान प्रोफाइल आणि भाषा';

  @override
  String get moreSignOut => 'साइन आउट';

  @override
  String get moreSignOutSub => 'ही सत्र संपन्न करा';

  @override
  String get moreSubtitle => 'सर्व सेवा';

  @override
  String get moreSuppliers => 'पुरवठादार';

  @override
  String get moreSuppliersSub => 'विक्रेते, देय पेमेंट आणि तपशील';

  @override
  String get moreTitle => 'अधिक';

  @override
  String get moreUsers => 'वापरकर्ते आणि भूमिका';

  @override
  String get moreUsersSub => 'संघ सदस्य आणि आमंत्रणे';

  @override
  String get myStore => 'माझे दुकान';

  @override
  String get name => 'नाव';

  @override
  String get no => 'नाही';

  @override
  String get ok => 'ठीक';

  @override
  String get paymEmpty => 'अजून पेमेंट नाही';

  @override
  String get paymPayment => 'पेमेंट';

  @override
  String paymReference(String type, String id) {
    return '$type #$id';
  }

  @override
  String get phone => 'फोन';

  @override
  String get pincode => 'पिन कोड';

  @override
  String get pleaseWait => 'कृपया प्रतीक्षा करा...';

  @override
  String get prodAbbrevCrore => 'कोटी';

  @override
  String get prodAbbrevLakh => 'लाख';

  @override
  String get prodAbbrevThousand => 'हजार';

  @override
  String get prodActionsTitle => 'उत्पाद क्रिया';

  @override
  String get prodAddLabel => 'जोडा (+)';

  @override
  String get prodAddTitle => 'उत्पाद जोडा';

  @override
  String get prodAdjustStock => 'स्टॉक समायोजित करा';

  @override
  String prodAdjustStockTitle(String productName) {
    return 'स्टॉक समायोजित करा · $productName';
  }

  @override
  String get prodAll => 'सर्व';

  @override
  String get prodApply => 'लागू करा';

  @override
  String get prodArchive => 'संग्रहित करा';

  @override
  String get prodArchiveConfirmTitle => 'उत्पाद संग्रहित करायचे?';

  @override
  String prodArchiveMessage(String productName) {
    return '\"$productName\" विक्री आणि याद्यांमधून लपवले जाईल. नोंदीसाठी मूव्हमेंट टिकवून ठेवल्या जातील.';
  }

  @override
  String get prodArchiveProduct => 'उत्पाद संग्रहित करा';

  @override
  String get prodCategory => 'श्रेणी';

  @override
  String prodCurrently(String stock, String unit) {
    return 'सध्या: $stock $unit';
  }

  @override
  String get prodEditProduct => 'उत्पाद संपादित करा';

  @override
  String get prodEmptySubtitle => 'वेगळा शोध घ्या किंवा नवीन उत्पाद जोडा.';

  @override
  String get prodEmptyTitle => 'कोणतेही उत्पाद सापडले नाही';

  @override
  String get prodGeneral => 'सामान्य';

  @override
  String get prodGstPercent => 'GST %';

  @override
  String prodLowQty(String qty) {
    return 'कमी · $qty';
  }

  @override
  String get prodManualAdjustment => 'मॅन्युअल समायोजन';

  @override
  String get prodMinStock => 'किमान स्टॉक';

  @override
  String get prodNoMovements => 'अद्याप कोणतीही मूव्हमेंट नोंदवलेली नाही';

  @override
  String get prodOpeningStock => 'सुरुवातीचा स्टॉक';

  @override
  String prodProductMeta(String category, String unit) {
    return '$category · $unit';
  }

  @override
  String prodProductMetaSku(String category, String unit, String sku) {
    return '$category · $unit · SKU $sku';
  }

  @override
  String get prodProductName => 'उत्पादाचे नाव';

  @override
  String get prodPurchase => 'खरेदी';

  @override
  String get prodPurchasePrice => 'खरेदी किंमत';

  @override
  String get prodQuantity => 'प्रमाण';

  @override
  String get prodReason => 'कारण';

  @override
  String get prodRemoveLabel => 'काढा (−)';

  @override
  String get prodSearchHint => 'नाव, SKU किंवा बारकोडने शोधा...';

  @override
  String get prodSelling => 'विक्री';

  @override
  String get prodSellingPrice => 'विक्री किंमत';

  @override
  String get prodStockMovements => 'स्टॉक मूव्हमेंट्स';

  @override
  String prodStockQty(String qty) {
    return '$qty स्टॉकमध्ये';
  }

  @override
  String get prodSubtitle => 'कॅटलॉग, किंमत आणि स्टॉक';

  @override
  String get prodTitle => 'उत्पादने';

  @override
  String get prodUnit => 'एकक';

  @override
  String get prodValue => 'मूल्य';

  @override
  String get purchAddPurchase => 'खरेदी जोडा';

  @override
  String purchDueAmount(String amount) {
    return 'बाकी: $amount';
  }

  @override
  String get purchFromMobileApp => 'मोबाइल अ‍ॅपवरून तयार केले';

  @override
  String get purchNoPurchasesYet => 'अजून कोणतीही खरेदी नाही';

  @override
  String get purchPurchaseItem => 'खरेदी वस्तू';

  @override
  String get purchSupplierName => 'पुरवठादाराचे नाव';

  @override
  String get purchTotalAmount => 'एकूण रक्कम';

  @override
  String get purchTotalBilled => 'एकूण बिल';

  @override
  String get purchUnknownSupplier => 'अज्ञात पुरवठादार';

  @override
  String get refresh => 'रिफ्रेश करा';

  @override
  String get reptBills => 'बिल';

  @override
  String get reptEstProfit => 'अंदाजित नफा';

  @override
  String get reptEstimatedProfit => 'अंदाजित नफा';

  @override
  String get reptGstSummary => 'जीएसटी सारांश';

  @override
  String get reptInputGst => 'इनपुट जीएसटी (खरेदी)';

  @override
  String get reptInventoryValue => 'इन्व्हेंटरी मूल्य (किंमत)';

  @override
  String get reptInvoices => 'इनव्हॉइस';

  @override
  String get reptLessTotalPurchases => 'वजा करा: एकूण खरेदी';

  @override
  String get reptNetGstPayable => 'निव्वळ जीएसटी देय';

  @override
  String get reptNoChartData => 'चार्टसाठी अद्याप डेटा नाही';

  @override
  String get reptNoSalesRows => 'अद्याप विक्री पंक्ती नाही';

  @override
  String get reptOutputGst => 'आउटपुट जीएसटी (विक्री)';

  @override
  String get reptProfitLossPeriod => 'नफा-तोटा (कालावधी)';

  @override
  String get reptRecentSalesRows => 'अलीकडील विक्री पंक्ती';

  @override
  String get reptSales => 'विक्री';

  @override
  String get reptSalesVsPurchasesPeriod => 'विक्री विरुद्ध खरेदी (कालावधी)';

  @override
  String get reptTitle => 'अहवाल';

  @override
  String get reptTotalSales => 'एकूण विक्री';

  @override
  String get reptCogs => 'सीओजीएस (विकलेल्या मालाची किंमत)';

  @override
  String get reptGrossMargin => 'एकूण मार्जिन';

  @override
  String get reptGrossProfit => 'एकूण नफा';

  @override
  String get reptGstBreakup => 'जीएसटी दर विभाजन';

  @override
  String get reptNetMargin => 'निव्वळ मार्जिन';

  @override
  String get reptNetProfit => 'निव्वळ नफा';

  @override
  String get reptNoData => 'या कालावधीसाठी डेटा नाही';

  @override
  String get reptRate => 'दर';

  @override
  String get reptRealPnl => 'नफा-तोटा (वास्तविक)';

  @override
  String get reptRevenue => 'महसूल';

  @override
  String get reptTax => 'कर';

  @override
  String get reptTaxable => 'करपात्र';

  @override
  String get required => 'आवश्यक';

  @override
  String get retry => 'पुन्हा प्रयत्न करा';

  @override
  String get referTitle => 'रेफर करा आणि कमवा';

  @override
  String get referYourCode => 'तुमचा रेफरल कोड';

  @override
  String get referCopy => 'कोड कॉपी करा';

  @override
  String get referCopied => 'रेफरल कोड कॉपी झाला';

  @override
  String get referOnlyOwner => 'फक्त दुकानाचा मालक रेफरल पाहू शकतो';

  @override
  String get referReferred => 'रेफर केलेली दुकाने';

  @override
  String get save => 'जतन करा';

  @override
  String get searchHint => 'शोधा...';

  @override
  String get sectionExpenses => 'खर्च';

  @override
  String get sectionInventory => 'इन्व्हेंटरी';

  @override
  String get sectionPayments => 'पेमेंट';

  @override
  String get sectionProducts => 'उत्पादने';

  @override
  String get sectionPurchases => 'खरेदी';

  @override
  String get sectionReports => 'जीएसटी आणि अहवाल';

  @override
  String get sectionSettings => 'सेटिंग्ज';

  @override
  String get sectionSuppliers => 'पुरवठादार';

  @override
  String get sectionSupplierInvoices => 'पुरवठादार बीजक';

  @override
  String get sectionUdhaari => 'उधारी';

  @override
  String get sectionUsers => 'वापरकर्ते आणि भूमिका';

  @override
  String get settingsAddressSection => 'पत्ता';

  @override
  String get settingsAppLanguage => 'अ‍ॅपची भाषा';

  @override
  String get settingsBusinessName => 'व्यवसायाचे नाव';

  @override
  String get settingsBusinessType => 'व्यवसाय प्रकार (उदा. किराणा, फार्मसी)';

  @override
  String get settingsGstin => 'जीएसटीआयएन';

  @override
  String get settingsInvoicePrefix => 'पावती उपसर्ग';

  @override
  String get settingsLanguageSection => 'भाषा';

  @override
  String get settingsSave => 'सेटिंग्ज जतन करा';

  @override
  String settingsSaveFailed(String error) {
    return 'सेटिंग्ज जतन करता आल्या नाहीत: $error';
  }

  @override
  String get settingsSaved => 'सेटिंग्ज जतन केल्या';

  @override
  String get settingsSaving => 'जतन करत आहे...';

  @override
  String get settingsStoreProfile => 'दुकान प्रोफाइल';

  @override
  String get settingsSubtitle => 'दुकान प्रोफाइल आणि प्राधान्ये';

  @override
  String get settingsTitle => 'सेटिंग्ज';

  @override
  String get signOut => 'साइन आउट';

  @override
  String signedInAs(String email) {
    return '$email म्हणून साइन इन केले';
  }

  @override
  String get smsSectionTitle => 'उधारी एसएमएस';

  @override
  String get smsSectionSubtitle =>
      'उधारी नोंद तयार झाल्यावर किंवा पैसे मिळाल्यावर ग्राहकाला संदेश पाठवा, म्हणजे त्यांना किती द्यायचे आहे हे कळेल.';

  @override
  String get smsLogOnly => 'फक्त लॉग';

  @override
  String get smsDeviceMode => 'फोन सिम';

  @override
  String get smsTodayFree => 'आजचे मोफत एसएमएस';

  @override
  String smsUsageCount(String used, String limit, String remaining) {
    return '$used / $limit वापरले · $remaining शिल्लक';
  }

  @override
  String get smsResetNote =>
      'मध्यरात्री IST ला रीसेट होते. दैनिक मर्यादा संपल्यानंतर उधारी संदेश पाठवले जात नाहीत.';

  @override
  String get smsDeviceNote =>
      'या फोनच्या सिमवरून पाठवले जाते. दुसऱ्या डिव्हाइसवर किंवा वेबवर तयार केलेल्या नोंदींसाठी किंवा नोंदवलेल्या पेमेंटसाठी संदेश जात नाही.';

  @override
  String get smsChooseSimTitle => 'एसएमएस कोणत्या सिमवरून पाठवायचा?';

  @override
  String get smsChooseSimBody =>
      'ज्या सिममध्ये एसएमएस रिचार्ज आहे ती निवडा. हा फोन उधारी संदेशांसाठी ती लक्षात ठेवेल.';

  @override
  String smsSimSlot(int slot) {
    return 'सिम $slot';
  }

  @override
  String get smsRecentTitle => 'अलीकडील संदेश';

  @override
  String get smsEmpty => 'अजून कोणताही एसएमएस पाठवलेला नाही';

  @override
  String get smsManagerOnly => 'फक्त मालक किंवा मॅनेजर हे सेटिंग बदलू शकतात.';

  @override
  String get smsLoadFailed => 'एसएमएस वापर लोड करता आला नाही.';

  @override
  String get smsEnabledToast => 'उधारी एसएमएस सुरू केले';

  @override
  String get smsDisabledToast => 'उधारी एसएमएस बंद केले';

  @override
  String smsUpdateFailed(String error) {
    return 'एसएमएस सेटिंग्ज अद्ययावत करता आल्या नाहीत: $error';
  }

  @override
  String get smsStatusQueued => 'रांगेत';

  @override
  String get smsStatusSending => 'पाठवत आहे';

  @override
  String get smsStatusFailed => 'अयशस्वी';

  @override
  String get smsStatusHandedOff => 'एसएमएस ॲपमधून पाठवले';

  @override
  String get smsStatusSkippedQuota => 'दैनिक मर्यादा पूर्ण';

  @override
  String get smsStatusSkippedNoMobile => 'मोबाइल क्रमांक नाही';

  @override
  String get smsStatusSkippedOptOut => 'नकार दिला';

  @override
  String get smsStatusSkippedDisabled => 'एसएमएस बंद आहे';

  @override
  String get state => 'राज्य';

  @override
  String get status => 'स्थिती';

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
  String get statusDraft => 'मसुदा';

  @override
  String get statusInStock => 'स्टॉकमध्ये';

  @override
  String get statusInactive => 'निष्क्रिय';

  @override
  String get statusLow => 'कमी';

  @override
  String get statusOpen => 'उघडे';

  @override
  String get statusOutOfStock => 'स्टॉक संपला';

  @override
  String get statusOutstanding => 'बाकी';

  @override
  String get statusOverdue => 'उशिरा झालेले';

  @override
  String get statusPaid => 'भरले';

  @override
  String get statusPartial => 'अंशतः';

  @override
  String get statusPending => 'प्रलंबित';

  @override
  String get statusReceived => 'प्राप्त';

  @override
  String get statusSent => 'पाठवले';

  @override
  String get statusSettled => 'निपटवले';

  @override
  String get statusUnpaid => 'नभरले';

  @override
  String get statusVoid => 'शून्य';

  @override
  String suppAcrossOpenAccounts(String count) {
    return '$count खुल्या खात्यांवर';
  }

  @override
  String get suppAddSupplier => 'पुरवठादार जोडा';

  @override
  String get suppAddressOptional => 'पत्ता (ऐच्छिक)';

  @override
  String get suppEmailOptional => 'ईमेल (ऐच्छिक)';

  @override
  String get suppGstinOptional => 'GSTIN (ऐच्छिक)';

  @override
  String suppLastDate(String date) {
    return 'शेवटचे: $date';
  }

  @override
  String get suppNoSuppliers => 'अजून पुरवठादार नाही';

  @override
  String get suppNoSuppliersSub =>
      'खरेदी आणि थकीत ट्रॅक करण्यासाठी तुमचा पहिला पुरवठादार जोडा.';

  @override
  String suppPayableAmount(String amount) {
    return 'देय: $amount';
  }

  @override
  String suppPurchasesAmount(String amount) {
    return 'खरेदी: $amount';
  }

  @override
  String get suppSubtitle => 'पुरवठादार आणि थकीत व्यवस्थापित करा';

  @override
  String get suppSupplierName => 'पुरवठादाराचे नाव';

  @override
  String get suppTotalPayable => 'एकूण देय रक्कम';

  @override
  String get suppTotalRegisteredVendors => 'एकूण नोंदणीकृत पुरवठादार';

  @override
  String suppXOutstanding(String count) {
    return '$count थकीत';
  }

  @override
  String suppXOverdue(String count) {
    return '$count अतिदेय';
  }

  @override
  String suppXSettled(String count) {
    return '$count निपटले';
  }

  @override
  String get suppViewDetails => 'तपशील पहा';

  @override
  String get suppPayments => 'देयके';

  @override
  String get suppPurchaseOrders => 'खरेदी ऑर्डर';

  @override
  String get suppNoPayments => 'कोणतेही देयके नोंदवलेले नाही';

  @override
  String get suppNoPOs => 'कोणतेही खरेदी ऑर्डर नाही';

  @override
  String get tabCustomers => 'ग्राहक';

  @override
  String get tabHome => 'होम';

  @override
  String get tabInvoice => 'पावती';

  @override
  String get tabMore => 'अधिक';

  @override
  String get tabStock => 'स्टॉक';

  @override
  String get tabUdhari => 'उधारी';

  @override
  String get total => 'एकूण';

  @override
  String get udhrAmountReceived => 'प्राप्त रक्कम';

  @override
  String get udhrBalance => 'शिल्लक';

  @override
  String get udhrDueToday => 'आज देय';

  @override
  String udhrEntryAmount(String amount) {
    return 'रक्कम: $amount';
  }

  @override
  String udhrEntryBalance(String balance) {
    return 'शिल्लक: $balance';
  }

  @override
  String udhrLastEntry(String date) {
    return 'शेवटची नोंद: $date';
  }

  @override
  String get udhrLedgerEntries => 'लेजर नोंदी';

  @override
  String udhrLoadEntriesFailed(String error) {
    return 'नोंदी लोड करता आल्या नाहीत: $error';
  }

  @override
  String get udhrModeBank => 'बँक';

  @override
  String get udhrModeCard => 'कार्ड';

  @override
  String get udhrModeCash => 'रोखड';

  @override
  String get udhrModeUpi => 'यूपीआई';

  @override
  String get udhrNoLedgerEntries => 'कोणत्याही लेजर नोंदी नाहीत';

  @override
  String get udhrNoRecords => 'अजून उधारी नोंदी नाहीत';

  @override
  String get udhrNoteOptional => 'टीप (पर्यायी)';

  @override
  String udhrOutstandingBalance(String amount) {
    return 'बाकी रक्कम: $amount';
  }

  @override
  String udhrPaidVia(String amount, String mode) {
    return '✓ $mode द्वारे $amount प्राप्त झाले';
  }

  @override
  String udhrPaidViaNote(String amount, String mode, String note) {
    return '✓ $mode द्वारे $amount प्राप्त झाले · $note';
  }

  @override
  String get udhrPaymentMode => 'पेमेंट पद्धत';

  @override
  String get udhrPaymentReceived => 'उधारी पेमेंट यशस्वीरित्या प्राप्त झाले.';

  @override
  String get udhrReceive => 'प्राप्त करा';

  @override
  String udhrReceivePaymentFrom(String name) {
    return '$name कडून पेमेंट प्राप्त करा';
  }

  @override
  String get udhrRecordPayment => 'पेमेंट प्राप्त करा';

  @override
  String get udhrTitle => 'ग्राहक उधारी';

  @override
  String udhrTotalAmount(String amount) {
    return 'एकूण: $amount';
  }

  @override
  String get udhrTotalReceivables => 'एकूण बाकी रक्कम';

  @override
  String get udhrUpcoming => 'आगामी';

  @override
  String userAllUsers(String count) {
    return 'सर्व वापरकर्ते ($count)';
  }

  @override
  String get userEmailOptional => 'ईमेल (ऐच्छिक)';

  @override
  String get userEmailRequired => 'ईमेल';

  @override
  String get userFullName => 'पूर्ण नाव';

  @override
  String get userInvite => 'आमंत्रित करा';

  @override
  String get userInviteHint =>
      'टीममध्ये सामील होण्यासाठी ही आमंत्रण लिंक त्यांच्यासोबत शेअर करा.';

  @override
  String get copyInviteLink => 'लिंक कॉपी करा';

  @override
  String get userInviteMember => 'सदस्याला आमंत्रित करा';

  @override
  String get userInviteTitle => 'टीम सदस्याला आमंत्रित करा';

  @override
  String userJoinedAt(String date) {
    return 'सामील: $date';
  }

  @override
  String get userMobileOptional => 'मोबाईल (ऐच्छिक)';

  @override
  String get userNoUsers => 'अद्याप इतर वापरकर्ते नाहीत';

  @override
  String get userRole => 'भूमिका';

  @override
  String get userRoleAdmin => 'प्रशासक';

  @override
  String get userRoleCashier => 'कॅशियर';

  @override
  String get userRoleManager => 'व्यवस्थापक';

  @override
  String get userRoleOwner => 'मालक';

  @override
  String get userRoleStaff => 'स्टाफ';

  @override
  String get userTitle => 'टीम आणि वापरकर्ते';

  @override
  String get userYou => 'आपण';

  @override
  String userYouLabel(String name) {
    return '$name (आपण)';
  }

  @override
  String get yes => 'होय';

  @override
  String get mobileNumber => 'मोबाईल क्रमांक';

  @override
  String get udhrAdd => 'उधारी जोडा';

  @override
  String get udhrAddNewCustomer => 'नवीन ग्राहक जोडा';

  @override
  String get udhrAmountLabel => 'रक्कम';

  @override
  String get udhrAmountRequired => 'शून्याहून अधिक रक्कम नोंदवा';

  @override
  String get udhrCustomer => 'ग्राहक';

  @override
  String get udhrDueDate => 'देय तारीख';

  @override
  String get udhrEntryDate => 'नोंद तारीख';

  @override
  String get udhrNewEntry => 'नवीन उधारी नोंद';

  @override
  String get udhrSelectCustomer => 'ग्राहक निवडा';

  @override
  String get validationMobileNumber => 'वैध मोबाईल क्रमांक नोंदवा (10-12 अंक)';

  @override
  String errCreateUdhaari(Object error) {
    return 'उधारी जोडता आली नाही: $error';
  }

  @override
  String get menuViewBusinessProfile => 'व्यवसाय प्रोफाइल पहा';

  @override
  String get bizProfileTitle => 'व्यवसाय प्रोफाइल';

  @override
  String get bizProfileSubtitle => 'तुमची व्यवसाय माहिती आणि योजना';

  @override
  String get bizOwnerName => 'मालक';

  @override
  String get bizGstin => 'GSTIN';

  @override
  String get bizAddress => 'पत्ता';

  @override
  String get bizMobile => 'मोबाईल';

  @override
  String get bizCategory => 'श्रेणी';

  @override
  String get bizRegisteredOn => 'नोंदणी तारीख';

  @override
  String get bizPlan => 'योजना';

  @override
  String get bizPlanStatus => 'स्थिती';

  @override
  String get bizPlanFree => 'फ्री';

  @override
  String get bizPlanTrial => 'ट्रायल';

  @override
  String get bizStatusSuspended => 'स्थगित';

  @override
  String get signOutConfirmTitle => 'साइन आउट करायचे?';

  @override
  String get signOutConfirmMessage =>
      'तुम्हाला साइन आउट करायचे आहे का? पुढील वेळी साइन इन करण्यासाठी तुम्हाला OTP सत्यापित करावे लागेल.';

  @override
  String get navDashboard => 'डॅशबोर्ड';

  @override
  String get navProductsStock => 'उत्पादने आणि स्टॉक';

  @override
  String get navSalesInvoices => 'विक्री आणि बिल';

  @override
  String get navCustomers => 'ग्राहक';

  @override
  String get navSystem => 'सिस्टम';

  @override
  String get userRoleStockManager => 'स्टॉक व्यवस्थापक';

  @override
  String get userRolePlatformAdmin => 'प्लॅटफॉर्म प्रशासक';

  @override
  String get roleAccessFull => 'Full Access / संपूर्ण प्रवेश';

  @override
  String get roleAccessLimited => 'मर्यादित दृश्यता / Limited Visibility';

  @override
  String get roleAccessPlatform => 'Platform Access / प्रशासक';

  @override
  String get syncOnline => 'ऑनलाइन';

  @override
  String get syncOffline => 'ऑफलाइन';

  @override
  String get appVersion => 'v3.4.2';

  @override
  String get appTagline => 'मी दुकानदार - स्मार्ट व्यवसाय व्यवस्थापन';

  @override
  String get exitAppTitle => 'MiDukandar बाहेर पडायचे?';

  @override
  String get exitAppMessage => 'तुम्हाला खरं ऐप बाहेर पडायचे आहे का?';

  @override
  String get exitApp => 'बाहेर पडा';

  @override
  String get billReverseTitle => 'बिल रद्द/परत घ्या';

  @override
  String billReverseMessage(Object invoiceNumber) {
    return 'तुम्हाला बिल \"$invoiceNumber\" रद्द/परत घायचे आहे का? हे एक परत घेणारी एन्ट्री तयार करते आणि मूळ बिलला रद्द असे चिन्हांकते. एक कारण आवश्यक आहे.';
  }

  @override
  String get billReverse => 'रद्द/परत घ्या';

  @override
  String errReverseInvoice(Object error) {
    return 'बिल रद्द करू शकले नाही: $error';
  }

  @override
  String errUpdateInvoice(Object error) {
    return 'इनव्हॉइस अद्यतन करू शकले नाही: $error';
  }

  @override
  String get suppEditSupplier => 'पुरवठादार संपादित करा';

  @override
  String get suppDeleteTitle => 'पुरवठादार हटवा?';

  @override
  String suppDeleteMessage(Object name) {
    return 'पुरवठादार \"$name\" हटवा? हे पुरवठादारला संग्रहित करते आणि यादीमधून काढते. बकाया खरेदी ऑर्डर पहिले रद्द केले पाहिजेत.';
  }

  @override
  String errUpdateSupplier(Object error) {
    return 'पुरवठादार अद्यतन करू शकले नाही: $error';
  }

  @override
  String errDeleteSupplier(Object error) {
    return 'पुरवठादार हटवू शकले नाही: $error';
  }

  @override
  String get expnEditExpense => 'खर्च संपादित करा';

  @override
  String get expnDeleteTitle => 'खर्च हटवा?';

  @override
  String expnDeleteMessage(Object title) {
    return 'खर्च \"$title\" हटवा? हे पूर्ववत केले जाणार नाही.';
  }

  @override
  String errUpdateExpense(Object error) {
    return 'खर्च अद्यतन करू शकले नाही: $error';
  }

  @override
  String errDeleteExpense(Object error) {
    return 'खर्च हटवू शकले नाही: $error';
  }

  @override
  String get purchPayTitle => 'पेमेंट नोंदवा';

  @override
  String get userChangeRole => 'भूमिका बदला';

  @override
  String get userDeactivate => 'निष्क्रिय करा';

  @override
  String get userActivate => 'सक्रिय करा';

  @override
  String get userCannotManage =>
      'फक्त मालक इतर टीम सदस्यांचे व्यवस्थापन करू शकतात.';

  @override
  String errUpdateUserStatus(Object error) {
    return 'वापरकर्ता स्थिती अद्यतन करू शकले नाही: $error';
  }

  @override
  String errUpdateUserRole(Object error) {
    return 'वापरकर्ता भूमिका अद्यतन करू शकले नाही: $error';
  }

  @override
  String get regTitle => 'तुमचा खाते तयार करा';

  @override
  String get regSubtitle => 'एकच पाऊलात तुमचे खाते आणि दुकान नोंदणी करा।';

  @override
  String get regEmailLabel => 'खाते ईमेल';

  @override
  String get regEmailRequired => 'तुमच्या खात्यासाठी ईमेल पता प्रविष्ट करा।';

  @override
  String get regEmailInvalid => 'वैध ईमेल पता प्रविष्ट करा।';

  @override
  String get regOwnerNameLabel => 'दुकान मालकाचे नाव';

  @override
  String get regOwnerNameRequired => 'दुकान मालकाचे नाव प्रविष्ट करा';

  @override
  String get regShopNameLabel => 'दुकान / व्यवसाय नाव';

  @override
  String get regShopNameRequired => 'तुमची दुकानचे नाव प्रविष्ट करा';

  @override
  String get regStoreTypeLabel => 'दुकान प्रकार';

  @override
  String get regPhoneLabel => 'मोबाइल नंबर';

  @override
  String get regGstLabel => 'GSTIN (पर्यायी)';

  @override
  String get regGstHint => '27ABCDE1234F1Z5';

  @override
  String get regLanguageLabel => 'ऐप भाषा';

  @override
  String get regAddressLabel => 'पत्ता';

  @override
  String get regAddressHint => 'दुकान क्रमांक, गल्ली, क्षेत्र';

  @override
  String get regAddressRequired => 'तुमची दुकानचा पत्ता प्रविष्ट करा';

  @override
  String get regCityLabel => 'शहर';

  @override
  String get regCityRequired => 'तुमचे शहर प्रविष्ट करा';

  @override
  String get regStateLabel => 'राज्य';

  @override
  String get regPincodeLabel => 'पिनकोड';

  @override
  String get regPincodeHint => '411001';

  @override
  String get regPincodeRequired => 'वैध ६-अंकीय पिनकोड प्रविष्ट करा';

  @override
  String get regPincodeInvalid => 'पिनकोड ६ अंकोंचा असावा';

  @override
  String get regCurrencyLabel => 'चलन';

  @override
  String get regInvoicePrefixLabel => 'इनव्हॉइस प्रीफिक्स';

  @override
  String get regInvoicePrefixHint => 'उदा. INV → INV-0001';

  @override
  String get regCreateAccount => 'खाते तयार करा';

  @override
  String get regSubmitting => 'खाते तयार होत आहे...';

  @override
  String get regSuccessMessage =>
      'खाते तयार झाले! सुरू ठेवण्यासाठी साइन इन करा।';

  @override
  String get regBackToLogin => 'लॉगिनवर परत जा';

  @override
  String get regSecureNotice =>
      'तुमचे डेटा एन्क्रिप्ट केलेले आणि सुरक्षितपणे संग्रहीत केलेले आहे।';

  @override
  String get regSecureBadge => 'सुरक्षित आणि निजी';

  @override
  String get regGstBadge => 'GST-तयार इनव्हॉइसिंग';

  @override
  String get regOfflineBadge => 'ऑफलाइन बिलिंग समर्थन';

  @override
  String get regSectionAccountDetails => 'वितरण विवरण';

  @override
  String get regSectionStoreDetails => 'दुकान विवरण';

  @override
  String get regSectionLocation => 'स्थान';

  @override
  String get regSectionPreferences => 'प्राधान्ये';
}
