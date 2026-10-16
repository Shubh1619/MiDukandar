import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const rows = fs
  .readFileSync(path.join(root, "audit/module-endpoints.csv"), "utf8")
  .trim()
  .split(/\r?\n/)
  .slice(1)
  .map((line) => {
    const m = line.match(/^(.*?),(.*?),"(.*?)",(.*?),(.*?),"(.*?)",(.*?),(.*?),(.*?)$/);
    return {
      module: m[1],
      method: m[2],
      path: m[3],
      file: m[4],
      export: m[5],
      auth: m[6],
      validation: m[7],
      web: m[8],
      mob: m[9],
    };
  });

const notes = {
  DASHBOARD: "Single summary endpoint, consumed by both web dashboard and mobile home. Fully integrated.",
  PRODUCTS:
    "Core catalog fully wired on web (CRUD, import, export, template, images) and mobile (CRUD, stock). Unused: `POST /:id/restore` (web uses `PATCH /:id/archive` toggle instead) and legacy `GET /api/products/template` (web uses `template.csv`/`template.xlsx`).",
  INVENTORY:
    "Stock list and movements used by both clients. `GET /api/inventory/stock/low` is backed only by the dead mobile method `getLowStockCount` -> effectively unused.",
  SALES_INVOICES:
    "Sale create/list/detail/invoice/pdf used. Held-sale (park/resume cart) endpoints exist on backend but have NO UI on web or mobile -> feature not exposed. `GET /api/sales/:id` only used by web.",
  BILLING:
    "Razorpay order/verify/webhook wired on both platforms. Fully integrated.",
  CUSTOMERS_UDHAARI:
    "Customer + udhaari ledger fully integrated on both. `GET /api/customers/:id` web-only (mobile uses list).",
  SUPPLIERS:
    "Suppliers, payments, reorder-message wired. `GET /api/suppliers/:id/payments` unused (no payment-history UI on either platform).",
  PURCHASES:
    "Purchase orders + purchase entry are web-only (POS/admin flow). Mobile has NO purchase-order UI, so 7 PO endpoints are web-only by design.",
  EXPENSES:
    "Expense CRUD/categories/summary wired on web; mobile has expense list + categories. DUPLICATION: recurring-expense handlers are implemented twice (inside `expenseRoutes` and again in `recurringExpenseRoutes`); the `expenseRoutes` copies reachable only via `/api/expense-categories/recurring*` and `/api/expenses/recurring*` are dead. Category edit/delete and expense-by-id are not exposed in any UI.",
  GST_REPORTS:
    "P&L, GST and stock reports used by web (6/6). Mobile reaches only sales/purchases reports (2/6); `getPnlReport`/`getGstReport` exist in `api_service.dart` but are never called, and mobile has NO reports screen.",
  USERS_ROLES:
    "Users list/edit/role wired on web; mobile can change a user role. `POST /api/users/invite/accept` is dead (see P0 in README). `/api/store/staff*` duplicates `/api/users*` and is unused. Role-matrix endpoints used by web settings.",
  UNGATED:
    "Auth, store setup/onboarding, plans, superadmin, webhooks, uploads and health. See sub-sections below.",
};

const moduleFiles = {
  DASHBOARD: "dashboard.md",
  PRODUCTS: "products.md",
  INVENTORY: "inventory.md",
  SALES_INVOICES: "sales-invoices.md",
  BILLING: "billing.md",
  CUSTOMERS_UDHAARI: "customers-udhaari.md",
  SUPPLIERS: "suppliers.md",
  PURCHASES: "purchases.md",
  EXPENSES: "expenses.md",
  GST_REPORTS: "reports.md",
  USERS_ROLES: "users-roles.md",
  UNGATED: "auth-store-platform.md",
};

const byModule = new Map();
for (const r of rows) {
  if (!byModule.has(r.module)) byModule.set(r.module, []);
  byModule.get(r.module).push(r);
}

const dir = path.join(root, "audit/modules");
fs.mkdirSync(dir, { recursive: true });

let index = ["# Module audits", "", "| module | handlers | web | mobile | neither | file |", "|---|---|---|---|---|---|"];
for (const [mod, list] of [...byModule.entries()].sort()) {
  const web = list.filter((r) => r.web === "yes").length;
  const mob = list.filter((r) => r.mob === "yes").length;
  const none = list.filter((r) => r.web === "no" && r.mob === "no").length;
  const f = moduleFiles[mod] ?? mod.toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".md";
  index.push(`| ${mod} | ${list.length} | ${web} | ${mob} | ${none} | [${f}](./${f}) |`);

  const out = [`# ${mod}`, "", notes[mod] ?? "", "", `Handlers: **${list.length}** | web: ${web} | mobile: ${mob} | neither: ${none}`, "", "| method | path | auth | web | mobile | file |", "|---|---|---|---|---|---|"];
  for (const r of list.sort((a, b) => a.path.localeCompare(b.path))) {
    out.push(`| ${r.method} | \`${r.path}\` | ${r.auth} | ${r.web} | ${r.mob} | ${r.file} |`);
  }
  out.push("");
  fs.writeFileSync(path.join(dir, f), out.join("\n"));
}
index.push("");
fs.writeFileSync(path.join(dir, "README.md"), index.join("\n"));
console.log("wrote audit/modules/*.md (" + byModule.size + " modules)");
