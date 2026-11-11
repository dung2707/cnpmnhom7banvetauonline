import { useState } from 'react'
import { Check, Copy, Mail } from 'lucide-react'

export interface PaymentSuccessDetails {
  bookingCode: string
  tripCode: string
  origin: string
  destination: string
  departureDate: string
  departureTime: string | null
  seats: string[]
  totalAmount: number
}

interface PaymentSuccessModalProps {
  details: PaymentSuccessDetails
  onNavigateToHistory: () => void
  onNavigateHome: () => void
}

function formatCurrency(amount: number) {
  return `${new Intl.NumberFormat('vi-VN').format(amount)} đ`
}

function formatDepartureDate(date: string) {
  const parsedDate = new Date(`${date}T12:00:00`)
  return Number.isNaN(parsedDate.getTime())
    ? date
    : new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: 'long', year: 'numeric' }).format(parsedDate)
}

export function PaymentSuccessModal({
  details,
  onNavigateToHistory,
  onNavigateHome,
}: PaymentSuccessModalProps) {
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState('')

  async function copyBookingCode() {
    try {
      await navigator.clipboard.writeText(details.bookingCode)
      setCopied(true)
      setCopyError('')
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopyError('Không thể sao chép mã đặt vé trên thiết bị này.')
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm">
      <section
        aria-labelledby="payment-success-title"
        aria-modal="true"
        className="payment-success-enter my-auto w-full max-w-lg rounded-2xl bg-white p-5 text-center shadow-2xl sm:p-7"
        role="dialog"
      >
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-100 text-emerald-600">
          <Check size={30} strokeWidth={3} aria-hidden="true" />
        </span>
        <h2 className="mt-4 text-2xl font-bold text-slate-800" id="payment-success-title">
          Thanh toán thành công!
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Cảm ơn bạn đã lựa chọn VietRail. Chuyến đi của bạn đã được ghi nhận.
        </p>

        <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-left text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-600">Mã đơn hàng</span>
            <span className="flex items-center gap-2 font-bold text-emerald-700">
              {details.bookingCode}
              <button
                aria-label="Sao chép mã đơn hàng"
                className="rounded-md p-1.5 text-slate-500 transition hover:bg-white hover:text-emerald-700"
                onClick={() => void copyBookingCode()}
                type="button"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </span>
          </div>
          {copyError && <p className="text-xs text-red-700" role="alert">{copyError}</p>}
          {copied && <p className="text-xs text-emerald-700" role="status">Đã sao chép mã đặt vé.</p>}
          <div className="flex justify-between gap-3">
            <span className="shrink-0 text-slate-600">Chuyến tàu</span>
            <span className="text-right font-medium text-slate-800">
              {details.tripCode} · {details.origin} → {details.destination}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="shrink-0 text-slate-600">Khởi hành</span>
            <span className="text-right font-medium text-slate-800">
              {formatDepartureDate(details.departureDate)}
              {details.departureTime ? ` · ${new Intl.DateTimeFormat('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
              }).format(new Date(details.departureTime))}` : ''}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="shrink-0 text-slate-600">Ghế</span>
            <span className="text-right font-medium text-slate-800">
              {details.seats.length > 0 ? details.seats.join(', ') : 'Chưa có thông tin ghế'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-3">
            <span className="font-semibold text-slate-700">Tổng tiền</span>
            <span className="text-lg font-bold text-emerald-600">{formatCurrency(details.totalAmount)}</span>
          </div>
        </div>

        <p className="mt-4 flex items-start justify-center gap-2 text-xs leading-5 text-slate-500" role="status">
          <Mail className="mt-0.5 shrink-0" size={15} aria-hidden="true" />
          Thông tin vé đang được gửi tự động tới email hành khách trong đơn.
        </p>

        <footer className="mt-5 space-y-2">
          <button
            className="w-full rounded-lg bg-emerald-600 px-5 py-2.5 font-medium text-white transition hover:bg-emerald-700"
            onClick={onNavigateToHistory}
            type="button"
          >
            Xem lịch sử đặt vé
          </button>
          <button
            className="w-full rounded-lg border border-slate-300 px-5 py-2.5 text-slate-700 transition hover:bg-slate-100"
            onClick={onNavigateHome}
            type="button"
          >
            Quay lại trang chủ
          </button>
        </footer>
      </section>
    </div>
  )
}
