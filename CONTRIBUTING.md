# Contributing

Thanks for wanting to help. This project exists because most free CV builders
give you three templates, no guidance, and no way to tell whether what you wrote
is any good. Contributions that widen the range of people it serves — a new
profession, a new region's rules, a new template — are the most valuable kind.

## Running it

```bash
git clone <your fork>
cd ihatejob
npm run dev
```

Open <http://localhost:5190>. That is the whole setup.

There is **no build step and no dependency install**. `server.mjs` is a small
static file server written against `node:http`. Edit a file, refresh the
browser, see the change. This is deliberate: a contributor should be able to fix
a typo in a profession pack without learning a bundler.

Please keep it that way. A pull request that introduces a build step, a
framework, or an npm dependency needs to argue its case in an issue first.

## Where things live

```
server.mjs              static file server, no dependencies
public/index.html       landing page
public/app.html         the builder
public/css/site.css     landing page styles
public/js/site.js       landing page logic
public/js/config.js     domain, repo, analytics endpoint, reviews
public/css/app.css      the editor UI
public/css/cv.css       the document: shared structure, .tpl-* skins, print rules
public/js/schema.js     data model + form schema + sample CV
public/js/professions.js  profession packs and region rules
public/js/templates.js  renders the CV (two DOM shapes) and the plain-text export
public/js/review.js     the standardisation checker
public/js/import.js     PDF/DOCX/text extraction and the CV text parser
public/js/form.js       builds the editor panel from the schema
public/js/main.js       state, events, live preview, storage, exports
```

## The three easiest ways in

### Add a profession

Open `public/js/professions.js` and add an entry to `PROFESSIONS`. Everything
else — the dropdown, the section order, the checker's expectations — follows
from that one object. See [docs/adding-a-profession.md](docs/adding-a-profession.md).

You do not need to be a developer to do this well. You need to know what a CV in
that field actually looks like. If you have hired for a role, you know something
the current packs do not.

### Add a template

Add one entry to `TEMPLATES` in `public/js/templates.js` and one `.tpl-<name>`
block in `public/css/cv.css`. See [docs/adding-a-template.md](docs/adding-a-template.md).

### Add a checker rule

`public/js/review.js` holds every rule. The bar for a new rule is simple:

> **A rule must be able to point at a specific string in the user's CV.**

"Make it more impactful" is what people already get everywhere and it helps
nobody. "The word *leveraged* appears in this bullet; use *used*" is worth
shipping. If your rule cannot name the offending text, it probably belongs in
the profession guidance instead.

Rules must also be quiet when there is nothing wrong. A checker that flags
something on every CV trains people to ignore it.

## Adding a region

`REGIONS` in `public/js/professions.js`. Please only add a region whose hiring
conventions you actually know — the photo and personal-details rules have real
consequences for applicants, and a confident wrong answer is worse than an
absent one. Cite a source in the pull request where you can.

## Things to be careful about

- **Never send user data anywhere.** The whole CV, including the photo, stays in
  `localStorage`. There is no analytics, no telemetry, no font CDN, no upload.
  A pull request that adds a network call to a third party will be declined.
- **Escape everything that reaches the page.** User input is rendered with
  string concatenation into `innerHTML`. Use the `esc()` helper in
  `templates.js` for every interpolated value.
- **Keep the print output correct.** Changes to `cv.css` should be checked by
  actually printing to PDF, not only by looking at the preview.
- **Watch for class-name collisions.** The landing page loads `app.css`,
  `cv.css` and `site.css` together, so a class defined in two of them silently
  merges. This has already bitten once: `.band` meant a rating bar in the app
  and a page section on the site, which turned every section into a
  three-column grid. To check before you commit:

  ```bash
  comm -12 <(grep -o '^\.[a-z0-9-]*' public/css/app.css | sort -u)            <(grep -o '^\.[a-z0-9-]*' public/css/site.css | sort -u)
  ```

  It should print nothing.
- **British or American spelling** — the codebase uses British spelling in user
  facing text (`licence`, `organised`). Match the file you are editing.

## Testing your change

There is no test runner yet (a good first contribution, if you want one). Before
opening a pull request, check by hand:

1. The example CV still renders in every template.
2. Your change survives a page refresh (it round-trips through `localStorage`).
3. Export to PDF, Word and plain text still work.
4. The Check tab reports something sensible for an empty CV and for the example.

## Pull requests

Small and focused beats large and sweeping. One profession pack, one template,
one rule. Describe what a user can now do that they could not before.

If you are adding a profession or region, say in the PR how you know the
convention — worked in the field, hired for it, official guidance. That context
is what lets a reviewer trust content they cannot verify themselves.
