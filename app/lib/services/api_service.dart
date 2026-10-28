import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

import '../core/config/app_config.dart';
import '../models/app_models.dart';

class TokenStorage {
  static const _refreshKey = 'midukandar_refresh_token';
  static const _legacyAccessKey = 'midukandar_access_token';

  static const FlutterSecureStorage _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
    iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
  );

  /// Access tokens are strictly in-memory: this app never persists them so a
  /// session survives restarts/updates purely via the refresh token, which
  /// lives in the OS secure store (Android Keystore / iOS Keychain).
  static Future<void> writeRefreshToken(String token) async {
    try {
      await _storage.write(key: _refreshKey, value: token);
    } catch (_) {}
  }

  static Future<String?> readRefreshToken() async {
    try {
      return await _storage.read(key: _refreshKey);
    } catch (_) {
      return null;
    }
  }

  static Future<void> clearTokens() async {
    try {
      await _storage.delete(key: _refreshKey);
      await _storage.delete(key: _legacyAccessKey);
    } catch (_) {}
  }

  /// One-time cleanup so a previously persisted access token (from older app
  /// builds) is never reused; access tokens must always be re-issued by the
  /// refresh endpoint after a cold start.
  static Future<void> purgeLegacyAccessToken() async {
    try {
      await _storage.delete(key: _legacyAccessKey);
    } catch (_) {}
  }
}

enum _RefreshOutcome { success, rejected, networkError }

String _extractRefreshTokenFromCookies(http.Response response) {
  final allSetCookies = response.headers['set-cookie'];
  if (allSetCookies == null || allSetCookies.isEmpty) {
    return '';
  }
  const cookieName = 'mz_refresh=';
  final segments = allSetCookies.split(',');
  for (final raw in segments) {
    final cookie = raw.trim();
    if (cookie.startsWith(cookieName)) {
      final afterEq = cookie.substring(cookieName.length);
      final semi = afterEq.indexOf(';');
      final value = semi >= 0 ? afterEq.substring(0, semi) : afterEq;
      return value;
    }
  }
  return '';
}

class InvoiceListPage {
  const InvoiceListPage({
    required this.invoices,
    required this.totalRevenue,
    required this.pendingAmount,
  });

  final List<InvoiceRecord> invoices;
  final num totalRevenue;
  final num pendingAmount;
}

class ApiService {
  ApiService({String? baseUrl, http.Client? client})
    : _baseUrl = AppConfig.normalize(
        baseUrl == null || baseUrl.trim().isEmpty ? AppConfig.baseUrl : baseUrl,
      ),
      _http = client ?? http.Client();

  final String _baseUrl;
  final http.Client _http;
  String? _accessToken;
  String? _refreshToken;
  Future<_RefreshOutcome>? _refreshFuture;

  static const _timeout = Duration(seconds: 20);

  String? get accessToken => _accessToken;
  String? get refreshToken => _refreshToken;

  /// Restores the persisted refresh token into memory. The access token stays
  /// null on cold start — the caller must run a silent refresh to obtain one.
  /// This is what lets a session survive process death, app updates and device
  /// restarts without ever showing the login screen.
  Future<void> loadTokens() async {
    await TokenStorage.purgeLegacyAccessToken();
    _accessToken = null;
    _refreshToken = await TokenStorage.readRefreshToken();
  }

  Future<void> _saveTokens({String? access, String? refresh}) async {
    if (access != null) _accessToken = access;
    if (refresh != null) {
      _refreshToken = refresh;
      await TokenStorage.writeRefreshToken(refresh);
    }
  }

  /// Silently refreshes the session using the persisted refresh token.
  /// Returns true when a valid access token is available afterwards. The
  /// refresh token is rotated server-side on every call (sliding expiry).
  Future<bool> restoreSession() async {
    _refreshToken ??= await TokenStorage.readRefreshToken();
    if (_refreshToken == null || _refreshToken!.isEmpty) {
      return false;
    }
    final outcome = await _refreshTokenInternal();
    if (outcome == _RefreshOutcome.success) return true;
    if (outcome == _RefreshOutcome.rejected) {
      // Server rejected the refresh token: force re-login on next launch.
      await _clearAll();
    }
    return false;
  }

  bool get isAuthenticated => _accessToken != null && _accessToken!.isNotEmpty;

  Future<Map<String, dynamic>> _request(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? body,
    Map<String, String>? headers,
    bool auth = true,
    bool allowRetry = true,
  }) async {
    final uri = AppConfig.uri(path, baseUrl: _baseUrl);
    final requestHeaders = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      if (auth && _accessToken != null && _accessToken!.isNotEmpty)
        'Authorization': 'Bearer $_accessToken',
      ...?headers,
    };

    http.Response response;
    try {
      if (method == 'GET') {
        response = await _http
            .get(uri, headers: requestHeaders)
            .timeout(_timeout);
      } else if (method == 'POST') {
        response = await _http
            .post(
              uri,
              headers: requestHeaders,
              body: body == null ? null : jsonEncode(body),
            )
            .timeout(_timeout);
      } else if (method == 'PUT') {
        response = await _http
            .put(
              uri,
              headers: requestHeaders,
              body: body == null ? null : jsonEncode(body),
            )
            .timeout(_timeout);
      } else if (method == 'PATCH') {
        response = await _http
            .patch(
              uri,
              headers: requestHeaders,
              body: body == null ? null : jsonEncode(body),
            )
            .timeout(_timeout);
      } else if (method == 'DELETE') {
        response = await _http
            .delete(uri, headers: requestHeaders)
            .timeout(_timeout);
      } else {
        throw UnsupportedError('Unsupported method: $method');
      }
    } on TimeoutException {
      throw const RequestTimeoutException();
    } catch (e) {
      if (e is HttpException) rethrow;
      throw const NetworkException();
    }

    if (response.statusCode == 401 && auth && allowRetry) {
      final outcome = await _refreshTokenInternal();
      if (outcome == _RefreshOutcome.success) {
        return _request(
          path,
          method: method,
          body: body,
          headers: headers,
          auth: auth,
          allowRetry: false,
        );
      }
      if (outcome == _RefreshOutcome.rejected) {
        // Server explicitly rejected the refresh token (expired/revoked).
        // This is the ONLY server-driven case that ends a session.
        await _clearAll();
        throw const SessionExpiredException();
      }
      // Network/transient failure during refresh: keep the stored refresh
      // token so the session survives, surface the failure to the user.
      throw const NetworkException();
    }

    if (response.statusCode >= 200 && response.statusCode < 300) {
      if (response.body.isEmpty) {
        return <String, dynamic>{};
      }
      try {
        final decoded = jsonDecode(response.body);
        return decoded is Map<String, dynamic>
            ? decoded
            : <String, dynamic>{'data': decoded};
      } catch (e) {
        return <String, dynamic>{'raw': response.body};
      }
    }

    String message = 'HTTP ${response.statusCode}';
    try {
      final decoded = jsonDecode(response.body);
      if (decoded is Map<String, dynamic>) {
        message =
            decoded['message']?.toString() ??
            decoded['error']?.toString() ??
            decoded['code']?.toString() ??
            message;
      }
    } catch (_) {}
    throw HttpException(message, response.statusCode);
  }

  Future<_RefreshOutcome> _refreshTokenInternal() async {
    if (_refreshFuture != null) return _refreshFuture!;
    _refreshFuture = () async {
      try {
        final storedRefresh = await TokenStorage.readRefreshToken();
        if (storedRefresh != null && storedRefresh.isNotEmpty) {
          _refreshToken = storedRefresh;
        }
        final body = <String, dynamic>{};
        if (_refreshToken != null && _refreshToken!.isNotEmpty) {
          body['refreshToken'] = _refreshToken;
        }
        final uri = AppConfig.uri('/api/auth/refresh', baseUrl: _baseUrl);
        http.Response res;
        try {
          res = await _http
              .post(
                uri,
                headers: {'Content-Type': 'application/json'},
                body: jsonEncode(body),
              )
              .timeout(_timeout);
        } on TimeoutException {
          return _RefreshOutcome.networkError;
        } catch (_) {
          return _RefreshOutcome.networkError;
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          final decoded = jsonDecode(res.body);
          if (decoded is Map) {
            final token = decoded['accessToken']?.toString() ?? '';
            final cookieToken = _extractRefreshTokenFromCookies(res);
            final nextRefresh = cookieToken.isNotEmpty
                ? cookieToken
                : (decoded['refreshToken']?.toString() ?? '');
            if (token.isNotEmpty) {
              await _saveTokens(
                access: token,
                refresh: nextRefresh.isNotEmpty ? nextRefresh : null,
              );
              return _RefreshOutcome.success;
            }
          }
        }
        if (res.statusCode == 401 || res.statusCode == 403) {
          return _RefreshOutcome.rejected;
        }
        return _RefreshOutcome.networkError;
      } catch (_) {
        return _RefreshOutcome.networkError;
      }
    }()..whenComplete(() => _refreshFuture = null);
    return _refreshFuture!;
  }

  Future<void> _clearAll() async {
    _accessToken = null;
    _refreshToken = null;
    await TokenStorage.clearTokens();
  }

  Future<void> logout() async {
    try {
      final storedRefresh = await TokenStorage.readRefreshToken();
      final body = <String, dynamic>{};
      if (storedRefresh != null && storedRefresh.isNotEmpty) {
        body['refreshToken'] = storedRefresh;
      } else if (_refreshToken != null && _refreshToken!.isNotEmpty) {
        body['refreshToken'] = _refreshToken;
      }
      await _request(
        '/api/auth/logout',
        method: 'POST',
        allowRetry: false,
        body: body.isEmpty ? null : body,
      );
    } catch (_) {}
    await _clearAll();
  }

  // ---------------- AUTH ----------------

  Future<String> requestLoginOtp({required String email}) async {
    final normalizedEmail = email.trim().toLowerCase();
    final loginKind = await _request(
      '/api/auth/login-kind',
      method: 'POST',
      body: {'identifier': normalizedEmail},
      auth: false,
    );
    final kind = loginKind['kind']?.toString() ?? 'user';
    if (kind.toLowerCase() == 'superadmin') {
      throw const HttpException(
        'Superadmin login is not supported on mobile. Please use the web dashboard.',
        403,
      );
    }
    try {
      final requestData = await _request(
        '/api/auth/otp/request',
        method: 'POST',
        body: {'email': normalizedEmail, 'purpose': 'LOGIN'},
        auth: false,
      );
      return (requestData['devOtp']?.toString() ?? '').trim();
    } on HttpException catch (error) {
      if (error.statusCode == 404) throw const AccountNotFoundException();
      rethrow;
    }
  }

  Future<AuthUser> verifyLoginOtp({
    required String email,
    required String otp,
  }) async {
    final normalizedEmail = email.trim().toLowerCase();
    final code = otp.trim();
    if (code.isEmpty) {
      throw const HttpException('OTP is required.', 400);
    }
    final verifyUri = AppConfig.uri('/api/auth/otp/verify', baseUrl: _baseUrl);
    final verifyBody = jsonEncode({
      'email': normalizedEmail,
      'otp': code,
      'purpose': 'LOGIN',
    });
    http.Response verification;
    try {
      verification = await _http
          .post(
            verifyUri,
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: verifyBody,
          )
          .timeout(_timeout);
    } on TimeoutException {
      throw const RequestTimeoutException();
    } catch (e) {
      if (e is HttpException) rethrow;
      throw const NetworkException();
    }

    if (!(verification.statusCode >= 200 && verification.statusCode < 300)) {
      String message = 'HTTP ${verification.statusCode}';
      try {
        final decoded = jsonDecode(verification.body);
        if (decoded is Map<String, dynamic>) {
          message =
              decoded['message']?.toString() ??
              decoded['error']?.toString() ??
              message;
        }
      } catch (_) {}
      throw HttpException(message, verification.statusCode);
    }

    final verificationData =
        jsonDecode(verification.body) as Map<String, dynamic>;
    final token = verificationData['accessToken']?.toString() ?? '';
    final refreshFromCookie = _extractRefreshTokenFromCookies(verification);
    final nextRefresh = refreshFromCookie.isNotEmpty
        ? refreshFromCookie
        : (verificationData['refreshToken']?.toString() ?? '');
    if (token.isNotEmpty) {
      await _saveTokens(
        access: token,
        refresh: nextRefresh.isNotEmpty ? nextRefresh : null,
      );
    }

    final user = verificationData['user'] is Map<String, dynamic>
        ? verificationData['user'] as Map<String, dynamic>
        : <String, dynamic>{};
    final me = await _request('/api/auth/me');
    final resolved = me['user'] is Map<String, dynamic>
        ? me['user'] as Map<String, dynamic>
        : (me.containsKey('id') ? me : user);
    return AuthUser.fromJson(resolved.isNotEmpty ? resolved : user);
  }

  Future<AuthUser> login({
    required String email,
    required String password,
  }) async {
    await requestLoginOtp(email: email);
    return verifyLoginOtp(email: email, otp: password);
  }

  Future<void> requestRegisterOtp({required String email}) async {
    await _request(
      '/api/auth/otp/request',
      method: 'POST',
      body: {'email': email.trim().toLowerCase(), 'purpose': 'REGISTER'},
      auth: false,
    );
  }

  Future<void> register({
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
  }) async {
    final body = jsonEncode({
      'email': email,
      'ownerName': ownerName,
      'name': name,
      'type': type,
      'address': address,
      'city': city,
      'state': state,
      'pincode': pincode,
      'phone': phone,
      'gst': gst,
      'currency': currency,
      'language': language,
      'invoicePrefix': invoicePrefix,
      'otp': otp,
    });
    final uri = AppConfig.uri('/api/auth/register', baseUrl: _baseUrl);
    http.Response response;
    try {
      response = await _http
          .post(
            uri,
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: body,
          )
          .timeout(_timeout);
    } on TimeoutException {
      throw const RequestTimeoutException();
    } catch (e) {
      if (e is HttpException) rethrow;
      throw const NetworkException();
    }

    if (!(response.statusCode >= 200 && response.statusCode < 300)) {
      String message = 'HTTP ${response.statusCode}';
      try {
        final decoded = jsonDecode(response.body);
        if (decoded is Map<String, dynamic>) {
          message =
              decoded['message']?.toString() ??
              decoded['error']?.toString() ??
              message;
        }
      } catch (_) {}
      throw HttpException(message, response.statusCode);
    }
  }

  Future<AuthUser> getCurrentUser() async {
    final data = await _request('/api/auth/me');
    return AuthUser.fromJson(
      (data['user'] is Map<String, dynamic>
          ? data['user'] as Map<String, dynamic>
          : (data.containsKey('id') ? data : <String, dynamic>{})),
    );
  }

  // ---------------- STORE ----------------

  Future<Store> getStore() async {
    final data = await _request('/api/store');
    final store = data['store'] is Map<String, dynamic>
        ? data['store'] as Map<String, dynamic>
        : (data.containsKey('id') ? data : <String, dynamic>{});
    return Store.fromJson(store);
  }

  Future<Store> updateStore(Map<String, dynamic> payload) async {
    final data = await _request('/api/store', method: 'PUT', body: payload);
    final store = data['store'] is Map<String, dynamic>
        ? data['store'] as Map<String, dynamic>
        : <String, dynamic>{};
    return Store.fromJson(store);
  }

  Future<Store> updateLanguage(String language) async {
    final data = await _request(
      '/api/settings/language',
      method: 'PATCH',
      body: {'language': language},
    );
    final store = data['store'] is Map<String, dynamic>
        ? data['store'] as Map<String, dynamic>
        : <String, dynamic>{};
    return Store.fromJson(store);
  }

  // ---------------- SMS ----------------

  Future<SmsUsage> getSmsUsage() async {
    final data = await _request('/api/sms/usage');
    return SmsUsage.fromJson(data);
  }

  Future<List<SmsMessage>> getSmsMessages({int limit = 5}) async {
    final data = await _request('/api/sms/messages?limit=$limit');
    final raw = data['messages'] is List ? data['messages'] as List : const [];
    final out = <SmsMessage>[];
    for (final item in raw) {
      if (item is Map<String, dynamic>) {
        out.add(SmsMessage.fromJson(item));
      } else if (item is Map) {
        out.add(SmsMessage.fromJson(Map<String, dynamic>.from(item)));
      }
    }
    return out;
  }

  Future<bool> updateSmsSettings(bool enabled) async {
    final data = await _request(
      '/api/sms/settings',
      method: 'PATCH',
      body: {'enabled': enabled},
    );
    return data['enabled'] == true;
  }

  /// Reports the outcome of a message the phone was asked to send in
  /// `SMS_MODE=device`: `SENT`, `FAILED` or `HANDED_OFF`.
  Future<void> reportSmsDelivery(String messageId, String status) async {
    await _request(
      '/api/sms/messages/$messageId/delivery',
      method: 'POST',
      body: {'status': status},
    );
  }

  Future<List<AppUser>> getUsers() async {
    final data = await _request('/api/users');
    final users = data['users'] is List ? data['users'] as List : const [];
    final invites = data['invites'] is List
        ? data['invites'] as List
        : const [];
    final out = <AppUser>[];
    for (final u in users) {
      if (u is Map<String, dynamic>) {
        out.add(AppUser.fromJson(u));
      }
    }
    for (final inv in invites) {
      if (inv is Map<String, dynamic>) {
        out.add(
          AppUser.fromJson({
            'id': inv['id']?.toString() ?? '',
            'name':
                inv['name']?.toString() ??
                (inv['email']?.toString() ?? 'Invite'),
            'email': inv['email']?.toString() ?? '',
            'phone': inv['phone']?.toString(),
            'role': inv['role']?.toString() ?? 'CASHIER',
            'isActive': false,
            'invitedAt': inv['invitedAt']?.toString() ??
                inv['createdAt']?.toString() ??
                inv['created_at']?.toString(),
          }),
        );
      }
    }
    return out;
  }

  // ---------------- PRODUCTS ----------------

  Future<Map<String, dynamic>> createProduct(
    Map<String, dynamic> payload,
  ) async {
    final data = await _request('/api/products', method: 'POST', body: payload);
    final product = data['product'];
    if (product is Map<String, dynamic>) return product;
    if (product is Map) return Map<String, dynamic>.from(product);
    return data;
  }

  Future<Map<String, dynamic>> updateProduct(
    String id,
    Map<String, dynamic> payload,
  ) async {
    final data = await _request(
      '/api/products/$id',
      method: 'PUT',
      body: payload,
    );
    final product = data['product'];
    if (product is Map<String, dynamic>) return product;
    if (product is Map) return Map<String, dynamic>.from(product);
    return data;
  }

  Future<void> deleteProduct(String id) async {
    await _request('/api/products/$id', method: 'DELETE');
  }

  Future<List<Product>> getProducts({int limit = 50}) async {
    final data = await _request('/api/products?limit=$limit');
    final items = data['products'] is List
        ? data['products'] as List
        : const [];
    return items
        .map((json) => Product.fromJson(json as Map<String, dynamic>))
        .toList();
  }

  Future<Map<String, dynamic>> adjustStock(
    String productId, {
    required num qty,
    required String reason,
    String? note,
  }) async {
    final data = await _request(
      '/api/products/$productId/adjust',
      method: 'POST',
      body: {
        'qty': qty,
        'reason': reason,
        if (note != null && note.isNotEmpty) 'note': note,
      },
    );
    return data;
  }

  Future<void> archiveProduct(String id, {bool archived = true}) async {
    await _request(
      '/api/products/$id/archive',
      method: 'PATCH',
      body: {'archived': archived},
    );
  }

  Future<Map<String, dynamic>> getProduct(String id) async {
    return _request('/api/products/$id');
  }

  Future<ProductSummary> getProductSummary() async {
    final data = await _request('/api/products/summary');
    final summary = data['summary'] is Map<String, dynamic>
        ? data['summary'] as Map<String, dynamic>
        : data;
    return ProductSummary.fromJson(summary);
  }

  Future<ExpiryAlert> getExpiryAlerts() async {
    final data = await _request('/api/products/expiring');
    return ExpiryAlert.fromJson(data);
  }

  Future<List<String>> getProductCategories() async {
    final data = await _request('/api/products/categories');
    final items = data['categories'] is List
        ? data['categories'] as List
        : const [];
    return items.map((e) => e.toString()).toList();
  }

  // ---------------- CUSTOMERS ----------------

  Future<Map<String, dynamic>> createCustomer(
    Map<String, dynamic> payload,
  ) async {
    final data = await _request(
      '/api/customers',
      method: 'POST',
      body: payload,
    );
    final customer = data['customer'];
    if (customer is Map<String, dynamic>) return customer;
    if (customer is Map) return Map<String, dynamic>.from(customer);
    return data;
  }

  Future<Map<String, dynamic>> updateCustomer(
    String id,
    Map<String, dynamic> payload,
  ) async {
    final data = await _request(
      '/api/customers/$id',
      method: 'PUT',
      body: payload,
    );
    final customer = data['customer'];
    if (customer is Map<String, dynamic>) return customer;
    if (customer is Map) return Map<String, dynamic>.from(customer);
    return data;
  }

  Future<void> deleteCustomer(String id) async {
    await _request('/api/customers/$id', method: 'DELETE');
  }

  Future<List<Customer>> getCustomers() async {
    final data = await _request('/api/customers');
    final items = data['customers'] is List
        ? data['customers'] as List
        : const [];
    return items
        .map((json) => Customer.fromJson(json as Map<String, dynamic>))
        .toList();
  }

  // ---------------- SALES / INVOICES ----------------

  Future<Map<String, dynamic>> createSale(Map<String, dynamic> payload) async {
    final data = await _request('/api/sales', method: 'POST', body: payload);
    final sale = data['sale'];
    if (sale is Map<String, dynamic>) return sale;
    if (sale is Map) return Map<String, dynamic>.from(sale);
    return data;
  }

  Future<Map<String, dynamic>> updateSale(
    String id,
    Map<String, dynamic> payload,
  ) async {
    final data = await _request('/api/sales/$id', method: 'PUT', body: payload);
    final sale = data['sale'];
    if (sale is Map<String, dynamic>) return sale;
    if (sale is Map) return Map<String, dynamic>.from(sale);
    return data;
  }

  Future<Map<String, dynamic>> markSalePaid(
    String id, {
    num? amount,
    String mode = 'CASH',
    String? note,
  }) async {
    final body = <String, dynamic>{};
    if (amount != null) body['amount'] = amount;
    body['mode'] = mode;
    if (note != null && note.isNotEmpty) body['note'] = note;
    final data = await _request(
      '/api/sales/$id/pay',
      method: 'POST',
      body: body.isEmpty ? null : body,
    );
    final sale = data['sale'];
    if (sale is Map<String, dynamic>) return sale;
    if (sale is Map) return Map<String, dynamic>.from(sale);
    return data;
  }

  Future<InvoiceListPage> getInvoices() async {
    final data = await _request('/api/sales?limit=200');
    final items = data['sales'] is List ? data['sales'] as List : const [];
    final summary = data['summary'] is Map
        ? Map<String, dynamic>.from(data['summary'] as Map)
        : const <String, dynamic>{};
    num readNum(Object? value) => value is num ? value : num.tryParse('$value') ?? 0;
    return InvoiceListPage(
      invoices: items
          .map((json) => InvoiceRecord.fromJson(json as Map<String, dynamic>))
          .toList(),
      totalRevenue: readNum(summary['totalRevenue']),
      pendingAmount: readNum(summary['pendingAmount']),
    );
  }

  Future<Map<String, dynamic>> reverseSale(
    String id, {
    required String reason,
  }) async {
    final data = await _request(
      '/api/sales/$id/reverse',
      method: 'POST',
      body: {'reason': reason},
    );
    final sale = data['sale'];
    if (sale is Map<String, dynamic>) return sale;
    if (sale is Map) return Map<String, dynamic>.from(sale);
    return data;
  }

  // ---------------- HELD BILLS ----------------

  Future<Map<String, dynamic>> holdSale(
    Map<String, dynamic> payload, {
    String? label,
  }) async {
    final data = await _request(
      '/api/sales/hold',
      method: 'POST',
      body: {'label': label, 'payload': payload},
    );
    final held = data['heldBill'];
    if (held is Map<String, dynamic>) return held;
    if (held is Map) return Map<String, dynamic>.from(held);
    return data;
  }

  Future<List<Map<String, dynamic>>> listHeldBills() async {
    final data = await _request('/api/sales/held/list');
    final items = data['heldBills'] is List ? data['heldBills'] as List : const [];
    return items
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }

  Future<void> deleteHeldBill(String id) async {
    await _request('/api/sales/held/$id', method: 'DELETE');
  }

  // ---------------- REFERRAL ----------------

  Future<Map<String, dynamic>> getReferral() async {
    return _request('/api/referral');
  }

  // ---------------- PURCHASES ----------------

  Future<Map<String, dynamic>> createPurchase(
    Map<String, dynamic> payload,
  ) async {
    final data = await _request(
      '/api/purchases',
      method: 'POST',
      body: payload,
    );
    final purchase = data['purchase'];
    if (purchase is Map<String, dynamic>) return purchase;
    if (purchase is Map) return Map<String, dynamic>.from(purchase);
    return data;
  }

  Future<void> recordPurchasePayment(
    String purchaseId, {
    required num amount,
    String mode = 'CASH',
    String? note,
  }) async {
    await _request(
      '/api/purchases/$purchaseId/payment',
      method: 'POST',
      body: {
        'amount': amount,
        'mode': mode,
        if (note != null && note.isNotEmpty) 'note': note,
      },
    );
  }

  Future<List<Purchase>> getPurchases() async {
    final data = await _request('/api/purchases');
    final items = data['purchases'] is List
        ? data['purchases'] as List
        : const [];
    return items
        .map((json) => Purchase.fromJson(json as Map<String, dynamic>))
        .toList();
  }

  // ---------------- SUPPLIERS ----------------

  Future<List<Supplier>> getSuppliers() async {
    final data = await _request('/api/suppliers');
    final items = data['suppliers'] is List
        ? data['suppliers'] as List
        : const [];
    return items
        .map((json) => Supplier.fromJson(json as Map<String, dynamic>))
        .toList();
  }

  Future<Map<String, dynamic>> getSupplierDetail(String id) async {
    return _request('/api/suppliers/$id');
  }

  Future<Map<String, dynamic>> createSupplier(
    Map<String, dynamic> payload,
  ) async {
    final data = await _request(
      '/api/suppliers',
      method: 'POST',
      body: payload,
    );
    final supplier = data['supplier'];
    if (supplier is Map<String, dynamic>) return supplier;
    if (supplier is Map) return Map<String, dynamic>.from(supplier);
    return data;
  }

  Future<Map<String, dynamic>> updateSupplier(
    String id,
    Map<String, dynamic> payload,
  ) async {
    final data = await _request(
      '/api/suppliers/$id',
      method: 'PATCH',
      body: payload,
    );
    final supplier = data['supplier'];
    if (supplier is Map<String, dynamic>) return supplier;
    if (supplier is Map) return Map<String, dynamic>.from(supplier);
    return data;
  }

  Future<void> deleteSupplier(String id) async {
    await _request('/api/suppliers/$id', method: 'DELETE');
  }

  Future<Map<String, dynamic>> createSupplierInvoice(
    String supplierId,
    Map<String, dynamic> payload,
  ) async {
    final data = await _request(
      '/api/suppliers/$supplierId/invoice',
      method: 'POST',
      body: payload,
    );
    final invoice = data['purchase'];
    if (invoice is Map<String, dynamic>) return invoice;
    if (invoice is Map) return Map<String, dynamic>.from(invoice);
    return data;
  }

  // ---------------- EXPENSES ----------------

  Future<Map<String, dynamic>> createExpense(
    Map<String, dynamic> payload,
  ) async {
    final data = await _request('/api/expenses', method: 'POST', body: payload);
    final expense = data['expense'];
    if (expense is Map<String, dynamic>) return expense;
    if (expense is Map) return Map<String, dynamic>.from(expense);
    return data;
  }

  Future<Map<String, dynamic>> updateExpense(
    String id,
    Map<String, dynamic> payload,
  ) async {
    final data = await _request(
      '/api/expenses/$id',
      method: 'PATCH',
      body: payload,
    );
    final expense = data['expense'];
    if (expense is Map<String, dynamic>) return expense;
    if (expense is Map) return Map<String, dynamic>.from(expense);
    return data;
  }

  Future<void> deleteExpense(String id) async {
    await _request('/api/expenses/$id', method: 'DELETE');
  }

  Future<List<Expense>> getExpenses() async {
    final data = await _request('/api/expenses');
    final items = data['expenses'] is List
        ? data['expenses'] as List
        : (data['items'] is List ? data['items'] as List : const []);
    return items
        .map((json) => Expense.fromJson(json as Map<String, dynamic>))
        .toList();
  }

  Future<List<ExpenseCategory>> getExpenseCategories() async {
    final data = await _request('/api/expenses/categories');
    final items = data['categories'] is List
        ? data['categories'] as List
        : const [];
    return items
        .map((json) => ExpenseCategory.fromJson(json as Map<String, dynamic>))
        .toList();
  }

  Future<ExpenseSummary> getExpenseSummary() async {
    final data = await _request('/api/expenses/summary');
    return ExpenseSummary.fromJson(data);
  }

  // ---------------- UDHAARI ----------------

  Future<List<UdhaariCustomer>> getUdhaariCustomers({String? status}) async {
    final path = status != null && status.isNotEmpty
        ? '/api/udhaari?status=$status'
        : '/api/udhaari';
    final data = await _request(path);
    final items = data['customers'] is List
        ? data['customers'] as List
        : (data['items'] is List ? data['items'] as List : const []);
    final out = <UdhaariCustomer>[];
    for (final row in items) {
      if (row is Map<String, dynamic>) {
        out.add(UdhaariCustomer.fromJson(row));
      }
    }
    return out;
  }

  Future<List<UdhaariEntry>> getUdhaariEntries(String customerId) async {
    final dynamic data = await _request('/api/udhaari/$customerId');
    final List items;
    if (data is Map && data['entries'] is List) {
      items = data['entries'] as List;
    } else if (data is List) {
      items = data;
    } else {
      items = const [];
    }
    final out = <UdhaariEntry>[];
    for (final row in items) {
      if (row is Map<String, dynamic>) {
        out.add(UdhaariEntry.fromJson(row));
      }
    }
    return out;
  }

  Future<Map<String, dynamic>> createUdhaari(
    Map<String, dynamic> payload,
  ) async {
    return _request('/api/udhaari', method: 'POST', body: payload);
  }

  Future<Map<String, dynamic>> payUdhaariEntry(
    String entryId, {
    required num amount,
    String mode = 'CASH',
    String? note,
  }) async {
    return _request(
      '/api/udhaari/$entryId/pay',
      method: 'POST',
      body: {
        'amount': amount,
        'mode': mode,
        if (note != null && note.isNotEmpty) 'note': note,
      },
    );
  }

  Future<Map<String, dynamic>> receiveCustomerPayment({
    required String customerId,
    required num amount,
    String mode = 'CASH',
    String? note,
  }) async {
    return _request(
      '/api/payments/receive',
      method: 'POST',
      body: {
        'customerId': customerId,
        'amount': amount,
        'mode': mode,
        if (note != null && note.isNotEmpty) 'note': note,
      },
    );
  }

  // ---------------- PAYMENTS ----------------

  Future<List<Payment>> getPayments({String? customerId}) async {
    final path = customerId != null && customerId.isNotEmpty
        ? '/api/payments?customerId=${Uri.encodeComponent(customerId)}'
        : '/api/payments';
    final data = await _request(path);
    final items = data['payments'] is List
        ? data['payments'] as List
        : const [];
    return items
        .map((json) => Payment.fromJson(json as Map<String, dynamic>))
        .toList();
  }

  // ---------------- REPORTS / DASHBOARD ----------------

  // ---------------- INVENTORY ----------------

  Future<List<InventoryStock>> getInventoryStock({
    bool lowOnly = false,
    String? search,
  }) async {
    final buffer = StringBuffer('/api/inventory/stock/current');
    final params = <String>[
      if (lowOnly) 'lowOnly=true',
      if (search != null && search.isNotEmpty)
        'search=${Uri.encodeQueryComponent(search)}',
    ];
    if (params.isNotEmpty) {
      buffer.write('?${params.join('&')}');
    }
    final data = await _request(buffer.toString());
    final items = data['stock'] is List ? data['stock'] as List : const [];
    return items
        .map((json) => InventoryStock.fromJson(json as Map<String, dynamic>))
        .toList();
  }

  Future<num> getLowStockCount() async {
    final data = await _request('/api/inventory/stock/low');
    final count = data['count'];
    if (count is num) return count;
    if (count is String) return num.tryParse(count) ?? 0;
    return 0;
  }

  Future<List<LowStockProduct>> getLowStockItems() async {
    final data = await _request('/api/inventory/stock/low');
    final items = data['items'] is List ? data['items'] as List : const [];
    return items
        .map((json) => LowStockProduct.fromJson(json as Map<String, dynamic>))
        .toList();
  }

  Future<List<StockMovementLedger>> getStockMovements({
    String? productId,
    int limit = 50,
  }) async {
    final buffer = StringBuffer('/api/inventory/movements?limit=$limit');
    if (productId != null && productId.isNotEmpty) {
      buffer.write('&productId=${Uri.encodeQueryComponent(productId)}');
    }
    final data = await _request(buffer.toString());
    final items = data['movements'] is List
        ? data['movements'] as List
        : const [];
    return items
        .map(
          (json) => StockMovementLedger.fromJson(json as Map<String, dynamic>),
        )
        .toList();
  }

  // ---------------- SUPPLIER SUMMARY ----------------

  Future<SupplierSummary> getSupplierSummary() async {
    final data = await _request('/api/suppliers/summary');
    return SupplierSummary.fromJson(data);
  }

  // ---------------- UDHAARI REMINDERS ----------------

  Future<({List<UdhaariReminder> reminders, UdhaariReminderCounts counts})>
  getUdhaariReminders({String scope = 'all', String? search}) async {
    final buffer = StringBuffer('/api/udhaari/reminders?scope=$scope');
    if (search != null && search.isNotEmpty) {
      buffer.write('&search=${Uri.encodeQueryComponent(search)}');
    }
    final data = await _request(buffer.toString());
    final items = data['reminders'] is List
        ? data['reminders'] as List
        : const [];
    final reminders = items
        .map((json) => UdhaariReminder.fromJson(json as Map<String, dynamic>))
        .toList();
    final counts = data['counts'] is Map<String, dynamic>
        ? data['counts'] as Map<String, dynamic>
        : <String, dynamic>{};
    return (
      reminders: reminders,
      counts: UdhaariReminderCounts.fromJson(counts),
    );
  }

  // ---------------- USERS ----------------

  Future<Map<String, dynamic>> inviteUser({
    required String name,
    String? email,
    String? phone,
    required String role,
  }) async {
    return _request(
      '/api/users/invite',
      method: 'POST',
      body: {
        'name': name,
        if (email != null && email.isNotEmpty) 'email': email,
        if (phone != null && phone.isNotEmpty) 'phone': phone,
        'role': role,
      },
    );
  }

  Future<void> updateUserStatus(String id, {required bool isActive}) async {
    await _request(
      '/api/users/$id/status',
      method: 'PATCH',
      body: {'isActive': isActive},
    );
  }

  Future<void> updateUserRole(String id, {required String role}) async {
    await _request('/api/users/$id', method: 'PATCH', body: {'role': role});
  }

  Future<DashboardStats> getDashboardSummary() async {
    final data = await _request('/api/reports/dashboard');
    final stats = data['stats'] is Map<String, dynamic>
        ? data['stats'] as Map<String, dynamic>
        : data;
    return DashboardStats.fromJson(stats);
  }

  Future<List<ReportSalesRow>> getSalesReport({
    String? from,
    String? to,
  }) async {
    final buffer = StringBuffer('/api/reports/sales');
    final params = <String>[];
    if (from != null && from.isNotEmpty) params.add('from=$from');
    if (to != null && to.isNotEmpty) params.add('to=$to');
    if (params.isNotEmpty) {
      buffer.write('?${params.join('&')}');
    }
    final data = await _request(buffer.toString());
    final rows = data['rows'] is List ? data['rows'] as List : const [];
    return rows
        .map((json) => ReportSalesRow.fromJson(json as Map<String, dynamic>))
        .toList();
  }

  Future<List<ReportPurchaseRow>> getPurchaseReport({
    String? from,
    String? to,
  }) async {
    final buffer = StringBuffer('/api/reports/purchases');
    final params = <String>[];
    if (from != null && from.isNotEmpty) params.add('from=$from');
    if (to != null && to.isNotEmpty) params.add('to=$to');
    if (params.isNotEmpty) buffer.write('?${params.join('&')}');
    final data = await _request(buffer.toString());
    final rows = data['rows'] is List ? data['rows'] as List : const [];
    return rows
        .map((json) => ReportPurchaseRow.fromJson(json as Map<String, dynamic>))
        .toList();
  }

  Future<Map<String, dynamic>> getPnlReport({String? from, String? to}) async {
    final buffer = StringBuffer('/api/reports/pnl');
    final params = <String>[];
    if (from != null && from.isNotEmpty) params.add('from=$from');
    if (to != null && to.isNotEmpty) params.add('to=$to');
    if (params.isNotEmpty) buffer.write('?${params.join('&')}');
    final data = await _request(buffer.toString());
    return data;
  }

  Future<Map<String, dynamic>> getGstReport({String? from, String? to}) async {
    final buffer = StringBuffer('/api/reports/gst');
    final params = <String>[];
    if (from != null && from.isNotEmpty) params.add('from=$from');
    if (to != null && to.isNotEmpty) params.add('to=$to');
    if (params.isNotEmpty) buffer.write('?${params.join('&')}');
    final data = await _request(buffer.toString());
    return data;
  }
}

@immutable
class HttpException implements Exception {
  const HttpException(this.message, this.statusCode);

  final String message;
  final int statusCode;

  @override
  String toString() => message;
}

class SessionExpiredException extends HttpException {
  const SessionExpiredException()
    : super('Your session has expired. Please sign in again.', 401);
}

class NetworkException extends HttpException {
  const NetworkException()
    : super(
        'Unable to connect to MiDukandar. Please check your internet connection and try again.',
        0,
      );
}

class RequestTimeoutException extends HttpException {
  const RequestTimeoutException()
    : super('Connection timed out. Please try again.', 408);
}

class AccountNotFoundException extends HttpException {
  const AccountNotFoundException()
    : super(
        'Account not found. Please check your email or register your business.',
        404,
      );
}
