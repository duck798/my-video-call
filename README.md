# Ứng Dụng Video Call 1-1 Nâng Cao (WebRTC)

Ứng dụng gọi video trực tiếp trên nền web với giao diện hiện đại (Glassmorphism), hỗ trợ kết nối P2P tức thì thông qua ID và tích hợp AI nhận diện khuôn mặt.

## Tính năng nổi bật

1. **Khử tiếng ồn môi trường**: Tích hợp luồng WebRTC được cấu hình `noiseSuppression` và `echoCancellation` giúp triệt tiêu tiếng quạt, gió và tiếng ồn nền (Noise Cancelling).
2. **Gọi ngang hàng (Peer-to-Peer)**: Giao tiếp qua `PeerJS` bảo mật tuyệt đối, hình ảnh và âm thanh không lưu qua máy chủ.
3. **Hiệu ứng AI trực tiếp (Face AR)**:
   - Sử dụng `face-api.js` nhận diện khuôn mặt theo thời gian thực (Realtime Face Tracking).
   - Hiệu ứng gắn kính râm (Sunglasses).
   - Hiệu ứng làm mờ/che khuôn mặt (Privacy Blur).
4. **Quản lý thiết bị**: Tuỳ ý bật / tắt Camera và Microphone nhanh chóng.
5. **Giao diện Premium**: Thiết kế tinh tế với Dark mode, hiệu ứng mờ kính (Glassmorphism), đáp ứng hoàn hảo trên cả Mobile và Desktop.

## Hướng dẫn đưa lên GitHub và chạy (Dành cho bạn)

Vì đây là ứng dụng hoàn toàn tĩnh (Static HTML/CSS/JS), bạn có thể đưa lên GitHub và host miễn phí thông qua **GitHub Pages** cực kỳ dễ dàng:

1. **Tạo Repository**:
   - Truy cập GitHub, tạo một Repository mới (ví dụ: `web-video-call`).
2. **Push mã nguồn**:
   - Mở Terminal ở thư mục dự án này và gõ:
     ```bash
     git init
     git add .
     git commit -m "Khởi tạo ứng dụng video call"
     git branch -M main
     git remote add origin https://github.com/TênTàiKhoảnCủaBạn/web-video-call.git
     git push -u origin main
     ```
3. **Bật GitHub Pages**:
   - Truy cập trang Repository của bạn trên GitHub -> **Settings** -> **Pages**.
   - Mục *Branch*, chọn `main` và ấn **Save**. 
   - Đợi vài phút, bạn sẽ có ngay 1 đường link online (ví dụ: `https://username.github.io/web-video-call`) để gửi cho bạn bè gọi thử!

## Kiến trúc mã nguồn
- `index.html`: Khung sườn giao diện.
- `style.css`: Hệ thống phong cách UI cao cấp.
- `script.js`: Toàn bộ Logic luồng Media, Signaling và AI Tracking.

*Lưu ý: Để tính năng Gọi Video (WebRTC) hoạt động trên web, URL trang web bắt buộc phải chạy qua `https://` hoặc ở môi trường `localhost`.*
