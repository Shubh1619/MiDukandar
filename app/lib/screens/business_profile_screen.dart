import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../l10n/generated/app_localizations.dart';
import '../models/app_models.dart';
import '../services/api_service.dart';
import '../theme/md_design.dart';
import 'settings_screen.dart';

/// Read-only business profile: details, registered date and plan status, with
/// an Edit action that reuses the existing Settings (store profile) form.
class BusinessProfileScreen extends StatefulWidget {
  const BusinessProfileScreen({
    super.key,
    required this.apiService,
    required this.user,
    required this.initialStore,
  });

  final ApiService apiService;
  final AuthUser? user;
  final Store? initialStore;

  @override
  State<BusinessProfileScreen> createState() => _BusinessProfileScreenState();
}

class _BusinessProfileScreenState extends State<BusinessProfileScreen> {
  Store? _store;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _store = widget.initialStore;
    _load();
  }

  Future<void> _load() async {
    try {
      final store = await widget.apiService.getStore();
      if (mounted) setState(() => _store = store);
    } catch (_) {
      // Keep the snapshot provided by the shell; details are best-effort.
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _edit() async {
    final l = AppLocalizations.of(context)!;
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => Scaffold(
          appBar: AppBar(title: Text(l.sectionSettings)),
          body: SettingsScreen(
            apiService: widget.apiService,
            store: _store ?? widget.initialStore,
            onChanged: () async {
              if (mounted) setState(() => _loading = true);
              await _load();
            },
          ),
        ),
      ),
    );
    await _load();
  }

  String _address(Store? store) {
    final parts = <String>[
      if (store?.address != null) store!.address!,
      if (store?.city != null) store!.city!,
      if (store?.state != null) store!.state!,
      if (store?.pincode != null) store!.pincode!,
    ].map((x) => x.trim()).where((x) => x.isNotEmpty).toList();
    return parts.isEmpty ? '—' : parts.join(', ');
  }

  String _date(String? iso) {
    if (iso == null || iso.isEmpty) return '—';
    try {
      return DateFormat('d MMM yyyy').format(DateTime.parse(iso).toLocal());
    } catch (_) {
      return iso;
    }
  }

  String _planLabel(AppLocalizations l, String plan) {
    if (plan.trim().toUpperCase() == 'FREE') return l.bizPlanFree;
    return plan.trim().isEmpty ? l.bizPlanFree : plan;
  }

  String _planStatusLabel(AppLocalizations l, String status) {
    switch (status.trim().toUpperCase()) {
      case 'TRIAL':
        return l.bizPlanTrial;
      case 'ACTIVE':
        return l.statusActive;
      case 'OVERDUE':
        return l.statusOverdue;
      case 'CANCELED':
      case 'CANCELLED':
        return l.statusCancelled;
      default:
        return status;
    }
  }

  Widget _statusChip(AppLocalizations l, Store store) {
    final suspended = store.status.toUpperCase() == 'SUSPENDED';
    final planStatus = store.planStatus.trim().toUpperCase();
    final problem = suspended || planStatus == 'OVERDUE' || planStatus == 'CANCELED';
    final active = planStatus == 'ACTIVE' && !suspended;
    final backgroundColor =
        problem ? MdColors.red50 : (active ? MdColors.green100 : const Color(0xFFFEF3C7));
    final foregroundColor =
        problem ? MdColors.red700 : (active ? MdColors.green700 : const Color(0xFF92400E));
    return MdChip(
      label: suspended ? l.bizStatusSuspended : _planStatusLabel(l, store.planStatus),
      background: backgroundColor,
      foreground: foregroundColor,
    );
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    return Scaffold(
      appBar: AppBar(title: Text(l.bizProfileTitle)),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _content(l),
    );
  }

  Widget _content(AppLocalizations l) {
    final store = _store ?? widget.initialStore;
    final user = widget.user;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        MdHeader(
          title: l.bizProfileTitle,
          subtitle: l.bizProfileSubtitle,
        ),
        const SizedBox(height: 16),
        MdCard(
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: MdColors.navy900,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Icon(
                  Icons.storefront_rounded,
                  color: Colors.white,
                  size: 24,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      store?.name ?? '—',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w700,
                        color: MdColors.navy900,
                      ),
                    ),
                    if ((store?.type ?? '').isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(
                        store!.type,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 12.5,
                          color: MdColors.mutedForeground,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              if (store != null) ...[
                const SizedBox(width: 10),
                _statusChip(l, store),
              ],
            ],
          ),
        ),
        const SizedBox(height: 12),
        MdCard(
          child: Column(
            children: [
              _DetailRow(
                icon: Icons.person_outline,
                label: l.bizOwnerName,
                value: user?.name ?? '—',
              ),
              _DetailRow(
                icon: Icons.confirmation_number_outlined,
                label: l.bizGstin,
                value: store?.gst ?? '—',
              ),
              _DetailRow(
                icon: Icons.location_on_outlined,
                label: l.bizAddress,
                value: _address(store),
              ),
              _DetailRow(
                icon: Icons.phone_outlined,
                label: l.bizMobile,
                value: store?.phone ?? user?.phone ?? '—',
              ),
              _DetailRow(
                icon: Icons.category_outlined,
                label: l.bizCategory,
                value: store?.type ?? '—',
              ),
              _DetailRow(
                icon: Icons.event_outlined,
                label: l.bizRegisteredOn,
                value: _date(store?.createdAt),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        MdCard(
          child: Column(
            children: [
              _DetailRow(
                icon: Icons.workspace_premium_outlined,
                label: l.bizPlan,
                value: _planLabel(l, store?.plan ?? 'FREE'),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Row(
                  children: [
                    Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: MdColors.navy50,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(
                        Icons.badge_outlined,
                        size: 18,
                        color: MdColors.navy600,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        l.bizPlanStatus,
                        style: const TextStyle(
                          fontSize: 12,
                          color: MdColors.mutedForeground,
                        ),
                      ),
                    ),
                    if (store != null) _statusChip(l, store),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        SizedBox(
          width: double.infinity,
          child: FilledButton.icon(
            onPressed: _edit,
            icon: const Icon(Icons.edit_outlined, size: 18),
            label: Text(l.edit),
          ),
        ),
        const SizedBox(height: 16),
      ],
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: MdColors.navy50,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, size: 18, color: MdColors.navy600),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 12,
                    color: MdColors.mutedForeground,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: const TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w600,
                    color: MdColors.navy900,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}