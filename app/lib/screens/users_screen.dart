import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';

import '../l10n/generated/app_localizations.dart';
import '../models/app_models.dart';
import '../services/api_service.dart';
import '../theme/md_design.dart';
import '../widgets/app_dialogs.dart';
import '../widgets/md_inputs.dart';

class UsersScreen extends StatefulWidget {
  const UsersScreen({super.key, required this.apiService, this.user, this.onInvite, this.onStatusChange, this.onRoleChange});

  final ApiService apiService;
  final AuthUser? user;
  final Future<String?> Function({
    required String name,
    String? email,
    String? phone,
    required String role,
  })? onInvite;
  final Future<void> Function(String id, bool isActive)? onStatusChange;
  final Future<void> Function(String id, String role)? onRoleChange;

  @override
  State<UsersScreen> createState() => _UsersScreenState();
}

class _UsersScreenState extends State<UsersScreen> {
  List<AppUser> _users = const [];
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final users = await widget.apiService.getUsers();
      if (!mounted) return;
      setState(() {
        _users = users;
        _error = null;
      });
    } catch (e) {
      debugPrint('Failed to load users: $e');
      if (!mounted) return;
      setState(() => _error = e.toString());
    }
  }

  bool get _canInvite => widget.user?.role == 'OWNER' && widget.onInvite != null;
  bool get _canManage => widget.user?.role == 'OWNER' && (widget.onStatusChange != null || widget.onRoleChange != null);

  Future<void> _showInviteDialog(BuildContext context) async {
    final l = AppLocalizations.of(context)!;
    final nameController = TextEditingController();
    final emailController = TextEditingController();
    final phoneController = TextEditingController();
    final phoneKey = GlobalKey<MobileNumberFieldState>();
    String role = 'CASHIER';

    final result = await AppDialogs.showFormSheet<Map<String, dynamic>>(
      context,
      title: l.userInviteTitle,
      builder: (sheetContext) {
        return StatefulBuilder(
          builder: (ctx, setDialogState) {
            return Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: nameController,
                  decoration: InputDecoration(labelText: l.userFullName),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: emailController,
                  keyboardType: TextInputType.emailAddress,
                  decoration: InputDecoration(labelText: l.userEmailRequired),
                ),
                const SizedBox(height: 12),
                MobileNumberField(
                  key: phoneKey,
                  controller: phoneController,
                  allowEmpty: true,
                ),
                const SizedBox(height: 12),
                MdPickerField<String>(
                  label: l.userRole,
                  selected: role,
                  prefixIcon: Icons.badge_outlined,
                  pickerTitle: l.userRole,
                  options: ['MANAGER', 'CASHIER', 'STAFF']
                      .map((r) => MdPickerOption(value: r, label: _roleLabel(l, r)))
                      .toList(),
                  onChanged: (v) => setDialogState(() => role = v),
                ),
                const SizedBox(height: 8),
                Text(
                  l.userInviteHint,
                  style: const TextStyle(fontSize: 12, color: Colors.grey),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => Navigator.pop(sheetContext),
                        child: Text(l.cancel),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: FilledButton(
                        onPressed: () {
                          final name = nameController.text.trim();
                          final email = emailController.text.trim();
                          if (name.isEmpty ||
                              email.isEmpty ||
                              !email.contains('@') ||
                              widget.onInvite == null) {
                            return;
                          }
                          if (phoneKey.currentState?.validate() != null) return;
                          Navigator.pop(sheetContext, {
                            'name': name,
                            'email': email,
                            'phone': phoneController.text.trim(),
                            'role': role,
                          });
                        },
                        child: Text(l.userInvite),
                      ),
                    ),
                  ],
                ),
              ],
            );
          },
        );
      },
    );
    // Function-locals used only by the sheet above; dispose so repeated
    // invite dialogs don't leak controllers and their listeners.
    nameController.dispose();
    emailController.dispose();
    phoneController.dispose();

    if (result != null && widget.onInvite != null) {
      if (!context.mounted) return;
      AppDialogs.showLoading(context);
      String? link;
      try {
        link = await widget.onInvite!(
          name: result['name'] as String,
          email: result['email'] as String?,
          phone: result['phone'] as String?,
          role: result['role'] as String? ?? 'CASHIER',
        );
      } finally {
        if (context.mounted) {
          AppDialogs.hideLoading(context);
        }
      }
      if (link != null && link.isNotEmpty && context.mounted) {
        await _showInviteLinkDialog(context, link);
      }
    }
  }

  Future<void> _showInviteLinkDialog(BuildContext context, String link) async {
    final l = AppLocalizations.of(context)!;
    await showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(l.userInviteTitle),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(l.userInviteHint),
            const SizedBox(height: 12),
            SelectableText(link),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () async {
              await Clipboard.setData(ClipboardData(text: link));
              if (dialogContext.mounted) {
                Navigator.pop(dialogContext);
              }
            },
            child: Text(l.copyInviteLink),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: Text(l.done),
          ),
        ],
      ),
    );
  }

  Future<void> _showActions(BuildContext context, AppUser u) async {
    final l = AppLocalizations.of(context)!;
    final isCurrentUser = widget.user != null && (u.id == widget.user!.id || u.email.toLowerCase() == widget.user!.email.toLowerCase());
    final canEdit = _canManage && !isCurrentUser && u.role != 'OWNER';

    final action = await AppDialogs.showFormSheet<String>(
      context,
      title: u.name,
      builder: (sheetContext) {
        return Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (canEdit && widget.onRoleChange != null)
              ListTile(
                leading: const Icon(Icons.badge_outlined),
                title: Text(l.userChangeRole),
                onTap: () => Navigator.pop(sheetContext, 'role'),
              ),
            if (canEdit && widget.onStatusChange != null)
              ListTile(
                leading: Icon(u.isActive ? Icons.block : Icons.check_circle_outline,
                    color: u.isActive ? Colors.red.shade700 : Colors.green.shade700),
                title: Text(
                  u.isActive ? l.userDeactivate : l.userActivate,
                  style: TextStyle(color: u.isActive ? Colors.red.shade700 : Colors.green.shade700),
                ),
                onTap: () => Navigator.pop(sheetContext, 'status'),
              ),
            if (!canEdit && !isCurrentUser)
              Padding(
                padding: const EdgeInsets.all(16),
                child: Text(l.userCannotManage, style: TextStyle(color: Colors.grey.shade600)),
              ),
          ],
        );
      },
    );

    if (action == null || !context.mounted) return;
    if (action == 'role' && canEdit && widget.onRoleChange != null) {
      String role = u.role;
      final roleResult = await AppDialogs.showFormSheet<String>(
        context,
        title: l.userChangeRole,
        builder: (sheetContext) {
          return StatefulBuilder(
            builder: (ctx, setDialogState) {
              return Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  MdPickerField<String>(
                    label: l.userRole,
                    selected: role,
                    prefixIcon: Icons.badge_outlined,
                    pickerTitle: l.userRole,
                    options: ['MANAGER', 'CASHIER', 'STAFF']
                        .map((r) => MdPickerOption(value: r, label: _roleLabel(l, r)))
                        .toList(),
                    onChanged: (v) => setDialogState(() => role = v),
                  ),
                  const SizedBox(height: 20),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () => Navigator.pop(sheetContext),
                          child: Text(l.cancel),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: FilledButton(
                          onPressed: () => Navigator.pop(sheetContext, role),
                          child: Text(l.save),
                        ),
                      ),
                    ],
                  ),
                ],
              );
            },
          );
        },
      );
      if (roleResult != null) {
        if (!context.mounted) return;
        AppDialogs.showLoading(context);
        try {
          await widget.onRoleChange!(u.id, role);
        } finally {
          if (context.mounted) AppDialogs.hideLoading(context);
        }
      }
    } else if (action == 'status' && canEdit && widget.onStatusChange != null) {
      if (!context.mounted) return;
      AppDialogs.showLoading(context);
      try {
        await widget.onStatusChange!(u.id, !u.isActive);
      } finally {
        if (context.mounted) AppDialogs.hideLoading(context);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final formatDate = DateFormat('d MMM yy');

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(l.userTitle, style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold)),
          const SizedBox(height: 16),
          if (_canInvite) ...[
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                FilledButton.icon(
                  onPressed: () => _showInviteDialog(context),
                  icon: const Icon(Icons.person_add_alt_1_outlined),
                  label: Text(l.userInviteMember),
                ),
              ],
            ),
            const SizedBox(height: 12),
          ],
          if (widget.user != null)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.blue.shade50,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.blue.shade200),
              ),
              child: Row(
                children: [
                  CircleAvatar(
                    backgroundColor: Colors.blue.shade200,
                    child: Text(
                      widget.user!.name.isNotEmpty ? widget.user!.name[0].toUpperCase() : '?',
                      style: TextStyle(color: Colors.blue.shade900, fontWeight: FontWeight.bold),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(l.userYouLabel(widget.user!.name), style: const TextStyle(fontWeight: FontWeight.w700)),
                        Text(widget.user!.email, style: TextStyle(color: Colors.grey.shade700, fontSize: 13)),
                      ],
                    ),
                  ),
                  _RoleBadge(role: widget.user!.role),
                ],
              ),
            ),
          const SizedBox(height: 16),
          Row(
            children: [
              Text(l.userAllUsers(_users.length.toString()), style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
            ],
          ),
          const SizedBox(height: 12),
          Expanded(
            child: _error != null
                ? MdErrorState(
                    message: _error!,
                    retryLabel: l.retry,
                    onRetry: _load,
                  )
                : _users.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.people_outline, size: 64, color: Colors.grey),
                        const SizedBox(height: 12),
                        Text(l.userNoUsers, style: const TextStyle(color: Colors.grey)),
                      ],
                    ),
                  )
                : ListView.separated(
                    physics: const AlwaysScrollableScrollPhysics(),
                    itemCount: _users.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 10),
                    itemBuilder: (context, index) {
                      final u = _users[index];
final isCurrentUser = widget.user != null && (u.id == widget.user!.id || u.email.toLowerCase() == widget.user!.email.toLowerCase());
                      final canManageRow = _canManage && !isCurrentUser && u.role != 'OWNER';
                      return Card(
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          side: BorderSide(color: Colors.grey.shade200),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        color: isCurrentUser ? Colors.blue.shade50 : null,
                        child: InkWell(
                          borderRadius: BorderRadius.circular(16),
                          onTap: canManageRow ? () => _showActions(context, u) : null,
                          child: Padding(
                          padding: const EdgeInsets.all(14),
                          child: Row(
                            children: [
                              CircleAvatar(
                                backgroundColor: u.isActive ? Colors.green.shade100 : Colors.grey.shade200,
                                child: Text(
                                  u.name.isNotEmpty ? u.name[0].toUpperCase() : '?',
                                  style: TextStyle(
                                    color: u.isActive ? Colors.green.shade800 : Colors.grey.shade600,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Flexible(
                                          child: Text(
                                            u.name,
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: const TextStyle(fontWeight: FontWeight.w700),
                                          ),
                                        ),
                                        if (isCurrentUser) ...[
                                          const SizedBox(width: 6),
                                          Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                            decoration: BoxDecoration(
                                              color: Colors.blue.shade200,
                                              borderRadius: BorderRadius.circular(999),
                                            ),
                                            child: Text(
                                              l.userYou,
                                              style: TextStyle(color: Colors.blue.shade900, fontWeight: FontWeight.w600, fontSize: 10),
                                            ),
                                          ),
                                        ],
                                      ],
                                    ),
                                    const SizedBox(height: 2),
                                    Text(u.email, style: TextStyle(color: Colors.grey.shade700, fontSize: 13)),
                                    if (u.phone != null && u.phone!.isNotEmpty)
                                      Text(u.phone!, style: TextStyle(color: Colors.grey.shade600, fontSize: 12)),
                                    const SizedBox(height: 4),
                                    if (u.createdAt != null)
                                      Text(
                                        l.userJoinedAt(formatDate.format(DateTime.tryParse(u.createdAt!) ?? DateTime.now())),
                                        style: TextStyle(color: Colors.grey.shade500, fontSize: 11),
                                      ),
                                  ],
                                ),
                              ),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  _RoleBadge(role: u.role),
                                  const SizedBox(height: 6),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                    decoration: BoxDecoration(
                                      color: u.isActive ? Colors.green.shade100 : Colors.grey.shade200,
                                      borderRadius: BorderRadius.circular(999),
                                    ),
                                    child: Text(
                                      u.isActive ? l.statusActive : l.statusInactive,
                                      style: TextStyle(
                                        color: u.isActive ? Colors.green.shade800 : Colors.grey.shade700,
                                        fontWeight: FontWeight.w600,
                                        fontSize: 10,
                                      ),
                                    ),
                                  ),
],
                              ),
                            ],
                          ),
                        ),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}

class _RoleBadge extends StatelessWidget {
  const _RoleBadge({required this.role});
  final String role;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final normalized = role.toUpperCase();
    Color bg;
    Color fg;
    if (normalized == 'OWNER' || normalized == 'ADMIN') {
      bg = Colors.purple.shade100;
      fg = Colors.purple.shade800;
    } else if (normalized == 'MANAGER') {
      bg = Colors.blue.shade100;
      fg = Colors.blue.shade800;
    } else if (normalized == 'CASHIER') {
      bg = Colors.teal.shade100;
      fg = Colors.teal.shade800;
    } else {
      bg = Colors.grey.shade200;
      fg = Colors.grey.shade800;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        _roleLabel(l, normalized),
        style: TextStyle(color: fg, fontWeight: FontWeight.w700, fontSize: 11),
      ),
    );
  }
}

String _roleLabel(AppLocalizations l, String role) {
  switch (role.toUpperCase()) {
    case 'OWNER':
      return l.userRoleOwner;
    case 'ADMIN':
      return l.userRoleAdmin;
    case 'MANAGER':
      return l.userRoleManager;
    case 'CASHIER':
      return l.userRoleCashier;
    case 'STAFF':
      return l.userRoleStaff;
    default:
      return role;
  }
}
