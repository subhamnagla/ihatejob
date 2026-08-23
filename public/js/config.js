// Everything you need to change after buying a domain lives here.

export const SITE = {
  name: 'ihatejob',

  // Set this once you own the domain. Used for share links and og: tags.
  url: (typeof location !== 'undefined' && location.origin.startsWith('http'))
    ? location.origin
    : 'https://ihatejob.example',

  // Where "Open an issue" and the suggestion form point.
  // Change the owner/repo once you push this to GitHub.
  repo: 'https://github.com/subhamnagla/ihatejob',

  // A fallback delivery channel for reviews and suggestions before the
  // repository is public. Set at least one of `repo` or `contactEmail`, or
  // visitors have no way to reach you and the form says so plainly.
  contactEmail: '',        // e.g. 'hello@ihatejob.com'
};

/**
 * Where the front page reads its visitor numbers from.
 *
 * Nothing is invented here. Until you point `endpoint` at something real, the
 * page says so rather than showing a made-up figure - a launch-day site
 * claiming thousands of users is the fastest way to lose a visitor's trust.
 *
 * `endpoint` must return JSON. Map whatever your provider calls things onto
 * { visitors, pageviews, cvsRated } in `read`.
 *
 * Options that work with a static site:
 *   - Plausible / Umami / Fathom: privacy-friendly, have a public stats API
 *   - Cloudflare Web Analytics: free, no cookies, but no public read API
 *   - GoatCounter: free for small sites, has a public JSON endpoint
 *   - Your own counter: a tiny worker storing an integer in KV
 */
export const STATS = {
  endpoint: '',            // e.g. 'https://stats.ihatejob.com/api/summary'

  // Visitor numbers appear only once they are worth showing. Below this they
  // stay off the page entirely - "17 visitors" is worse than saying nothing,
  // and a visitor never sees a placeholder or an explanation.
  minVisitors: 100,

  read: (json) => ({
    visitors: json.visitors,
    pageviews: json.pageviews,
    cvsRated: json.cvs_rated,
  }),
};

/**
 * Real reviews only.
 *
 * This ships empty on purpose. Inventing testimonials from people who do not
 * exist is fabrication, and it is the single easiest thing for a visitor to
 * catch. Add entries here as real people send them, with their permission:
 *
 *   { quote: '...', name: 'Full Name', role: 'Job title', place: 'City',
 *     source: 'https://link-to-where-they-said-it' }
 *
 * `source` is optional but worth having - a review someone can click through
 * to is worth ten they cannot.
 */
export const REVIEWS = [];

// The reviews section stays out of the page until there are at least this
// many. One lone quote reads as thin; three reads as a section. Nothing about
// the section - not the heading, not the nav link - renders before then.
export const MIN_REVIEWS = 3;
