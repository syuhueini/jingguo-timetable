# 桃園市立經國國民中學課表查詢系統

依 `littleyi22/timetable-demo` 的靜態前端架構製作：`index.html` + `style.css` + `app.js` + `config.js`，課表資料使用 `timetable_1151.csv`，導師資料使用 `homerooms_1151.json`。

## 本次資料
- 學校：桃園市立經國國民中學
- 學期：115學年度第1學期
- 實施日期：115.08.31 ～ 116.01.20
- 班級：701–710、801–810、901–909，共 29 班
- 每班：40 節
- CSV：79 位教師資料列

## 本機預覽
```bash
python -m http.server 8000
```
開啟 `http://localhost:8000/`，也可直接使用「訪客登入」。

## GitHub Pages
將此資料夾內容放入 GitHub repository，Settings → Pages → Source 選 `GitHub Actions`。專案內的 `.github/workflows/pages.yml` 會在 push 後自動部署。

## Firebase Hosting
若要使用 Firebase Hosting：
```bash
npx -y firebase-tools@latest login
npx -y firebase-tools@latest init hosting
npx -y firebase-tools@latest deploy
```
這個網站是純靜態前端，不需要 Firebase Database 或 Authentication。
