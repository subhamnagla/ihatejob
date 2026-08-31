# Where reviews and suggestions arrive

Everything a visitor sends — a review, a journey, a bug — is emailed to you.
Nothing is stored on the site, and **nobody is ever sent to GitHub to say
something**. That was the whole problem with the old arrangement: asking a staff
nurse to register somewhere to say "this helped" loses almost all of them, and
keeps only the unrepresentative few who already had an account.

## Setting it up

Reviews, journeys and suggestions post to **`/api/submit`**, a serverless
function that emails them to you. The visitor fills in a form and presses send.

| Variable | Required | What it is |
| --- | --- | --- |
| `RESEND_API_KEY` | yes | An API key from [resend.com](https://resend.com) |
| `NOTIFY_EMAIL` | yes | Where submissions land |
| `NOTIFY_FROM` | no | Sender address. Defaults to `onboarding@resend.dev` |

Set them in the Vercel project settings and redeploy. Without them the endpoint
returns 503 and the form says so plainly rather than pretending to send.

`NOTIFY_EMAIL` is an environment variable rather than a field in `config.js` on
purpose. `config.js` is committed to a public repository, and a personal address
sitting in one is scraped within days.

Resend will only send from `onboarding@resend.dev` until you verify a domain,
which is fine here — the mail is going to you, so whitelist it if your provider
is fussy. Once you own a domain, verify it and set `NOTIFY_FROM`. The free tier
is 3,000 emails a month and 100 a day, far more than a feedback form will use.

Nothing is emailed to the *visitor*. The form never asks for their address, so
there is none to send to.

**The API is routed through `server.mjs`, not Vercel's `/api` auto-detection.**
Vercel builds this project with `server.mjs` as its single entrypoint, and in
that mode the `api/` directory is never turned into separate functions — the
deployment carried exactly two lambdas, the entrypoint and the middleware. Every
`/api/*` request was quietly answered with `index.html`. `server.mjs` imports the
handlers instead, so one code path serves both production and `npm run dev`.

If you ever add a handler under `api/`, register it in the `API` map at the top
of `server.mjs` or it will not be reachable.

Because it is the one unauthenticated write path on the site, it also carries a
honeypot field, a minimum time-on-page, per-address rate limiting, a link cap,
length bounds, and a kind allowlist. `npm test` covers all of them, including
that a mail provider error never reaches the visitor — those messages can name
the recipient and the key.

## What arrives

Plain text, with a `Kind:` line first so a mail filter can sort on it without
depending on how the subject is worded.

A review:

```
Subject: Review: Jupiter - Asha R

Kind: review

Rating: Jupiter (5 of 10, 2.5 stars)
Credit: Asha R - Staff nurse, Leeds
May be quoted on the site: yes

The licence check caught a gap I had not noticed in four years.

---
Sent through the form on the site. The visitor has no account.
```

A journey carries the same shape, with `Outcome:` in place of `Rating:` and
"May be published on the site". Subjects are prefixed by kind — `Review:`,
`Story:`, `New profession:`, `Bug:` — so subject-line rules work too.

Filter your inbox on the `Kind:` line: `review`, `story`, `profession`,
`region`, `template`, `checker`, `bug`, `enhancement`.

## Journeys publish from the email itself

A journey is different from a review: it is queued the moment it arrives.

1. The submission is written straight into `public/data/stories.json` with
   **`published: false`**. `stories.js` only renders entries with
   `published: true`, so no visitor can see it — but it is already in the
   admin's Journeys editor, where you can read, edit or delete it.
2. The email carries a **Publish it** link.
3. Clicking it flips the flag, commits, and the journey is live in about a
   minute.

The link points at `/api/approve`, which sits behind the same admin password as
everything else. That is the whole security model: no signing scheme to get
subtly wrong and no second secret to rotate. Anyone who could use that link
could already have published the journey by hand.

It is safe to click twice — a second click reports "already published" and
commits nothing. Refreshes, forwarded mail and mail clients that prefetch links
all end up doing this.

**Consent is enforced at both ends.** The form asks "May be published on the
site". If the answer was no, the email carries no publish link and
`/api/approve` refuses the journey outright with a 403. Publishing it anyway
means opening the admin and doing it deliberately, having presumably asked
them first.

`SITE_URL` sets the domain used in that link. It defaults to
`https://ihatejob.app`.

If GitHub is unreachable when a journey arrives, **the email still sends** with
the full text — it just carries no publish link. Losing someone's job history
because GitHub had a bad minute is not an acceptable failure.

## Publishing a review once you have one

Reviews do not appear on the site automatically. That is deliberate: you decide
what goes up, and you should have the person's permission — the form asks them
for it, and the answer is in the email.

The normal route is the admin: **Reviews → Add blank**, paste the quote, name and
planet out of the email, **Show**, **Save**. Journeys are the same with **Write
one**. See [admin.md](admin.md).

Saving commits `public/data/reviews.json` through `/api/content`, which needs
`GITHUB_TOKEN` (**Contents: read and write**) and `GITHUB_REPO`. That is the
repository acting as the site's datastore — it is not a submission channel, and
no visitor ever touches it.

Without the admin, edit `public/data/reviews.json` by hand, or seed `REVIEWS` in
`public/js/config.js`:

```js
export const REVIEWS = [
  {
    quote: 'Told me my bullets had no numbers in them. It was right.',
    name: 'Priya R.',
    role: 'Staff Nurse',
    place: 'Kochi',
    planet: 8,                 // 1 Mercury .. 10 the Sun; stars follow from it
  },
];
```

The section stays hidden until there are `MIN_REVIEWS` of them (3 by default),
then appears on its own, nav link and all.

## What GitHub is still used for

Two things, neither of which a visitor ever signs in to:

- **The datastore.** `/api/content` commits `reviews.json` and `stories.json`
  when the admin saves. Every change is versioned and revertable, and there is
  no extra service to pay for.
- **Journey threads.** The likes and replies under `/stories/<slug>` are read
  live from that journey's GitHub issue. So if you publish a journey and want it
  to carry replies, it needs an issue to point at, and **you must not delete or
  lock that issue afterwards** — the page loses its replies. Closing it is fine.

The admin's *incoming* queue also reads issues. Now that submissions arrive by
email, that queue will only ever show issues you filed yourself. It is not
broken, just quiet — the email is the inbox now.

## Checking it works before launch

1. Set `RESEND_API_KEY` and `NOTIFY_EMAIL` in Vercel, and redeploy.
2. Reload the front page and open the browser console — the messages about
   hidden visitor numbers and reviews tell you what is still unconfigured.
3. Go to **Rate us on the same scale we rate you**, pick a planet, write a line
   and submit. It should say "Sent" and stay on the page. Nothing should open a
   new tab.
4. The email should arrive within seconds. If it does not, check the function
   logs in Vercel — a provider error is logged there and deliberately never
   shown to the visitor.
5. If the form says nothing was sent, `/api/submit` returned 503: the two
   variables are missing, or the deployment predates them.
