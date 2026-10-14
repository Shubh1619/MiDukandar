import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CalendarDays, CheckCircle2, FileText, Mail, MessageCircle, Phone } from "lucide-react";
import PublicFooter from "@/components/public/PublicFooter";
import PublicHeader from "@/components/public/PublicHeader";
import TermsToc, { type TermsSectionLink } from "@/components/public/TermsToc";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: "Terms and conditions for using the MiDukandar business management platform.",
};

type TermsSection = TermsSectionLink & {
  paragraphs: string[];
  bullets?: string[];
};

const sections: TermsSection[] = [
  {
    id: "section-1",
    title: "Introduction & Acceptance",
    paragraphs: [
      "These Terms and Conditions (the \"Terms\") govern access to and use of the MiDukandar website, applications, accounts, and related services (collectively, the \"Service\") operated for businesses in India. By creating an account, starting a trial, purchasing a subscription, or otherwise using the Service, you agree to these Terms on behalf of yourself and the business you represent.",
      "If you do not agree with these Terms, do not create an account or use the Service. If you use the Service for an organisation, you confirm that you have authority to bind that organisation and that the organisation accepts these Terms.",
    ],
  },
  {
    id: "section-2",
    title: "Description of Service",
    paragraphs: [
      "MiDukandar provides software tools that help businesses manage day-to-day commercial operations. Depending on the plan and current availability, the Service may include billing and invoices, customer and udhaari ledgers, inventory and product management, business reports, GST-related reports or exports, staff access, multi-store management, and sharing of invoices through third-party channels.",
      "Features may change as the Service evolves. A feature shown on the pricing page or in the application is not a promise that it will be available in every plan, jurisdiction, device, or at all times. We may add, modify, suspend, or discontinue features as our business and technology needs change.",
    ],
  },
  {
    id: "section-3",
    title: "Account Registration & Eligibility",
    paragraphs: [
      "You must be legally capable of entering into a binding contract and must operate a legitimate business or be an authorised representative of a legitimate business. You may not register an account for an unlawful activity, for impersonation, or to evade a suspension, restriction, or fee.",
      "You must provide accurate, current, and complete registration information, including business identity, contact details, and tax information where requested. You are responsible for activity under your account and for keeping credentials secure. Tell us promptly if you suspect unauthorised access.",
    ],
  },
  {
    id: "section-4",
    title: "Subscription Plans & Billing",
    paragraphs: [
      "MiDukandar may offer Free, Pro, and Enterprise or multi-store plans, with the features, limits, and pricing shown on the pricing page or in an order form. The public pricing page is populated from the current plan catalog, subject to availability. The commercial terms displayed at checkout or in a written order control if they conflict with a draft page or with these Terms.",
      "Paid subscriptions renew automatically for the selected billing period unless cancelled before the next renewal. You can cancel future renewals at any time through the account or by contacting support. Cancellation stops future charges but does not automatically entitle you to a refund for the current period, except as required by law or as expressly approved by MiDukandar.",
      "Fees are exclusive of applicable taxes unless stated otherwise. We may update prices, usage limits, or plan packaging with notice. If a change materially affects a paid plan, the notice and any effective date will be communicated through the Service or to the account contact. Refund requests are assessed under the applicable order, plan terms, and law.",
    ],
    bullets: [
      "Use the payment method authorised by you and keep billing details accurate.",
      "Keep your subscription active by renewing or cancelling before the renewal date.",
      "Review the final pricing catalog before relying on a plan comparison or promotional price.",
    ],
  },
  {
    id: "section-5",
    title: "Free Trial Terms",
    paragraphs: [
      "New eligible businesses may receive a 14-day free trial. The trial does not require a payment card where the signup flow states that no card is required. Trial availability, eligible features, and the start date are determined by the signup flow and may be limited or withdrawn where required by law or to prevent abuse.",
      "At the end of the trial, the account may move to the available Free plan, become read-only or paused, or require the business to select a paid plan. We will use reasonable efforts to provide a reminder before the trial ends. Access after the trial, including the ability to export data, is subject to the plan and these Terms.",
    ],
  },
  {
    id: "section-6",
    title: "User Responsibilities",
    paragraphs: [
      "You are responsible for entering and maintaining accurate business information, customer information, product prices, tax details, inventory quantities, invoices, credit balances, and other records. You must review information before relying on it for accounting, tax, inventory, customer, or legal purposes.",
      "You are solely responsible for compliance with applicable laws, including tax, GST, accounting, consumer, privacy, labour, and product rules applicable to your business. MiDukandar provides software and reports; it does not act as your accountant, tax adviser, legal adviser, or guarantor of the accuracy of your business records. Obtain professional advice where required.",
      "You must use the Service only in accordance with law, keep backups of important records, and protect access credentials. You are responsible for resolving conflicts or corrections in the source data before submitting invoices, filings, or reports.",
    ],
  },
  {
    id: "section-7",
    title: "Data Ownership & Portability",
    paragraphs: [
      "As between you and MiDukandar, you retain ownership of the business data, information, and content you submit to the Service. You grant MiDukandar a limited licence to host, process, transmit, and display that data only as necessary to operate, secure, support, and improve the Service for you.",
      "You may request an export of available business data and may request deletion when your account is closed, subject to legal, tax, fraud-prevention, dispute, and security retention requirements. We may retain or delete data in accordance with our retention practices and applicable law. You should export important records before closure.",
    ],
  },
  {
    id: "section-8",
    title: "Prohibited Uses",
    paragraphs: [
      "You may not use the Service to bill or facilitate unlawful goods or services, evade tax or accounting obligations, commit fraud, impersonate another person or business, infringe intellectual property or privacy rights, distribute malware, interfere with the Service, probe or bypass security controls, or attempt unauthorised access to another account.",
      "You may not resell, sublicense, rent, lease, share, or provide access to the Service or an account except where expressly authorised in a written agreement. Automated scraping, excessive requests, spam, misleading advertising, and using the Service to harass or deceive others are also prohibited.",
    ],
  },
  {
    id: "section-9",
    title: "Third-Party Services",
    paragraphs: [
      "The Service may link to or integrate with third-party services, including Razorpay or another payment processor, WhatsApp sharing, and email or SMS delivery providers such as Brevo. These services are operated by third parties and are subject to their own terms, privacy notices, availability, and charges.",
      "We do not control third-party services and are not responsible for their independent acts, omissions, content, or availability. You are responsible for reviewing and accepting the applicable third-party terms, authorising integrations, and resolving disputes with those providers. Do not submit sensitive information to a third-party service unless you have a lawful basis and permission to do so.",
    ],
  },
  {
    id: "section-10",
    title: "Limitation of Liability",
    paragraphs: [
      "To the maximum extent permitted by law, MiDukandar and its providers are not liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for loss of profits, revenue, data, goodwill, or business interruption, arising out of or related to the Service, even if advised that such loss was possible.",
      "To the maximum extent permitted by law, each party's aggregate liability under these Terms is limited to the fees paid or payable by the business for the relevant Service during the twelve months before the event giving rise to the claim. Some jurisdictions do not allow certain exclusions, so parts of this section may not apply to every user.",
      "Nothing in these Terms excludes liability that cannot lawfully be excluded, including liability for fraud, intentional misconduct, or death or personal injury caused by negligence where applicable.",
    ],
  },
  {
    id: "section-11",
    title: "Availability & Offline Mode",
    paragraphs: [
      "We work to make the Service reliable, but we do not guarantee 100% uptime, uninterrupted access, or that every feature will be error-free or continuously available. Maintenance, network failures, power or connectivity issues, third-party outages, and events beyond our reasonable control may cause delays or interruptions.",
      "Where offline mode is available, records entered offline may be stored locally until a connection is restored. Synchronisation can be delayed, interrupted, or fail because of conflicts, device storage, browser settings, connectivity, or other technical factors. You should verify synced records and keep an independent backup of critical business data.",
    ],
  },
  {
    id: "section-12",
    title: "Termination",
    paragraphs: [
      "You may stop using the Service and request account closure at any time. We may suspend or terminate an account, limit access, or remove data immediately or after notice where we reasonably believe that these Terms have been breached, the account is fraudulent or unlawful, or continued operation creates a security, legal, or platform risk.",
      "Where appropriate, we will provide notice and an opportunity to resolve the issue. After termination, access may be disabled, outstanding fees remain payable, and data handling will follow the retention and portability provisions in these Terms. Sections that by their nature should survive termination, including payment, confidentiality, liability, and dispute provisions, will survive.",
    ],
  },
  {
    id: "section-13",
    title: "Changes to Terms",
    paragraphs: [
      "We may update these Terms to reflect changes in the Service, law, security, pricing, or our business. We will post the updated version with a revised \"Last updated\" date and, for material changes, provide reasonable notice through the Service, the account, or the contact details on file.",
      "A notice period of at least 30 days will ordinarily apply to material changes, except where a shorter period is needed for security, legal compliance, or urgent operational reasons. Changes apply from their stated effective date. If you do not accept a material change, you may cancel future renewals and close the account before the change takes effect.",
    ],
  },
  {
    id: "section-14",
    title: "Governing Law & Jurisdiction",
    paragraphs: [
      "These Terms are governed by the laws of India, without regard to conflict-of-law rules. Subject to any mandatory consumer or statutory rights, the courts at Mumbai, Maharashtra will have exclusive jurisdiction over disputes arising from or connected with these Terms or the Service.",
      "Before filing a formal proceeding, please contact support so that we have a reasonable opportunity to resolve the concern informally. Nothing in this section limits rights or remedies that cannot be waived under applicable law.",
    ],
  },
  {
    id: "section-15",
    title: "Contact Information",
    paragraphs: [
      "Questions about these Terms, the Service, billing, or a data request can be sent to support@midukandar.com. You can also call the MiDukandar support desk at 1800-MI-DUKAN (1800-639-3852) or message the WhatsApp support desk for general assistance.",
      "The legal operating entity name, registered address, and final support email must be inserted and verified before these Terms are published. Do not send passwords, full payment-card details, or other unnecessary sensitive information by email or chat.",
    ],
    bullets: [
      "Email: support@midukandar.com",
      "Phone: 1800-MI-DUKAN (1800-639-3852)",
      "WhatsApp: available through the MiDukandar support desk",
    ],
  },
];

function LegalSection({ section }: { section: TermsSection }) {
  return (
    <section id={section.id} className="scroll-mt-32 border-t border-navy-100 py-8 first:border-t-0 first:pt-0 sm:py-10">
      <div className="flex items-start gap-3">
        <span className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-lg bg-navy-50 font-mono text-xs font-bold text-royal-700">
          {section.id.replace("section-", "").padStart(2, "0")}
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-xl font-bold tracking-tight text-navy-950 sm:text-2xl">{section.title}</h2>
          <div className="mt-4 space-y-4 text-[15px] leading-8 text-navy-600">
            {section.paragraphs.map((paragraph, index) => (
              <p key={`${section.id}-paragraph-${index}`}>
                {section.id === "section-4" && index === 0 ? (
                  <>
                    {paragraph.split("pricing page")[0]}
                    <Link href="/pricing" className="font-semibold text-royal-700 underline decoration-royal-200 underline-offset-4 hover:text-royal-800">
                      pricing page
                    </Link>
                    {paragraph.split("pricing page")[1]}
                  </>
                ) : (
                  paragraph
                )}
              </p>
            ))}
          </div>
          {section.bullets && (
            <ul className="mt-5 space-y-2.5 text-sm leading-6 text-navy-600">
              {section.bullets.map((bullet) => (
                <li key={bullet} className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-1 size-4 shrink-0 text-emerald-600" aria-hidden />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          )}
          {section.id === "section-15" && (
            <div className="mt-5 flex flex-wrap gap-3">
              <a href="mailto:support@midukandar.com" className="inline-flex items-center gap-2 rounded-xl bg-navy-950 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-navy-800">
                <Mail className="size-4" aria-hidden />
                Email support
              </a>
              <a href="tel:18006393852" className="inline-flex items-center gap-2 rounded-xl border border-navy-200 bg-white px-4 py-2.5 text-sm font-bold text-navy-800 transition-colors hover:border-royal-300 hover:text-royal-700">
                <Phone className="size-4" aria-hidden />
                Call support
              </a>
              <a href="https://wa.me/918000629385" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-navy-200 bg-white px-4 py-2.5 text-sm font-bold text-navy-800 transition-colors hover:border-emerald-300 hover:text-emerald-700">
                <MessageCircle className="size-4" aria-hidden />
                WhatsApp
              </a>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#f7f9fc] text-navy-900">
      <PublicHeader variant="simple" />
      <div className="sticky top-[73px] z-20 border-b border-navy-100 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-center gap-2 px-5 py-2.5 text-center text-xs font-semibold text-navy-500 sm:px-8">
          <CalendarDays className="size-3.5 text-royal-600" aria-hidden />
          <span>Last updated: 24 September 2026</span>
          <span className="hidden text-navy-300 sm:inline">·</span>
          <span className="hidden sm:inline">Draft for legal review</span>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14 lg:px-10 lg:py-16">
        <div className="grid items-start gap-10 lg:grid-cols-[220px_minmax(0,800px)] lg:justify-center lg:gap-14">
          <TermsToc sections={sections} />

          <article className="min-w-0 rounded-3xl border border-navy-100 bg-white px-5 py-7 shadow-card sm:px-9 sm:py-10 lg:px-12">
            <header className="border-b border-navy-100 pb-8">
              <span className="inline-flex items-center gap-2 rounded-full bg-royal-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-royal-700">
                <FileText className="size-3.5" aria-hidden />
                Legal
              </span>
              <h1 className="mt-5 font-display text-3xl font-bold tracking-tight text-navy-950 sm:text-4xl">Terms &amp; Conditions</h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-navy-500">Clear terms for using MiDukandar to run your shop and business.</p>
              <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-900">
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden />
                <p><span className="font-bold">Draft placeholder:</span> this document is for product and legal review. A qualified lawyer must review, finalise, and approve the wording, commercial policies, entity details, and contact information before the Service goes live.</p>
              </div>
            </header>

            <div className="pt-8">
              {sections.map((section) => <LegalSection key={section.id} section={section} />)}
            </div>
          </article>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
