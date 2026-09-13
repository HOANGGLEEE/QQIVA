# FIX npm install - Expo SDK 57

Đã sửa các dependency Expo SDK 57 bị ghim sai patch trong package.json.

Trên Windows PowerShell, tại thư mục Mobile:

```powershell
if (Test-Path node_modules) { Remove-Item node_modules -Recurse -Force }
if (Test-Path package-lock.json) { Remove-Item package-lock.json -Force }
npm cache verify
npm install
npx expo install --check
npx tsc --noEmit
npx expo-doctor
```

Nếu `npx expo install --check` đề nghị chỉnh version, dùng:

```powershell
npx expo install --fix
npx tsc --noEmit
npx expo-doctor
```

Cảnh báo peer dependency react-native-worklets không phải lỗi ETARGET. Chỉ xử lý nếu expo-doctor còn báo sau khi install thành công.
