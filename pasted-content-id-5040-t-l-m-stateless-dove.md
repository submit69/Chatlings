# Plan: Zalo bong bóng (desktop) + nhiều tài khoản

## Context
Ý tưởng lấy từ bài khoe app: Zalo trên PC biến thành bong bóng nổi góc màn hình như trên điện thoại, đang làm Excel bấm vào là chat luôn. Ý mới của anh/chị: **đăng nhập nhiều tài khoản Zalo cùng lúc**.
Đã chốt:
- **Cách kết nối:** bọc Zalo Web (chat.zalo.me) bằng Electron, mỗi tài khoản một session riêng. Không dùng API không chính thức (zca-js), nên ít rủi ro bị khoá nick.
- **MVP:** bong bóng nổi + nhiều tài khoản + skin mèo/cún động.
- **Để sau** (ghi vào PLAN.md): bong bóng riêng cho từng người/nhóm, chỉ kêu khi bị tag, phím tắt chụp màn hình / Excel thành ảnh, bộ cài đặt.

Đây là project mới, chưa có code: `D:\Tool\zalo-bubble\`. Dùng Node 22 ở `%APPDATA%\nvm\v22.16.0` (Node mặc định của máy là 10.14, không chạy được Electron). Không dùng git.

## Kiến trúc
Electron (bản ổn định mới nhất), JS thuần, không bundler. Một process chính và 2 loại cửa sổ cho mỗi tài khoản:

1. **Cửa sổ Zalo** (`BrowserWindow`, `partition: persist:zalo-<id>`): tải `https://chat.zalo.me` với user agent Chrome. Cửa sổ luôn sống ngầm để vẫn nhận tin, chỉ ẩn/hiện. Khi hiện thì là popup ~420×680 cạnh bong bóng, luôn ở trên cùng, tự ẩn khi mất focus (có nút ghim).
2. **Bong bóng** (`BrowserWindow` trong suốt, không viền, luôn trên cùng, `skipTaskbar`): hiện avatar hoặc skin, có số tin chưa đọc và viền màu riêng cho từng tài khoản. Bong bóng của các tài khoản xếp dọc ở mép màn hình.

Luồng hoạt động:
- **Thêm tài khoản:** tray → "Thêm tài khoản" → tạo id và partition mới → hiện cửa sổ Zalo để quét QR. Cookie lưu trong partition, nên lần sau mở app vẫn đăng nhập.
- **Đếm tin chưa đọc:** `zalo-preload.js` đọc `document.title` (dạng "(3) Zalo"), dùng MutationObserver và poll 2s làm dự phòng. Preload cũng bọc `window.Notification` để chuyển `{title, body}` về main qua IPC, chặn thông báo gốc, và đọc tên/avatar người đăng nhập từ DOM. Selector để trong một file riêng, Zalo đổi giao diện thì chỉ cần sửa file đó.
- **Bấm bong bóng:** mở/đóng popup chat của tài khoản đó. **Kéo bong bóng:** dùng pointer event + IPC `setPosition`, không dùng `-webkit-app-region` vì nó nuốt mất click. Di quá 4px mới tính là kéo. Thả ra thì hít vào mép gần nhất và lưu vị trí.
- **Chuột phải bong bóng:** đổi skin (Avatar / Mèo / Cún), đổi tên, đổi màu, ẩn bong bóng, đăng xuất (xoá dữ liệu partition), xoá tài khoản.
- **Tray:** danh sách tài khoản kèm số tin chưa đọc, Thêm tài khoản, Hiện/ẩn tất cả bong bóng, Khởi động cùng Windows (`app.setLoginItemSettings`), Thoát. Có `requestSingleInstanceLock`.
- **Skin động:** mèo và cún vẽ bằng SVG inline + CSS keyframes, không cần file ảnh ngoài. Có 3 trạng thái: `idle` (thở, chớp mắt, vẫy đuôi), `hover` (ngó lên), `unread` (nhảy, vẫy tai, có badge). Tôn trọng `prefers-reduced-motion`.
- **Bảo mật:** tất cả cửa sổ bật `contextIsolation: true`, `nodeIntegration: false`. Preload chỉ mở vài kênh IPC có tên cố định. Cửa sổ Zalo chặn điều hướng ra ngoài `*.zalo.me`, link ngoài thì mở bằng `shell.openExternal`.

## File
```
zalo-bubble/
  package.json            electron, scripts: start, test
  PLAN.md                 spec + danh sách "Để sau"
  src/main/main.js        khởi động app, single instance, IPC
  src/main/store.js       accounts.json trong userData (id, name, color, skin, bubblePos, partition)
  src/main/accounts.js    thêm/xoá/đăng xuất, tạo partition
  src/main/zalo-window.js tạo/hiện/ẩn popup Zalo, UA, chặn điều hướng
  src/main/bubble-window.js  tạo bong bóng, layout xếp dọc, hít mép (hàm thuần để test)
  src/main/tray.js
  src/preload/zalo-preload.js   unread + hook Notification + lấy profile
  src/preload/zalo-selectors.js selector DOM Zalo (một chỗ duy nhất)
  src/preload/bubble-preload.js
  src/renderer/bubble.html|css|js
  src/renderer/skins/cat.js, dog.js, avatar.js   (SVG + trạng thái)
  test/*.test.mjs         node:test cho store, hàm hít mép/xếp layout, parse title
  test/fake-zalo.html     trang giả: đổi title, gọi Notification
```
`ZALO_URL` trong env cho phép thay chat.zalo.me bằng `test/fake-zalo.html` khi test.

## Rủi ro cần kiểm tra sớm
- Đăng nhập Zalo Web có thể đá phiên Zalo PC hoặc một phiên web khác của **cùng một** tài khoản. Nhiều tài khoản **khác nhau** dùng partition riêng thì không đụng nhau. Cần thử thật ở bước 1.
- Zalo có thể chặn UA Electron. Đã xử lý bằng cách đặt UA Chrome cho từng session.
- Popup ẩn có thể bị Chromium hãm timer làm trễ tin. Đặt `backgroundThrottling: false` cho cửa sổ Zalo.

## Thứ tự làm
1. Khung Electron + 1 tài khoản: popup Zalo, quét QR, khởi động lại vẫn còn đăng nhập.
2. Bong bóng + đếm tin chưa đọc + kéo/hít mép + tray.
3. Nhiều tài khoản: thêm/xoá/đăng xuất, màu, xếp bong bóng.
4. Skin mèo/cún động + menu chuột phải.
5. Test + PLAN.md.

## Kiểm tra
- `node --test test/` (dùng Node 22): store, layout/hít mép, parse "(n) Zalo".
- Chạy với `ZALO_URL=test/fake-zalo.html` và 2 tài khoản giả: badge cập nhật, skin chuyển sang `unread`, bấm mở đúng popup. Có thể tự động bằng Playwright `_electron.launch` + chụp ảnh bong bóng.
- Kiểm tra thật (anh/chị làm, cần điện thoại): thêm 2 tài khoản bằng QR, nhắn thử từ máy khác vào từng nick, xem badge và hoạt hình, tắt mở app vẫn giữ đăng nhập, mở Excel full màn hình bong bóng vẫn nổi trên cùng.
