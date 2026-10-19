# Email setup (Brevo)

MiDukandar sends login and recovery one-time codes through the [Brevo](https://www.brevo.com)
transactional API. For those emails to reach the inbox instead of the spam
folder (or being dropped outright) the sender domain must be authenticated, and
the app must send from an address on that domain.

The application code is already in place. Everything below is a **manual**
one-time setup in Brevo, your DNS provider and the deployment environment.

## Why this matters

Gmail (and Yahoo, Outlook) enforce DMARC. Mail that claims to come from a free
mailbox (`@gmail.com`, `@yahoo.com`, `@outlook.com`, `@hotmail.com`) but is
relayed by Brevo cannot pass SPF or DKIM alignment, so the provider rejects it
or files it as spam. To prevent that, the backend **refuses to boot** in
production when `MAIL_FROM_EMAIL` is on one of those domains.

## 1. Authenticate a sender domain

1. Buy or use a domain you own (for example `midukandar.com`).
2. In Brevo go to **Senders, Domains & Dedicated IPs → Domains → Add domain**.
3. Add the DNS records Brevo shows for that domain:
   - the **Brevo code** TXT record,
   - the **DKIM** record,
   - a **DMARC** record — start permissive:
     `v=DMARC1; p=none; rua=mailto:you@yourdomain.com`,
   - an **SPF** record including `spf.brevo.com` (only one SPF TXT record per
     domain; merge with any existing one).
4. Click **Authenticate** in Brevo until every check is green.

## 2. Add and verify the sender address

1. Brevo → **Senders** → add `no-reply@yourdomain.com` and verify it.
2. You can now use that address as `MAIL_FROM_EMAIL`.

## 3. Configure the environment

Set these on the host (Render → service → Environment), then redeploy:

| Variable | Value |
| --- | --- |
| `MAIL_MODE` | `brevo` |
| `BREVO_API_KEY` | Brevo → SMTP & API → API Keys |
| `MAIL_FROM_EMAIL` | `no-reply@yourdomain.com` (must be on the authenticated domain) |
| `MAIL_FROM_NAME` | `MiDukandar` (optional display name) |
| `MAIL_REPLY_TO` | optional mailbox for replies; leave empty for none |
| `BREVO_WEBHOOK_SECRET` | a long random string, shared with the Brevo webhook below |

The older `BREVO_SENDER_EMAIL` / `BREVO_SENDER_NAME` names are still read as a
fallback when `MAIL_FROM_*` are unset, but they are deprecated — use the
`MAIL_FROM_*` variables.

Authorise the deployment's egress IP in Brevo (**Security → Authorised IPs**);
a request from an unlisted IP is answered with a `401` and the send fails. The
backend logs `brevo: failed to send email` with the HTTP status and Brevo's
error code in that case.

## 4. Register the delivery webhook

So an operator can see **why** an email did not arrive:

1. Brevo → **Webhooks** → add `https://<your-host>/api/webhooks/brevo`.
2. Set the shared secret from `BREVO_WEBHOOK_SECRET`. Supply it either as a
   custom request header `x-brevo-webhook-secret` or as a `?token=` query
   parameter on the URL.
3. Select the events: **blocked, hard bounce, soft bounce, spam, unsubscribed**.
4. Failing events are logged at `warn` as `brevo: delivery failed` with the
   event, a masked recipient, the reason and the `messageId`. The endpoint
   writes nothing to the database and is safe to receive the same event twice.
   A missing or wrong secret is answered with `401`.

## 5. Verify delivery

Send a code to a Gmail address and an Outlook address. In the received message,
inspect the headers and confirm:

- `SPF=pass`,
- `DKIM=pass`,
- `DMARC=pass`.

If a message still does not arrive, check Brevo → **Transactional → Logs** for
the `messageId` (the backend logs it on the `brevo: accepted` line): the event
there says whether it was delivered, blocked or bounced, and the delivery
webhook records the same for the running service.
