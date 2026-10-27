import { supabase } from '../lib/supabase'
import type { PassengerDetails, PassengerType } from '../components/booking/PassengerForm'

export interface CreateBookingInput {
  bookingCode: string
  tripId: string
  tripCode: string
  tripDate: string
  origin: string
  destination: string
  contactEmail: string
  totalAmount: number
}

export interface BookingRecord {
  id: string
  booking_code: string
  status: string
  total_amount: number
}

export interface BookingPassengerInput extends PassengerDetails {
  carNumber: number
  seatNumber: number
  baseFare: number
}

export interface SavedPassengerRecord {
  id: string
  booking_id: string
  seat_id: string
  full_name: string
  phone: string
  email: string
  passenger_type: PassengerType
  base_fare: number
  discount_rate: number
  final_fare: number
}

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
  status: 'pending_verification'
}

export class BookingServiceError extends Error {
  readonly originalError: unknown

  constructor(message: string, originalError: unknown) {
    super(message)
    this.name = 'BookingServiceError'
    this.originalError = originalError
  }
}

const discountRates: Record<PassengerType, number> = {
  adult: 0,
  child: 0.25,
  student: 0.1,
  senior: 0.15,
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export async function createBooking(input: CreateBookingInput): Promise<BookingRecord> {
  try {
    if (!input.bookingCode.trim() || !input.tripId.trim() || !input.tripCode.trim()) {
      throw new Error('Mã đặt vé và thông tin chuyến tàu là bắt buộc.')
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.tripDate)) {
      throw new Error('Ngày khởi hành không đúng định dạng YYYY-MM-DD.')
    }
    if (!Number.isFinite(input.totalAmount) || input.totalAmount <= 0) {
      throw new Error('Tổng tiền đặt vé phải lớn hơn 0.')
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.contactEmail.trim())) {
      throw new Error('Email liên hệ không hợp lệ.')
    }

    const { data, error } = await supabase
      .from('bookings')
      .insert({
        booking_code: input.bookingCode.trim(),
        trip_id: input.tripId,
        trip_code: input.tripCode.trim(),
        trip_date: input.tripDate,
        origin: input.origin.trim(),
        destination: input.destination.trim(),
        contact_email: input.contactEmail.trim(),
        total_amount: Math.round(input.totalAmount),
        status: 'pending_payment',
      })
      .select('id, booking_code, status, total_amount')
      .single()

    if (error) throw error
    if (!data) throw new Error('Supabase không trả về thông tin đặt vé vừa tạo.')

    return data
  } catch (error) {
    throw new BookingServiceError(`Không thể tạo đặt vé: ${errorMessage(error)}`, error)
  }
}

export async function savePassengers(
  bookingId: string,
  passengers: BookingPassengerInput[],
): Promise<SavedPassengerRecord[]> {
  try {
    if (!bookingId.trim()) throw new Error('Thiếu mã đặt vé.')
    if (passengers.length === 0) throw new Error('Đặt vé phải có ít nhất một hành khách.')

    const passengerRows = passengers.map((passenger) => {
      if (!passenger.seatId.trim() || !passenger.fullName.trim()) {
        throw new Error('Mỗi hành khách cần có ghế và họ tên hợp lệ.')
      }
      if (!/^0(?:3|5|7|8|9)\d{8}$/.test(passenger.phone.trim())) {
        throw new Error(`Số điện thoại của ${passenger.fullName} không hợp lệ.`)
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(passenger.email.trim())) {
        throw new Error(`Email của ${passenger.fullName} không hợp lệ.`)
      }
      if (!Number.isFinite(passenger.baseFare) || passenger.baseFare <= 0) {
        throw new Error(`Giá vé của ghế ${passenger.seatNumber} không hợp lệ.`)
      }

      const discountRate = discountRates[passenger.type]
      const baseFare = Math.round(passenger.baseFare)
      return {
        booking_id: bookingId,
        seat_id: passenger.seatId,
        carriage_number: passenger.carNumber,
        seat_number: passenger.seatNumber,
        full_name: passenger.fullName.trim(),
        phone: passenger.phone.trim(),
        email: passenger.email.trim(),
        passenger_type: passenger.type,
        base_fare: baseFare,
        discount_rate: discountRate,
        final_fare: baseFare - Math.round(baseFare * discountRate),
      }
    })

    const { data, error } = await supabase
      .from('booking_passengers')
      .insert(passengerRows)
      .select('id, booking_id, seat_id, full_name, phone, email, passenger_type, base_fare, discount_rate, final_fare')

    if (error) throw error
    if (!data || data.length !== passengerRows.length) {
      throw new Error('Số hành khách được lưu không khớp với số hành khách đã gửi.')
    }

    return data
  } catch (error) {
    throw new BookingServiceError(`Không thể lưu thông tin hành khách: ${errorMessage(error)}`, error)
  }
}

export async function processPayment(input: ProcessPaymentInput): Promise<PaymentRecord> {
  try {
    if (!input.bookingId.trim() || !input.referenceCode.trim()) {
      throw new Error('Thiếu mã đặt vé hoặc mã tham chiếu thanh toán.')
    }
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new Error('Số tiền thanh toán phải lớn hơn 0.')
    }

    const { data, error } = await supabase
      .from('payments')
      .insert({
        booking_id: input.bookingId,
        payment_method: input.paymentMethod,
        amount: Math.round(input.amount),
        reference_code: input.referenceCode.trim(),
        status: 'pending_verification',
      })
      .select('id, booking_id, payment_method, amount, reference_code, status')
      .single()

    if (error) throw error
    if (!data) throw new Error('Supabase không trả về yêu cầu thanh toán vừa tạo.')

    return data
  } catch (error) {
    throw new BookingServiceError(`Không thể gửi yêu cầu thanh toán: ${errorMessage(error)}`, error)
  }
}

/*
Test case 1 — US04: Chọn hai ghế, nhập đủ họ tên, số điện thoại Việt Nam hợp lệ,
email hợp lệ và hai loại hành khách khác nhau; nút Tiếp tục được bật và callback
nhận đúng hai hành khách cùng seatId tương ứng.

Test case 2 — US04: Nhập số điện thoại thiếu số, không bắt đầu bằng 0, hoặc email
sai định dạng; lỗi hiển thị ngay dưới trường tương ứng và nút Tiếp tục bị vô hiệu hóa.

Test case 3 — US04: Tóm tắt một vé Người lớn 100.000 đồng, Trẻ em 100.000 đồng,
Sinh viên 100.000 đồng và Người cao tuổi 100.000 đồng; thành tiền lần lượt là
100.000, 75.000, 90.000 và 85.000 đồng, tổng thanh toán là 350.000 đồng.

Test case 4 — US05: Tạo booking thành công, lưu hành khách, chọn VietQR và gửi
xác nhận; QR chứa số tiền đã giảm cùng mã đặt vé, payment được lưu ở trạng thái
pending_verification và UI báo đang chờ đối soát, không báo đã thanh toán thành công.

Test case 5 — US05: Khi request processPayment đang chạy, nút xác nhận bị vô hiệu
hóa; khi Supabase trả lỗi, lỗi được hiển thị và trạng thái loading kết thúc để
người dùng có thể thử lại.
*/
