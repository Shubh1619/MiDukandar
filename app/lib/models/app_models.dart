class ApiResponse<T> {
  const ApiResponse({required this.success, this.data, this.message, this.error});

  final bool success;
  final T? data;
  final String? message;
  final String? error;

  factory ApiResponse.fromJson(
    Map<String, dynamic> json,
    T Function(Map<String, dynamic>) fromJson,
  ) {
    return ApiResponse<T>(
      success: json['success'] ?? true,
      data: json['data'] != null ? fromJson(json['data']) : null,
      message: json['message'],
      error: json['error'],
    );
  }
}

String? _firstValue(Map<String, dynamic> json, List<String> keys) {
  for (final key in keys) {
    final value = json[key];
    if (value != null) return value.toString();
  }
  return null;
}

num _firstNumber(Map<String, dynamic> json, List<String> keys, {num fallback = 0}) {
  for (final key in keys) {
    final value = json[key];
    if (value == null) continue;
    if (value is num) return value;
    if (value is String) {
      final parsed = num.tryParse(value);
      if (parsed != null) return parsed;
    }
  }
  return fallback;
}

bool _firstBool(Map<String, dynamic> json, List<String> keys, {bool fallback = false}) {
  for (final key in keys) {
    final value = json[key];
    if (value == null) continue;
    if (value is bool) return value;
    if (value is String) {
      if (value == 'true') return true;
      if (value == 'false') return false;
    }
  }
  return fallback;
}

class AuthUser {
  const AuthUser({
    required this.id,
    required this.name,
    required this.email,
    required this.phone,
    required this.role,
    required this.storeId,
  });

  final String id;
  final String name;
  final String email;
  final String phone;
  final String role;
  final String storeId;

  factory AuthUser.fromJson(Map<String, dynamic> json) {
    return AuthUser(
      id: _firstValue(json, const ['id']) ?? '',
      name: _firstValue(json, const ['name']) ?? '',
      email: _firstValue(json, const ['email']) ?? '',
      phone: _firstValue(json, const ['phone']) ?? '',
      role: _firstValue(json, const ['role']) ?? 'OWNER',
      storeId: _firstValue(json, const ['storeId', 'store_id']) ?? '',
    );
  }
}

class Store {
  const Store({
    required this.id,
    required this.name,
    required this.type,
    this.address,
    this.city,
    this.state,
    this.pincode,
    this.phone,
    this.gst,
    required this.currency,
    required this.language,
    this.logoUrl,
    required this.invoicePrefix,
    this.status = 'ACTIVE',
    this.plan = 'FREE',
    this.planStatus = 'TRIAL',
    this.trialEndsAt,
    this.createdAt,
  });

  final String id;
  final String name;
  final String type;
  final String? address;
  final String? city;
  final String? state;
  final String? pincode;
  final String? phone;
  final String? gst;
  final String currency;
  final String language;
  final String? logoUrl;
  final String invoicePrefix;
  final String status;
  final String plan;
  final String planStatus;
  final String? trialEndsAt;
  final String? createdAt;

  factory Store.fromJson(Map<String, dynamic> json) {
    return Store(
      id: _firstValue(json, const ['id']) ?? '',
      name: _firstValue(json, const ['name']) ?? 'My Store',
      type: _firstValue(json, const ['type']) ?? 'Retail',
      address: _firstValue(json, const ['address']),
      city: _firstValue(json, const ['city']),
      state: _firstValue(json, const ['state']),
      pincode: _firstValue(json, const ['pincode']),
      phone: _firstValue(json, const ['phone']),
      gst: _firstValue(json, const ['gst']),
      currency: _firstValue(json, const ['currency']) ?? 'INR',
      language: _firstValue(json, const ['language']) ?? 'en',
      logoUrl: _firstValue(json, const ['logoUrl', 'logo_url']),
      invoicePrefix: _firstValue(json, const ['invoicePrefix', 'invoice_prefix']) ?? 'INV',
      status: _firstValue(json, const ['status']) ?? 'ACTIVE',
      plan: _firstValue(json, const ['plan']) ?? 'FREE',
      planStatus: _firstValue(json, const ['planStatus', 'plan_status']) ?? 'TRIAL',
      trialEndsAt: _firstValue(json, const ['trialEndsAt', 'trial_ends_at']),
      createdAt: _firstValue(json, const ['createdAt', 'created_at']),
    );
  }
}

class Product {
  const Product({
    required this.id,
    required this.name,
    this.category,
    required this.unit,
    required this.sellingPrice,
    this.purchasePrice,
    required this.stock,
    required this.isLow,
    this.barcode,
    this.sku,
    this.mrp,
    this.gstPercent,
    this.minStock,
  });

  final String id;
  final String name;
  final String? category;
  final String unit;
  final num sellingPrice;
  final num? purchasePrice;
  final num stock;
  final bool isLow;
  final String? barcode;
  final String? sku;
  final num? mrp;
  final num? gstPercent;
  final num? minStock;

  factory Product.fromJson(Map<String, dynamic> json) {
    return Product(
      id: _firstValue(json, const ['id']) ?? '',
      name: _firstValue(json, const ['name']) ?? '',
      category: _firstValue(json, const ['category']),
      unit: _firstValue(json, const ['unit']) ?? 'Piece',
      sellingPrice: _firstNumber(json, const ['sellingPrice', 'selling_price', 'price'], fallback: 0),
      purchasePrice: json['purchasePrice'] != null || json['purchase_price'] != null
          ? _firstNumber(json, const ['purchasePrice', 'purchase_price'])
          : null,
      stock: _firstNumber(json, const ['stock', 'balance', 'currentStock'], fallback: 0),
      isLow: _firstBool(json, const ['isLow', 'is_low', 'lowStock'], fallback: false),
      barcode: _firstValue(json, const ['barcode']),
      sku: _firstValue(json, const ['sku']),
      mrp: json['mrp'] != null ? _firstNumber(json, const ['mrp']) : null,
      gstPercent: json['gstPercent'] != null || json['gst_percent'] != null
          ? _firstNumber(json, const ['gstPercent', 'gst_percent'])
          : null,
      minStock: json['minStock'] != null || json['min_stock'] != null
          ? _firstNumber(json, const ['minStock', 'min_stock'])
          : null,
    );
  }
}

/// A product surfaced by the expiry alert (expired or expiring soon).
class ExpiringProduct {
  const ExpiringProduct({
    required this.id,
    required this.name,
    this.category,
    required this.unit,
    this.expiryDate,
    required this.daysLeft,
  });

  final String id;
  final String name;
  final String? category;
  final String unit;
  final String? expiryDate;
  final int daysLeft;

  bool get isExpired => daysLeft < 0;

  factory ExpiringProduct.fromJson(Map<String, dynamic> json) {
    final raw = _firstValue(json, const ['expiryDate', 'expiry_date']);
    return ExpiringProduct(
      id: _firstValue(json, const ['id']) ?? '',
      name: _firstValue(json, const ['name']) ?? '',
      category: _firstValue(json, const ['category']),
      unit: _firstValue(json, const ['unit']) ?? 'Piece',
      expiryDate: raw != null && raw.length >= 10 ? raw.substring(0, 10) : raw,
      daysLeft: _firstNumber(json, const ['daysLeft', 'days_left'], fallback: 0).toInt(),
    );
  }
}

/// Result of the product expiry alert query: what is expired and what expires
/// within the store's configured window.
class ExpiryAlert {
  const ExpiryAlert({
    required this.expired,
    required this.expiringSoon,
    required this.warningDays,
  });

  final List<ExpiringProduct> expired;
  final List<ExpiringProduct> expiringSoon;
  final int warningDays;

  int get total => expired.length + expiringSoon.length;
  bool get hasAlerts => total > 0;

  factory ExpiryAlert.fromJson(Map<String, dynamic> json) {
    List<ExpiringProduct> parse(Object? list) => list is List
        ? list
            .whereType<Map<String, dynamic>>()
            .map(ExpiringProduct.fromJson)
            .toList()
        : const [];
    return ExpiryAlert(
      expired: parse(json['expired']),
      expiringSoon: parse(json['expiringSoon'] ?? json['expiring_soon']),
      warningDays: _firstNumber(json, const ['warningDays', 'warning_days'], fallback: 30).toInt(),
    );
  }
}


class Customer {
  const Customer({
    required this.id,
    required this.name,
    this.mobile,
    this.address,
    this.city,
    this.state,
    this.pincode,
    this.gst,
    this.creditLimit,
    this.openingBalance,
    required this.outstanding,
    this.createdAt,
  });

  final String id;
  final String name;
  final String? mobile;
  final String? address;
  final String? city;
  final String? state;
  final String? pincode;
  final String? gst;
  final num? creditLimit;
  final num? openingBalance;
  final num outstanding;
  final String? createdAt;

  factory Customer.fromJson(Map<String, dynamic> json) {
    return Customer(
      id: _firstValue(json, const ['id']) ?? '',
      name: _firstValue(json, const ['name']) ?? '',
      mobile: _firstValue(json, const ['mobile']),
      address: _firstValue(json, const ['address']),
      city: _firstValue(json, const ['city']),
      state: _firstValue(json, const ['state']),
      pincode: _firstValue(json, const ['pincode']),
      gst: _firstValue(json, const ['gst']),
      creditLimit: json['creditLimit'] != null ? _firstNumber(json, const ['creditLimit']) : null,
      openingBalance: json['openingBalance'] != null
          ? _firstNumber(json, const ['openingBalance', 'opening_balance'])
          : null,
      outstanding: _firstNumber(json, const ['outstanding'], fallback: 0),
      createdAt: _firstValue(json, const ['createdAt', 'created_at']),
    );
  }
}

class InvoiceItem {
  const InvoiceItem({
    this.id,
    this.productId,
    required this.name,
    required this.qty,
    required this.price,
    required this.amount,
    this.discount,
    this.gstPercent,
  });

  final String? id;
  final String? productId;
  final String name;
  final num qty;
  final num price;
  final num amount;
  final num? discount;
  final num? gstPercent;

  factory InvoiceItem.fromJson(Map<String, dynamic> json) {
    return InvoiceItem(
      id: _firstValue(json, const ['id']),
      productId: _firstValue(json, const ['productId', 'product_id']),
      name: _firstValue(json, const ['name', 'productName', 'product_name']) ?? '',
      qty: _firstNumber(json, const ['qty', 'quantity'], fallback: 0),
      price: _firstNumber(json, const ['price', 'unitPrice', 'unit_price'], fallback: 0),
      amount: _firstNumber(json, const ['amount', 'lineTotal', 'line_total'], fallback: 0),
      discount: json['discount'] != null ? _firstNumber(json, const ['discount']) : null,
      gstPercent: json['gstPercent'] != null || json['gst_percent'] != null
          ? _firstNumber(json, const ['gstPercent', 'gst_percent'])
          : null,
    );
  }
}

class InvoiceRecord {
  const InvoiceRecord({
    required this.id,
    required this.invoiceNumber,
    required this.customerName,
    this.customerId,
    this.customerMobile,
    required this.amount,
    required this.dueAmount,
    required this.paidAmount,
    required this.paymentMode,
    required this.status,
    required this.createdAt,
    this.dueDate,
    this.notes,
    required this.items,
  });

  final String id;
  final String invoiceNumber;
  final String customerName;
  final String? customerId;
  final String? customerMobile;
  final num amount;
  final num dueAmount;
  final num paidAmount;
  final String paymentMode;
  final String status;
  final String createdAt;
  final String? dueDate;
  final String? notes;
  final List<InvoiceItem> items;

  bool get isPaid => status.toLowerCase() == 'paid' || dueAmount.toDouble() <= 0;
  bool get isUdhaar => status.toLowerCase() == 'unpaid' || dueAmount.toDouble() > 0;

  factory InvoiceRecord.fromJson(Map<String, dynamic> json) {
    final rawItems = (json['items'] as List<dynamic>? ?? const [])
        .map((item) => InvoiceItem.fromJson(item as Map<String, dynamic>))
        .toList();

    return InvoiceRecord(
      id: _firstValue(json, const ['id']) ?? '',
      invoiceNumber: _firstValue(json, const ['invoiceNumber', 'invoice_number']) ?? 'INV-0000',
      customerName:
          _firstValue(json, const ['customerName', 'customer_name']) ?? 'Walk-in customer',
      customerId: _firstValue(json, const ['customerId', 'customer_id']),
      customerMobile: _firstValue(json, const ['customerMobile', 'customer_mobile']),
      amount: _firstNumber(json, const ['total', 'amount', 'subtotal'], fallback: 0),
      dueAmount: _firstNumber(json, const ['dueAmount', 'due_amount'], fallback: 0),
      paidAmount: _firstNumber(json, const ['paidAmount', 'paid_amount'], fallback: 0),
      paymentMode: _firstValue(json, const ['paymentMode', 'payment_mode']) ?? 'CASH',
      status: _firstValue(json, const ['status']) ?? 'CONFIRMED',
      createdAt: _firstValue(json, const ['createdAt', 'created_at']) ??
          DateTime.now().toIso8601String(),
      dueDate: _firstValue(json, const ['dueDate', 'due_date']),
      notes: _firstValue(json, const ['notes']),
      items: rawItems,
    );
  }

  InvoiceRecord copyWith({
    String? id,
    String? invoiceNumber,
    String? customerName,
    String? customerId,
    num? amount,
    num? dueAmount,
    num? paidAmount,
    String? paymentMode,
    String? status,
    String? createdAt,
    String? dueDate,
    List<InvoiceItem>? items,
  }) {
    return InvoiceRecord(
      id: id ?? this.id,
      invoiceNumber: invoiceNumber ?? this.invoiceNumber,
      customerName: customerName ?? this.customerName,
      customerId: customerId ?? this.customerId,
      customerMobile: customerMobile,
      amount: amount ?? this.amount,
      dueAmount: dueAmount ?? this.dueAmount,
      paidAmount: paidAmount ?? this.paidAmount,
      paymentMode: paymentMode ?? this.paymentMode,
      status: status ?? this.status,
      createdAt: createdAt ?? this.createdAt,
      dueDate: dueDate ?? this.dueDate,
      notes: notes,
      items: items ?? this.items,
    );
  }
}

class DashboardStats {
  const DashboardStats({
    required this.todaySales,
    required this.todayPurchases,
    required this.todayProfit,
    required this.receivables,
    required this.payables,
    required this.lowStockCount,
    required this.recentTransactions,
  });

  final num todaySales;
  final num todayPurchases;
  final num todayProfit;
  final num receivables;
  final num payables;
  final num lowStockCount;
  final List<RecentTransaction> recentTransactions;

  factory DashboardStats.fromJson(Map<String, dynamic> json) {
    final rawTx =
        (json['recentTransactions'] as List<dynamic>? ??
                json['recent_transactions'] as List<dynamic>? ??
                const [])
            .map((tx) => RecentTransaction.fromJson(tx as Map<String, dynamic>))
            .toList();

    return DashboardStats(
      todaySales: _firstNumber(json, const ['todaySales', 'today_sales'], fallback: 0),
      todayPurchases: _firstNumber(json, const ['todayPurchases', 'today_purchases'], fallback: 0),
      todayProfit: _firstNumber(json, const ['todayProfit', 'today_profit'], fallback: 0),
      receivables: _firstNumber(json, const ['receivables'], fallback: 0),
      payables: _firstNumber(json, const ['payables'], fallback: 0),
      lowStockCount: _firstNumber(json, const ['lowStockCount', 'lowStock', 'low_stock'], fallback: 0),
      recentTransactions: rawTx,
    );
  }
}

class RecentTransaction {
  const RecentTransaction({
    required this.id,
    required this.type,
    required this.number,
    required this.party,
    this.mode,
    required this.amount,
    required this.createdAt,
  });

  final String id;
  final String type;
  final String number;
  final String party;
  final String? mode;
  final num amount;
  final String createdAt;

  factory RecentTransaction.fromJson(Map<String, dynamic> json) {
    return RecentTransaction(
      id: _firstValue(json, const ['id']) ?? '',
      type: _firstValue(json, const ['type']) ?? 'SALE',
      number: _firstValue(json, const ['number']) ?? '',
      party: _firstValue(json, const ['party']) ?? '',
      mode: _firstValue(json, const ['mode']),
      amount: _firstNumber(json, const ['amount'], fallback: 0),
      createdAt: _firstValue(json, const ['createdAt', 'created_at']) ?? '',
    );
  }
}

class Purchase {
  const Purchase({
    required this.id,
    required this.purchaseNumber,
    required this.supplierName,
    this.supplierMobile,
    required this.subtotal,
    this.discount,
    this.taxTotal,
    required this.total,
    required this.paidAmount,
    required this.dueAmount,
    required this.paymentStatus,
    this.notes,
    required this.createdAt,
    this.items = const [],
  });

  final String id;
  final String purchaseNumber;
  final String supplierName;
  final String? supplierMobile;
  final num subtotal;
  final num? discount;
  final num? taxTotal;
  final num total;
  final num paidAmount;
  final num dueAmount;
  final String paymentStatus;
  final String? notes;
  final String createdAt;
  final List<InvoiceItem> items;

  factory Purchase.fromJson(Map<String, dynamic> json) {
    final rawItems = (json['items'] as List<dynamic>? ?? const [])
        .map((item) => InvoiceItem.fromJson(item as Map<String, dynamic>))
        .toList();
    return Purchase(
      id: _firstValue(json, const ['id']) ?? '',
      purchaseNumber:
          _firstValue(json, const ['purchaseNumber', 'purchase_number']) ?? 'PUR-0000',
      supplierName:
          _firstValue(json, const ['supplierName', 'supplier_name']) ?? 'Unknown supplier',
      supplierMobile: _firstValue(json, const ['supplierMobile', 'supplier_mobile']),
      subtotal: _firstNumber(json, const ['subtotal'], fallback: 0),
      discount: json['discount'] != null ? _firstNumber(json, const ['discount']) : null,
      taxTotal: json['taxTotal'] != null || json['tax_total'] != null
          ? _firstNumber(json, const ['taxTotal', 'tax_total'])
          : null,
      total: _firstNumber(json, const ['total'], fallback: 0),
      paidAmount: _firstNumber(json, const ['paidAmount', 'paid_amount'], fallback: 0),
      dueAmount: _firstNumber(json, const ['dueAmount', 'due_amount'], fallback: 0),
      paymentStatus:
          _firstValue(json, const ['paymentStatus', 'payment_status']) ?? 'UNPAID',
      notes: _firstValue(json, const ['notes']),
      createdAt: _firstValue(json, const ['createdAt', 'created_at']) ??
          DateTime.now().toIso8601String(),
      items: rawItems,
    );
  }
}

class ExpenseCategory {
  const ExpenseCategory({required this.id, required this.name});

  final String id;
  final String name;

  factory ExpenseCategory.fromJson(Map<String, dynamic> json) {
    return ExpenseCategory(
      id: _firstValue(json, const ['id']) ?? '',
      name: _firstValue(json, const ['name']) ?? '',
    );
  }
}

class Expense {
  const Expense({
    required this.id,
    required this.title,
    this.categoryId,
    this.categoryName,
    required this.amount,
    required this.expenseDate,
    required this.paymentMode,
    this.note,
    required this.createdAt,
  });

  final String id;
  final String title;
  final String? categoryId;
  final String? categoryName;
  final num amount;
  final String expenseDate;
  final String paymentMode;
  final String? note;
  final String createdAt;

  factory Expense.fromJson(Map<String, dynamic> json) {
    return Expense(
      id: _firstValue(json, const ['id']) ?? '',
      title: _firstValue(json, const ['title']) ?? '',
      categoryId: _firstValue(json, const ['categoryId', 'category_id']),
      categoryName: _firstValue(json, const ['categoryName', 'category_name']),
      amount: _firstNumber(json, const ['amount'], fallback: 0),
      expenseDate: _firstValue(json, const ['expenseDate', 'expense_date']) ??
          DateTime.now().toIso8601String().split('T').first,
      paymentMode: _firstValue(json, const ['paymentMode', 'payment_mode']) ?? 'CASH',
      note: _firstValue(json, const ['note']),
      createdAt: _firstValue(json, const ['createdAt', 'created_at']) ??
          DateTime.now().toIso8601String(),
    );
  }
}

class ExpenseSummary {
  const ExpenseSummary({
    required this.thisMonth,
    required this.lastMonth,
    required this.byCategory,
  });

  final num thisMonth;
  final num lastMonth;
  final List<ExpenseCategoryTotal> byCategory;

  factory ExpenseSummary.fromJson(Map<String, dynamic> json) {
    final raw =
        (json['byCategory'] as List<dynamic>? ??
                json['by_category'] as List<dynamic>? ??
                const [])
            .map((e) => ExpenseCategoryTotal.fromJson(e as Map<String, dynamic>))
            .toList();
    return ExpenseSummary(
      thisMonth: _firstNumber(json, const ['thisMonth', 'this_month'], fallback: 0),
      lastMonth: _firstNumber(json, const ['lastMonth', 'last_month'], fallback: 0),
      byCategory: raw,
    );
  }
}

class ExpenseCategoryTotal {
  const ExpenseCategoryTotal({this.categoryId, this.categoryName, required this.total});

  final String? categoryId;
  final String? categoryName;
  final num total;

  factory ExpenseCategoryTotal.fromJson(Map<String, dynamic> json) {
    return ExpenseCategoryTotal(
      categoryId: _firstValue(json, const ['categoryId', 'category_id']),
      categoryName: _firstValue(json, const ['categoryName', 'category_name']),
      total: _firstNumber(json, const ['total', 'amount'], fallback: 0),
    );
  }
}

class Payment {
  const Payment({
    required this.id,
    this.customerId,
    this.customerName,
    required this.amount,
    required this.type,
    required this.mode,
    this.referenceType,
    this.referenceId,
    this.note,
    required this.createdAt,
  });

  final String id;
  final String? customerId;
  final String? customerName;
  final num amount;
  final String type;
  final String mode;
  final String? referenceType;
  final String? referenceId;
  final String? note;
  final String createdAt;

  factory Payment.fromJson(Map<String, dynamic> json) {
    return Payment(
      id: _firstValue(json, const ['id']) ?? '',
      customerId: _firstValue(json, const ['customerId', 'customer_id']),
      customerName: _firstValue(json, const ['customerName', 'customer_name']),
      amount: _firstNumber(json, const ['amount'], fallback: 0),
      type: _firstValue(json, const ['type']) ?? 'RECEIVED',
      mode: _firstValue(json, const ['mode']) ?? 'CASH',
      referenceType: _firstValue(json, const ['referenceType', 'reference_type']),
      referenceId: _firstValue(json, const ['referenceId', 'reference_id']),
      note: _firstValue(json, const ['note']),
      createdAt: _firstValue(json, const ['createdAt', 'created_at']) ??
          DateTime.now().toIso8601String(),
    );
  }
}

class Supplier {
  const Supplier({
    required this.id,
    required this.name,
    this.phone,
    this.email,
    this.gstin,
    this.address,
    this.category,
    this.totalPurchases,
    this.outstandingPayable,
    this.lastOrderDate,
    this.activePoCount,
  });

  final String id;
  final String name;
  final String? phone;
  final String? email;
  final String? gstin;
  final String? address;
  final String? category;
  final num? totalPurchases;
  final num? outstandingPayable;
  final String? lastOrderDate;
  final num? activePoCount;

  factory Supplier.fromJson(Map<String, dynamic> json) {
    return Supplier(
      id: _firstValue(json, const ['id']) ?? '',
      name: _firstValue(json, const ['name']) ?? '',
      phone: _firstValue(json, const ['phone']),
      email: _firstValue(json, const ['email']),
      gstin: _firstValue(json, const ['gstin']),
      address: _firstValue(json, const ['address']),
      category: _firstValue(json, const ['category']),
      totalPurchases: json['totalPurchases'] != null || json['total_purchases'] != null
          ? _firstNumber(json, const ['totalPurchases', 'total_purchases'])
          : null,
      outstandingPayable:
          json['outstandingPayable'] != null || json['outstanding_payable'] != null
              ? _firstNumber(json, const ['outstandingPayable', 'outstanding_payable'])
              : null,
      lastOrderDate: _firstValue(json, const ['lastOrderDate', 'last_order_date']),
      activePoCount: json['activePoCount'] != null || json['active_po_count'] != null
          ? _firstNumber(json, const ['activePoCount', 'active_po_count'])
          : null,
    );
  }
}

class UdhaariCustomer {
  const UdhaariCustomer({
    required this.customerId,
    required this.name,
    this.mobile,
    required this.totalAmount,
    required this.paidAmount,
    required this.balance,
    required this.status,
    this.lastEntryDate,
    this.nextDueDate,
  });

  final String customerId;
  final String name;
  final String? mobile;
  final num totalAmount;
  final num paidAmount;
  final num balance;
  final String status;
  final String? lastEntryDate;
  final String? nextDueDate;

  factory UdhaariCustomer.fromJson(Map<String, dynamic> json) {
    return UdhaariCustomer(
      customerId:
          _firstValue(json, const ['customerId', 'customer_id']) ??
          _firstValue(json, const ['id']) ??
          '',
      name: _firstValue(json, const ['name', 'customerName', 'customer_name']) ?? '',
      mobile: _firstValue(json, const ['mobile', 'customerMobile', 'customer_mobile']),
      totalAmount: _firstNumber(json, const ['totalAmount', 'total_amount'], fallback: 0),
      paidAmount: _firstNumber(json, const ['paidAmount', 'paid_amount'], fallback: 0),
      balance: _firstNumber(json, const ['balance', 'outstanding'], fallback: 0),
      status: _firstValue(json, const ['status']) ?? 'PENDING',
      lastEntryDate: _firstValue(json, const ['lastEntryDate', 'last_entry_date']),
      nextDueDate: _firstValue(json, const ['nextDueDate', 'next_due_date']),
    );
  }
}

class UdhaariEntry {
  const UdhaariEntry({
    required this.id,
    this.customerId,
    required this.amount,
    required this.paidAmount,
    required this.balance,
    required this.status,
    this.entryDate,
    this.dueDate,
    this.reminderDate,
    this.note,
    this.saleId,
    required this.createdAt,
    this.payments = const [],
  });

  final String id;
  final String? customerId;
  final num amount;
  final num paidAmount;
  final num balance;
  final String status;
  final String? entryDate;
  final String? dueDate;
  final String? reminderDate;
  final String? note;
  final String? saleId;
  final String createdAt;
  final List<UdhaariPayment> payments;

  factory UdhaariEntry.fromJson(Map<String, dynamic> json) {
    final payments =
        (json['payments'] as List<dynamic>? ?? const [])
            .map((p) => UdhaariPayment.fromJson(p as Map<String, dynamic>))
            .toList();
    return UdhaariEntry(
      id: _firstValue(json, const ['id']) ?? '',
      customerId: _firstValue(json, const ['customerId', 'customer_id']),
      amount: _firstNumber(json, const ['amount'], fallback: 0),
      paidAmount: _firstNumber(json, const ['paidAmount', 'paid_amount'], fallback: 0),
      balance: _firstNumber(json, const ['balance'], fallback: 0),
      status: _firstValue(json, const ['status']) ?? 'PENDING',
      entryDate: _firstValue(json, const ['entryDate', 'entry_date']),
      dueDate: _firstValue(json, const ['dueDate', 'due_date']),
      reminderDate: _firstValue(json, const ['reminderDate', 'reminder_date']),
      note: _firstValue(json, const ['note']),
      saleId: _firstValue(json, const ['saleId', 'sale_id']),
      createdAt: _firstValue(json, const ['createdAt', 'created_at']) ??
          DateTime.now().toIso8601String(),
      payments: payments,
    );
  }
}

class UdhaariPayment {
  const UdhaariPayment({
    required this.id,
    required this.amount,
    required this.mode,
    this.note,
    required this.createdAt,
  });

  final String id;
  final num amount;
  final String mode;
  final String? note;
  final String createdAt;

  factory UdhaariPayment.fromJson(Map<String, dynamic> json) {
    return UdhaariPayment(
      id: _firstValue(json, const ['id']) ?? '',
      amount: _firstNumber(json, const ['amount'], fallback: 0),
      mode: _firstValue(json, const ['mode']) ?? 'CASH',
      note: _firstValue(json, const ['note']),
      createdAt: _firstValue(json, const ['createdAt', 'created_at']) ??
          DateTime.now().toIso8601String(),
    );
  }
}

class ReportSalesRow {
  const ReportSalesRow({
    required this.date,
    required this.invoiceCount,
    required this.subtotal,
    required this.discount,
    required this.tax,
    required this.total,
  });

  final String date;
  final num invoiceCount;
  final num subtotal;
  final num discount;
  final num tax;
  final num total;

  factory ReportSalesRow.fromJson(Map<String, dynamic> json) {
    return ReportSalesRow(
      date: _firstValue(json, const ['date', 'day']) ?? '',
      invoiceCount: _firstNumber(json, const ['invoiceCount', 'invoice_count'], fallback: 0),
      subtotal: _firstNumber(json, const ['subtotal'], fallback: 0),
      discount: _firstNumber(json, const ['discount'], fallback: 0),
      tax: _firstNumber(json, const ['tax'], fallback: 0),
      total: _firstNumber(json, const ['total'], fallback: 0),
    );
  }
}

class ReportPurchaseRow {
  const ReportPurchaseRow({
    required this.date,
    required this.purchaseCount,
    required this.subtotal,
    required this.tax,
    required this.total,
  });

  final String date;
  final num purchaseCount;
  final num subtotal;
  final num tax;
  final num total;

  factory ReportPurchaseRow.fromJson(Map<String, dynamic> json) {
    return ReportPurchaseRow(
      date: _firstValue(json, const ['date', 'day']) ?? '',
      purchaseCount: _firstNumber(json, const ['purchaseCount', 'purchase_count'], fallback: 0),
      subtotal: _firstNumber(json, const ['subtotal'], fallback: 0),
      tax: _firstNumber(json, const ['tax'], fallback: 0),
      total: _firstNumber(json, const ['total'], fallback: 0),
    );
  }
}

class ProductSummary {
  const ProductSummary({
    required this.total,
    required this.active,
    required this.low,
    required this.out,
    required this.archived,
    required this.value,
  });

  final num total;
  final num active;
  final num low;
  final num out;
  final num archived;
  final num value;

  factory ProductSummary.fromJson(Map<String, dynamic> json) {
    return ProductSummary(
      total: _firstNumber(json, const ['total', 'totalProducts', 'total_products'], fallback: 0),
      active: _firstNumber(json, const ['active', 'activeProducts', 'active_products'], fallback: 0),
      low: _firstNumber(json, const ['low', 'lowStock', 'low_stock'], fallback: 0),
      out: _firstNumber(json, const ['out', 'outOfStock', 'out_of_stock'], fallback: 0),
      archived: _firstNumber(json, const ['archived'], fallback: 0),
      value: _firstNumber(json, const ['value', 'inventoryValue', 'inventory_value'], fallback: 0),
    );
  }
}

class InventoryStock {
  const InventoryStock({
    required this.id,
    required this.name,
    this.sku,
    this.barcode,
    this.category,
    required this.unit,
    required this.balance,
    required this.minStock,
    required this.isLow,
    required this.sellingPrice,
    required this.purchasePrice,
    this.imageUrl,
  });

  final String id;
  final String name;
  final String? sku;
  final String? barcode;
  final String? category;
  final String unit;
  final num balance;
  final num minStock;
  final bool isLow;
  final num sellingPrice;
  final num purchasePrice;
  final String? imageUrl;

  factory InventoryStock.fromJson(Map<String, dynamic> json) {
    return InventoryStock(
      id: _firstValue(json, const ['id', 'productId', 'product_id']) ?? '',
      name: _firstValue(json, const ['name', 'productName', 'product_name']) ?? '',
      sku: _firstValue(json, const ['sku']),
      barcode: _firstValue(json, const ['barcode']),
      category: _firstValue(json, const ['category']),
      unit: _firstValue(json, const ['unit']) ?? 'pc',
      balance: _firstNumber(json, const ['balance', 'stock', 'currentStock', 'closingQty'], fallback: 0),
      minStock: _firstNumber(json, const ['minStock', 'min_stock'], fallback: 0),
      isLow: _firstBool(json, const ['isLow', 'is_low', 'low'], fallback: false),
      sellingPrice: _firstNumber(json, const ['sellingPrice', 'selling_price'], fallback: 0),
      purchasePrice: _firstNumber(json, const ['purchasePrice', 'purchase_price'], fallback: 0),
      imageUrl: _firstValue(json, const ['imageUrl', 'image_url']),
    );
  }
}

class StockMovementLedger {
  const StockMovementLedger({
    required this.id,
    this.productId,
    this.productName,
    this.productSku,
    this.productUnit,
    required this.qty,
    required this.type,
    this.referenceType,
    this.referenceId,
    this.balanceAfter,
    this.note,
    required this.createdAt,
  });

  final String id;
  final String? productId;
  final String? productName;
  final String? productSku;
  final String? productUnit;
  final num qty;
  final String type;
  final String? referenceType;
  final String? referenceId;
  final num? balanceAfter;
  final String? note;
  final String createdAt;

  factory StockMovementLedger.fromJson(Map<String, dynamic> json) {
    return StockMovementLedger(
      id: _firstValue(json, const ['id', 'movementId']) ?? '',
      productId: _firstValue(json, const ['productId', 'product_id']),
      productName: _firstValue(json, const ['productName', 'product_name']),
      productSku: _firstValue(json, const ['productSku', 'product_sku']),
      productUnit: _firstValue(json, const ['productUnit', 'product_unit']),
      qty: _firstNumber(json, const ['qty', 'quantity'], fallback: 0),
      type: _firstValue(json, const ['type']) ?? 'ADJUSTMENT',
      referenceType: _firstValue(json, const ['referenceType', 'reference_type']),
      referenceId: _firstValue(json, const ['referenceId', 'reference_id']),
      balanceAfter: json['balanceAfter'] != null || json['balance_after'] != null
          ? _firstNumber(json, const ['balanceAfter', 'balance_after'])
          : null,
      note: _firstValue(json, const ['note']),
      createdAt: _firstValue(json, const ['createdAt', 'created_at']) ??
          DateTime.now().toIso8601String(),
    );
  }
}

class SupplierSummary {
  const SupplierSummary({
    required this.total,
    required this.totalPayable,
    required this.outstandingCount,
    required this.settledCount,
    required this.overdueCount,
  });

  final num total;
  final num totalPayable;
  final num outstandingCount;
  final num settledCount;
  final num overdueCount;

  factory SupplierSummary.fromJson(Map<String, dynamic> json) {
    return SupplierSummary(
      total: _firstNumber(json, const ['total', 'totalSuppliers', 'total_suppliers'], fallback: 0),
      totalPayable: _firstNumber(json, const ['totalPayable', 'total_payable'], fallback: 0),
      outstandingCount: _firstNumber(json, const ['outstandingCount', 'outstanding_count'], fallback: 0),
      settledCount: _firstNumber(json, const ['settledCount', 'settled_count'], fallback: 0),
      overdueCount: _firstNumber(json, const ['overdueCount', 'overdue_count'], fallback: 0),
    );
  }
}

class UdhaariReminder {
  const UdhaariReminder({
    required this.entryId,
    required this.customerId,
    required this.customerName,
    this.customerMobile,
    required this.amount,
    required this.paid,
    required this.remaining,
    this.dueDate,
    this.reminderDate,
    this.invoiceNumber,
    this.saleId,
    required this.createdAt,
    required this.status,
    required this.overdue,
    this.overdueDays,
  });

  final String entryId;
  final String customerId;
  final String customerName;
  final String? customerMobile;
  final num amount;
  final num paid;
  final num remaining;
  final String? dueDate;
  final String? reminderDate;
  final String? invoiceNumber;
  final String? saleId;
  final String createdAt;
  final String status;
  final bool overdue;
  final num? overdueDays;

  factory UdhaariReminder.fromJson(Map<String, dynamic> json) {
    return UdhaariReminder(
      entryId: _firstValue(json, const ['entryId', 'entry_id']) ?? '',
      customerId: _firstValue(json, const ['customerId', 'customer_id']) ?? '',
      customerName: _firstValue(json, const ['customerName', 'customer_name']) ?? '',
      customerMobile: _firstValue(json, const ['customerMobile', 'customer_mobile']),
      amount: _firstNumber(json, const ['amount'], fallback: 0),
      paid: _firstNumber(json, const ['paid'], fallback: 0),
      remaining: _firstNumber(json, const ['remaining'], fallback: 0),
      dueDate: _firstValue(json, const ['dueDate', 'due_date']),
      reminderDate: _firstValue(json, const ['reminderDate', 'reminder_date']),
      invoiceNumber: _firstValue(json, const ['invoiceNumber', 'invoice_number']),
      saleId: _firstValue(json, const ['saleId', 'sale_id']),
      createdAt: _firstValue(json, const ['createdAt', 'created_at']) ??
          DateTime.now().toIso8601String(),
      status: _firstValue(json, const ['status']) ?? 'PENDING',
      overdue: _firstBool(json, const ['overdue'], fallback: false),
      overdueDays: json['overdueDays'] != null || json['overdue_days'] != null
          ? _firstNumber(json, const ['overdueDays', 'overdue_days'])
          : null,
    );
  }
}

class UdhaariReminderCounts {
  const UdhaariReminderCounts({
    required this.overdue,
    required this.today,
    required this.upcoming,
  });

  final num overdue;
  final num today;
  final num upcoming;

  factory UdhaariReminderCounts.fromJson(Map<String, dynamic> json) {
    return UdhaariReminderCounts(
      overdue: _firstNumber(json, const ['overdue'], fallback: 0),
      today: _firstNumber(json, const ['today'], fallback: 0),
      upcoming: _firstNumber(json, const ['upcoming'], fallback: 0),
    );
  }
}

class AppUser {
  const AppUser({
    required this.id,
    required this.name,
    required this.email,
    this.phone,
    required this.role,
    required this.isActive,
    this.createdAt,
    this.invitedAt,
  });

  final String id;
  final String name;
  final String email;
  final String? phone;
  final String role;
  final bool isActive;
  final String? createdAt;
  final String? invitedAt;

  factory AppUser.fromJson(Map<String, dynamic> json) {
    return AppUser(
      id: _firstValue(json, const ['id']) ?? '',
      name: _firstValue(json, const ['name']) ?? '',
      email: _firstValue(json, const ['email']) ?? '',
      phone: _firstValue(json, const ['phone']),
      role: _firstValue(json, const ['role']) ?? 'CASHIER',
      isActive: _firstBool(json, const ['isActive', 'is_active', 'active'], fallback: true),
      createdAt: _firstValue(json, const ['createdAt', 'created_at']),
      invitedAt: _firstValue(json, const ['invitedAt', 'invited_at']),
    );
  }
}
