# CLAUDE.md

本檔提供 Claude Code 在此專案中工作所需的指引。內容根據現有原始碼整理，請保持格式統一清晰。

---

## 1. 專案概覽

- **專案名稱**：`vr2-campus-panorama`（`package.json` 中定義）。
- **專案類型**：360 度互動式全景場景前端，使用全螢幕 WebGL 提供沉浸式體驗。
- **場景主題**：雨後校園金針花（萱草花）360 度全景，含可互動的花朵熱點與解說對話。
- **語系**：UI 文字全程使用繁體中文，HTML 語系固定為 `zh-Hant`。

---

## 2. 技術棧

- **建置工具**：Vite `^7.2.7`（dev 依賴）。
- **3D 函式庫**：Three.js `^3` 系列，版本 `^0.180.0`。
- **語言**：原生 JavaScript（ES Modules），**不使用** React、Vue 或 Svelte。
- **模組型態**：`package.json` 設定 `"type": "module"`。

---

## 3. 專案結構

| 路徑 | 說明 |
| --- | --- |
| `index.html` | 繁體中文 HTML 入口，包含全螢幕 canvas、準星、陀螺儀按鈕、互動提示、對話覆蓋層與底部 HUD。 |
| `src/main.js` | 核心程式：Three.js 場景、全景貼圖載入、滑鼠/觸控拖曳、手機陀螺儀 fallback、熱點偵測與對話系統。 |
| `src/styles.css` | 全螢幕沉浸式 UI 樣式，含安全區（safe-area）、HUD、對話面板與手機版 RWD。 |
| `src/assets/panorama.png` | 2:1 等距圓柱投影（equirectangular）全景背景圖。 |
| `vite.config.js` | Vite dev/preview 的 host 設定（`0.0.0.0`）。 |
| `package.json` | npm 指令與依賴定義。 |
| `AGENTS.md` | 代理指引文件，內容與本檔互補。 |
| `dist/` | 建置產物，由 `npm run build` 自動產生，**不應手動修改**。 |
| `node_modules/` | 套件目錄，已被 `.gitignore` 忽略。 |

---

## 4. 開發指令

| 動作 | 指令 |
| --- | --- |
| 安裝依賴 | `npm install` |
| 啟動開發伺服器 | `npm run dev`（等同 `vite --host 0.0.0.0`） |
| 建置正式版 | `npm run build`（等同 `vite build`） |
| 預覽建置結果 | `npm run preview`（等同 `vite preview --host 0.0.0.0`） |

> dev 與 preview 皆綁定 `0.0.0.0`，方便以區域網路用手機測試陀螺儀與觸控。

---

## 5. 核心架構與功能（`src/main.js`）

- **場景組成**：`PerspectiveCamera`（FOV 72）、`WebGLRenderer`（antialias、`high-performance`）、大型 `SphereGeometry(500, 96, 64)`。
- **全景渲染**：全景貼圖貼在球體內側，材質 `MeshBasicMaterial` 使用 `THREE.BackSide`，相機置於球心向外觀看。
- **貼圖載入**：以 `THREE.TextureLoader` 載入，設定 `colorSpace = SRGBColorSpace`、`wrapS = RepeatWrapping`、`wrapT = ClampToEdgeWrapping`、`anisotropy = min(maxAnisotropy, 8)`；載入失敗會在 HUD 顯示中文錯誤訊息。
- **視角控制**：
  - **桌面/觸控拖曳**：以 `lon`/`lat` 經緯度更新相機朝向，`lat` 限制在 ±82 度，滾輪縮放 FOV 範圍 46–82。
  - **手機陀螺儀**：`enableGyro()` 透過 `DeviceOrientationEvent` 取得姿態，含 iOS 權限請求、1.8 秒逾時 fallback；拖曳時會自動停用陀螺儀。
- **熱點互動**：`flowerHotspots` 以經緯度與半徑定義；每幀計算相機朝向與各熱點夾角，找出最近熱點並顯示互動提示（桌面顯示 `F` 鍵、觸控裝置顯示點擊提示）。
- **對話系統**：觸發後開啟對話覆蓋層，逐句顯示 `flowerDialogueLines`；支援 `F`/`Enter`/`Space` 進入下一句、`Escape` 關閉。
- **渲染迴圈**：`animate()` 以 `requestAnimationFrame` 驅動，對話開啟時暫停視角更新。
- **DOM 查詢**：集中放在 `src/main.js` 最上方，便於維護。

---

## 6. 實作規範

- JavaScript 一律使用 **ES Modules**、**2 空格縮排**、**雙引號**與**分號**。
- 全景圖片需透過 `new URL("./assets/panorama.png", import.meta.url).href` 載入，不要寫死字串路徑。
- 載入全景貼圖時務必保留第 5 節所列的 texture 設定（colorSpace / wrap / anisotropy）。
- 維持**全螢幕 WebGL 沉浸式**體驗，**不要**改成卡片式或分欄版面。
- UI 文字維持**繁體中文**，HTML 語系維持 `zh-Hant`。
- 修改視覺或互動後，優先在**桌面與手機尺寸**下檢查：畫面渲染、拖曳、陀螺儀提示、熱點互動與圖片載入。
- **不要直接修改 `dist/`**；產物一律由 `npm run build` 重新產生。

---

## 7. Git 與產物

- `.gitignore` 已忽略：`node_modules/`、`dist/`、`.DS_Store`，這些不應提交。
- 可提交的來源檔：`index.html`、`src/`、`vite.config.js`、`package.json`、`package-lock.json`、`.gitignore`、`AGENTS.md` 與本檔 `CLAUDE.md`。
- 建置前後可用 `git status --short --branch` 確認工作區狀態。

---

## 8. 檔案刪除限制（重要）

**禁止批量刪除文件或目錄。**

不要使用以下指令：

- `del /s`
- `rd /s`
- `rmdir /s`
- `Remove-Item -Recurse`
- `rm -rf`

需要刪除文件時，**只能一次刪除一個明確路徑的文件**。

如果需要批量刪除文件，**應停止操作，並向用戶請求，讓用戶手動刪除**。
