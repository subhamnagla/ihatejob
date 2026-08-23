# Adding a profession

A profession pack is one object in `PROFESSIONS` in
[`public/js/professions.js`](../public/js/professions.js). Adding one changes the
dropdown, the default template, the section order, the section names, the
guidance shown in the editor, and what the checker treats as missing.

You do not need to touch any other file.

## The shape

```js
'veterinary': {
  name: 'Veterinary',              // shown in the dropdown
  group: 'Regulated',              // dropdown grouping; reuse an existing group
  template: 'classic',             // default template id from TEMPLATES
  pages: [1, 2],                   // realistic min and max page count
  order: ['summary', 'licences', 'experience', 'education',
          'skills', 'certifications', 'achievements', 'languages', 'custom'],
  require: ['licences', 'experience', 'education'],   // empty => blocker in the checker
  recommend: ['certifications'],                      // empty => tip
  labels: {                        // rename sections for this field
    experience: 'Clinical Experience',
  },
  guidance: {                      // shown above the section in the editor
    licences: 'Council registration number and the state you are registered in.',
    experience: 'Species handled, caseload, and the practice type.',
  },
  verbs: ['Diagnosed', 'Treated', 'Operated', 'Vaccinated', 'Advised'],
  metrics: ['caseload', 'species', 'practice size', 'surgery count'],
  wants: {                         // optional, checked individually
    licence: 'Registration is verified before hiring.',
  },
},
```

### Fields that matter most

| Field | Why it matters |
|---|---|
| `order` | The single biggest difference between fields. Academics lead with education and publications; sales leads with achievements. Get this right and the pack is already useful. |
| `require` | Drives blockers in the Check tab. Only list what a CV in this field genuinely cannot omit. |
| `labels` | "Experience" is wrong for a lot of fields. Renaming it costs nothing and reads as though the tool understands the job. |
| `metrics` | Shown to the user when their bullets have no numbers. Field-specific measures are far more useful than "impact". |
| `verbs` | Offered as replacements when the checker finds weak openers like "responsible for". |

### Optional flags

- `personalDetailsExpected: true` — the profession overrides the region rule on
  date of birth and similar. Used by `government-psu`, where the application
  form asks for them.
- `longForm: true` — marks a format where multi-page output is normal.

## Choosing `pages`

The checker combines the profession's range with the region's and takes the more
generous ceiling, so a US academic is not told to cut a six-page CV to one page.
Set the range you would actually expect to receive, not the one you wish people
sent.

## Sections that do not exist yet

`licences` and `publications` are optional sections — they stay hidden in the
editor until a pack lists them in `require` or `recommend`, or the user turns
them on. If your profession needs a section that does not exist at all, add it
to `SECTIONS` in [`schema.js`](../public/js/schema.js), add a renderer to `BODY`
in [`templates.js`](../public/js/templates.js), and add it to `SECTION_IDS`
and `OPTIONAL_SECTIONS`.

## Checklist before opening the PR

- [ ] Selecting the profession reorders the preview as you expect.
- [ ] Every id in `order`, `require` and `recommend` exists in `SECTION_IDS`.
- [ ] The Check tab's blockers are ones a real recruiter in that field would agree with.
- [ ] `guidance` says something specific. "Write clearly" helps nobody; "state
      the ward, patient load and acuity" does.
- [ ] You said in the PR how you know this field's conventions.
