import 'dart:async';

import 'package:flutter/material.dart';

import '../l10n/generated/app_localizations.dart';
import '../services/api_service.dart';

enum _AuthStep { email, otp }

class AuthScreen extends StatefulWidget {
  const AuthScreen({
    super.key,
    required this.onRequestOtp,
    required this.onVerifyOtp,
    this.isLoading = false,
    this.onRegister,
  });

  final Future<String> Function(String email) onRequestOtp;
  final Future<void> Function(String email, String otp) onVerifyOtp;
  final bool isLoading;
  final VoidCallback? onRegister;

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final _emailController = TextEditingController();
  final _otpController = TextEditingController();
  final _emailFormKey = GlobalKey<FormState>();
  _AuthStep _step = _AuthStep.email;
  bool _requestingOtp = false;
  bool _verifying = false;
  int _countdown = 0;
  String? _devHint;
  String? _emailError;
  String? _notice;
  bool _noticeIsError = false;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _startTimerTick();
  }

  void _startTimerTick() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (_countdown > 0) {
        if (mounted) setState(() => _countdown--);
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _emailController.dispose();
    _otpController.dispose();
    super.dispose();
  }

  String _friendlyError(
    Object error,
    AppLocalizations l, {
    required bool verifying,
  }) {
    if (error is AccountNotFoundException) return l.authAccountNotFound;
    if (error is RequestTimeoutException) return l.authConnectionTimeout;
    if (error is NetworkException) return l.authUnableToConnect;
    if (error is HttpException) {
      if (error.statusCode == 408) return l.authConnectionTimeout;
      if (error.statusCode == 404) return l.authAccountNotFound;
      if (error.statusCode >= 500) return l.authServiceUnavailable;
      if (error.statusCode == 403 || error.statusCode == 400) {
        return error.message;
      }
    }
    return verifying ? l.authErrVerify : l.authErrSendOtp;
  }

  Future<void> _requestCode() async {
    if (_requestingOtp) return;
    if (!(_emailFormKey.currentState?.validate() ?? false)) return;
    setState(() {
      _requestingOtp = true;
      _emailError = null;
      _notice = null;
    });
    try {
      final devOtp = await widget.onRequestOtp(_emailController.text.trim());
      if (!mounted) return;
      setState(() {
        _step = _AuthStep.otp;
        _countdown = 120;
        _devHint = devOtp.isNotEmpty ? devOtp : null;
        if (devOtp.isNotEmpty) {
          _otpController.text = devOtp;
        } else {
          _notice = AppLocalizations.of(context)!.authCodeSentNotice;
          _noticeIsError = false;
        }
      });
    } catch (error) {
      if (!mounted) return;
      final message = _friendlyError(
        error,
        AppLocalizations.of(context)!,
        verifying: false,
      );
      setState(() {
        _emailError = message;
        _notice = null;
      });
    } finally {
      if (mounted) setState(() => _requestingOtp = false);
    }
  }

  Future<void> _verify() async {
    if (_verifying || widget.isLoading) return;
    final otp = _otpController.text.trim();
    if (otp.length < 4) {
      setState(() {
        _notice = AppLocalizations.of(context)!.authOtpTooShort;
        _noticeIsError = true;
      });
      return;
    }
    setState(() {
      _verifying = true;
      _notice = null;
    });
    try {
      await widget.onVerifyOtp(_emailController.text.trim(), otp);
    } catch (error) {
      if (!mounted) return;
      final message = _friendlyError(
        error,
        AppLocalizations.of(context)!,
        verifying: true,
      );
      setState(() {
        _notice = message;
        _noticeIsError = true;
        _otpController.clear();
      });
    } finally {
      if (mounted) setState(() => _verifying = false);
    }
  }

  void _changeEmail() {
    setState(() {
      _step = _AuthStep.email;
      _otpController.clear();
      _devHint = null;
      _countdown = 0;
      _notice = null;
      _emailError = null;
    });
  }

  Future<void> _registerBusiness() async {
    if (widget.onRegister != null) {
      widget.onRegister!();
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final verifying = _verifying || widget.isLoading;
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
                  child: SizedBox(
                    width: double.infinity,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(14),
                          child: Image.asset(
                            'assets/logo.png',
                            height: 80,
                            fit: BoxFit.contain,
                            errorBuilder: (_, __, ___) => const Icon(
                              Icons.storefront,
                              size: 56,
                              color: Color(0xFF1F4E79),
                            ),
                          ),
                        ),

                        const SizedBox(height: 20),
                        if (_step == _AuthStep.email) ...[
                          _buildEmailStep(verifying: verifying),
                          const SizedBox(height: 20),
                          const Divider(height: 1),
                          const SizedBox(height: 16),
                          Wrap(
                            alignment: WrapAlignment.center,
                            crossAxisAlignment: WrapCrossAlignment.center,
                            children: [
                              Text(
                                l.authNoAccount,
                                style: const TextStyle(color: Colors.grey),
                              ),
                              TextButton(
                                onPressed: verifying ? null : _registerBusiness,
                                style: TextButton.styleFrom(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 6,
                                  ),
                                ),
                                child: Text(l.authRegisterBusiness),
                              ),
                            ],
                          ),
                        ] else ...[
                          _buildOtpStep(verifying: verifying),
                        ],
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildEmailStep({required bool verifying}) {
    final l = AppLocalizations.of(context)!;
    final sending = _requestingOtp || verifying;
    return Form(
      key: _emailFormKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: Colors.blue.shade200),
              color: Colors.blue.shade50,
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(
                    color: Colors.blue.shade700,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 6),
                Text(
                  l.authSignInBadge,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: Colors.blue.shade800,
                    letterSpacing: 1.2,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Text(
            l.authWelcomeBack,
            style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 4),
          Text(
            l.authSignInSubtitle,
            style: const TextStyle(color: Colors.grey, fontSize: 13),
          ),
          const SizedBox(height: 20),
          TextFormField(
            controller: _emailController,
            enabled: !sending,
            keyboardType: TextInputType.emailAddress,
            autocorrect: false,
            autofillHints: const [AutofillHints.email],
            autovalidateMode: AutovalidateMode.onUserInteraction,
            validator: (value) {
              final v = (value ?? '').trim();
              if (v.isEmpty) return l.authEnterEmail;
              if (!RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(v))
                return l.authInvalidEmail;
              return null;
            },
            onChanged: (_) {
              if (_emailError != null) setState(() => _emailError = null);
              if (_notice != null) setState(() => _notice = null);
            },
            decoration: InputDecoration(
              labelText: l.authEmail,
              prefixIcon: const Icon(Icons.email_outlined),
              border: const OutlineInputBorder(),
            ),
          ),
          if (_emailError != null) ...[
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: Colors.red.shade50,
                border: Border.all(color: Colors.red.shade200),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(
                    Icons.error_outline,
                    color: Colors.red.shade700,
                    size: 18,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _emailError!,
                          style: TextStyle(
                            color: Colors.red.shade800,
                            fontSize: 12,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Align(
                          alignment: Alignment.centerRight,
                          child: TextButton.icon(
                            onPressed: sending ? null : _requestCode,
                            icon: const Icon(Icons.refresh, size: 15),
                            label: Text(l.authTryAgain),
                            style: TextButton.styleFrom(
                              padding: EdgeInsets.zero,
                              minimumSize: Size.zero,
                              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                              visualDensity: VisualDensity.compact,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: sending ? null : _requestCode,
              icon: sending
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : Icon(
                      _emailError == null ? Icons.arrow_forward : Icons.refresh,
                    ),
              label: Text(
                sending
                    ? l.authSendingOtp
                    : _emailError == null
                    ? l.authGetOtp
                    : l.authTryAgain,
              ),
              style: FilledButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildOtpStep({required bool verifying}) {
    final l = AppLocalizations.of(context)!;
    final loading = _verifying || verifying;
    final canResend = _countdown <= 0 && !_requestingOtp;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton.icon(
            onPressed: loading ? null : _changeEmail,
            icon: const Icon(Icons.arrow_back, size: 18),
            label: Text(l.authChangeEmail),
            style: TextButton.styleFrom(padding: EdgeInsets.zero),
          ),
        ),
        const SizedBox(height: 8),
        if (_devHint != null) ...[
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: Colors.amber.shade50,
              border: Border.all(color: Colors.amber.shade200),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                Icon(
                  Icons.shield_outlined,
                  color: Colors.amber.shade700,
                  size: 18,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    l.authDevMode(_devHint!),
                    style: TextStyle(
                      color: Colors.amber.shade900,
                      fontSize: 12,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
        ] else ...[
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: Colors.green.shade50,
              border: Border.all(color: Colors.green.shade200),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                Icon(
                  Icons.check_circle_outline,
                  color: Colors.green.shade700,
                  size: 18,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    l.authCodeSentTo(_emailController.text.trim()),
                    style: TextStyle(
                      color: Colors.green.shade800,
                      fontSize: 12,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
        ],
        Text(
          l.authEnterOtp,
          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 4),
        Text(
          l.authOtpInstructions(_formatCountdown(_countdown)),
          style: const TextStyle(color: Colors.grey, fontSize: 13),
        ),
        const SizedBox(height: 16),
        TextField(
          controller: _otpController,
          enabled: !loading,
          keyboardType: TextInputType.number,
          style: const TextStyle(
            fontSize: 22,
            letterSpacing: 8,
            fontWeight: FontWeight.bold,
          ),
          textAlign: TextAlign.center,
          maxLength: 6,
          decoration: InputDecoration(
            counterText: '',
            prefixIcon: const Icon(Icons.lock_outline),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
            hintText: l.authOtpPlaceholder,
            hintStyle: const TextStyle(
              letterSpacing: 6,
              color: Colors.grey,
              fontSize: 16,
            ),
          ),
          onSubmitted: (_) => _verify(),
        ),
        if (_notice != null) ...[
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: _noticeIsError ? Colors.red.shade50 : Colors.blue.shade50,
              border: Border.all(
                color: _noticeIsError
                    ? Colors.red.shade200
                    : Colors.blue.shade200,
              ),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                Icon(
                  _noticeIsError ? Icons.error_outline : Icons.info_outline,
                  color: _noticeIsError
                      ? Colors.red.shade700
                      : Colors.blue.shade700,
                  size: 18,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    _notice!,
                    style: TextStyle(
                      color: _noticeIsError
                          ? Colors.red.shade800
                          : Colors.blue.shade800,
                      fontSize: 12,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
        const SizedBox(height: 16),
        SizedBox(
          width: double.infinity,
          child: FilledButton.icon(
            onPressed: loading ? null : _verify,
            icon: loading
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : const Icon(Icons.check_circle_outline),
            label: Text(loading ? l.authSigningIn : l.authVerifyAndSignIn),
            style: FilledButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: 14),
            ),
          ),
        ),
        const SizedBox(height: 12),
        Center(
          child: TextButton(
            onPressed: canResend && !loading ? _requestCode : null,
            child: Text(
              canResend
                  ? l.authResendCode
                  : l.authResendIn(_formatCountdown(_countdown)),
            ),
          ),
        ),
      ],
    );
  }

  static String _formatCountdown(int seconds) {
    final mm = (seconds ~/ 60).toString().padLeft(2, '0');
    final ss = (seconds % 60).toString().padLeft(2, '0');
    return '$mm:$ss';
  }
}
