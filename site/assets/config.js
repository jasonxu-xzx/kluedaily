// Everything you'd change before launch lives here.
window.CD_CONFIG = {
  // Public site URL, no trailing slash. Used in share text. Empty = use the current page's address.
  siteUrl: "https://kluedaily.com",

  // PostHog project API key (starts with "phc_"). Empty = analytics off (nothing loads, nothing is sent).
  posthogKey: "phc_sobsyTNbEPbeB6L9xrCcXcK64meVMD8oByNhqAXhZnor",
  posthogHost: "https://us.i.posthog.com",

  // Google Form for "Report a data error". Empty = the link is hidden.
  reportErrorUrl: "https://forms.gle/iTQjGivYjFzmgUon8",

  // Bump when songs.json / artists.json change, so analytics can split results by data version.
  dataVersion: "2026-11-20",
};
