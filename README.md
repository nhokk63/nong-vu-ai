# Nông Vụ AI v13 — bản upload bằng điện thoại

Bản này được làm phẳng để **GitHub trên điện thoại chỉ cần chọn file**, không phải upload thư mục con.

## Trong repo chỉ cần các file này

- index.html
- app.js
- styles.css
- manifest.json
- sw.js
- knowledge.json
- icon-180.png
- icon-192.png
- icon-512.png
- schema.sql
- _worker.js
- wrangler.toml
- package.json
- .gitignore

## GitHub Pages

Có thể chạy frontend ngay bằng GitHub Pages ở chế độ local-first. Không cần VPS/Termux.

Settings → Pages → Source → Deploy from a branch → main → /(root).

## Cloudflare

`_worker.js` là bản worker gộp để sau này chạy API serverless mà không cần thư mục `functions/`. Gắn D1 binding tên `DB` và secret `OPENAI_API_KEY` khi muốn bật AI cloud.

Frontend vẫn chạy local nếu backend chưa cấu hình.
