'use strict';
// DOM selectors for Zalo. This is the ONLY file to edit when the site
// changes its markup. Empty string = not used.
// Checked against a logged-in chat.zalo.me on 2026-10-17:
//   <div class="mmi-icon-wr">
//     <div class="z-noti-badge-container">
//       <div class="z-noti-badge --big --counter">
//         <i class="fa fa-5_24_Line z-noti-badge__content"></i>   ← 5 unread, drawn as an icon glyph
//       </div>
//       <i class="fa fa-Message_28_Filled internal-icon"></i>     ← the Messages tab
//     </div>
//   </div>
// The title never carries a count ("Zalo - <name>"), and the page also fires
// a Notification per message.
module.exports = {
  // Containers of the left-bar tab badges (Messages, Contacts, Cloud…).
  unreadBadge: '.z-noti-badge-container',
  // Only the Messages tab counts unread chats.
  messagesIcon: 'i[class*="fa-Message_"]',
  // The number lives in this element's class name (fa-<n>_24_Line).
  badgeContent: '.z-noti-badge__content',
  // Logged-in user's display name / avatar image.
  profileName: '',
  profileAvatar: '[data-id="div_Main_TabAvatar"] img, .nav__tabs__zalo img.a-child, #main-tab img.a-child',
};
