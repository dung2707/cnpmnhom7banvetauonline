const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
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

interface EmailPassenger {
  full_name: string
  phone: string
  email: string
  carriage_number: number
  seat_number: number
}

interface EmailBooking {
  booking_code: string
  trip_code: string
  trip_date: string
  departure_time: string | null
  origin: string
  destination: string
  total_amount: number
  booking_passengers: EmailPassenger[]
}

function createEmailHtml(booking: EmailBooking) {
  const passengers = Array.isArray(booking.booking_passengers) ? booking.booking_passengers : []
  const passengerRows = passengers.map((passenger) => `
    <tr>
      <td style="padding:12px;border-bottom:1px solid #e2e8f0">
        <strong>${escapeHtml(passenger.full_name)}</strong><br>
        <span style="color:#64748b">${escapeHtml(passenger.phone)} · ${escapeHtml(passenger.email)}</span>
      </td>
      <td style="padding:12px;border-bottom:1px solid #e2e8f0">Toa ${escapeHtml(passenger.carriage_number)}</td>
      <td style="padding:12px;border-bottom:1px solid #e2e8f0">Ghế ${escapeHtml(passenger.seat_number)}</td>
    </tr>
  `).join('')

  return `<!doctype html>
    <html lang="vi">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <style>
          @media only screen and (max-width:600px) {
            .email-container { width:100% !important; margin:0 !important; border-radius:0 !important; }
            .email-content { padding:20px !important; }
            .ticket-table th,.ticket-table td { padding:8px 5px !important; font-size:12px !important; }
          }
        </style>
      </head>
      <body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
        <div class="email-container" style="max-width:680px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden">
          <div style="padding:26px 32px;background:#065f46;color:#fff">
            <p style="margin:0 0 8px;font-size:13px;font-weight:bold;letter-spacing:2px">VIETRAIL</p>
            <h1 style="margin:0;font-size:24px">Cảm ơn bạn đã đặt vé!</h1>
            <p style="margin:12px 0 0;color:#d1fae5">Mã đặt vé <strong>${escapeHtml(booking.booking_code)}</strong></p>
          </div>
          <div class="email-content" style="padding:28px 32px">
            <h2 style="margin:0 0 16px;font-size:18px">Thông tin chuyến đi</h2>
            <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px">
              <tr><td style="padding:10px 0;color:#64748b">Mã chuyến tàu</td><td style="padding:10px 0;font-weight:bold">${escapeHtml(booking.trip_code)}</td></tr>
              <tr><td style="padding:10px 0;color:#64748b">Hành trình</td><td style="padding:10px 0;font-weight:bold">${escapeHtml(booking.origin)} → ${escapeHtml(booking.destination)}</td></tr>
              <tr><td style="padding:10px 0;color:#64748b">Ngày giờ khởi hành</td><td style="padding:10px 0;font-weight:bold">${formatDeparture(booking.departure_time, booking.trip_date)}</td></tr>
              <tr><td style="padding:10px 0;color:#64748b">Tổng tiền đã thanh toán</td><td style="padding:10px 0;font-size:18px;font-weight:bold;color:#047857">${new Intl.NumberFormat('vi-VN').format(Number(booking.total_amount))} đ</td></tr>
            </table>
            <h2 style="margin:24px 0 12px;font-size:18px">Hành khách và chỗ ngồi</h2>
            <div style="overflow-x:auto">
              <table class="ticket-table" role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;text-align:left">
                <thead><tr style="background:#f8fafc"><th style="padding:10px">Hành khách</th><th style="padding:10px">Toa</th><th style="padding:10px">Ghế</th></tr></thead>
                <tbody>${passengerRows}</tbody>
              </table>
            </div>
            <p style="margin:24px 0 0;padding:16px;border-radius:10px;background:#ecfdf5;color:#065f46;font-size:14px;line-height:1.6">
              Vui lòng mang theo CCCD/giấy tờ tùy thân hợp lệ và có mặt tại ga trước giờ khởi hành 30 phút.
            </p>
          </div>
          <div style="padding:18px 32px;background:#f8fafc;color:#64748b;font-size:12px">Email tự động từ VietRail. Vui lòng không trả lời email này.</div>
        </div>
      </body>
    </html>`
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  try {
    const { bookingId } = await request.json()
    if (typeof bookingId !== 'string' || !/^[0-9a-f-]{36}$/i.test(bookingId)) {
      return jsonResponse({ error: 'Invalid ticket email request' }, 400)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const sender = Deno.env.get('RESEND_FROM_EMAIL')
    if (!supabaseUrl || !serviceRoleKey || !resendApiKey || !sender) {
      throw new Error('Email function is missing required server configuration.')
    }

    const bookingUrl = new URL('/rest/v1/bookings', supabaseUrl)
    bookingUrl.searchParams.set(
      'select',
      'id,booking_code,trip_code,trip_date,departure_time,origin,destination,total_amount,email_sent,status,payments(status),booking_passengers(full_name,phone,email,carriage_number,seat_number)',
    )
    bookingUrl.searchParams.set('id', `eq.${bookingId}`)
    const bookingResponse = await fetch(bookingUrl, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    })
    if (!bookingResponse.ok) throw new Error('Unable to verify booking before sending email.')

    const bookings = await bookingResponse.json()
    const booking = bookings[0]
    if (!booking) return jsonResponse({ error: 'Booking not found' }, 404)
    if (booking.email_sent) return jsonResponse({ emailSent: true, alreadySent: true })

    const bookingStatus = String(booking.status).toLocaleLowerCase('en')
    const payments = Array.isArray(booking.payments) ? booking.payments : []
    const paymentStatuses = payments.map((payment: { status: string }) =>
      String(payment.status).toLocaleLowerCase('en'),
    )
    const isPaid = ['paid', 'confirmed', 'completed'].includes(bookingStatus) ||
      paymentStatuses.some((status: string) => ['paid', 'success', 'succeeded', 'completed'].includes(status))
    if (!isPaid) throw new Error('Booking payment is not confirmed.')

    const passengers: EmailPassenger[] = Array.isArray(booking.booking_passengers)
      ? booking.booking_passengers
      : []
    const recipients = [...new Set(
      passengers
        .map((passenger: { email?: unknown }) =>
          typeof passenger.email === 'string' ? passenger.email.trim() : '',
        )
        .filter((email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)),
    )]
    if (recipients.length === 0) {
      throw new Error('Booking has no valid passenger email addresses.')
    }

    const bookingPassengers: EmailPassenger[] = Array.isArray(booking.booking_passengers)
      ? booking.booking_passengers
      : []
    if (bookingPassengers.length === 0) throw new Error('Booking has no passenger details.')

    const emailBooking = booking as EmailBooking
    const sendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: sender,
        to: [recipients[0]],
        ...(recipients.length > 1 ? { bcc: recipients.slice(1) } : {}),
        subject: `[VietRail] Xác nhận đặt vé thành công - Mã đơn ${booking.booking_code}`,
        html: createEmailHtml(emailBooking),
      }),
    })
    const sendResult: { id?: string; message?: string } = await sendResponse.json()
    if (!sendResponse.ok) {
      throw new Error(typeof sendResult.message === 'string' ? sendResult.message : 'Resend rejected the email.')
    }

    const updateUrl = new URL('/rest/v1/bookings', supabaseUrl)
    updateUrl.searchParams.set('id', `eq.${bookingId}`)
    const updateResponse = await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ email_sent: true }),
    })
    if (!updateResponse.ok) {
      throw new Error('Email was sent, but the booking email_sent flag could not be updated.')
    }

    return jsonResponse({ emailSent: true, emailId: sendResult.id })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected email service error.'
    console.error('send-ticket-email failed:', message)
    return jsonResponse({ error: message }, 500)
  }
})
