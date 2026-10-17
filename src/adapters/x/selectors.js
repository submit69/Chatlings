'use strict';
// DOM selectors for X (Twitter) DMs. This is the ONLY file to edit when the site
// changes its markup. Empty string = not used (title parsing is enough).
// Status: written from public markup, not yet confirmed against a logged-in
// session. If you can confirm or fix one, please send a PR.
module.exports = {
  // Badges in the conversation list; their numbers are summed.
  unreadBadge: "a[href=\"/messages\"] [aria-live=\"polite\"]",
  // Logged-in user's display name / avatar image.
  profileName: "",
  profileAvatar: "",
};
