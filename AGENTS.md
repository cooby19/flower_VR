# 專案代理指引

## 專案概覽

這是一個 Vite + Three.js + 原生 JavaScript 的 360 度互動場景前端專案，不使用 React、Vue 或 Svelte。

主要結構：
- `index.html`：繁體中文 HTML 入口，包含全螢幕 canvas、準星、陀螺儀按鈕與底部 HUD。
- `src/main.js`：Three.js 場景、全景貼圖載入、滑鼠/觸控拖曳、手機陀螺儀 fallback。
- `src/styles.css`：全螢幕沉浸式 UI、安全區、HUD 與手機版樣式。
- `src/assets/panorama.png`：2:1 等距圓柱投影全景背景圖。
- `vite.config.js`：Vite dev/preview host 設定。
- `package.json`：npm 指令與依賴。

## 開發指令

- 安裝依賴：`npm install`
- 啟動開發伺服器：`npm run dev`
- 建置：`npm run build`
- 預覽建置結果：`npm run preview`

## 實作規範

- JavaScript 使用 ES Modules、2 空格縮排、雙引號與分號。
- DOM 查詢集中放在 `src/main.js` 上方。
- 全景圖片需透過 `new URL("./assets/panorama.png", import.meta.url).href` 載入。
- 使用 `THREE.TextureLoader` 載入全景圖，並保留：
  - `texture.colorSpace = THREE.SRGBColorSpace`
  - `texture.wrapS = THREE.RepeatWrapping`
  - `texture.wrapT = THREE.ClampToEdgeWrapping`
  - `texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8)`
- 全景背景貼到大型 `SphereGeometry` 內側，材質使用 `THREE.BackSide`。
- 保持全螢幕 WebGL 沉浸式體驗，不要改成卡片式版面。
- UI 文字維持繁體中文，HTML 語系維持 `zh-Hant`。
- 修改視覺或互動後，優先檢查桌面與手機尺寸下的畫面、拖曳、陀螺儀提示與圖片載入。
- 不要直接修改 `dist/`；`dist/` 應由 `npm run build` 產生。

## Git 與產物

- 目前 `node_modules/` 與 `dist/` 已在 `.gitignore` 中忽略，不應提交。
- 可提交的來源檔包含 `index.html`、`src/`、`vite.config.js`、`package.json`、`package-lock.json`、`.gitignore` 與本檔。
- 建置前後可以用 `git status --short --branch` 確認工作區狀態。

## 刪除限制

禁止批量刪除文件或目錄。

不要使用：
- `del /s`
- `rd /s`
- `rmdir /s`
- `Remove-Item -Recurse`
- `rm -rf`

需要刪除文件時，只能一次刪除一個明確路徑的文件。

如果需要批量刪除文件，應停止操作，並向用戶請求，讓用戶手動刪除。
