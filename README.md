# Nông Vụ AI v20 PRO — Groq + Telegram approval

- Groq là AI text chính; OpenRouter free là fallback.
- AI có thể chờ lâu hơn để tăng tỷ lệ hoàn thành, không còn timeout 10–12 giây.
- Mỗi ngày Worker chạy AI tổng hợp, lưu khuyến cáo PENDING và gửi Telegram nút DUYỆT/TỪ CHỐI khi đã cấu hình bot.
- Telegram được poll mỗi 5 phút bằng Cron Trigger; không cần webhook.
- Duyệt từ Telegram sẽ tạo các mốc lịch trong D1. Từ chối sẽ xóa khuyến cáo.
- Có xóa toàn bộ dữ liệu, xóa lịch/khuyến cáo, xóa từng cây/vật tư.
- Không chạy lại schema.sql. Giữ nguyên D1 + DB binding hiện tại.

Secrets cần có:
- GROQ_API_KEY
- OPENROUTER_API_KEY
- TELEGRAM_BOT_TOKEN
- TELEGRAM_CHAT_ID
