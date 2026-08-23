# Adding a template

Templates are CSS skins over two fixed DOM shapes. You almost never need to
write rendering code — you write a stylesheet block.

## The two shapes

**Single column** (`layout: 'single'`) — a header, then sections in order:

```html
<header class="cv-head">
  <div class="cv-head-main">
    <h1 class="cv-name">…</h1>
    <p class="cv-headline">…</p>
    <div class="cv-contact">…</div>
  </div>
  <div class="cv-photo"><img …></div>
</header>
<div class="cv-body">
  <section class="cv-section" data-sec="experience">
    <h3 class="cv-h">Experience</h3>
    <div class="cv-sec-body">
      <article class="cv-entry">
        <div class="cv-entry-top">
          <div class="cv-entry-id">
            <h4 class="cv-entry-title">…</h4>
            <div class="cv-entry-sub">…</div>
          </div>
          <div class="cv-entry-meta"><div class="cv-entry-date">…</div></div>
        </div>
        <ul class="cv-points"><li>…</li></ul>
      </article>
    </div>
  </section>
</div>
```

**Sidebar** (`layout: 'sidebar'`) — the same sections split across two columns:

```html
<header class="cv-banner">…</header>   <!-- only for right-rail templates -->
<div class="cv-split">
  <aside class="cv-side">…</aside>
  <div class="cv-main">…</div>
</div>
```

## Steps

**1.** Add an entry to `TEMPLATES` in
[`public/js/templates.js`](../public/js/templates.js):

```js
swiss: { name: 'Swiss', blurb: 'Grid-led, generous white space', layout: 'single' },
```

If it is a sidebar template, also add which sections belong in the rail:

```js
const SIDE_SECTIONS = {
  swiss: ['skills', 'languages', 'certifications'],
};
```

**2.** Add a `.tpl-swiss` block in
[`public/css/cv.css`](../public/css/cv.css). Style by overriding the shared
classes. The page exposes these custom properties:

| Property | Meaning |
|---|---|
| `--accent` | User-chosen accent colour |
| `--ink` / `--muted` / `--rule` | Text, secondary text, hairlines |
| `--pad` | Page padding (set to `0` for full-bleed sidebars) |
| `--gap` | Vertical rhythm between sections |
| `--fs` / `--lh` | Base size and line height |
| `--page-w` / `--page-h` | Sheet dimensions |

**3.** Add a thumbnail to `THUMBS` in
[`public/js/form.js`](../public/js/form.js). Each entry is
`[top, left, width, height, kind]` in percentages, painted in order. `kind` is
one of `d` (dark text block), `l` (light text line), `a` (accent), `w` (white,
for use on accent), `t` (accent tint).

## Rules

- **Do not set a font family.** The typeface is the user's choice.
- **Use the accent variable**, never a hard-coded colour, except where the
  template is deliberately monochrome (see `.tpl-ats`).
- **Full-bleed needs `padding: 0`** on the template root, with the padding moved
  onto `.cv-side` and `.cv-main`.
- **Every entry must survive a page break.** `.cv-entry` already carries
  `break-inside: avoid`; do not override it.
- **Test the print output**, not just the preview. Download PDF, set margins to
  None, and check page two.

## A word on multi-page

Page padding lives inside the document rather than in `@page`, which is what
lets sidebar templates bleed colour to the sheet edge. The cost is that on page
two the top padding and the sidebar background do not repeat. If your template
is intended for long CVs, prefer a single-column layout with no full-bleed
elements — see `.tpl-academic`.
