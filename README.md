# Nông Vụ AI v19.1 PRO — Groq First

Bản vá cho v19 PRO:
- Groq-first, OpenRouter Free fallback.
- Không bao giờ hiển thị raw model output/chain-of-thought nếu model trả về sai JSON.
- Dữ liệu AI phải là JSON hợp lệ mới được nhận.
- Cài đặt có tùy chọn xóa toàn bộ dữ liệu cloud + máy, hoặc chỉ xóa lịch & khuyến cáo.
- Giữ nguyên D1 `DB`, không chạy lại schema.

Upload đè: `_worker.js`, `app.js`, `wrangler.toml`, `README.md`.
Không tạo D1 mới.
