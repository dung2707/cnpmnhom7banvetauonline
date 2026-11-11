import { supabase } from '../lib/supabase'

export interface SendTicketEmailInput {
  bookingId: string
}

export async function sendTicketEmail({ bookingId }: SendTicketEmailInput): Promise<void> {
  if (!bookingId.trim()) throw new Error('Thiếu mã đơn hàng để gửi email vé.')

  const { data, error } = await supabase.functions.invoke('send-ticket-email', {
    body: { bookingId },
  })

  if (error) throw new Error(`Không thể gửi email vé: ${error.message}`)
  if (!data?.emailSent) throw new Error('Dịch vụ email chưa xác nhận gửi thư thành công.')
}
