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

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  try {
    const { bookingId, recipient, bookingCode, subject, html } = await request.json()
    if (
      typeof bookingId !== 'string' ||
      typeof recipient !== 'string' ||
      typeof bookingCode !== 'string' ||
      typeof subject !== 'string' ||
      typeof html !== 'string' ||
      html.length > 200_000
    ) {
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
      'id,booking_code,contact_email,status,payments(status)',
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
    if (
      !booking ||
      booking.booking_code !== bookingCode ||
      booking.contact_email?.toLocaleLowerCase('en') !== recipient.trim().toLocaleLowerCase('en')
    ) {
      return jsonResponse({ error: 'Booking or recipient does not match' }, 404)
    }

    const bookingStatus = String(booking.status).toLocaleLowerCase('en')
    const payments = Array.isArray(booking.payments) ? booking.payments : []
    const paymentStatuses = payments.map((payment: { status: string }) =>
      String(payment.status).toLocaleLowerCase('en'),
    )
    const isPaid = ['paid', 'confirmed', 'completed'].includes(bookingStatus) ||
      paymentStatuses.some((status: string) => ['paid', 'success', 'succeeded', 'completed'].includes(status))
    if (!isPaid) return jsonResponse({ error: 'Booking payment is not confirmed' }, 409)

    const sendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: sender, to: [booking.contact_email], subject, html }),
    })
    const sendResult = await sendResponse.json()
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
    return jsonResponse({ error: message }, 500)
  }
})
