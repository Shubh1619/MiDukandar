import {
  ArrowRight,
  BarChart3,
  Boxes,
  Calculator,
  FileText,
  ReceiptText,
  ShoppingCart,
  Users,
  Wallet,
  CalendarClock,
  ClipboardList,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import LandingHeader from "./LandingHeader";
import LandingFooter from "./LandingFooter";

const features = [
  {
    icon: ReceiptText,
    title: "Billing and Sales",
    points: [
      "Create sales invoices",
      "Manage payment methods",
      "Calculate line-item totals, discounts, and applicable taxes",
      "Track completed and cancelled sales",
      "Print or share invoices",
    ],
  },
  {
    icon: Boxes,
    title: "Inventory Management",
    points: [
      "Maintain product information",
      "Track stock quantities",
      "Manage product categories, SKUs, and barcodes",
      "Monitor low-stock products",
      "Record stock adjustments and movements",
    ],
  },
  {
    icon: ShoppingCart,
    title: "Purchase Management",
    points: [
      "Create purchase challans",
      "Record supplier invoices",
      "Track received quantities and purchase rates",
      "Manage purchase discounts and taxes",
      "Update stock when a purchase is confirmed",
      "Prevent duplicate stock updates when converting a challan to a purchase",
    ],
  },
  {
    icon: CalendarClock,
    title: "Batch and Expiry Management",
    points: [
      "Maintain batch numbers and expiry dates where applicable",
      "Track batch-wise stock",
      "Identify products nearing expiry",
      "Support medicine pack, strip, and tablet quantities for medical stores where applicable",
    ],
  },
  {
    icon: Wallet,
    title: "Customer Ledger and Udhaari",
    points: [
      "Maintain customer accounts",
      "Record credit sales and receipts",
      "Track outstanding balances",
      "Support partial payments",
      "View customer transaction history",
    ],
  },
  {
    icon: Users,
    title: "Supplier Management",
    points: [
      "Maintain supplier records",
      "Track purchases and supplier balances",
      "Record supplier payments",
      "Review supplier transaction history",
    ],
  },
  {
    icon: Calculator,
    title: "Expenses and Financial Reports",
    points: [
      "Record business expenses",
      "Review sales and purchase summaries",
      "Monitor outstanding balances",
      "Review profit and margin estimates where supported by actual cost data",
      "Export reports where implemented",
    ],
  },
  {
    icon: ShieldCheck,
    title: "Staff and Role Management",
    points: [
      "Support Owner, Manager, Cashier, and Stock Manager roles where configured",
      "Enforce server-side permissions",
      "Restrict access to sensitive operations",
    ],
  },
  {
    icon: BarChart3,
    title: "Business Dashboard",
    points: [
      "Summarize sales, inventory, credit, purchases, and expenses",
      "Provide date-based filters",
      "Display clear charts and actionable business indicators",
    ],
  },
];

const steps = [
  { num: "01", title: "Create your business account", desc: "Set up your business profile to get started." },
  { num: "02", title: "Add products and suppliers", desc: "Build your catalog and supplier list." },
  { num: "03", title: "Start billing and recording purchases", desc: "Create invoices and record purchases with challans." },
  { num: "04", title: "Monitor stock, credit, and business reports", desc: "Stay on top of your business with clear insights." },
];

const audiences = [
  "Kirana stores",
  "General stores",
  "Medical and pharmacy stores",
  "Grocery retailers",
  "Small wholesalers",
  "Other local retail businesses",
];

const benefits = [
  "Reduce manual recordkeeping",
  "Improve inventory visibility",
  "Track customer credit more reliably",
  "Keep purchase records organized",
  "Understand sales and business expenses",
  "Maintain clearer supplier records",
  "Improve staff accountability",
  "Access business information more easily",
];

const faqs = [
  {
    q: "What is MiDukandar?",
    a: "MiDukandar is a retail billing, inventory, purchases, customer credit (Udhaari), suppliers, and business reporting platform designed for Indian shops and small retailers.",
  },
  {
    q: "Which types of shops can use MiDukandar?",
    a: "MiDukandar is suitable for Kirana stores, general stores, medical and pharmacy stores, grocery retailers, small wholesalers, and other local retail businesses.",
  },
  {
    q: "Can I manage products and inventory?",
    a: "Yes. You can maintain products with categories, SKUs, and barcodes, track stock quantities, monitor low-stock items, and record stock adjustments and movements.",
  },
  {
    q: "Can I track customer udhaari?",
    a: "Yes. MiDukandar maintains customer ledgers to record credit sales and receipts, track outstanding balances, support partial payments, and view transaction history.",
  },
  {
    q: "What is a purchase challan?",
    a: "A purchase challan lets you record incoming goods from a supplier before reconciling the supplier's purchase invoice. You can add products, quantities, batch/expiry where applicable, rates, discounts, and GST, then convert the challan to a confirmed purchase invoice when ready.",
  },
  {
    q: "Can I manage batches and expiry dates?",
    a: "Yes, where applicable. Batch numbers, expiry dates, batch-wise stock, and products nearing expiry are supported, with additional support for medicine pack/strip/tablet quantities in relevant configurations.",
  },
  {
    q: "Can different employees have different permissions?",
    a: "Yes. MiDukandar supports Owner, Manager, Cashier, and Stock Manager roles where configured, with server-side permission enforcement to restrict access to sensitive operations.",
  },
  {
    q: "How do I get started?",
    a: "Click 'Get Started' on the homepage to go to the login page and begin setting up your business account.",
  },
  {
    q: "How can I contact support?",
    a: "You can reach support via email at trinetraservices.ltd@gmail.com or by phone at +91 99703 68016 as listed in the footer.",
  },
];

export default function MiDukandarLanding() {
  return (
    <div className="min-h-screen bg-white text-navy-950">
      <LandingHeader />
      <main>
        <section id="home" className="relative overflow-hidden">
          <div className="absolute inset-0 -z-10">
            <div className="absolute -top-40 left-1/4 h-96 w-96 rounded-full bg-royal-100/40 blur-3xl" />
            <div className="absolute -bottom-40 right-0 h-[28rem] w-[28rem] rounded-full bg-navy-100/40 blur-3xl" />
          </div>
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-2 lg:gap-16 lg:px-10 lg:py-24">
            <div>
              <p className="mb-4 inline-flex items-center rounded-full border border-navy-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-navy-600">
                MiDukandar - Smart Business
              </p>
              <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                Manage Your Entire Shop. One Simple Platform.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-navy-600">
                MiDukandar helps retailers manage billing, inventory, purchases, customer credit, suppliers, and business reports
                from one easy-to-use platform.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/login"
                  className="group inline-flex items-center gap-2 rounded-xl bg-navy-950 px-5 py-3 text-sm font-bold text-white shadow-[0_10px_30px_-12px_rgb(9_26_51/0.9)] transition-all hover:bg-navy-800"
                >
                  Get Started
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
                <a
                  href="#features"
                  className="inline-flex items-center gap-2 rounded-xl border border-navy-200 px-5 py-3 text-sm font-semibold text-navy-700 transition-colors hover:bg-navy-50"
                >
                  Explore Features
                </a>
              </div>
            </div>
            <div className="relative">
              <div className="rounded-3xl border border-navy-100 bg-white shadow-[0_30px_80px_-40px_rgb(15_39_71/0.4)]">
                <div className="flex items-center justify-between border-b border-navy-100 px-6 py-4">
                  <div>
                    <p className="text-sm font-bold text-navy-950">Business Dashboard</p>
                    <p className="text-xs text-navy-400">Illustrative preview</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-navy-400">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Live overview
                  </div>
                </div>
                <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
                  {[
                    { label: "Today's sales", value: "₹ 12,450" },
                    { label: "Total products", value: "248" },
                    { label: "Low-stock items", value: "7" },
                    { label: "Outstanding customer credit", value: "₹ 18,920" },
                  ].map((card) => (
                    <div key={card.label} className="rounded-2xl border border-navy-100 p-4">
                      <p className="text-xs text-navy-400">{card.label}</p>
                      <p className="mt-2 text-lg font-bold text-navy-950">{card.value}</p>
                    </div>
                  ))}
                </div>
                <div className="grid gap-4 px-6 pb-6 lg:grid-cols-[1.2fr_1fr]">
                  <div className="rounded-2xl border border-navy-100 p-4">
                    <p className="text-sm font-semibold text-navy-950">Sales overview chart</p>
                    <div className="mt-4 flex h-40 items-end gap-2">
                      {[40, 65, 52, 78, 60, 84, 72].map((h, i) => (
                        <div key={i} className="flex-1 rounded-t-lg bg-royal-500/80" style={{ height: `${h}%` }} />
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-navy-400">Illustrative data only</p>
                  </div>
                  <div className="rounded-2xl border border-navy-100 p-4">
                    <p className="text-sm font-semibold text-navy-950">Recent transactions</p>
                    <div className="mt-3 space-y-2 text-sm">
                      {[
                        { id: "INV-1024", amount: "₹ 1,245" },
                        { id: "INV-1023", amount: "₹ 842" },
                        { id: "INV-1022", amount: "₹ 2,160" },
                      ].map((tx) => (
                        <div key={tx.id} className="flex items-center justify-between rounded-xl bg-navy-50 px-3 py-2">
                          <span className="text-navy-600">{tx.id}</span>
                          <span className="font-semibold text-navy-950">{tx.amount}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="overview" className="border-t border-navy-100 bg-[#f7f9fc]">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-10 lg:py-20">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Everything Your Business Needs in One Place</h2>
              <p className="mt-4 text-lg text-navy-600">
                Manage billing, inventory, purchases, credit, suppliers, expenses, and reports from a single platform.
              </p>
            </div>
            <div id="features" className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div key={feature.title} className="rounded-2xl border border-navy-100 bg-white p-6 shadow-[0_20px_60px_-40px_rgb(15_39_71/0.5)]">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-royal-50 text-royal-600">
                      <Icon className="size-5" aria-hidden />
                    </div>
                    <h3 className="mt-4 text-lg font-bold text-navy-950">{feature.title}</h3>
                    <ul className="mt-3 space-y-2 text-sm text-navy-600">
                      {feature.points.map((point) => (
                        <li key={point} className="flex items-start gap-2">
                          <CheckCircle2 className="mt-0.5 size-4 text-emerald-500" aria-hidden />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="border-t border-navy-100">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-10 lg:py-20">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Simplify Every Purchase</h2>
              <p className="mt-4 text-lg text-navy-600">
                Record incoming goods from suppliers with a purchase challan workflow before reconciling the supplier's purchase invoice.
              </p>
            </div>
            <div className="mt-10 grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:items-start">
              <div className="rounded-2xl border border-navy-100 bg-white p-6 shadow-[0_20px_60px_-40px_rgb(15_39_71/0.5)]">
                <p className="text-sm font-semibold text-navy-950">Purchase Challan Workflow</p>
                <ol className="mt-4 space-y-3 text-sm text-navy-600">
                  {[
                    "Select supplier",
                    "Enter challan number and date",
                    "Add products and quantities",
                    "Record batch, expiry, and free quantities where applicable",
                    "Enter purchase rates, discounts, and applicable GST",
                    "Review totals",
                    "Save the challan",
                    "Convert to a confirmed purchase invoice when appropriate",
                    "Update stock and supplier balances exactly once according to the defined business workflow",
                  ].map((step, idx) => (
                    <li key={step} className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-navy-50 text-xs font-bold text-navy-700">
                        {idx + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="rounded-2xl border border-navy-100 bg-white shadow-[0_20px_60px_-40px_rgb(15_39_71/0.5)]">
                <div className="flex items-center justify-between border-b border-navy-100 px-6 py-4">
                  <p className="text-sm font-semibold text-navy-950">Purchase Challan (Demonstration)</p>
                  <span className="text-xs text-navy-400">Fictional example data</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-navy-100 bg-navy-50/60">
                        <th className="px-6 py-2.5 font-semibold text-navy-600">Product</th>
                        <th className="px-4 py-2.5 font-semibold text-navy-600">Pack</th>
                        <th className="px-4 py-2.5 font-semibold text-navy-600">Batch</th>
                        <th className="px-4 py-2.5 font-semibold text-navy-600">Expiry</th>
                        <th className="px-4 py-2.5 font-semibold text-navy-600">Quantity</th>
                        <th className="px-4 py-2.5 font-semibold text-navy-600">Free Qty</th>
                        <th className="px-4 py-2.5 font-semibold text-navy-600">Purchase Rate</th>
                        <th className="px-4 py-2.5 font-semibold text-navy-600">Discount</th>
                        <th className="px-4 py-2.5 font-semibold text-navy-600">GST</th>
                        <th className="px-6 py-2.5 text-right font-semibold text-navy-600">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { product: "Paracetamol 500mg", pack: "Strip", batch: "PC-2401", expiry: "12/2026", qty: "10", free: "0", rate: "₹ 28.00", disc: "₹ 0.00", gst: "12%", amount: "₹ 313.60" },
                        { product: "Cough Syrup 100ml", pack: "Bottle", batch: "CS-2310", expiry: "10/2026", qty: "5", free: "1", rate: "₹ 85.00", disc: "₹ 0.00", gst: "12%", amount: "₹ 476.00" },
                        { product: "Soap Bar", pack: "Piece", batch: "SB-2503", expiry: "-", qty: "24", free: "0", rate: "₹ 32.00", disc: "₹ 24.00", gst: "18%", amount: "₹ 903.36" },
                      ].map((row) => (
                        <tr key={row.product} className="border-b border-navy-100 last:border-0">
                          <td className="px-6 py-2.5 text-navy-700">{row.product}</td>
                          <td className="px-4 py-2.5 text-navy-600">{row.pack}</td>
                          <td className="px-4 py-2.5 text-navy-600">{row.batch}</td>
                          <td className="px-4 py-2.5 text-navy-600">{row.expiry}</td>
                          <td className="px-4 py-2.5 text-navy-600">{row.qty}</td>
                          <td className="px-4 py-2.5 text-navy-600">{row.free}</td>
                          <td className="px-4 py-2.5 text-navy-600">{row.rate}</td>
                          <td className="px-4 py-2.5 text-navy-600">{row.disc}</td>
                          <td className="px-4 py-2.5 text-navy-600">{row.gst}</td>
                          <td className="px-6 py-2.5 text-right font-semibold text-navy-950">{row.amount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-6 py-3 text-xs text-navy-400">Illustrative data only</div>
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="border-t border-navy-100 bg-[#f7f9fc]">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-10 lg:py-20">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">How It Works</h2>
              <p className="mt-4 text-lg text-navy-600">Get started in four simple steps.</p>
            </div>
            <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {steps.map((step) => (
                <div key={step.num} className="rounded-2xl border border-navy-100 bg-white p-6">
                  <span className="text-sm font-bold text-royal-600">{step.num}</span>
                  <h3 className="mt-3 text-lg font-bold text-navy-950">{step.title}</h3>
                  <p className="mt-2 text-sm text-navy-600">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-navy-100">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-10 lg:py-20">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Who Is MiDukandar For?</h2>
              <p className="mt-4 text-lg text-navy-600">
                Built for shops and businesses of all sizes. Medicine-specific batch, expiry, and pack handling applies only to relevant configurations.
              </p>
            </div>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              {audiences.map((aud) => (
                <span key={aud} className="rounded-full border border-navy-200 px-4 py-2 text-sm font-semibold text-navy-700">
                  {aud}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section id="benefits" className="border-t border-navy-100 bg-[#f7f9fc]">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-10 lg:py-20">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Benefits</h2>
              <p className="mt-4 text-lg text-navy-600">Practical advantages for your daily operations.</p>
            </div>
            <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {benefits.map((benefit) => (
                <div key={benefit} className="flex items-start gap-2 rounded-2xl border border-navy-100 bg-white p-4">
                  <CheckCircle2 className="mt-0.5 size-4 text-emerald-500" aria-hidden />
                  <span className="text-sm text-navy-700">{benefit}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-navy-100">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-10 lg:py-20">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Security and Data Management</h2>
              <p className="mt-4 text-lg text-navy-600">
                Access is controlled by your business context with role-based permissions and server-side enforcement.
              </p>
            </div>
            <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[
                { title: "Business-specific data access", desc: "Data is scoped to the business context." },
                { title: "Role-based permissions", desc: "Owner, Manager, Cashier, and Stock Manager roles where configured." },
                { title: "Secure authentication", desc: "Authentication is required for protected routes and operations." },
                { title: "Controlled access to business records", desc: "Sensitive operations are restricted by permissions." },
                { title: "Transaction history and auditability", desc: "Business actions are tracked through transaction history." },
                { title: "Server-side protection", desc: "Route protection and permission checks are enforced server-side." },
              ].map((item) => (
                <div key={item.title} className="rounded-2xl border border-navy-100 p-6">
                  <ShieldCheck className="size-5 text-royal-600" aria-hidden />
                  <h3 className="mt-3 text-lg font-bold text-navy-950">{item.title}</h3>
                  <p className="mt-2 text-sm text-navy-600">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="border-t border-navy-100 bg-[#f7f9fc]">
          <div className="mx-auto max-w-4xl px-5 py-16 sm:px-8 lg:px-10 lg:py-20">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Frequently Asked Questions</h2>
              <p className="mt-4 text-lg text-navy-600">Answers based on actual platform capabilities.</p>
            </div>
            <div className="mt-10 space-y-4">
              {faqs.map((faq) => (
                <details key={faq.q} className="group rounded-2xl border border-navy-100 bg-white p-6">
                  <summary className="cursor-pointer list-none text-base font-semibold text-navy-950">
                    <div className="flex items-center justify-between gap-4">
                      <span>{faq.q}</span>
                      <ArrowRight className="size-4 transition-transform group-open:rotate-90" aria-hidden />
                    </div>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-navy-600">{faq.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-navy-100">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-10 lg:py-20">
            <div className="relative overflow-hidden rounded-3xl border border-navy-100 bg-gradient-to-br from-navy-950 via-navy-900 to-royal-900 px-6 py-12 text-center text-white sm:px-10 lg:px-16">
              <div className="absolute -top-20 right-0 h-64 w-64 rounded-full bg-royal-500/20 blur-3xl" />
              <div className="absolute -bottom-24 left-1/3 h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl" />
              <div className="relative mx-auto max-w-3xl">
                <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
                  Spend Less Time Managing Records. Focus More on Your Business.
                </h2>
                <p className="mt-4 text-lg text-white/80">
                  Bring your shop's daily operations together with MiDukandar.
                </p>
                <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                  <Link
                    href="/login"
                    className="group inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-navy-950 shadow-[0_10px_30px_-12px_rgb(255_255_255/0.6)] transition-all hover:bg-white/90"
                  >
                    Get Started
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </Link>
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-2 rounded-xl border border-white/40 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                  >
                    Login to Your Account
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}
