// Shared clue-category illustrations for the social templates (tools/social.html, tools/carousel.html).
// One illustration per clue category (64x64 viewBox; cobalt strokes, pink accents).
const C = "#1F46C8", P = "#FF8AC8", S = `fill="none" stroke="${C}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"`;
const T = (x, y, s, txt, fill = C) => `<text x="${x}" y="${y}" font-family="Bagel Fat One" font-size="${s}" fill="${fill}" text-anchor="middle">${txt}</text>`;
const ICONS = {
  artist: `<path d="M24 34 l-10 18" ${S}/><rect x="22" y="8" width="20" height="30" rx="10" fill="${P}" stroke="${C}" stroke-width="5"/><path d="M26 18h12M26 25h12" ${S}/>`,
  year: `<rect x="8" y="12" width="48" height="44" rx="8" ${S}/><path d="M8 24h48M20 6v12M44 6v12" ${S}/>${T(32, 49, 18, "YR", P)}`,
  month: `<rect x="8" y="12" width="48" height="44" rx="8" ${S}/><path d="M8 24h48M20 6v12M44 6v12" ${S}/><circle cx="20" cy="36" r="3.5" fill="${C}"/><circle cx="32" cy="36" r="3.5" fill="${C}"/><circle cx="44" cy="36" r="5" fill="${P}"/><circle cx="20" cy="47" r="3.5" fill="${C}"/><circle cx="32" cy="47" r="3.5" fill="${C}"/>`,
  season: `<path d="M14 50 C14 22 34 10 54 10 C54 34 40 52 14 50Z" fill="${P}" stroke="${C}" stroke-width="5" stroke-linejoin="round"/><path d="M14 50 L40 24" ${S}/>`,
  views: `<rect x="6" y="14" width="52" height="36" rx="10" ${S}/><path d="M27 23 L41 32 L27 41Z" fill="${P}" stroke="${C}" stroke-width="4" stroke-linejoin="round"/>`,
  length: `<circle cx="32" cy="36" r="22" ${S}/><path d="M26 6h12M32 6v8M32 36l9-9" ${S}/><circle cx="32" cy="36" r="4" fill="${P}"/>`,
  genre: `<rect x="8" y="30" width="9" height="22" rx="3" fill="${P}" stroke="${C}" stroke-width="4"/><rect x="21" y="16" width="9" height="36" rx="3" fill="${C}"/><rect x="34" y="24" width="9" height="28" rx="3" fill="${P}" stroke="${C}" stroke-width="4"/><rect x="47" y="10" width="9" height="42" rx="3" fill="${C}"/>`,
  label: `<circle cx="32" cy="32" r="25" fill="${C}"/><circle cx="32" cy="32" r="17" fill="none" stroke="#fff" stroke-width="1.5" opacity=".5"/><circle cx="32" cy="32" r="10" fill="${P}"/><circle cx="32" cy="32" r="3" fill="#fff"/>`,
  letters: `${T(32, 46, 34, "Aa")}<path d="M10 54h44" stroke="${P}" stroke-width="6" stroke-linecap="round"/>`,
  words: `<rect x="4" y="22" width="18" height="20" rx="5" fill="${P}" stroke="${C}" stroke-width="4"/><rect x="25" y="22" width="14" height="20" rx="5" ${S}/><rect x="42" y="22" width="18" height="20" rx="5" fill="${P}" stroke="${C}" stroke-width="4"/>`,
  first: `<rect x="6" y="18" width="16" height="28" rx="5" fill="${P}" stroke="${C}" stroke-width="4"/>${T(14, 37.5, 14, "A", C)}<rect x="25" y="18" width="14" height="28" rx="5" ${S}/><rect x="42" y="18" width="16" height="28" rx="5" ${S}/>`,
  last: `<rect x="6" y="18" width="16" height="28" rx="5" ${S}/><rect x="25" y="18" width="14" height="28" rx="5" ${S}/><rect x="42" y="18" width="16" height="28" rx="5" fill="${P}" stroke="${C}" stroke-width="4"/>${T(50, 37.5, 14, "Z", C)}`,
  lang: `<rect x="4" y="10" width="34" height="30" rx="8" fill="${P}" stroke="${C}" stroke-width="4"/>${T(21, 31.5, 15, "가")}<rect x="26" y="26" width="34" height="30" rx="8" fill="#fff" stroke="${C}" stroke-width="4"/>${T(43, 47.5, 16, "A")}`,
  stage: `<path d="M6 56 H20 V44 H32 V32 H44 V20 H58" ${S}/><path d="M50 4 L52.5 9.5 58 10 54 14 55 20 50 17 45 20 46 14 42 10 47.5 9.5Z" fill="${P}" stroke="${C}" stroke-width="2.5" stroke-linejoin="round"/>`,
  members: `<circle cx="20" cy="22" r="8" fill="${P}" stroke="${C}" stroke-width="4"/><circle cx="44" cy="22" r="8" fill="${P}" stroke="${C}" stroke-width="4"/><path d="M6 52 C6 40 34 40 34 52" ${S}/><path d="M30 52 C30 40 58 40 58 52" ${S}/>`,
  wins: `<path d="M18 8 H46 V24 C46 34 40 40 32 40 C24 40 18 34 18 24Z" fill="${P}" stroke="${C}" stroke-width="5" stroke-linejoin="round"/><path d="M18 14 H8 C8 24 12 28 18 28 M46 14 H56 C56 24 52 28 46 28 M32 40 V48 M20 56 H44" ${S}/>`,
  cover: `<rect x="8" y="8" width="48" height="48" rx="6" ${S}/><circle cx="32" cy="32" r="13" fill="${P}" stroke="${C}" stroke-width="4"/><circle cx="32" cy="32" r="3" fill="${C}"/><path d="M8 20 L20 8" stroke="${P}" stroke-width="5" stroke-linecap="round"/>`,
  comeback: `<path d="M48 20 A20 20 0 1 0 52 36" ${S}/><path d="M48 8 V20 H36" ${S}/>${T(31, 41, 16, "#", P)}`,
  gap: `<path d="M16 6 H48 M16 58 H48 M20 6 C20 22 44 24 44 32 C44 40 20 42 20 58 M44 6 C44 22 20 24 20 32 C20 40 44 42 44 58" ${S}/><path d="M25 52 L39 52 L32 44Z" fill="${P}"/>`,
};
const icon = id => `<svg viewBox="0 0 64 64">${ICONS[id] || ICONS.genre}</svg>`;
