import type { Metadata } from "next";
import { CalendarDays, Mail, MessageCircle, Phone, ShieldCheck } from "lucide-react";
import PublicFooter from "@/components/public/PublicFooter";
import PublicHeader from "@/components/public/PublicHeader";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "What data MiDukandar collects, why it is collected, how it is protected, and how shop owners can access or delete it.",
};

const LAST_UPDATED = "29 October 2026";

const SECTIONS: { title: string; paragraphs: string[]; bullets?: string[] }[] = [
  {
    title: "Who we are",
    paragraphs: [
      "MiDukandar is a business management service for shops and small businesses in India. In this policy, \"MiDukandar\", \"we\", \"us\" and \"our\" refer to the operator of the MiDukandar website, mobile applications and related services.",
      "Your shop's data belongs to you. We process it to run the Service for you, and we do not sell it or use it for third-party advertising. This policy explains what we collect and the choices you have.",
    ],
  },
  {
    title: "Information we collect",
    paragraphs: [
      "We collect the information you give us when you create an account and use the Service, together with limited technical information needed to keep the Service secure and working.",
    ],
    bullets: [
      "Account details: owner name, business name, email address, mobile number, business address, GST number (if you add one) and preferred language or currency.",
      "Business records you enter: products, stock levels, sales, invoices, customers, udhaari (credit) ledgers, suppliers, purchase orders, expenses and staff roles.",
      "Staff accounts: the name, email, mobile number and role that an owner or manager creates for their team.",
      "Authentication data: one-time login codes, session tokens and, where enabled, a hashed record of the device you signed in from.",
      "Messages sent through the Service: when you send a udhaari reminder by SMS, we store the recipient's number, the message body, the delivery status and the time it was sent.",
      "Technical data: IP address, browser or app version, and error logs used for security, debugging and abuse prevention.",
    ],
  },
  {
    title: "Why we use it",
    paragraphs: [
      "We use your information to provide and operate the Service, to authenticate you and protect your account, to send transactional messages you have asked for (such as login codes and udhaari reminders), to provide support, and to diagnose faults.",
      "We also use aggregated, de-identified information to understand how features are used so we can improve them. We do not use your shop's business records to train third-party models, and we do not sell personal data.",
    ],
  },
  {
    title: "Who we share it with",
    paragraphs: [
      "We share data only with service providers who help us run the Service, and only as much as they need. Each provider is bound by its own contract and privacy terms.",
    ],
    bullets: [
      "Hosting and database providers that store the Service and your records.",
      "Email delivery providers used to send login codes and account notices.",
      "Payment processors used to collect subscription fees. Card and UPI details are entered with the processor; MiDukandar does not store them.",
      "SMS and messaging providers, where you enable messages that are sent through a gateway rather than your own phone's SIM.",
      "Authorities, where we are legally required to disclose information, or where disclosure is necessary to investigate fraud or protect the Service.",
    ],
  },
  {
    title: "How long we keep it",
    paragraphs: [
      "We keep your account and business records while your account is active. After a verified deletion request we remove or de-identify the data, except where we must keep it for a legal, tax, fraud-prevention or dispute-resolution obligation, in which case it is retained only for that purpose and then deleted.",
      "Login codes expire within minutes. Session records are removed when you sign out or when they are no longer valid.",
    ],
  },
  {
    title: "Your choices",
    paragraphs: [
      "You can review and correct most of your information directly in the app or on the web console. You can also ask us to export or delete the personal data associated with your account by writing to the support address below.",
      "Deleting your account removes access to the Service and is not reversible. Export anything you need first. Some records may be retained where the law requires it, as described above.",
      "You can turn udhaari SMS messages off at any time from Settings, and you can decline device permissions such as contacts or phone state without losing core billing features.",
    ],
  },
  {
    title: "How we protect it",
    paragraphs: [
      "Traffic between your device and the Service is encrypted in transit with HTTPS/TLS. Passwords and one-time codes are stored in hashed form, session tokens are kept in secure storage, and access to business data is scoped to your shop's account.",
      "No online service can promise perfect security. If we become aware of a breach that affects your personal data, we will notify affected account holders and any authority as required by applicable law.",
    ],
  },
  {
    title: "Children",
    paragraphs: [
      "The Service is meant for business use by adults. It is not directed at children, and we do not knowingly collect personal data from children. If you believe a child has provided us data, contact us and we will remove it.",
    ],
  },
  {
    title: "Changes to this policy",
    paragraphs: [
      "We may update this policy as the Service or the law changes. The revised version will be posted here with a new \"Last updated\" date, and material changes will be communicated through the Service or to the account contact.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#f7f9fc] text-navy-900">
      <PublicHeader variant="simple" />
      <div className="sticky top-[73px] z-20 border-b border-navy-100 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-center gap-2 px-5 py-2.5 text-center text-xs font-semibold text-navy-500 sm:px-8">
          <CalendarDays className="size-3.5 text-royal-600" aria-hidden />
          <span>Last updated: {LAST_UPDATED}</span>
        </div>
      </div>

      <main className="mx-auto max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
        <article className="rounded-3xl border border-navy-100 bg-white px-5 py-7 shadow-card sm:px-9 sm:py-10 lg:px-12">
          <header className="border-b border-navy-100 pb-8">
            <span className="inline-flex items-center gap-2 rounded-full bg-royal-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-royal-700">
              <ShieldCheck className="size-3.5" aria-hidden />
              Privacy
            </span>
            <h1 className="mt-5 font-display text-3xl font-bold tracking-tight text-navy-950 sm:text-4xl">
              Privacy Policy
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-navy-500">
              What we collect to run your shop&apos;s account, why we collect it, and how you can get it back or have it
              removed.
            </p>
          </header>

          <div className="divide-y divide-navy-100">
            {SECTIONS.map((section, index) => (
              <section key={section.title} className="py-8 first:pt-8">
                <div className="flex items-start gap-3">
                  <span className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-lg bg-navy-50 font-mono text-xs font-bold text-royal-700">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    <h2 className="font-display text-xl font-bold tracking-tight text-navy-950">{section.title}</h2>
                    <div className="mt-3 space-y-3 text-[15px] leading-8 text-navy-600">
                      {section.paragraphs.map((paragraph, i) => (
                        <p key={`${section.title}-${i}`}>{paragraph}</p>
                      ))}
                    </div>
                    {section.bullets && (
                      <ul className="mt-4 space-y-2.5 text-sm leading-6 text-navy-600">
                        {section.bullets.map((bullet) => (
                          <li key={bullet} className="flex items-start gap-2.5">
                            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-royal-400" aria-hidden />
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </section>
            ))}

            <section className="py-8">
              <h2 className="font-display text-xl font-bold tracking-tight text-navy-950">Contact us</h2>
              <p className="mt-3 text-[15px] leading-8 text-navy-600">
                Send privacy or data-deletion requests to the support address below. Tell us the account email and the
                shop name so we can verify the request, and allow us a reasonable period to respond.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <a
                  href="mailto:trinetraservices.ltd@gmail.com"
                  className="inline-flex items-center gap-2 rounded-xl bg-navy-950 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-navy-800"
                >
                  <Mail className="size-4" aria-hidden />
                  trinetraservices.ltd@gmail.com
                </a>
                <a
                  href="tel:+919970368016"
                  className="inline-flex items-center gap-2 rounded-xl border border-navy-200 bg-white px-4 py-2.5 text-sm font-bold text-navy-800 transition-colors hover:border-royal-300 hover:text-royal-700"
                >
                  <Phone className="size-4" aria-hidden />
                  +91 99703 68016
                </a>
                <a
                  href="https://wa.me/918000629385"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-navy-200 bg-white px-4 py-2.5 text-sm font-bold text-navy-800 transition-colors hover:border-emerald-300 hover:text-emerald-700"
                >
                  <MessageCircle className="size-4" aria-hidden />
                  WhatsApp
                </a>
              </div>
            </section>
          </div>
        </article>
      </main>
      <PublicFooter />
    </div>
  );
}
