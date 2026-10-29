import type { Metadata } from "next";
import { CalendarDays, Mail, MessageCircle, Phone, ReceiptText } from "lucide-react";
import PublicFooter from "@/components/public/PublicFooter";
import PublicHeader from "@/components/public/PublicHeader";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy",
  description:
    "How MiDukandar subscriptions renew, how to cancel, and when a subscription payment is refunded.",
};

const LAST_UPDATED = "29 October 2026";

const SECTIONS: { title: string; paragraphs: string[]; bullets?: string[] }[] = [
  {
    title: "Free trial first",
    paragraphs: [
      "New eligible businesses can use MiDukandar free for 14 days. The trial is there so you can test billing, inventory, udhaari and reports on your own shop data before paying. No card is required where the signup flow says so.",
      "If you do not want to continue, cancel before the trial ends and nothing is charged.",
    ],
  },
  {
    title: "Subscriptions renew automatically",
    paragraphs: [
      "A paid plan runs for the billing period you selected (monthly or annual) and renews automatically at the end of each period unless you cancel before the renewal date. The price and period that apply are the ones shown at checkout or in your order confirmation.",
      "Cancelling stops future renewals. It does not by itself refund the period you are already in, because the Service has already been made available for that period.",
    ],
  },
  {
    title: "When we do refund",
    paragraphs: [
      "If a charge is wrong, we will make it right. We refund a payment in full when any of the following applies:",
    ],
    bullets: [
      "You were charged twice for the same period, or charged again after a cancellation you completed before the renewal date.",
      "You were charged after telling us you did not want to renew, and you ask us within 7 days of the charge.",
      "A paid feature you were charged for was unavailable for a sustained period because of a fault on our side, and we cannot reasonably restore it.",
      "The payment was made fraudulently or without your authorisation.",
    ],
  },
  {
    title: "When we do not refund",
    paragraphs: [
      "We do not refund a period that has already run, change-of-mind requests made after the period has started, unused days after a mid-cycle cancellation, or charges for add-ons already consumed (such as paid SMS credits that have been sent).",
      "Refunds are not available where an account was suspended for breaching the Terms of Service, or where the request relates to data the business failed to export before closing the account.",
    ],
  },
  {
    title: "How to request a refund",
    paragraphs: [
      "Write to us from the account's registered email address, or contact support with the shop name, the payment reference and the reason. We may ask for a receipt or invoice to locate the payment.",
      "We aim to respond within 3 business days. Approved refunds are sent back to the original payment method. Banks and payment processors typically take 5–10 business days to credit the amount, and the exact timing depends on them rather than on us.",
    ],
  },
  {
    title: "Cancelling your account",
    paragraphs: [
      "You can cancel future renewals at any time from the account or by contacting support. Cancelling stops future charges; access continues until the end of the period you have already paid for.",
      "If you also want your account and data deleted, say so in the same request or use the process in our Privacy Policy. Export any invoices or records you need first — deletion cannot be undone.",
    ],
  },
  {
    title: "Price changes",
    paragraphs: [
      "We may change plan prices. A change never applies to a period you have already paid for, and we will give notice before it applies to your next renewal so you can cancel if you do not accept it.",
    ],
  },
];

export default function RefundPage() {
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
              <ReceiptText className="size-3.5" aria-hidden />
              Billing
            </span>
            <h1 className="mt-5 font-display text-3xl font-bold tracking-tight text-navy-950 sm:text-4xl">
              Refund &amp; Cancellation Policy
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-navy-500">
              Clear rules for trials, renewals, cancellations and refunds on MiDukandar subscriptions.
            </p>
          </header>

          <div className="divide-y divide-navy-100">
            {SECTIONS.map((section, index) => (
              <section key={section.title} className="py-8">
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
              <h2 className="font-display text-xl font-bold tracking-tight text-navy-950">Contact billing support</h2>
              <p className="mt-3 text-[15px] leading-8 text-navy-600">
                Include the shop name, the account email and the payment reference so we can find the charge quickly.
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
