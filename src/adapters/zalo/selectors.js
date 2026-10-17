'use strict';
// DOM selectors for Zalo. This is the ONLY file to edit when the site
// changes its markup. Empty string = not used (title parsing is enough).
// Status: written from public markup, not yet confirmed against a logged-in
// session. If you can confirm or fix one, please send a PR.
module.exports = {
  // Badges in the conversation list; their numbers are summed.
  unreadBadge: "#conversationList .z-noti-badge, #conversationList [class*=\"unread-count\"], .conv-item .badge-number",
  // Logged-in user's display name / avatar image.
  profileName: "",
  profileAvatar: "[data-id=\"div_Main_TabAvatar\"] img, .nav__tabs__zalo img.a-child, #main-tab img.a-child",
};
