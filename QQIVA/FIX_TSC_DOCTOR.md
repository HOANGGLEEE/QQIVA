# FIX TSC + EXPO DOCTOR (2026-09-11)

Sửa theo log kiểm tra thực tế trên Windows:

- `tsconfig.json`: bỏ `compilerOptions.baseUrl` để tương thích TypeScript 6; alias `@/* -> src/*` vẫn giữ nguyên qua `paths`.
- `app.json`: bỏ `expo.newArchEnabled` vì schema Expo SDK 57 hiện không chấp nhận field này.
- `package.json`: thêm peer dependencies bắt buộc `expo-font ~57.0.3` và `expo-linking ~57.0.9`.
- `package.json`: nâng `react-native-view-shot` lên `5.1.0` theo `npx expo install --check`.
- Tăng version workspace lên `0.3.1`, Android `versionCode` lên `4`.

Sau khi giải nén bản này, chạy trong `Mobile`:

```powershell
npm install
npx expo install --check
npx tsc --noEmit
npx expo-doctor
```

Không chạy `npm audit fix --force` trong lúc này vì có thể kéo dependency lệch Expo SDK 57.
