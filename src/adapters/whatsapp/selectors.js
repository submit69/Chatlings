'use strict';
// DOM selectors for WhatsApp. This is the ONLY file to edit when the site
// changes its markup. Empty string = not used (title parsing is enough).
// Status: written from public markup, not yet confirmed against a logged-in
// session. If you can confirm or fix one, please send a PR.
module.exports = {
  // Badges in the conversation list; their numbers are summed.
  unreadBadge: "#pane-side span[aria-label*=\"unread\" i], #pane-side span[aria-label*=\"chưa đọc\" i]",
  // Logged-in user's display name / avatar image.
  profileName: "",
  profileAvatar: "#app header img[src*=\"whatsapp.net\"]",
};
