# The admin panel

Moderate reviews and job journeys, read feedback, and check the site's own
setup. Protected by a username and password you choose, at an address you
choose.

## Why the password is not in the code

A static site cannot check a password in the browser. Any check written in
JavaScript ships to every visitor in a file they can open, and anyone can call
the function that follows it. There is no way around that.

So the check runs in [`middleware.js`](../middleware.js), on Vercel's edge,
**before any file is served**. The username, password and secret address live in
environment variables and never reach the browser.

**With no password set, the admin refuses to load at all** — it returns 503
rather than standing open. An admin panel that is accidentally public is worse
than one that is broken.

## Setting it up

Vercel dashboard → your project → **Settings → Environment Variables**. Add
these to **Production** (and Preview if you want it there too):

| Variable | Required | What it does |
| --- | --- | --- |
| `ADMIN_USER` | yes | Username at the login prompt |
| `ADMIN_PASSWORD` | yes | Password. Use a long random one — this is the only thing standing in front of the panel |
| `ADMIN_PATH` | no | Secret address, e.g. `/control-room-7f3a`. When set, `/admin` returns 404 as if nothing is there |
| `GITHUB_TOKEN` | to save | Fine-grained token, **Contents: read and write** on this repo only |
| `GITHUB_REPO` | to save | `subhamnagla/ihatejob` |
| `GITHUB_BRANCH` | no | Defaults to `main` |

Redeploy after adding them — environment variables are read at request time,
but a deployment made before they existed will not have them attached.

### Making the GitHub token

<https://github.com/settings/personal-access-tokens/new>

- **Repository access:** only `subhamnagla/ihatejob`
- **Permissions → Repository → Contents:** Read and write
- Nothing else. That is the whole permission set it needs.

Without a token the admin still loads and shows everything; it just cannot save.
It says so rather than failing silently when you press Save.

## How saving works

There is no database. The repository is the store: pressing **Save** commits
`public/data/reviews.json` or `public/data/stories.json` back to GitHub, and
Vercel redeploys. About a minute from Save to live.

Slower than a database, and worth it — every change is a commit, so you can see
who changed what and revert anything. There is also no extra service to pay for
or keep alive.

If two browser tabs edit at once, the second Save is rejected rather than
silently overwriting the first. Reload and reapply.

## Two inboxes, not one

> **Submissions now arrive by email, not here.** Both blocks below read GitHub
> issues, and `/api/submit` no longer files any — it emails you instead, so that
> nobody has to sign up anywhere to leave a review. The queues still work, but
> they will only ever show issues you filed yourself. To publish something that
> came in by email, use **Add blank** under Reviews or **Write one** under
> Journeys and paste it in. See [receiving-feedback.md](receiving-feedback.md).

**Reviews people sent** and **Issues & ideas** are separate blocks, because they
are separate jobs: one is a moderation queue, the other is a to-do list. A
review never appears in the issues list, and the label filters there no longer
offer `review`.

Each waiting review shows the **planet** the person picked and whether they
agreed to be quoted, read straight out of the issue body. An issue written by
hand rather than through the form is marked *written by hand* and simply misses
those.

## Reviews

Nothing appears on the site until you allow it.

- **Add as review** pulls a waiting review into the list — **hidden**, so you
  decide what goes public. It carries the planet, the credit and the quote
  across. Tidy them; the raw text is rarely the sentence you want.
- **Hide / Show** controls whether it reaches the page at all.
- **Pin** puts one at the front.
- **▲ ▼** reorder the rest.
- **Planet** is the rating. The stars on the card are derived from it — half a
  star per rung — so there is only ever one number to set.
- A row that is shown but has no quote is marked **empty**, because it will not
  render and does not count towards the threshold.

The section stays off the front page entirely until **three** are visible — set
by `MIN_REVIEWS` in `public/js/config.js`.

**Ask before you publish someone.** The review form asks whether they are happy
to be quoted and how they want to be credited. If they said no, *Add as review*
warns you before it does anything. Their GitHub username is not consent.

## Job journeys

Journeys live at `/stories` and `/stories/<slug>`. Drafts stay off both until
**Published** is ticked.

**Journeys people sent** is the queue. *Add as journey* pulls one in as a draft,
carrying the headline, the outcome badge, the credit and the text. As with
reviews, it warns you first if the person did not agree to publishing.

**Issue number** is the field that matters most. It wires the published page to
its GitHub thread, and that thread is the entire backend for the social side:

- the like count is the real reactions on that issue
- the replies under the journey are its real comments, read-only
- **Add a reply** sends people to the thread, where their own account is who
  they are

*Add as journey* fills it in for you. Leave it blank on a journey you wrote
yourself and the page simply has no likes and no replies, which is honest — there
is nowhere for them to come from.

Counts vanish rather than showing zero when GitHub rate-limits the request. An
absent number is true; a zero would not be.

Body accepts a small amount of Markdown: `## headings`, `**bold**`, `*italic*`,
`` `code` ``, ```` ``` ```` fenced blocks, `> quotes`, `- lists`, `1. lists`,
`---`, and `[links](https://example.com)`.

Links are restricted to `http`, `https` and root-relative paths, and everything
is escaped before any markup is added. That matters twice over here: the replies
under a journey are written by strangers and go through the same renderer.

The slug is generated from the title only while it is still the generated one,
so renaming a published journey never silently breaks its URL.

## What it cannot show you

No CVs, no visitor identities, no per-user history — none of it is collected.
CVs live in each visitor's own browser and are never transmitted. The panel says
this on the page, so you are not left wondering where the data went.

Visitor counts come only from an analytics endpoint, if you configure one, and
count page views rather than content.

## Running it locally

`npm run dev` serves the admin at <http://localhost:5190/admin> with **no
password** — middleware is a Vercel feature and does not run locally. That is
fine on localhost, but do not expose the dev server to a network.

Saving is also unavailable locally, since there are no serverless functions. The
panel detects this and says so rather than showing a JSON parse error.
