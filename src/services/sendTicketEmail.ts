import { supabase } from '../lib/supabase'

interface TicketEmailPassenger {
  id: string
  full_name: string
  phone: string
  email: string
  carriage_number: number
  seat_number: number
  passenger_type: string
  date_of_birth: string | null
  student_id: string | null
  school_name: string | null
}

interface TicketEmailBooking {
  id: string
  booking_code: string
  trip_code: string
  trip_date: string
  departure_time: string | null
  origin: string
  destination: string
  contact_email: string
  status: string
  booking_passengers: TicketEmailPassenger[]
  payments: { status: string }[]
}

export interface SendTicketEmailInput {
  bookingId: string
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] ?? character)
}

function formatDeparture(value: string | null, tripDate: string) {
  const parsedDate = value
    ? new Date(value)
    : new Date(`${tripDate.slice(0, 10)}T12:00:00`)
  return Number.isNaN(parsedDate.getTime())
    ? escapeHtml(tripDate)
    : new Intl.DateTimeFormat('vi-VN', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Ho_Chi_Minh',
    }).format(parsedDate)
}

function formatDateOfBirth(value: string | null) {
  if (!value) return 'Chưa cập nhật'
  const [year, month, day] = value.slice(0, 10).split('-')
  return year && month && day ? `${day}/${month}/${year}` : value
}

function getTicketTypeLabel(passenger: TicketEmailPassenger) {
  switch (passenger.passenger_type) {
    case 'child':
      return `Trẻ em - NS: ${formatDateOfBirth(passenger.date_of_birth)}`
    case 'student':
      return `Sinh viên - MSSV: ${passenger.student_id || 'Chưa cập nhật'}`
    case 'senior':
      return 'Người cao tuổi'
    default:
      return 'Người lớn'
  }
}

function createEmailHtml(booking: TicketEmailBooking, qrImages: string[]) {
  const passengerRows = booking.booking_passengers.map((passenger, index) => `
    <tr>
      <td style="padding:12px;border-bottom:1px solid #e2e8f0">${escapeHtml(passenger.full_name)}<br><span style="color:#64748b">${escapeHtml(passenger.phone)} · ${escapeHtml(passenger.email)}</span><br><span style="color:#334155">Loại vé: ${escapeHtml(getTicketTypeLabel(passenger))}</span>${passenger.school_name ? `<br><span style="color:#64748b">${escapeHtml(passenger.school_name)}</span>` : ''}</td>
      <td style="padding:12px;border-bottom:1px solid #e2e8f0">${escapeHtml(booking.trip_code)}</td>
      <td style="padding:12px;border-bottom:1px solid #e2e8f0">Toa ${passenger.carriage_number}<br>Ghế ${passenger.seat_number}</td>
      <td style="padding:12px;border-bottom:1px solid #e2e8f0;text-align:center"><img src="${qrImages[index]}" width="112" height="112" alt="Mã QR vé ${escapeHtml(booking.booking_code)} ghế ${passenger.seat_number}" style="display:block;margin:auto"><span style="font-size:11px;color:#64748b">Quét mã khi vào ga</span></td>
    </tr>
  `).join('')

  return `
    <!doctype html>
    <html lang="vi">
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
      <body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
        <div style="max-width:720px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden">
          <div style="padding:26px 32px;background:#065f46;color:#fff">
            <p style="margin:0 0 8px;font-size:13px;letter-spacing:2px">VIETRAIL</p>
            <h1 style="margin:0;font-size:24px">Xác nhận đặt vé thành công</h1>
            <p style="margin:12px 0 0;color:#d1fae5">Mã đơn hàng <strong>${escapeHtml(booking.booking_code)}</strong></p>
          </div>
          <div style="padding:28px 32px">
            <h2 style="margin:0 0 16px;font-size:18px">Thông tin chuyến đi</h2>
            <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px">
              <tr><td style="padding:10px 0;color:#64748b">Chặng đi</td><td style="padding:10px 0;font-weight:bold">${escapeHtml(booking.origin)} → ${escapeHtml(booking.destination)}</td></tr>
              <tr><td style="padding:10px 0;color:#64748b">Ngày giờ</td><td style="padding:10px 0;font-weight:bold">${formatDeparture(booking.departure_time, booking.trip_date)}</td></tr>
              <tr><td style="padding:10px 0;color:#64748b">Số hiệu tàu</td><td style="padding:10px 0;font-weight:bold">${escapeHtml(booking.trip_code)}</td></tr>
            </table>
            <h2 style="margin:24px 0 12px;font-size:18px">Hành khách và vé điện tử</h2>
            <table role="presentation" style="width:100%;border-collapse:collapse;font-size:13px">
              <thead><tr style="background:#f8fafc;text-align:left"><th style="padding:10px">Hành khách</th><th style="padding:10px">Tàu</th><th style="padding:10px">Chỗ ngồi</th><th style="padding:10px;text-align:center">Mã QR</th></tr></thead>
              <tbody>${passengerRows}</tbody>
            </table>
              ${booking.booking_passengers.some((passenger) => ['child', 'student'].includes(passenger.passenger_type)) ? `
                <p style="margin:16px 0 0;padding:14px;border:1px solid #fecaca;border-radius:10px;background:#fef2f2;color:#b91c1c;font-size:13px;font-weight:bold">
                  ⚠️ Vé ưu tiên chỉ có giá trị khi đi kèm Giấy khai sinh (Trẻ em) hoặc Thẻ Sinh viên hợp lệ tại cửa soát vé.
                </p>
              ` : ''}
              <p style="margin:24px 0 0;padding:16px;border-radius:10px;background:#ecfdf5;color:#065f46;font-size:14px">
              Vui lòng có mặt tại ga trước giờ khởi hành 30 phút.
            </p>
          </div>
          <div style="padding:18px 32px;background:#f8fafc;color:#64748b;font-size:12px">Email tự động từ VietRail. Vui lòng không trả lời email này.</div>
        </div>
      </body>
    </html>
  `
}

export async function sendTicketEmail({ bookingId }: SendTicketEmailInput): Promise<void> {
  if (!bookingId.trim()) throw new Error('Thiếu mã đơn hàng để gửi email vé.')

  const { data, error } = await supabase
    .from('bookings')
    .select(`
      id,
      booking_code,
      trip_code,
      trip_date,
      departure_time,
      origin,
      destination,
      contact_email,
      status,
      booking_passengers (
        id,
        full_name,
        phone,
        email,
        carriage_number,
        seat_number,
        passenger_type,
        date_of_birth,
        student_id,
        school_name
      ),
      payments (
        status
      )
    `)
    .eq('id', bookingId)
    .maybeSingle()

  if (error) throw new Error(`Không thể tải thông tin gửi vé: ${error.message}`)
  if (!data) throw new Error('Không tìm thấy đơn hàng để gửi email.')

  const booking = data as TicketEmailBooking
  const bookingStatus = booking.status.toLocaleLowerCase('en')
  const paidPaymentStatuses = booking.payments.map((payment) => payment.status.toLocaleLowerCase('en'))
  const isPaid = ['paid', 'confirmed', 'completed'].includes(bookingStatus) ||
    paidPaymentStatuses.some((status) => ['paid', 'success', 'succeeded', 'completed'].includes(status))
  if (!isPaid) throw new Error('Vé chỉ có thể gửi sau khi thanh toán được xác nhận thành công.')
  if (!booking.contact_email || booking.booking_passengers.length === 0) {
    throw new Error('Đơn hàng thiếu email liên hệ hoặc thông tin hành khách.')
  }

  const { default: QRCode } = await import('qrcode')
  const qrImages = await Promise.all(booking.booking_passengers.map((passenger) =>
    QRCode.toDataURL(JSON.stringify({
      bookingId: booking.id,
      passengerName: passenger.full_name,
      seatNumber: passenger.seat_number,
      trainNo: booking.trip_code,
    }), { errorCorrectionLevel: 'M', margin: 1, width: 224 }),
  ))
  const subject = `[VietRail] Xác nhận đặt vé thành công - Mã đơn hàng #${booking.booking_code}`
  const html = createEmailHtml(booking, qrImages)
  const { data: result, error: functionError } = await supabase.functions.invoke('send-ticket-email', {
    body: {
      bookingId: booking.id,
      recipient: booking.contact_email,
      bookingCode: booking.booking_code,
      subject,
      html,
    },
  })

  if (functionError) {
    throw new Error(`Không thể gửi email vé: ${functionError.message}`)
  }
  if (!result?.emailSent) {
    throw new Error('Dịch vụ email chưa xác nhận gửi thư thành công.')
  }
}
