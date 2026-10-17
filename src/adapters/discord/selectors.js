'use strict';
// DOM selectors for Discord. This is the ONLY file to edit when the site
// changes its markup. Empty string = not used (title parsing is enough).
// Status: written from public markup, not yet confirmed against a logged-in
// session. If you can confirm or fix one, please send a PR.
module.exports = {
  // Badges in the conversation list; their numbers are summed.
  unreadBadge: "nav [class*=\"numberBadge_\"]",
  // Logged-in user's display name / avatar image.
  profileName: "section[aria-label=\"User area\"] [class*=\"panelTitleContainer_\"], section[aria-label=\"User area\"] [class*=\"title_\"]",
  profileAvatar: "section[aria-label=\"User area\"] img[class*=\"avatar\"]",
};
