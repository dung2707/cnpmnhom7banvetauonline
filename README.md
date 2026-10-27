# Module tài khoản Đường sắt Việt

## Chạy thử

Yêu cầu Node.js 20 trở lên.

```bash
npm install
npm run dev
```

Mở URL Vite hiển thị trong terminal. Build production bằng `npm run build`.

Tài khoản demo: `demo@duongsat.vn` / `Tau123456`.

## Cấu trúc

- `src/auth/validation.ts`: kiểm tra email, trường bắt buộc và mật khẩu xác nhận.
- `src/auth/authService.ts`: mock đăng ký/đăng nhập, dữ liệu tài khoản trong bộ nhớ và delay 500 ms.
- `src/auth/AuthContext.tsx`: context phiên đăng nhập; token và user được lưu trong `localStorage`.
- `src/components/LoginForm.tsx`, `RegisterForm.tsx`: form và trạng thái phản hồi.
- `src/components/PasswordField.tsx`: trường mật khẩu có nút hiện/ẩn.
- `src/components/AuthPage.tsx`, `HomePage.tsx`: màn hình xác thực và trang chủ sau đăng nhập.

## Sprint 2: trạng thái ghế và giữ chỗ

Trang chọn chỗ đọc ghế từ Supabase theo `carriage_id` (`<mã tàu>_T<số toa>`) và đồng bộ thay đổi bảng `seats` qua Realtime. Ghế được giữ bằng cập nhật có điều kiện `status = 'available'`; mỗi lần giữ tạo một dòng trong `seat_holds` với thời hạn 10 phút. UUID phiên trình duyệt được lưu trong `localStorage` để khôi phục và giải phóng các chỗ do cùng phiên giữ.

Cấu trúc cần có:

- `seats`: `id`, `carriage_id`, `seat_number`, `price`, `status` (`available`, `held`, `booked`).
- `seat_holds`: `id`, `seat_id`, `session_id`, `expires_at`.

Trong Supabase, bật Realtime cho bảng `public.seats` và cấu hình quyền RLS cho các thao tác đọc/cập nhật `seats` cùng đọc/thêm/xóa `seat_holds` mà ứng dụng cần. Việc tự giải phóng hết hạn chạy khi ứng dụng đang mở; để dọn ghế của phiên đã đóng trình duyệt, cần thêm tác vụ hết hạn phía máy chủ.

## Lịch sử đặt vé

Tab `#lich-su` hiển thị các đơn từ `bookings`, kèm `booking_passengers` và `payments`. Tài khoản thông thường chỉ đọc đơn có `contact_email` khớp email đăng nhập; tài khoản demo `demo@duongsat.vn` xem các đơn mới nhất. Cấu hình quan hệ khóa ngoại giữa các bảng để Supabase hỗ trợ truy vấn lồng nhau, đồng thời cho phép đọc các đơn liên quan và cập nhật `bookings.status` theo chính sách RLS. Hủy vé đặt trạng thái `cancelled`.

## Nối backend thật

Thay phần triển khai trong `authService.ts` bằng request tới API đăng ký/đăng nhập, rồi giữ nguyên các hàm `signIn` và `signUp` của context. Mock hiện chỉ giữ tài khoản đăng ký trong bộ nhớ của tab và không phù hợp để lưu mật khẩu thật; session đăng nhập được giữ qua `localStorage` để tiện thử giao diện.