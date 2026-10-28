import type { PlanDefinition } from "./plan-catalog";

export type Role = "OWNER" | "CASHIER" | "MANAGER" | "STAFF" | "STOCK_MANAGER";

export type PermissionFlag =
  | "can_manage_invoices"
  | "can_manage_products"
  | "can_manage_customers"
  | "can_manage_udhaari"
  | "can_manage_suppliers"
  | "can_manage_expenses"
  | "can_view_reports"
  | "can_manage_settings"
  | "can_manage_users";

export type PermissionMap = Record<PermissionFlag, boolean>;

/** Per-shop restriction overrides applied by the platform superadmin. */
export interface StoreAccess {
  disabledPages: string[];
  disabledFeatures: PermissionFlag[];
  /** Pages the superadmin granted beyond the tenant's plan (full access). */
  grantedPages?: string[];
}
export type PaymentMode = "CASH" | "UPI" | "CARD" | "CREDIT";
export type SaleStatus = "HELD" | "CONFIRMED" | "CANCELED" | "REVERSED";
export type SalePaymentStatus = "PAID" | "UNPAID" | "OVERDUE";

export interface InvoiceSummary {
  totalInvoices: number;
  totalRevenue: number;
  pendingAmount: number;
  overdueCount: number;
}

export interface Store {
  id: string;
  name: string;
  type: string;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  phone: string | null;
  gst: string | null;
  currency: string;
  language: string;
  logoUrl: string | null;
  invoicePrefix: string;
  planId?: string | null;
  plan?: string | null;
  planStatus?: string | null;
  trialEndsAt?: string | null;
  planDetails?: PlanDefinition | null;
}

export interface Product {
  id: string;
  name: string;
  barcode: string | null;
  sku: string | null;
  category: string | null;
  unit: string;
  purchasePrice: number | string;
  sellingPrice: number | string;
  mrp: number | string | null;
  gstPercent: number | string;
  minStock: number | string;
  supplier: string | null;
  imageUrl: string | null;
  description?: string | null;
  expiryDate?: string | null;
  isArchived: boolean;
  stock: number;
  isLow: boolean;
  createdAt: string;
  updatedAt?: string;
  archivedAt?: string | null;
  archivedByName?: string | null;
}

export interface ProductSummary {
  total: number;
  active: number;
  low: number;
  out: number;
  archived: number;
  value: number;
}

export interface ExpiringProduct {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  category: string | null;
  unit: string;
  sellingPrice: number | string;
  expiryDate: string;
  daysLeft: number;
}

export interface Customer {
  id: string;
  name: string;
  mobile: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  gst?: string | null;
  creditLimit: number | string;
  openingBalance: number | string;
  outstanding: number;
  createdAt: string;
}

export interface Sale {
  id: string;
  invoiceNumber: string;
  customerId: string | null;
  customerName: string | null;
  customerMobile: string | null;
  subtotal: number | string;
  discount: number | string;
  taxTotal: number | string;
  total: number | string;
  paidAmount: number | string;
  dueAmount: number | string;
  paymentMode: PaymentMode;
  dueDate: string | null;
  status: SaleStatus;
  notes: string | null;
  createdAt: string;
}

export interface SaleItem {
  id: string;
  productId: string | null;
  productName: string;
  barcode: string | null;
  qty: number;
  unitPrice: number | string;
  discount: number | string;
  gstPercent: number | string;
  taxAmount: number | string;
  lineTotal: number | string;
}

export interface Purchase {
  id: string;
  purchaseNumber: string;
  supplierName: string;
  supplierMobile: string | null;
  subtotal: number | string;
  discount: number | string;
  taxTotal: number | string;
  total: number | string;
  paidAmount: number | string;
  dueAmount: number | string;
  paymentStatus: "PAID" | "PARTIAL" | "UNPAID";
  notes: string | null;
  createdAt: string;
}

export interface PurchaseDetail extends Purchase {
  items: SaleItem[];
}

export interface Payment {
  id: string;
  customerId: string | null;
  customerName: string | null;
  amount: number | string;
  type: string;
  mode: PaymentMode;
  referenceType: string | null;
  referenceId: string | null;
  note: string | null;
  createdAt: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  qty: number;
  type: "OPENING" | "SALE" | "PURCHASE" | "ADJUSTMENT" | "REVERSAL";
  referenceType: string | null;
  referenceId: string | null;
  balanceAfter: number | null;
  note: string | null;
  createdAt: string;
  productName?: string;
  productSku?: string | null;
  productUnit?: string;
}

export interface StockRow {
  id: string;
  name: string;
  sku?: string;
  barcode?: string;
  category?: string | null;
  unit: string;
  balance: number;
  minStock: number;
  isLow: boolean;
  sellingPrice: number;
  purchasePrice: number;
  imageUrl?: string;
}

export interface LedgerEntry {
  id: string;
  type: "DEBIT" | "CREDIT";
  amount: number | string;
  balanceAfter: number | string | null;
  referenceType: string | null;
  referenceId: string | null;
  note: string | null;
  createdAt: string;
}

export interface RecentTransaction {
  id: string;
  type: "SALE" | "PURCHASE" | "PAYMENT";
  number: string;
  party: string;
  amount: number;
  mode: string | null;
  createdAt: string;
}

export interface DashboardStats {
  todaySales: number;
  todayPurchases: number;
  todayProfit: number;
  receivables: number;
  payables: number;
  lowStockCount: number;
  recentTransactions: RecentTransaction[];
}

export interface StoreStaff {
  id: string;
  name: string;
  email: string;
  role: Role;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  status: "active" | "inactive";
  isActive: boolean;
  lastLogin: string | null;
  last_login_at?: string | null;
  createdAt: string;
}

export interface UserInvite {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  status: "pending" | "accepted" | "expired" | "cancelled";
  expiresAt: string;
  createdAt: string;
  invitedByName: string | null;
}

export interface RolePermissions {
  role: Role;
  permissions: PermissionMap;
  locked: boolean;
  updatedAt: string;
}

export interface InvoiceData {
  invoiceNumber: string;
  date: string;
  store: { name: string; type?: string; address?: string; phone?: string; gst?: string } | null;
  customer: { name: string; mobile?: string; address?: string } | null;
  items: {
    name: string;
    qty: number;
    price: number;
    gst: number;
    tax: number;
    amount: number;
  }[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paid: number;
  due: number;
  paymentMode: PaymentMode;
  notes: string | null;
  status: SaleStatus;
  dueDate?: string;
}

export interface SaleDetailItem {
  id: string;
  productId: string | null;
  productName: string;
  barcode: string | null;
  qty: number | string;
  unitPrice: number | string;
  discount: number | string;
  gstPercent: number | string;
  taxAmount: number | string;
  lineTotal: number | string;
}

/** Full sale detail returned by GET /api/sales/:id — used to prefill the edit dialog. */
export interface SaleDetail extends Sale {
  items: SaleDetailItem[];
  customer: Customer | null;
  discountType: "FLAT" | "PERCENT";
}

export interface ReportsRow {
  date: string;
  invoiceCount?: number;
  purchaseCount?: number;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  invoices?: SalesInvoiceRow[];
}

export interface ReportsTotals {
  invoices?: number;
  purchases?: number;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
}

export type UdhaariStatus = "PENDING" | "PARTIAL" | "PAID";

export interface UdhaariCustomerRow {
  customerId: string;
  customerName: string;
  customerMobile: string | null;
  entryCount: number;
  totalAmount: number;
  paidAmount: number;
  outstanding: number;
  status: UdhaariStatus;
  lastEntryDate: string | null;
}

export interface UdhaariEntry {
  id: string;
  amount: number;
  entryDate: string;
  dueDate: string | null;
  reminderDate: string | null;
  saleId: string | null;
  invoiceNumber: string | null;
  note: string | null;
  createdAt: string;
  paid: number;
  remaining: number;
  status: UdhaariStatus;
  payments: UdhaariPayment[];
}

/** One row of the Udhaari reminders feed (invoice-linked / dated entries). */
export interface UdhaariReminder {
  entryId: string;
  customerId: string;
  customerName: string;
  customerMobile: string | null;
  amount: number;
  paid: number;
  remaining: number;
  dueDate: string | null;
  reminderDate: string | null;
  invoiceNumber: string | null;
  saleId: string | null;
  createdAt: string;
  status: UdhaariStatus;
  overdue: boolean;
  overdueDays: number | null;
}

export interface UdhaariRemindersResponse {
  reminders: UdhaariReminder[];
  counts: { overdue: number; today: number; upcoming: number };
}

export interface UdhaariPayment {
  id: string;
  amount: number;
  mode: PaymentMode;
  note: string | null;
  createdAt: string;
}

export interface UdhaariCustomerDetail {
  customer: {
    id: string;
    name: string;
    mobile: string | null;
    address: string | null;
    gst?: string | null;
  };
  totalAmount: number;
  paidAmount: number;
  outstanding: number;
  entries: UdhaariEntry[];
}

export type SupplierPaymentMode = "CASH" | "UPI" | "CARD" | "CHEQUE" | "NEFT";
export type PurchaseOrderStatus = "draft" | "sent" | "received" | "cancelled";

export interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  address: string | null;
  category: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt?: string;
  totalPurchases?: number | string;
  outstandingPayable?: number | string;
  lastOrderDate?: string | null;
  activePoCount?: number;
}

export interface SupplierSummary {
  total: number;
  totalPayable: number;
  outstandingCount: number;
  settledCount: number;
  overdueCount: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  status: PurchaseOrderStatus;
  orderDate: string;
  expectedDate: string | null;
  partyNumber?: string | null;
  partyDate?: string | null;
  challanType?: "CASH" | "CREDIT" | null;
  totalAmount: number | string;
  itemCount?: number;
  isOverdue?: boolean;
  createdAt: string;
}

export interface PurchaseOrderItem {
  id: string;
  poId?: string;
  productId: string;
  name?: string;
  quantity: number | string;
  rate: number | string;
  mrp?: number | string | null;
  taxRate: number | string;
  lineTotal: number | string;
  pack?: string | null;
  batch?: string | null;
  expiryDate?: string | null;
  tabQty?: number | string | null;
  freeQty?: number | string | null;
  discountPercent?: number | string | null;
}

export interface PurchaseOrderDetail extends PurchaseOrder {
  items: PurchaseOrderItem[];
}

export interface SupplierPayment {
  id: string;
  supplierId: string;
  poId: string | null;
  poNumber?: string | null;
  amount: number | string;
  paymentDate: string;
  paymentMode: SupplierPaymentMode;
  note: string | null;
  createdAt: string;
}

export interface SupplierDetail {
  supplier: Supplier;
  purchaseOrders: PurchaseOrder[];
  payments: SupplierPayment[];
}

export type ExpensePaymentMode = "CASH" | "UPI" | "CARD" | "BANK";

export interface ExpenseCategory {
  id: string;
  storeId?: string;
  name: string;
  isDefault: boolean;
  createdAt: string;
}

export interface Expense {
  id: string;
  storeId?: string;
  categoryId: string | null;
  categoryName: string | null;
  title: string;
  amount: number;
  expenseDate: string;
  paymentMode: ExpensePaymentMode;
  note: string | null;
  attachmentUrl: string | null;
  createdById?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface ExpenseCategoryBreakdown {
  categoryId: string | null;
  categoryName: string;
  total: number;
  percentage: number;
}

export interface ExpenseSummary {
  todayTotal: number;
  thisMonthTotal: number;
  lastMonthTotal: number;
  pctChangeVsLastMonth: number;
  topCategory: { name: string; total: number } | null;
  categoryBreakdown: ExpenseCategoryBreakdown[];
}

export interface RecurringExpense {
  id: string;
  storeId?: string;
  categoryId: string | null;
  categoryName: string | null;
  title: string;
  amount: number;
  frequency: "MONTHLY" | "WEEKLY";
  nextDueDate: string;
  paymentMode: ExpensePaymentMode;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

// ─── Reports ─────────────────────────────────────────────────────────────────

export interface SalesInvoiceRow {
  id: string;
  invoiceNumber: string;
  customerName: string;
  paymentMode: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paidAmount: number;
  dueAmount: number;
}

export interface GstRateBreakup {
  rate: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  invoiceCount: number;
}

export interface Gstr1InvoiceRow {
  invoiceNumber: string;
  date: string;
  customerName: string;
  gstin: string | null;
  taxableValue: number;
  gstRate: number;
  cgst: number;
  sgst: number;
  igst: number;
  taxAmount: number;
  total: number;
}

export interface GstReportResponse {
  totalTaxableValue: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalTax: number;
  rateBreakup: GstRateBreakup[];
  invoices: Gstr1InvoiceRow[];
  from: string;
  to: string;
}

export interface PnlTrendRow {
  period: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
}

export interface PnlReportResponse {
  revenue: number;
  cogs: number;
  grossProfit: number;
  grossMarginPct: number;
  expenses: number;
  netProfit: number;
  netMarginPct: number;
  trend: PnlTrendRow[];
  from: string;
  to: string;
}

export interface StockMovementReportRow {
  productId: string;
  productName: string;
  sku?: string;
  category?: string;
  unit: string;
  purchasePrice: number;
  openingQty: number;
  stockIn: number;
  stockOut: number;
  closingQty: number;
  valuation: number;
}

export interface StockMovementReportResponse {
  rows: StockMovementReportRow[];
  totalValuation: number;
  from: string;
  to: string;
}
