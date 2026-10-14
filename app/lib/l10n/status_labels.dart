import 'package:flutter/material.dart';

import 'generated/app_localizations.dart';

/// Translates backend status strings that arrive in English ("PAID", "Due",
/// "LOW STOCK", ...) into the active locale. Falls back to the raw value for
/// unknown/compound statuses.
String localizedStatus(BuildContext context, String raw) {
  final l = AppLocalizations.of(context)!;
  switch (raw.trim().toLowerCase().replaceAll('_', ' ').replaceAll('-', ' ')) {
    case 'paid':
      return l.statusPaid;
    case 'unpaid':
    case 'due':
      return l.statusUnpaid;
    case 'partial':
    case 'partially paid':
      return l.statusPartial;
    case 'pending':
      return l.statusPending;
    case 'overdue':
      return l.statusOverdue;
    case 'low':
    case 'low stock':
      return l.statusLow;
    case 'active':
      return l.statusActive;
    case 'inactive':
    case 'disabled':
      return l.statusInactive;
    case 'received':
      return l.statusReceived;
    case 'sent':
      return l.statusSent;
    case 'draft':
      return l.statusDraft;
    case 'void':
      return l.statusVoid;
    case 'settled':
      return l.statusSettled;
    case 'outstanding':
      return l.statusOutstanding;
    case 'open':
      return l.statusOpen;
    case 'closed':
      return l.statusClosed;
    case 'cancelled':
    case 'canceled':
      return l.statusCancelled;
    case 'delivered':
      return l.statusDelivered;
    case 'in stock':
    case 'available':
      return l.statusInStock;
    case 'out of stock':
    case 'out-of-stock':
      return l.statusOutOfStock;
    case 'completed':
    case 'complete':
    case 'success':
      return l.statusCompleted;
    default:
      return raw;
  }
}