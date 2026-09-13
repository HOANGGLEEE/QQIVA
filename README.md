# QQIVA Mobile

QQIVA Mobile là ứng dụng quản lý báo giá, hóa đơn, sản phẩm, khách hàng, công nợ, bán hàng, kho và các nghiệp vụ doanh nghiệp trên Android.

Dự án được xây dựng bằng **React Native + Expo**, ưu tiên hoạt động **offline** và lưu dữ liệu cục bộ bằng **SQLite**.

## Công nghệ chính

- React Native
- Expo SDK 57
- Expo Router
- TypeScript
- SQLite
- Expo FileSystem
- Expo Media Library
- Expo Clipboard
- Native Android build bằng Gradle

## Yêu cầu môi trường

Khuyến nghị:

- Node.js 20+ hoặc phiên bản Node tương thích với Expo SDK 57
- npm
- Java JDK 17
- Android Studio
- Android SDK Platform 36
- Android SDK Build Tools 36
- Android SDK Platform Tools
- Thiết bị Android thật hoặc Android Emulator

> Trên Windows, nên dùng **JDK 17**. Không khuyến nghị build project này bằng JDK 25/26 vì có thể gặp lỗi Gradle/jlink.

## Clone project

```bash
git clone <URL_REPOSITORY>
cd QQIVA
```

Thay `<URL_REPOSITORY>` bằng URL GitHub/GitLab của repository.

## Cài dependency

```bash
npm install
```

Kiểm tra TypeScript:

```bash
npm run typecheck
```

## Cấu hình Android SDK trên Windows

Android SDK thường nằm tại:

```text
C:\Users\<USERNAME>\AppData\Local\Android\Sdk
```

Nếu project chưa có file `android/local.properties`, tạo file này với nội dung:

```properties
sdk.dir=C:/Users/<USERNAME>/AppData/Local/Android/Sdk
```

Ví dụ:

```properties
sdk.dir=C:/Users/Hoang/AppData/Local/Android/Sdk
```

Không nên commit `local.properties` lên Git vì đường dẫn SDK khác nhau trên từng máy.

## Cấu hình Java

Kiểm tra Java:

```bash
java -version
```

Project nên chạy bằng **JDK 17**.

Trên Windows PowerShell có thể đặt tạm:

```powershell
$env:JAVA_HOME="C:\Program Files\Eclipse Adoptium\jdk-17"
$env:Path="$env:JAVA_HOME\bin;$env:Path"
```

Kiểm tra lại:

```powershell
java -version
```

## Chạy ứng dụng Android lần đầu

Kết nối điện thoại Android bằng USB và bật:

- Developer options
- USB debugging

Kiểm tra thiết bị:

```powershell
$adb="$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb devices
```

Sau đó build Development Client:

```bash
npx expo run:android
```

Lần build đầu có thể mất khá lâu vì Gradle phải tải và biên dịch các native dependency.

## Chạy ứng dụng trong quá trình phát triển

Sau khi Development Client đã được cài trên điện thoại:

```powershell
$adb="$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb reverse tcp:8081 tcp:8081
```

Khởi động Metro:

```bash
npx expo start --dev-client --clear
```

Giữ terminal Metro đang chạy và mở ứng dụng QQIVA trên điện thoại.

### Khi chỉ sửa TypeScript / React Native

Thông thường **không cần build lại APK**. Chỉ cần Metro đang chạy và reload app.

### Khi thêm hoặc thay đổi native module

Ví dụ:

- `expo-clipboard`
- `expo-media-library`
- native Android plugin
- thay đổi `android/`
- thay đổi native configuration trong `app.json`

thì phải build lại:

```bash
npx expo run:android
```

## Nếu app báo `Unable to load script`

Kiểm tra lại kết nối ADB:

```powershell
$adb="$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"

& $adb devices
& $adb reverse tcp:8081 tcp:8081
& $adb reverse --list
```

Sau đó khởi động lại Metro:

```bash
npx expo start --dev-client --clear
```

Đóng hoàn toàn app QQIVA trên điện thoại rồi mở lại.

## Build APK Release

Để build APK chạy độc lập, không cần Metro:

```powershell
cd android
.\gradlew.bat assembleRelease
```

APK thường được tạo tại:

```text
android/app/build/outputs/apk/release/app-release.apk
```

> Development build cần Metro để tải JavaScript. Release build chứa bundle JavaScript bên trong APK và có thể chạy độc lập.

## Kiểm tra project

### TypeScript

```bash
npm run typecheck
```

### Kiểm tra logic tiền

```bash
node scripts/check-studio-money.cjs
```

### Kiểm tra lưu trữ Studio

```bash
node scripts/check-studio-storage.cjs
```

### Kiểm tra export

```bash
node scripts/check-studio-export.cjs
```

### Kiểm tra Smart Quote / Smart Invoice

```bash
node scripts/check-smart-workflow.cjs
```

## Professional Studio

Professional Studio hỗ trợ tạo báo giá/hóa đơn theo nhiều định dạng:

- PHONE 9:16
- A4 Portrait
- Landscape
- Square

Các chức năng export gồm:

- PNG
- PDF
- Share
- lưu PNG vào Gallery
- lưu PDF vào thư mục do người dùng chọn

PHONE PNG sử dụng kích thước:

```text
1080 × 1920
```

PHONE PDF sử dụng tỷ lệ 9:16.

## Hóa đơn thông minh

QQIVA **không tự OCR ảnh trong ứng dụng** và **không yêu cầu OpenAI API key**.

Luồng sử dụng:

1. Mở **Hóa đơn thông minh**.
2. Chọn **Sao chép Prompt**.
3. Chọn **Mở ChatGPT**.
4. Trong ChatGPT, gửi Prompt cùng ảnh bảng đo.
5. Sao chép kết quả JSON ChatGPT trả về.
6. Quay lại QQIVA.
7. Chọn **Dán từ bộ nhớ tạm**.
8. Chọn **Kiểm tra & nạp kết quả**.
9. QQIVA kiểm tra schema, phép đo và chuẩn hóa dữ liệu.
10. Sang bước chuẩn hóa rồi tiếp tục vào trình soạn hóa đơn.

QQIVA hỗ trợ kết quả:

- JSON thuần
- khối `json` trong code fence
- JSON nằm trong câu trả lời có phần giải thích

QQIVA sẽ tự kiểm tra lại công thức/phép đo. Nếu số lượng ChatGPT trả về không khớp phép tính, dòng dữ liệu có thể được đánh dấu `NEED_CHECK`.

## Kiến trúc dữ liệu quan trọng

Dữ liệu chứng từ sử dụng cấu trúc chính:

```text
floors[]
  └── rooms[]
       └── items[]
```

`floors[].rooms[].items` là nguồn dữ liệu chính cho hạng mục chứng từ.

Professional Studio sử dụng SQLite và bảng `studio_records` để lưu:

- draft
- template
- metadata
- payload

Không nên thay đổi kiến trúc này nếu chưa kiểm tra migration và dữ liệu cũ.

## Một số nguyên tắc khi sửa code

Không thay đổi logic tính tiền nếu không có lỗi được chứng minh.

Các phần cần giữ ổn định:

- subtotal
- discount
- surcharge
- VAT
- grand total
- SQLite
- `studio_records`
- PNG export
- PDF export
- Share
- save/reopen document

Sau khi sửa chức năng liên quan, nên chạy lại các script kiểm tra trong thư mục `scripts/`.

## Lưu ý về đường dẫn project trên Windows

Không nên đặt source quá sâu, ví dụ:

```text
C:\Users\User\Downloads\folder1\folder2\folder3\QQIVA...
```

Native Android/CMake có thể gặp giới hạn độ dài đường dẫn.

Khuyến nghị:

```text
D:\QQIVA
```

hoặc:

```text
C:\QQIVA
```

## Troubleshooting

### `adb` is not recognized

Dùng trực tiếp:

```powershell
$adb="$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb devices
```

### Android SDK not found

Kiểm tra `android/local.properties` và bảo đảm `sdk.dir` trỏ đúng Android SDK.

### Gradle dùng sai Java

Kiểm tra:

```bash
java -version
```

Nên là JDK 17.

Có thể cấu hình Gradle bằng `android/gradle.properties`:

```properties
org.gradle.java.home=C:\\Program Files\\Eclipse Adoptium\\jdk-17
```

Đường dẫn phải đúng với máy đang build.

### Native dependency vừa được thêm nhưng reload không hoạt động

Build lại:

```bash
npx expo run:android
```

Sau đó chạy lại Metro:

```bash
npx expo start --dev-client --clear
```

## Development workflow đề xuất

```text
npm install
   ↓
npm run typecheck
   ↓
npx expo run:android
   ↓
adb reverse tcp:8081 tcp:8081
   ↓
npx expo start --dev-client --clear
   ↓
test trên thiết bị thật
   ↓
chạy regression scripts
   ↓
build Release APK
```

## Trạng thái dự án

Dự án hiện tập trung vào:

- hoạt động offline
- trải nghiệm Android native
- SQLite
- quản lý chứng từ
- Professional Studio
- Smart Quote / Smart Invoice
- export PNG/PDF
- dữ liệu doanh nghiệp và bán hàng

Một số chức năng có thể vẫn đang tiếp tục được hoàn thiện.

## License

Cập nhật phần này theo giấy phép mà chủ repository muốn sử dụng.

Ví dụ:

```text
Private / Proprietary
```

hoặc thêm file `LICENSE` nếu dự án được phát hành mã nguồn mở.
