// The planet scale.
//
// A score out of 100 is precise and forgettable. "Your CV is Mars" is neither,
// but people remember it and tell other people about it. Both are shown - the
// planet is the hook, the six characters underneath are the actual feedback.
//
// Ordered outward from Mercury and ending at the Sun, so brighter is better.

export const PLANETS = [
  {
    rank: 1, name: 'Mercury', colour: '#8c8a85', shade: '#5f5d59',
    tag: 'Scorched and bare',
    line: 'Barely anything on the surface. There is a CV here somewhere, but a recruiter '
      + 'would not find it in six seconds.',
  },
  {
    rank: 2, name: 'Venus', colour: '#d9a441', shade: '#9c7223',
    tag: 'All cloud, no view',
    line: 'Plenty of words, nothing you can see through them. Mostly filler where the '
      + 'evidence should be.',
  },
  {
    rank: 3, name: 'Earth', colour: '#3b82c4', shade: '#1f4f7d',
    tag: 'Habitable',
    line: 'The basics are alive. It would survive a first glance, then get put down.',
  },
  {
    rank: 4, name: 'Mars', colour: '#c1440e', shade: '#7d2c09',
    tag: 'Promising, thin air',
    line: 'A real CV with real gaps. The structure holds; the evidence does not fill it yet.',
  },
  {
    rank: 5, name: 'Jupiter', colour: '#c8944f', shade: '#8a6432',
    tag: 'Big, and getting noticed',
    line: 'Substantial. Enough here to get a call, though some of it is still weather '
      + 'rather than surface.',
  },
  {
    rank: 6, name: 'Saturn', colour: '#d8c07a', shade: '#9c8a4e', ring: true,
    tag: 'Striking',
    line: 'This has a shape people remember. A few loose rings left to tidy.',
  },
  {
    rank: 7, name: 'Uranus', colour: '#7fd4d8', shade: '#4a9296',
    tag: 'Cool and composed',
    line: 'Consistent, calm, well ordered. Very little to argue with.',
  },
  {
    rank: 8, name: 'Neptune', colour: '#3f5fd8', shade: '#26398a',
    tag: 'Deep',
    line: 'Serious depth of evidence. A hiring manager would read this one all the way down.',
  },
  {
    rank: 9, name: 'Pluto', colour: '#b9a693', shade: '#7e6f5f',
    tag: 'Small print, big claim',
    line: 'Nearly the whole distance. Technically a dwarf planet, and technically you are '
      + 'one detail short of the top.',
  },
  {
    rank: 10, name: 'The Sun', colour: '#f5a623', shade: '#c26f04', sun: true,
    tag: 'Impossible to ignore',
    line: 'Everything a CV in this field is supposed to do, done. Send it.',
  },
];

/** Score out of 100 -> planet. 0-9 Mercury, 90-100 the Sun. */
export function planetFor(score) {
  const idx = Math.min(9, Math.max(0, Math.floor(score / 10)));
  return PLANETS[idx];
}

/** Each rung is worth half a star, so rank 10 is the full five. */
export function starsFor(rank) {
  return rank / 2;
}

export function starRow(stars, size) {
  const px = size || 18;
  let html = '<span class="stars" aria-label="' + stars + ' out of 5 stars">';
  for (let i = 1; i <= 5; i += 1) {
    const fill = stars >= i ? 'full' : stars >= i - 0.5 ? 'half' : 'empty';
    html += '<svg class="star ' + fill + '" viewBox="0 0 24 24" width="' + px + '" height="' + px + '">'
      + '<defs><linearGradient id="h' + i + '-' + px + '">'
      + '<stop offset="50%" stop-color="currentColor"/><stop offset="50%" stop-color="transparent"/>'
      + '</linearGradient></defs>'
      + '<path d="M12 2.6l2.9 5.9 6.5.95-4.7 4.58 1.11 6.47L12 17.45l-5.81 3.05 1.11-6.47L2.6 9.45l6.5-.95z"'
      + ' fill="' + (fill === 'full' ? 'currentColor' : fill === 'half' ? 'url(#h' + i + '-' + px + ')' : 'none')
      + '" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>';
  }
  return html + '</span>';
}

/** Inline SVG for one planet. Self-contained so it works in any theme. */
export function planetSVG(p, size) {
  const s = size || 120;
  const id = 'pl' + p.rank + '-' + s;
  const r = p.sun ? s * 0.3 : s * 0.32;

  const glow = p.sun
    ? '<circle cx="' + (s / 2) + '" cy="' + (s / 2) + '" r="' + (r * 1.55) + '"'
      + ' fill="url(#g' + id + ')" opacity="0.55"/>'
    : '';

  const ring = p.ring
    ? '<ellipse cx="' + (s / 2) + '" cy="' + (s / 2) + '" rx="' + (r * 1.75) + '" ry="' + (r * 0.42) + '"'
      + ' fill="none" stroke="' + p.colour + '" stroke-width="' + (s * 0.045) + '" opacity="0.85"'
      + ' transform="rotate(-18 ' + (s / 2) + ' ' + (s / 2) + ')"/>'
    : '';

  return '<svg class="planet-svg" viewBox="0 0 ' + s + ' ' + s + '" width="' + s + '" height="' + s + '"'
    + ' role="img" aria-label="' + p.name + '">'
    + '<defs>'
    + '<radialGradient id="s' + id + '" cx="35%" cy="30%">'
    + '<stop offset="0%" stop-color="' + p.colour + '"/>'
    + '<stop offset="100%" stop-color="' + p.shade + '"/>'
    + '</radialGradient>'
    + '<radialGradient id="g' + id + '">'
    + '<stop offset="40%" stop-color="' + p.colour + '"/>'
    + '<stop offset="100%" stop-color="' + p.colour + '" stop-opacity="0"/>'
    + '</radialGradient>'
    + '</defs>'
    + glow
    + (p.ring ? ring : '')
    + '<circle cx="' + (s / 2) + '" cy="' + (s / 2) + '" r="' + r + '" fill="url(#s' + id + ')"/>'
    + (p.ring
      ? '<ellipse cx="' + (s / 2) + '" cy="' + (s / 2) + '" rx="' + (r * 1.75) + '" ry="' + (r * 0.42) + '"'
        + ' fill="none" stroke="' + p.colour + '" stroke-width="' + (s * 0.045) + '" opacity="0.55"'
        + ' transform="rotate(-18 ' + (s / 2) + ' ' + (s / 2) + ')"'
        + ' stroke-dasharray="' + (r * 1.2) + ' ' + (r * 4) + '"/>'
      : '')
    + '</svg>';
}
