import { useMemo } from 'react'
import type { BookingSeat, PassengerDetails, PassengerType } from './PassengerForm'

export interface BookingSummaryRow {
  passenger: PassengerDetails
  seat: BookingSeat
  passengerTypeLabel: string
  discountRate: number
  originalPrice: number
  discountAmount: number
  finalPrice: number
}

export interface BookingSummaryResult {
  rows: BookingSummaryRow[]
  subtotal: number
  discountTotal: number
  addOnTotal: number
  total: number
}

export interface BookingSummaryProps {
  seats: BookingSeat[]
  passengers: PassengerDetails[]
  addOns?: { label: string; price: number }[]
  showContinue?: boolean
  isSubmitting?: boolean
  onContinue: (summary: BookingSummaryResult) => void
}

const fareRules: Record<PassengerType, { label: string; discountRate: number }> = {
  adult: { label: 'Người lớn', discountRate: 0 },
  child: { label: 'Trẻ em', discountRate: 0.25 },
  student: { label: 'Sinh viên', discountRate: 0.1 },
  senior: { label: 'Người cao tuổi', discountRate: 0.15 },
}

function formatCurrency(amount: number) {
  return `${new Intl.NumberFormat('vi-VN').format(amount)} đ`
}

export function BookingSummary({
  seats,
  passengers,
  addOns = [],
  showContinue = true,
  isSubmitting = false,
  onContinue,
}: BookingSummaryProps) {
  const summary = useMemo<BookingSummaryResult>(() => {
    const seatsById = new Map(seats.map((seat) => [seat.id, seat]))
    const rows = passengers.flatMap((passenger) => {
      const seat = seatsById.get(passenger.seatId)
      if (!seat) return []

      const fareRule = fareRules[passenger.type]
      const originalPrice = Math.max(0, Math.round(seat.price))
      const discountAmount = Math.round(originalPrice * fareRule.discountRate)
      return [{
        passenger,
        seat,
        passengerTypeLabel: fareRule.label,
        discountRate: fareRule.discountRate,
        originalPrice,
        discountAmount,
        finalPrice: originalPrice - discountAmount,
      }]
    })

    const subtotal = rows.reduce((total, row) => total + row.originalPrice, 0)
    const discountTotal = rows.reduce((total, row) => total + row.discountAmount, 0)
    const addOnTotal = addOns.reduce((total, addOn) => total + addOn.price, 0)

    return { rows, subtotal, discountTotal, addOnTotal, total: subtotal - discountTotal + addOnTotal }
  }, [addOns, passengers, seats])

  const hasCompletePassengerList = seats.length > 0 &&
    passengers.length === seats.length &&
    summary.rows.length === seats.length &&
    new Set(passengers.map((passenger) => passenger.seatId)).size === seats.length

  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <header>
        <h2 className="text-xl font-bold text-slate-900">Tóm tắt đặt vé</h2>
        <p className="mt-1 text-sm text-slate-600">Giá vé được tính theo loại hành khách đã chọn.</p>
      </header>

      {summary.rows.length === 0 ? (
        <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900" role="status">
          Chưa có đủ ghế và thông tin hành khách để lập tóm tắt.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-3 font-semibold">Ghế / hành khách</th>
                <th className="px-3 py-3 font-semibold">Loại vé</th>
                <th className="px-3 py-3 text-right font-semibold">Giá gốc</th>
                <th className="px-3 py-3 text-right font-semibold">Giảm giá</th>
                <th className="px-3 py-3 text-right font-semibold">Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              {summary.rows.map((row) => (
                <tr className="border-b border-slate-100 last:border-0" key={row.passenger.seatId}>
                  <td className="px-3 py-3">
                    <strong className="block text-slate-900">
                      {row.seat.carriageTitle ?? `Toa ${row.seat.carNumber}`} · Ghế {row.seat.seatNumber}
                    </strong>
                    <span className="text-slate-500">{row.passenger.fullName}</span>
                  </td>
                  <td className="px-3 py-3">
                    <span className="block text-slate-800">{row.passengerTypeLabel}</span>
                    <span className="text-slate-500">
                      {row.discountRate === 0 ? 'Giá gốc' : `Giảm ${Math.round(row.discountRate * 100)}%`}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right text-slate-600">{formatCurrency(row.originalPrice)}</td>
                  <td className="px-3 py-3 text-right text-emerald-700">−{formatCurrency(row.discountAmount)}</td>
                  <td className="px-3 py-3 text-right font-semibold text-slate-900">{formatCurrency(row.finalPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <dl className="ml-auto max-w-sm space-y-2 border-t border-slate-200 pt-4 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-slate-600">Tạm tính</dt>
          <dd className="font-medium text-slate-900">{formatCurrency(summary.subtotal)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-slate-600">Tổng giảm giá</dt>
          <dd className="font-medium text-emerald-700">−{formatCurrency(summary.discountTotal)}</dd>
        </div>
        {addOns.map((addOn) => (
          <div className="flex justify-between gap-4" key={addOn.label}>
            <dt className="text-slate-600">{addOn.label}</dt>
            <dd className="font-medium text-slate-900">{formatCurrency(addOn.price)}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-4 border-t border-slate-100 pt-3 text-base">
          <dt className="font-bold text-slate-900">Tổng thanh toán</dt>
          <dd className="font-bold text-emerald-800">{formatCurrency(summary.total)}</dd>
        </div>
      </dl>

      {showContinue && (
        <button
          className="w-full rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          type="button"
          disabled={!hasCompletePassengerList || summary.total <= 0 || isSubmitting}
          onClick={() => onContinue(summary)}
        >
          {isSubmitting ? 'Đang tạo đặt vé...' : 'Tiếp tục thanh toán'}
        </button>
      )}
    </section>
  )
}
