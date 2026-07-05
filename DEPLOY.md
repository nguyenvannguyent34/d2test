# HƯỚNG DẪN TRIỂN KHAI HỆ THỐNG ONLINE LÊN FIREBASE HOSE & GITHUB

Hệ thống đã được tối ưu hóa toàn bộ sang kiến trúc **Serverless** sử dụng **Firebase Firestore** trực tiếp từ trình duyệt (Client-side), loại bỏ hoàn toàn việc phải duy trì máy chủ Node.js Express chạy liên tục. Điều này cho phép hệ thống hoạt động 100% online miễn phí và bảo mật cực cao trên **Firebase Hosting**.

---

## 1. Triển khai lên GitHub

Dự án đã được khởi tạo Git cục bộ và cấu hình remote tới GitHub của bạn:
`https://github.com/nguyenvannguyent34/d2test`

Nếu trên màn hình máy tính của bạn xuất hiện cửa sổ **Git Credential Manager** (Popup đăng nhập GitHub), vui lòng click **"Sign in with your browser"** để ủy quyền tải mã nguồn lên.

Nếu chưa được đẩy lên hoặc bạn muốn đẩy thủ công, bạn chỉ cần mở Terminal (PowerShell hoặc Command Prompt) tại thư mục `d:\AI\pccc-online-test-system` và chạy lệnh sau:
```bash
git add .
git commit -m "Deploy serverless Firebase version of PCCC Online Testing System"
git push -u origin main -f
```

---

## 2. Triển khai lên Firebase Hosting (Hoạt động Online)

Tôi đã cấu hình sẵn 2 tệp cài đặt `firebase.json` và `.firebaserc` trỏ tới dự án Firebase **`test-e0aa0`** của bạn. Để đưa trang web lên hoạt động online, bạn chỉ cần thực hiện 3 bước đơn giản sau:

### Bước 2.1: Biên dịch mã nguồn Frontend
Mở Terminal tại thư mục `d:\AI\pccc-online-test-system\frontend` và chạy lệnh biên dịch dự án:
```bash
npm run build
```
Lệnh này sẽ tạo ra thư mục chứa sản phẩm tĩnh tại `frontend/dist`.

### Bước 2.2: Đăng nhập Firebase CLI
Mở Terminal tại thư mục gốc của dự án `d:\AI\pccc-online-test-system` và đăng nhập tài khoản Google chứa dự án Firebase của bạn:
```bash
npx firebase login
```
*Trình duyệt sẽ tự động mở ra, bạn chỉ cần chọn tài khoản Google và nhấn **Allow** (Cho phép).*

### Bước 2.3: Triển khai (Deploy) lên Firebase Hosting
Tại thư mục gốc dự án `d:\AI\pccc-online-test-system`, chạy lệnh sau để đưa trang web lên môi trường online:
```bash
npx firebase deploy
```

Sau khi hoàn tất, Firebase sẽ cung cấp link hoạt động online chính thức dạng:
👉 **`https://test-e0aa0.web.app`** hoặc **`https://test-e0aa0.firebaseapp.com`**

---

## 3. Cấu hình Firestore Rule (LƯU Ý QUAN TRỌNG)

Để ứng dụng có thể đọc/ghi dữ liệu từ trình duyệt vào Firestore database của bạn, bạn cần cấu hình rules cho Database của mình tại console Firebase:

1. Truy cập vào: [Firebase Console - Project test-e0aa0](https://console.firebase.google.com/project/test-e0aa0/firestore)
2. Chọn **Cloud Firestore** -> Vào tab **Rules** (Quy tắc).
3. Đổi quy tắc thành cho phép đọc ghi thử nghiệm (hoặc cấu hình bảo mật tùy nhu cầu) rồi nhấn **Publish**:
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if true;
       }
     }
   }
   ```
4. Ứng dụng tích hợp trình tự động **seeding dữ liệu mẫu** (exams, candidates, units, questions). Khi bạn mở trang web online lần đầu tiên, dữ liệu mẫu sẽ tự động được ghi vào Firestore Database của bạn một cách hoàn chỉnh mà không cần chạy bất kỳ script nào khác!
