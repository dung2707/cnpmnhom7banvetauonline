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
- `src/components/AuthPage.tsx`, `HomePage.tsx`: màn hình xác thực và điều phối trang chủ sau đăng nhập.
- `src/components/SearchTrainForm.tsx`, `TrainList.tsx`, `SeatMap.tsx`: tìm chuyến, danh sách kết quả và sơ đồ chọn ghế.
- `src/services/bookingService.ts`, `paymentService.ts`: truy vấn đơn hàng, nghiệp vụ đặt/hủy vé, giải phóng ghế và gửi yêu cầu thanh toán.
- `src/components/booking/PassengerForm.tsx`: nhập thông tin hành khách và xác thực loại vé trẻ em/sinh viên.
- `src/utils/format.ts`, `qrCodeGenerator.ts`: định dạng hiển thị và tạo mã QR vé điện tử.
- `src/types/index.ts`: kiểu dữ liệu dùng chung; `src/types/bookingFlow.ts` duy trì đường dẫn tương thích cho luồng đặt vé.

## Sprint 2: trạng thái ghế và giữ chỗ

Trang chọn chỗ đọc ghế từ Supabase theo `carriage_id` (`<mã tàu>_T<số toa>`) và đồng bộ thay đổi bảng `seats` qua Realtime. Ghế được giữ bằng cập nhật có điều kiện `status = 'available'`; mỗi lần giữ tạo một dòng trong `seat_holds` với thời hạn 10 phút. UUID phiên trình duyệt được lưu trong `localStorage` để khôi phục và giải phóng các chỗ do cùng phiên giữ.

Cấu trúc cần có:

- `seats`: `id`, `carriage_id`, `seat_number`, `price`, `status` (`available`, `held`, `booked`).
- `seat_holds`: `id`, `seat_id`, `session_id`, `expires_at`.

Trong Supabase, bật Realtime cho bảng `public.seats` và cấu hình quyền RLS cho các thao tác đọc/cập nhật `seats` cùng đọc/thêm/xóa `seat_holds` mà ứng dụng cần. Việc tự giải phóng hết hạn chạy khi ứng dụng đang mở; để dọn ghế của phiên đã đóng trình duyệt, cần thêm tác vụ hết hạn phía máy chủ.

## Lịch sử đặt vé

Tab `#lich-su` hiển thị các đơn từ `bookings`, kèm `booking_passengers` và `payments`; danh sách tự tải lại khi có thay đổi và có thể làm mới thủ công. Tài khoản thông thường chỉ đọc đơn có `contact_email` khớp email đăng nhập; tài khoản demo `demo@duongsat.vn` xem các đơn mới nhất. Cấu hình quan hệ khóa ngoại giữa các bảng để Supabase hỗ trợ truy vấn lồng nhau. Áp dụng các migration `20261104300000_atomic_booking_cancellation.sql` và `20261104400000_booking_cancellation_time_limit.sql` để hủy đơn và giải phóng ghế trong cùng transaction; chỉ cho phép hủy trong 4 giờ từ lúc tạo đơn và trước giờ khởi hành hơn 4 giờ. Hàm chạy theo quyền RLS của người gọi và cần quyền cập nhật `bookings`, `seats` cùng quyền đọc các bảng liên quan.

Thanh toán VietQR ghi nhận booking và payment thành `paid` trong một transaction thông qua migration `20261104500000_confirm_booking_payment.sql`, rồi hiển thị modal xác nhận với thông tin chuyến, ghế và tổng tiền. Cần cấp quyền RLS cho phép người gọi thực thi cập nhật `bookings` và thêm `payments`. Luồng hiện tại ghi nhận theo thao tác xác nhận của người dùng, không xác minh giao dịch trực tiếp từ ngân hàng.

Sau khi cập nhật thanh toán thành công, ứng dụng gọi Supabase Edge Function `send-ticket-email` ở chế độ nền. Hàm tự đọc thông tin booking/hành khách, gửi email HTML qua Resend tới địa chỉ email hành khách, rồi đánh dấu `bookings.email_sent`; lỗi gửi được ghi vào log của Edge Function và không ảnh hưởng popup thanh toán. Cấu hình secrets `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (địa chỉ gửi đã xác thực trên Resend), `SUPABASE_URL` và `SUPABASE_SERVICE_ROLE_KEY` cho Edge Function; áp dụng migration `20261104100000_booking_email_sent.sql` trước khi triển khai.

## Nối backend thật

Thay phần triển khai trong `authService.ts` bằng request tới API đăng ký/đăng nhập, rồi giữ nguyên các hàm `signIn` và `signUp` của context. Mock hiện chỉ giữ tài khoản đăng ký trong bộ nhớ của tab và không phù hợp để lưu mật khẩu thật; session đăng nhập được giữ qua `localStorage` để tiện thử giao diện.