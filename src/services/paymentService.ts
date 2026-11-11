import { supabase } from '../lib/supabase'
import { BookingServiceError } from './bookingService'

export type PaymentMethod = 'vietqr' | 'domestic_card'

export interface ProcessPaymentInput {
  bookingId: string
  paymentMethod: PaymentMethod
  amount: number
  referenceCode: string
}

export interface PaymentRecord {
  id: string
  booking_id: string
  payment_method: PaymentMethod
  amount: number
  reference_code: string
  status: 'paid'
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null) {
    const details = error as { message?: unknown; error?: unknown }
    if (typeof details.message === 'string' && details.message.trim()) return details.message
    if (typeof details.error === 'string' && details.error.trim()) return details.error
  }
  if (typeof error === 'string' && error.trim()) return error
  return 'Đã có lỗi xảy ra'
}

export async function processPayment(input: ProcessPaymentInput): Promise<PaymentRecord> {
  try {
    if (!input.bookingId.trim() || !input.referenceCode.trim()) {
      throw new Error('Thiếu mã đặt vé hoặc mã tham chiếu thanh toán.')
    }
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new Error('Số tiền thanh toán phải lớn hơn 0.')
    }

    const { data, error } = await supabase.rpc('confirm_booking_payment', {
      p_booking_id: input.bookingId,
      p_payment_method: input.paymentMethod,
      p_amount: Math.round(input.amount),
      p_reference_code: input.referenceCode.trim(),
    })

    if (error) throw error
    if (!data) throw new Error('Supabase không trả về yêu cầu thanh toán vừa tạo.')

    return data as PaymentRecord
  } catch (error) {
    throw new BookingServiceError(`Không thể gửi yêu cầu thanh toán: ${errorMessage(error)}`, error)
  }
}
