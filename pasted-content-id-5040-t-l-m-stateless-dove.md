# Plan: Bongbong — chat heads nổi trên desktop cho mọi app chat, nhiều tài khoản, mã nguồn mở

## Context
Ý tưởng lấy từ bài khoe app: Zalo trên PC biến thành bong bóng nổi góc màn hình như trên điện thoại, đang làm Excel bấm vào là chat luôn. Anh/chị mở rộng thêm 3 ý:
- **đăng nhập nhiều tài khoản cùng lúc**;
- **hỗ trợ các app chat phổ biến**, không chỉ Zalo;
- **public trên GitHub với mục tiêu lên trending**.

Đã chốt:
- Bọc bản web chính thức của từng app chat bằng Electron, mỗi tài khoản một session riêng. Không dùng API không chính thức, nên ít rủi ro bị khoá nick.
- MVP gồm: bong bóng nổi, nhiều tài khoản (nhiều nick cùng một app hoặc trộn app, ví dụ 2 Zalo + 1 WhatsApp + 1 Discord), skin mèo/cún động, cùng 7 tính năng ở mục "Tính năng thêm": tự ẩn khi share màn hình, xem trước tin, giờ làm việc / không làm phiền, khoá PIN, ngủ tài khoản, âm báo riêng, thú cưng có cảm xúc.
- Tên trung lập **Bongbong** (tên tạm, đổi được). Không dùng tên hay logo của app chat nào làm thương hiệu. README có dòng "không liên kết với các dịch vụ được hỗ trợ".
- License MIT, README hai thứ tiếng (en mặc định, vi), không thu thập dữ liệu (no telemetry).

**Để sau** (ghi trong ROADMAP của README): bong bóng riêng cho từng người/nhóm, chỉ kêu khi bị tag, phím tắt chụp màn hình / Excel thành ảnh, phím tắt + ô tìm nhanh tài khoản, bản macOS/Linux.

Project mới tại `D:\Tool\bongbong\`. Dùng Node 22 ở `%APPDATA%\nvm\v22.16.0` (Node mặc định của máy là 10.14). Không chạy git: anh/chị tự tạo repo và đẩy code.

## Kiến trúc
Electron (bản ổn định mới nhất), JS thuần, không bundler. Cả app chỉ có **2 cửa sổ dùng chung**, không tạo cửa sổ riêng cho từng tài khoản, để tiết kiệm RAM (xem mục "Tối ưu RAM"):

1. **Dock bong bóng** (một cửa sổ trong suốt, không viền, luôn trên cùng, `skipTaskbar`): vẽ bong bóng của mọi tài khoản xếp dọc ở mép màn hình. Mỗi bong bóng hiện avatar hoặc skin, số tin chưa đọc, viền màu riêng và icon nhỏ của app ở góc.
   - Vùng trong suốt cho click xuyên qua bằng `setIgnoreMouseEvents(true, { forward: true })`; bật/tắt theo `mouseenter`/`mouseleave` trên từng bong bóng.
   - Thẻ xem trước tin cũng vẽ trong cửa sổ này (cửa sổ nới rộng ra khi rê chuột).
   - Kéo một bong bóng là kéo cả cụm dock.
2. **Popup chat** (một `BaseWindow`): mỗi tài khoản là một `WebContentsView` (`partition: persist:<adapter>-<id>`) chạy ngầm với user agent Chrome. Bấm bong bóng nào thì gắn view của tài khoản đó vào popup.
   - Popup ~420×680 nằm cạnh dock (Discord, Slack, Teams mặc định ~900×680), luôn trên cùng, tự ẩn khi mất focus (có nút ghim).
   - Màn khoá PIN là một view phủ lên trên view chat.

### Adapter
Mỗi app chat là một thư mục `src/adapters/<id>/` gồm 2 file:
- `index.js` export `{ id, name, url, allowedHosts, icon, size, tier, parseUnread(title), unreadFromDom(), profileFromDom() }`;
- `selectors.js` chứa selector DOM (một chỗ duy nhất; web đổi giao diện thì chỉ sửa file này).

`src/adapters/index.js` là registry. Thêm app mới chỉ cần thêm một thư mục, và CONTRIBUTING có mẫu để cộng đồng gửi PR.

**Tier 1 — hoàn thiện kỹ** (đếm tin qua tiêu đề + DOM, lấy tên/avatar, kiểm tra thật trước khi phát hành):

| Adapter | URL | Đăng nhập | Ghi chú |
|---|---|---|---|
| zalo | chat.zalo.me | QR | |
| messenger | www.messenger.com (dự phòng facebook.com/messages) | email + mật khẩu | Meta đang dần chuyển messenger.com về facebook.com, nên kiểm tra URL nào còn chạy. Đăng nhập lần đầu có thể bị checkpoint bảo mật. |
| telegram | web.telegram.org/k/ | QR / số điện thoại | |
| whatsapp | web.whatsapp.com | QR | Bắt buộc UA Chrome mới. |
| discord | discord.com/app | QR / mật khẩu | |

**Tier 2 — beta** (chỉ đếm tin qua tiêu đề hoặc badge, gắn nhãn "beta" trong menu):

| Adapter | URL | Ghi chú |
|---|---|---|
| slack | app.slack.com/client | |
| teams | teams.microsoft.com (công việc), teams.live.com (cá nhân) | 2 adapter riêng vì khác cách đăng nhập |
| googlechat | mail.google.com/chat | Google có thể chặn đăng nhập trong webview. Cần thử; nếu bị chặn thì ghi vào FAQ. |
| googlemessages | messages.google.com/web | Tin nhắn SMS/RCS từ điện thoại Android, đăng nhập QR |
| instagram | www.instagram.com/direct/inbox/ | |
| x | x.com/messages | |
| linkedin | www.linkedin.com/messaging/ | |
| element | app.element.io | Matrix |

**Tuỳ chỉnh:** người dùng nhập URL và tên bất kỳ; app đếm tin bằng regex tiêu đề chung. Cách này phủ được mọi app chat web khác mà không cần viết code.

**Không hỗ trợ được** (không có bản web): LINE, Viber, Signal, KakaoTalk. WeChat Web chặn phần lớn tài khoản mới. Ghi rõ những app này trong FAQ để tránh issue hỏi đi hỏi lại.

### Đếm tin chưa đọc
1. Regex chung `^\((\d+)\)` trên `document.title`.
2. Nếu app không ghi số trong tiêu đề, dùng `unreadFromDom()` của adapter: cộng các badge trong danh sách chat.
3. Dự phòng cuối: thấy favicon đổi hoặc có Notification mới thì hiện chấm đỏ, không có số.

Định dạng tiêu đề thật của từng app phải xác minh khi làm adapter đó và ghi lại trong comment.

`src/preload/chat-preload.js` dùng chung cho mọi adapter. Nó nhận id adapter qua `additionalArguments`, rồi:
- dùng MutationObserver theo dõi tiêu đề và favicon (poll 2s làm dự phòng);
- bọc `window.Notification` để chuyển `{title, body}` về main và chặn thông báo gốc;
- đọc tên/avatar tài khoản đang đăng nhập.

Icon dịch vụ dùng glyph đơn sắc của simple-icons (CC0), chỉ để nhận diện trong menu chọn app và góc bong bóng.

### Luồng hoạt động
- **Thêm tài khoản:** tray → "Thêm tài khoản" → lưới chọn app (Tier 1, Tier 2 beta, Tuỳ chỉnh) → tạo partition mới → hiện cửa sổ chat để đăng nhập. Đăng nhập được lưu trong partition.
- **Bấm bong bóng:** mở/đóng popup với view của tài khoản đó. **Kéo:** dùng pointer event + IPC `setPosition` để di chuyển cả dock, di quá 4px mới tính là kéo. Thả ra thì hít vào mép gần nhất và lưu vị trí.
- **Chuột phải:** đổi skin (Avatar / Mèo / Cún), đổi tên, đổi màu, ẩn, đăng xuất (xoá dữ liệu partition), xoá tài khoản.
- **Tray:** danh sách tài khoản nhóm theo app kèm số tin chưa đọc, Thêm tài khoản, Hiện/ẩn tất cả bong bóng, "Gộp bong bóng" (một bong bóng tổng, bấm vào xoè ra các tài khoản; hữu ích khi có nhiều tài khoản), Khởi động cùng Windows, Kiểm tra cập nhật, Thoát. Có `requestSingleInstanceLock`.
- **Skin:** mỗi skin là một file trong `src/renderer/skins/<name>.js`, export `{ id, name: {en, vi}, render(el), setState(state) }`, vẽ bằng SVG + CSS keyframes. Có 3 trạng thái: `idle` (thở, chớp mắt, vẫy đuôi), `hover`, `unread` (nhảy, vẫy tai). Tôn trọng `prefers-reduced-motion`. Có `skins/README.md` hướng dẫn gửi PR thêm skin.
- **Ngôn ngữ:** `src/i18n/{en,vi}.json`, mặc định theo `app.getLocale()`.
- **Bảo mật:** bật `contextIsolation`, tắt `nodeIntegration`. Preload chỉ mở các kênh IPC có tên cố định. Cửa sổ chat chặn điều hướng ra ngoài `allowedHosts` của adapter, nhưng vẫn cho trang đăng nhập SSO (accounts.google.com, login.microsoftonline.com…) nằm trong `allowedHosts` của adapter cần nó. Link ngoài mở bằng `shell.openExternal`. Không gọi mạng nào ngoài adapter và kênh cập nhật GitHub Releases.

## Tính năng thêm
Logic quyết định của mỗi tính năng (lịch, cảm xúc, ngủ/thức) viết thành **hàm thuần** để test bằng node:test, không phụ thuộc Electron.

1. **Tự ẩn khi share màn hình** (`src/main/privacy.js`)
   - Mọi cửa sổ Bongbong (bong bóng, popup, xem trước) gọi `setContentProtection(true)`. Windows 10 2004+ sẽ loại các cửa sổ này khỏi ảnh chụp, ghi hình và chia sẻ màn hình (Meet, Zoom, Teams, OBS). Người dùng vẫn thấy bình thường, người xem share thì không thấy. Không cần đoán xem app nào đang share.
   - Tuỳ chọn "Ẩn khi trình chiếu/chơi game": gọi `SHQueryUserNotificationState` qua `koffi` (FFI có sẵn bản build, không phải biên dịch), ẩn khi trạng thái là `QUNS_PRESENTATION_MODE` hoặc `QUNS_RUNNING_D3D_FULL_SCREEN`. **Không** ẩn với `QUNS_BUSY`, để bong bóng vẫn hiện trên Excel phóng to.
   - Có công tắc trong tray để tắt chế độ này khi cần chụp màn hình bong bóng.
2. **Xem trước tin khi rê chuột**
   - Preload đã bắt Notification `{title, body, time}`. Main giữ 3 tin gần nhất mỗi tài khoản, **chỉ trong RAM**, không ghi ra đĩa.
   - Rê chuột 300ms thì bong bóng nở thành thẻ xem trước nằm cạnh, chiều theo mép đang hít.
   - Không hiện khi đang khoá PIN, khi tài khoản đang ở giờ không làm phiền, hoặc khi người dùng tắt xem trước cho tài khoản đó.
3. **Giờ làm việc / Không làm phiền** (`src/main/schedule.js`)
   - Mỗi tài khoản có lịch `{ days[], from, to, outside: 'hide'|'mute'|'none' }`.
   - Có **nhóm hồ sơ** (mặc định "Công việc", "Cá nhân"). Tray có mục bật/tắt cả nhóm và "Không làm phiền 1 giờ / đến sáng mai".
   - Hàm thuần `isActive(schedule, now)` xử lý được ca qua nửa đêm.
4. **Khoá bằng PIN** (`src/main/lock.js`)
   - PIN băm bằng `crypto.scrypt` kèm salt, lưu trong store.
   - Khi đang khoá: bấm bong bóng sẽ hiện màn khoá thay vì popup chat, badge chỉ hiện chấm, không có xem trước.
   - Tự khoá khi máy rảnh X phút (`powerMonitor.getSystemIdleTime`) và khi khoá màn hình Windows (`powerMonitor` sự kiện `lock-screen`). Nhập sai 5 lần thì chờ 30 giây.
   - README nói rõ PIN chỉ chặn người dùng chung máy, **không mã hoá** dữ liệu đăng nhập.
5. **Ngủ tài khoản**: xem mục "Tối ưu RAM" bên dưới.
6. **Âm báo riêng từng nick** (`src/main/sound.js` + `src/renderer/sounds/`)
   - Bongbong chặn Notification gốc rồi tự phát âm theo tài khoản. Có các lựa chọn: vài tiếng chuông tổng hợp bằng WebAudio, meo/gâu theo skin (file CC0, ghi credit trong README), file tự chọn, hoặc im lặng.
   - Tuỳ chọn "Tắt âm gốc của app" (mặc định bật) dùng `webContents.setAudioMuted(true)` khi popup ẩn, và tự bật lại khi popup mở để không mất tiếng cuộc gọi.
   - Lịch không làm phiền và khoá PIN có hiệu lực trước âm báo.
7. **Thú cưng có cảm xúc** (`src/renderer/mood.js`)
   - Hàm thuần `mood({ unread, oldestUnreadAt, lastReplyLatency, asleep, lastActivityAt }, now)` trả về một trong các trạng thái:
     - `sleepy` (ngủ gật): không có tin và 30 phút không ai đụng, hoặc tài khoản đang ngủ;
     - `excited` (nhảy, vẫy tai): vừa có tin mới;
     - `happy` (tim bay): mở đọc trong 2 phút sau khi tin tới;
     - `sad` (cụp tai): còn tin tồn quá 30 phút;
     - `idle`.
   - Skin phải xử lý đủ 5 trạng thái, thiếu thì dùng `idle`. `skins/README.md` mô tả hợp đồng này.

## Tối ưu RAM
**Sự thật cần nói thẳng trong README:** RAM chủ yếu nằm ở chính trang web chat. Mỗi tài khoản đang thức cần một tiến trình Chromium riêng, vì tách đăng nhập thì bắt buộc phải tách tiến trình.
- Ước tính (sẽ đo thật): Zalo khoảng 200–300MB, WhatsApp/Discord 300–500MB.
- Mục tiêu: phần khung Bongbong (main + GPU + dock + popup) **dưới 150MB**.
- Một tài khoản đang thức không được tốn hơn chính trang đó mở trong Chrome.

Các cách giảm, theo mức tác động:
1. **Ngủ tài khoản** (`src/main/sleep.js`). Đây là cách giảm nhiều nhất.
   - Khi thêm tài khoản, chọn chế độ: "Luôn thức" (mặc định cho app nhận tin gấp như Zalo, WhatsApp, Messenger), "Ngủ khi không dùng" (mặc định cho Tier 2), hoặc "Chỉ thức trong giờ làm việc" (nối với lịch ở tính năng 3).
   - Khi ngủ, huỷ `WebContentsView` để trả RAM về gần 0; đăng nhập vẫn còn trong partition.
   - Cứ M phút (mặc định 10) thức 60 giây để lấy số tin chưa đọc rồi ngủ lại. Bấm bong bóng thì thức ngay. Bong bóng hiện "zzz" và thú cưng ở trạng thái `sleepy`.
   - Hàm thuần `nextWake(account, now)` để test.
2. **Hai cửa sổ dùng chung** thay vì 2 cửa sổ cho mỗi tài khoản (xem Kiến trúc). Bỏ được N bong bóng renderer riêng, ước tính tiết kiệm 40–60MB mỗi tài khoản.
3. **Khởi động lần lượt:** lúc mở app, nạp từng tài khoản cách nhau 3 giây, để RAM và CPU không vọt lên một lúc. Tài khoản đang ngủ thì không nạp.
4. **Canh rò rỉ RAM** (`src/main/memory.js`). Web chat chạy nhiều ngày hay rò rỉ RAM.
   - Mỗi 5 phút đọc `app.getAppMetrics()`.
   - Nếu một tài khoản vượt ngưỡng (mặc định 800MB, chỉnh được) **và** popup đang ẩn, tự `reload()` im lặng. Số tin chưa đọc vẫn còn vì nó nằm phía server.
5. **Tắt thứ không cần** trong `webPreferences`: `spellcheck: false` (bật lại được), `autoplayPolicy: 'document-user-activation-required'`, không bật DevTools và WebSQL.
6. **Dock nhẹ:** dock không dùng framework. Hoạt hình chỉ dùng CSS `transform`/`opacity`, và tạm dừng (`animation-play-state: paused`) khi dock bị che hoặc màn hình khoá.
7. **Bảng RAM** trong Cài đặt và tray: RAM từng tài khoản, tổng, nút "Ngủ ngay" và "Tải lại".

## File
```
bongbong/
  package.json             electron, electron-builder, electron-updater; scripts: start, test, dist
  electron-builder.yml     win: nsis + portable, publish: github
  LICENSE (MIT)  README.md (en)  README.vi.md  PRIVACY.md  CONTRIBUTING.md (mẫu adapter + skin)
  .github/workflows/release.yml   tag v* → build exe trên windows-latest → GitHub Release
  build/icon.png|ico       icon riêng (bong bóng + tai mèo)
  docs/demo.gif            ghi bằng Playwright với trang giả
  src/main/{main,store,accounts,chat-popup,dock-window,tray,updater,picker}.js
  src/main/{privacy,schedule,lock,sleep,memory,sound}.js
  scripts/mem-report.mjs   mở app với N tài khoản giả/thật, in bảng RAM từng tiến trình (dùng cho README)
  src/adapters/{zalo,messenger,telegram,whatsapp,discord,slack,teams,teams-live,googlechat,googlemessages,instagram,x,linkedin,element,custom}/
  src/preload/{chat-preload,bubble-preload}.js
  src/renderer/dock.{html,css,js}, picker.{html,js}, lock.{html,js}, settings.{html,js}
  src/renderer/mood.js, skins/{avatar,cat,dog}.js, skins/README.md, sounds/
  src/i18n/{en,vi}.json
  test/*.test.mjs          node:test: store, hít mép/xếp layout, parseUnread, adapter đủ trường, i18n đủ key,
                           isActive (lịch qua nửa đêm), mood, nextWake, ngưỡng reload, PIN băm + khoá khi sai nhiều lần
  test/fake-chat.html      trang giả: đổi title, đổi favicon, gọi Notification
```
Biến môi trường `BONGBONG_FAKE=1` thay URL adapter bằng `test/fake-chat.html` khi test và khi ghi demo.

## README (quyết định số sao)
GIF demo ở đầu trang (bong bóng Zalo, WhatsApp, Discord cùng nổi trên Excel) → một câu giới thiệu → nút Download (link Releases) → hàng icon các app hỗ trợ → bảng tính năng → mục "Privacy: no telemetry, mã nguồn bạn tự đọc được" → FAQ (app nào không hỗ trợ và lý do) → ROADMAP → hướng dẫn thêm skin/adapter → disclaimer. Ghi rõ exe chưa ký số sẽ bị SmartScreen cảnh báo ("More info → Run anyway"). Ký số miễn phí qua SignPath xin sau.

## Rủi ro cần kiểm tra sớm
- Đăng nhập bản web có thể đá phiên app desktop hoặc phiên web khác của **cùng một** tài khoản (Zalo, WhatsApp giới hạn số thiết bị liên kết). Nhiều tài khoản **khác nhau** dùng partition riêng thì không đụng nhau. Ghi kết quả vào FAQ.
- Một số web chặn UA Electron (WhatsApp, Google). Đã xử lý bằng cách đặt UA Chrome cho từng session. Riêng Google có thể vẫn chặn đăng nhập trong webview, nên Google Chat để ở Tier 2.
- Web đổi giao diện làm app ngừng đọc được tin. Đã dồn selector vào một file mỗi adapter và có 3 tầng đếm dự phòng.
- RAM: mỗi tài khoản đang thức là một tiến trình Chromium. Xử lý trong mục "Tối ưu RAM" và công bố số đo thật trong README.
- `setIgnoreMouseEvents` với `forward` trên cửa sổ trong suốt đôi khi lỗi trên một số máy Windows dùng nhiều màn hình có DPI khác nhau. Cần test sớm ở bước 2.

## Thứ tự làm
1. Khung Electron + adapter Zalo + 1 tài khoản: đăng nhập QR, khởi động lại vẫn còn đăng nhập.
2. Dock bong bóng (click xuyên qua) + popup dùng chung + đếm tin chưa đọc + kéo/hít mép + tray.
3. Nhiều tài khoản + lưới chọn app + Tuỳ chỉnh: thêm/xoá/đăng xuất, màu, xếp bong bóng, gộp bong bóng.
4. Adapter Tier 1: Messenger, Telegram, WhatsApp, Discord.
5. Adapter Tier 2 (beta).
6. Skin mèo/cún + 5 cảm xúc + menu chuột phải + i18n.
7. Riêng tư: chống chụp/share màn hình, ẩn khi trình chiếu, khoá PIN.
8. Xem trước tin, âm báo riêng, giờ làm việc + nhóm hồ sơ, màn Cài đặt.
9. Tối ưu RAM: ngủ tài khoản, khởi động lần lượt, canh rò rỉ, bảng RAM, `mem-report`.
10. electron-builder, updater, workflow release, icon.
11. Test, README en/vi (kèm bảng RAM đo thật), PRIVACY, CONTRIBUTING, FAQ, ghi GIF demo.

## Kiểm tra
- `node --test test/` (dùng Node 22): kiểm tra luôn mọi adapter trong registry có đủ trường, và `allowedHosts` chứa host của URL.
- Chạy `BONGBONG_FAKE=1` với nhiều tài khoản giả, kiểm tra bằng Playwright `_electron.launch`: badge cập nhật qua cả 3 tầng (tiêu đề, DOM, favicon/Notification), skin chuyển sang `unread`, bấm mở đúng popup, kéo rồi hít mép, gộp bong bóng. Chụp ảnh và ghép thành `docs/demo.gif`.
- Chống chụp màn hình: chụp bằng `desktopCapturer` khi bong bóng đang hiện; ảnh chụp không được có bong bóng.
- Playwright: khoá PIN chặn popup và xem trước; lịch ngoài giờ ẩn/tắt tiếng đúng; tài khoản ngủ thì cửa sổ chat bị huỷ, bấm bong bóng thì thức lại.
- RAM: chạy `node scripts/mem-report.mjs` với 0, 1, 5 tài khoản giả. Phần khung phải dưới 150MB. Cho 5 tài khoản ngủ thì RAM phải tụt về gần mức khung. Giả lập vượt ngưỡng thì view tự reload khi popup ẩn, và không reload khi popup đang mở.
- Mở thật từng URL adapter trong Electron (chưa đăng nhập), xác nhận trang đăng nhập hiện lên và không bị chặn UA.
- `npm run dist` ra file exe; chạy thử bản portable trên máy.
- Kiểm tra thật (anh/chị làm, cần tài khoản): đăng nhập ít nhất các app Tier 1, nhắn thử vào từng nick, xem badge và hoạt hình, tắt mở app vẫn giữ đăng nhập, bong bóng vẫn nổi trên Excel full màn hình.
