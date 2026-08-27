# Where reviews and suggestions arrive

Everything a visitor sends — a review, a missing profession, a bug — goes to one
of two places, decided by `public/js/config.js`. Nothing about them is stored on the site
itself, because the site has no backend.

## No account required

Reviews, journeys and suggestions post to **`/api/submit`**, a serverless
function that files them as issues using the site's own `GITHUB_TOKEN`. The
visitor fills a form and presses send — they never see GitHub and never make an
account.

That matters more than it sounds. Asking a staff nurse to register with GitHub
to say "this helped" loses almost all of them, and keeps only the
unrepresentative few who already had an account.

It needs the same two variables the admin uses: `GITHUB_TOKEN` (with **Issues:
read and write**, not just Contents) and `GITHUB_REPO`. Without them the
endpoint returns 503 and the forms fall back to the routes below.

Because it is the one unauthenticated write path on the site, it also carries a
honeypot field, a minimum time-on-page, per-address rate limiting, a link cap,
length bounds, and a label allowlist. `npm test` covers all of them.

## Set a channel first

Until one of these is set, **nothing reaches you**. The form says so honestly
rather than pretending to send, but no one can contact you.

```js
export const SITE = {
  repo: 'https://github.com/YOUR-NAME/ihatejob',   // preferred
  contactEmail: 'you@yourdomain.com',              // fallback, or use both
};
```

`repo` wins when both are set.

## Option A: GitHub issues (recommended)

Submissions become issues on your repository, pre-filled and labelled.

**Where to look:** `https://github.com/YOUR-NAME/ihatejob/issues` — or the
admin, which is the same list with the moderation controls attached.

Issues filed through the form are opened by your own token, so their GitHub
author is you. The person's name comes from the `Credit:` line in the body, and
the admin reads that rather than the account.

Filter by what you care about:

| Link | Shows |
| --- | --- |
| `/issues?q=is:open+label:review` | Reviews from users |
| `/issues?q=is:open+label:story` | Job journeys people wrote up |
| `/issues?q=is:open+label:profession` | Missing or wrong professions |
| `/issues?q=is:open+label:region` | Regional rules to fix |
| `/issues?q=is:open+label:template` | New format requests |
| `/issues?q=is:open+label:checker` | Checks that should exist |
| `/issues?q=is:open+label:bug` | Things that are broken |
| `/issues?q=is:open+label:enhancement` | Everything else |

### Create the labels first

**GitHub silently ignores a label that does not exist**, so without this step
every submission arrives unlabelled and the filters above return nothing. Run
once, after creating the repository:

```bash
gh label create review      --color 0E8A16 --description "Feedback from someone who used it"
gh label create story       --color 8250DF --description "A job journey written up by a visitor"
gh label create profession  --color 1D76DB --description "A profession pack to add or fix"
gh label create region      --color 5319E7 --description "Regional CV conventions"
gh label create template    --color FBCA04 --description "A new CV format"
gh label create checker     --color D93F0B --description "A rule the checker should have"
gh label create enhancement --color A2EEEF --description "Everything else"
```

`bug` and `good first issue` already exist on every new GitHub repository.

### Getting told about them

Issues do not email you by default on your own repository. Turn it on:

- **Watch → All Activity** on the repo page, or
- `gh api -X PUT repos/YOUR-NAME/ihatejob/subscription -f subscribed=true`

Check your notification settings at <https://github.com/settings/notifications>
so "Participating and @mentions" also includes watched repositories.

### Why issues rather than a private inbox

A review filed as an issue is public, timestamped and attributable. When you
later quote it on the front page you can link to it, and a review a visitor can
click through to is worth ten they cannot. It also means suggestions do not
quietly die in a mailbox only you can read.

## Option B: email

If `repo` is unset and `contactEmail` is set, the form opens the visitor's own
mail client with the subject and body filled in. They arrive as ordinary email.

Two things to know:

- It depends on the visitor having a mail client configured. On a shared or
  locked-down machine, nothing happens. GitHub issues do not have this problem.
- You get no labels or filtering. Subjects are prefixed — `Review:`,
  `New profession:`, `Bug:` — so a mail rule on the subject line works well.

## Publishing a review once you have one

Reviews do not appear on the site automatically. That is deliberate: you decide
what goes up, and you should have the person's permission — the form asks them
for it, and the admin warns you if they said no.

The normal route is the admin: **Reviews people sent → Add as review**, tidy the
quote, **Show**, **Save**. See [admin.md](admin.md).

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
    source: 'https://github.com/YOUR-NAME/ihatejob/issues/42',
  },
];
```

The section stays hidden until there are `MIN_REVIEWS` of them (3 by default),
then appears on its own, nav link and all.

## What a review looks like when it arrives

The review form is its own section, separate from the issue form, and the rating
is a planet rather than a number. It writes a fixed header so the admin can read
the answers back out:

```
Rating: Jupiter (5 of 10, 2.5 stars)
Credit: Asha R - Staff nurse, Leeds
May be quoted on the site: yes

The licence check caught a gap I had not noticed in four years.
```

An issue written by hand misses those lines and is marked *written by hand* in
the admin rather than being guessed at.

## Journeys are different: the issue stays alive

A review is lifted out of its issue and the issue is done. A **journey** keeps
its issue for good, because that thread is what the published page uses for its
likes and replies — the reaction count and the comments under `/stories/<slug>`
are read live from it.

So do not delete or lock a journey's issue after publishing it. If you do, the
page loses its replies. Closing it is fine; comments still work on a closed
issue.

Journeys carry the same shape of header:

```
Outcome: Offer at an NHS trust
Credit: Asha R - Staff nurse, Leeds
May be published on the site: yes

...the journey itself
```

## Checking it works before launch

1. Set `SITE.repo` to your real repository.
2. Reload the front page and open the browser console — the messages about
   hidden visitor numbers and reviews tell you what is still unconfigured.
3. Go to **Rate us on the same scale we rate you**, pick a planet, write a line
   and submit. It should say "Sent" **without opening GitHub**, and the issue
   should appear in your repository with the `review` label.
4. If it opens GitHub instead, `/api/submit` returned 503 — the token or repo
   variable is missing, or the deployment predates them.
5. If the issue appears with no label, you skipped the label step above.
