# Nông Vụ AI v18 — Free AI + theo dõi tự động 24/7

Bản này giữ giao diện iOS 18 + GitHub Pages/local-first, đồng thời thêm **Cloudflare Worker + D1 + Cron + OpenRouter / Groq + Telegram**; AI mặc định dùng Llama 3.3 70B miễn phí qua OpenRouter và Groq làm fallback. để hệ thống tự theo dõi khi mày không mở app.

## Có gì mới

- Kiểm tra thời tiết theo GPS của từng cây mỗi giờ.
- Cảnh báo mưa/ẩm cao và nhắc công việc sắp đến.
- Nhắc cây quá 4 ngày chưa cập nhật.
- Tổng hợp AI hằng ngày; AI tạo khuyến cáo ở trạng thái `PENDING`, không tự quyết định phun.
- Khi mày Duyệt một khuyến cáo, `nextSteps` được đưa thành nhiều mốc lịch theo số ngày mà AI đề xuất.
- Sau khi ghi nhận Đã làm, lịch sử được lưu để lần tư vấn sau AI đọc lại.
- Telegram gửi cảnh báo/tổng hợp; token không nằm trong frontend.
- CSDL D1 lưu cây, lịch, quan sát, vật tư, khuyến cáo, thời tiết và nhật ký thông báo.
- Không cần VPS, không cần điện thoại chạy 24/7.

## Hai chế độ

### GitHub Pages
Dùng để kiểm tra giao diện, GPS, weather và local-first. `/api/*` không chạy trên GitHub Pages.

### Cloudflare Worker (khuyến nghị để chạy tự động)
Worker phục vụ luôn static assets và API bằng `_worker.js`; cấu hình Cron nằm trong `wrangler.toml`. Cloudflare Workers Cron Triggers gọi `scheduled()` theo lịch; cron dùng UTC. Xem tài liệu chính thức: https://developers.cloudflare.com/workers/configuration/cron-triggers/

## Deploy Worker từ GitHub

1. Tạo D1 database tên `nong-vu-ai-db`.
2. Chạy toàn bộ `schema.sql` trong D1 Console.
3. Lấy `database_id` và thay `REPLACE_WITH_D1_DATABASE_ID` trong `wrangler.toml` (hoặc bind D1 từ dashboard).
4. Kết nối repo GitHub vào Cloudflare Workers Builds/Git integration.
5. Chọn production branch `main`.
6. Dùng Wrangler config này để Worker build với `main = "_worker.js"` và assets ở `.`.
7. Tạo Secrets:
   - `APP_TOKEN` — chuỗi bí mật để app gọi API.
   - `OPENROUTER_API_KEY / GROQ_API_KEY` — API key server-side.
   - `TELEGRAM_BOT_TOKEN` — token bot Telegram.
   - `TELEGRAM_CHAT_ID` — chat id nhận thông báo.
8. Sau deploy, mở URL `*.workers.dev` của Worker. Trong app, có thể để API Base trống nếu frontend được phục vụ cùng Worker.

## Cron

- `0 * * * *` — mỗi giờ: weather, cảnh báo, việc sắp đến, cây cần cập nhật.
- `0 22 * * *` — 05:00 giờ Việt Nam: tổng hợp AI + tạo khuyến cáo PENDING + Telegram digest.

Cloudflare Cron dùng UTC.

## AI và thuốc

Worker gọi OpenRouter / Groq Chat Completions API. AI được yêu cầu chỉ đưa sản phẩm/liều/PHI cụ thể khi `inventory.label_verified=1` và dữ liệu phù hợp với cây/đối tượng. Nếu thiếu dữ liệu, AI phải nói rõ chưa đủ dữ liệu.

Không để `OPENROUTER_API_KEY / GROQ_API_KEY` hoặc Telegram token trong `app.js`, GitHub Pages hay repo công khai.

## Nguồn kiến thức khởi đầu

- Cục Trồng trọt và Bảo vệ thực vật: https://www.ppd.gov.vn/
- WASI: https://wasi.org.vn/
- Khuyến nông Việt Nam: https://khuyennongvn.gov.vn/
- Open-Meteo: https://open-meteo.com/en/docs
