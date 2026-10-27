import { useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, CreditCard, Landmark, LoaderCircle, QrCode } from 'lucide-react'
import { processPayment, type PaymentRecord } from '../../services/bookingService'

export interface VietQrBankConfig {
  bankId: string
  accountNumber: string
  accountName: string
}

export interface PaymentPageProps {
  bookingId: string
  bookingCode: string
  totalAmount: number
  bankConfig: VietQrBankConfig
  onPaymentSubmitted?: (payment: PaymentRecord) => void
}

type PaymentMethod = 'vietqr' | 'domestic_card'

function formatCurrency(amount: number) {
  return `${new Intl.NumberFormat('vi-VN').format(amount)} đ`
}

export function PaymentPage({
  bookingId,
  bookingCode,
  totalAmount,
  bankConfig,
  onPaymentSubmitted,
}: PaymentPageProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('vietqr')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [paymentSubmitted, setPaymentSubmitted] = useState(false)

  const qrUrl = useMemo(() => {
    const query = new URLSearchParams({
      amount: String(Math.round(totalAmount)),
      addInfo: bookingCode,
      accountName: bankConfig.accountName,
    })
    const bankId = encodeURIComponent(bankConfig.bankId)
    const accountNumber = encodeURIComponent(bankConfig.accountNumber)
    return `https://img.vietqr.io/image/${bankId}-${accountNumber}-compact2.png?${query.toString()}`
  }, [totalAmount, bookingCode, bankConfig.accountName, bankConfig.accountNumber, bankConfig.bankId])

  const isBankConfigValid = Boolean(
    bankConfig.bankId.trim() && bankConfig.accountNumber.trim() && bankConfig.accountName.trim(),
  )

  async function handleConfirmTransfer() {
    if (isLoading || paymentSubmitted || paymentMethod !== 'vietqr') return
    if (!bookingId || !bookingCode || !Number.isFinite(totalAmount) || totalAmount <= 0 || !isBankConfigValid) {
      setErrorMessage('Thông tin đặt vé, số tiền hoặc tài khoản nhận thanh toán chưa hợp lệ.')
      return
    }

    setErrorMessage('')
    setIsLoading(true)
    try {
      const payment = await processPayment({
        bookingId,
        paymentMethod,
        amount: Math.round(totalAmount),
        referenceCode: bookingCode,
      })
      setPaymentSubmitted(true)
      onPaymentSubmitted?.(payment)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Không thể gửi yêu cầu xác nhận thanh toán.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">US05 · Thanh toán</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Hoàn tất thanh toán</h1>
        <p className="mt-2 text-sm text-slate-600">Mã đặt vé <strong className="text-slate-900">{bookingCode}</strong></p>
      </header>

      <div className="rounded-2xl bg-slate-50 p-4">
        <p className="text-sm text-slate-600">Số tiền cần thanh toán</p>
        <p className="mt-1 text-2xl font-bold text-emerald-800">{formatCurrency(totalAmount)}</p>
      </div>

      <fieldset className="space-y-3">
        <legend className="mb-3 text-base font-semibold text-slate-900">Chọn phương thức thanh toán</legend>
        <button
          aria-pressed={paymentMethod === 'vietqr'}
          className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left transition ${paymentMethod === 'vietqr' ? 'border-emerald-600 bg-emerald-50 ring-1 ring-emerald-600' : 'border-slate-200 hover:border-slate-400'}`}
          type="button"
          onClick={() => { setPaymentMethod('vietqr'); setErrorMessage('') }}
        >
          <QrCode className="shrink-0 text-emerald-700" aria-hidden="true" />
          <span>
            <strong className="block text-slate-900">VietQR / Chuyển khoản ngân hàng</strong>
            <span className="text-sm text-slate-600">Quét mã bằng ứng dụng ngân hàng.</span>
          </span>
        </button>
        <button
          aria-pressed={paymentMethod === 'domestic_card'}
          className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left transition ${paymentMethod === 'domestic_card' ? 'border-emerald-600 bg-emerald-50 ring-1 ring-emerald-600' : 'border-slate-200 hover:border-slate-400'}`}
          type="button"
          onClick={() => { setPaymentMethod('domestic_card'); setErrorMessage('') }}
        >
          <CreditCard className="shrink-0 text-slate-700" aria-hidden="true" />
          <span>
            <strong className="block text-slate-900">Thẻ nội địa</strong>
            <span className="text-sm text-slate-600">Cần tích hợp cổng thanh toán thẻ trước khi sử dụng.</span>
          </span>
        </button>
      </fieldset>

      {paymentMethod === 'vietqr' ? (
        <section className="grid gap-5 rounded-2xl border border-slate-200 p-4 sm:grid-cols-[1fr_auto] sm:items-center sm:p-5">
          <div className="space-y-3 text-sm">
            <h2 className="font-semibold text-slate-900">Thông tin chuyển khoản</h2>
            <p className="flex items-start gap-2 text-slate-700"><Landmark size={18} className="mt-0.5 shrink-0" aria-hidden="true" />Ngân hàng: {bankConfig.bankId || 'Chưa cấu hình'}</p>
            <p className="text-slate-700">Số tài khoản: <strong>{bankConfig.accountNumber || 'Chưa cấu hình'}</strong></p>
            <p className="text-slate-700">Chủ tài khoản: <strong>{bankConfig.accountName || 'Chưa cấu hình'}</strong></p>
            <p className="text-slate-700">Nội dung chuyển khoản: <strong>{bookingCode}</strong></p>
          </div>
          {isBankConfigValid ? (
            <img
              alt={`Mã VietQR thanh toán ${formatCurrency(totalAmount)} cho đặt vé ${bookingCode}`}
              className="mx-auto aspect-square w-52 rounded-xl border border-slate-200 bg-white object-contain p-2"
              src={qrUrl}
            />
          ) : (
            <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900" role="alert">
              Cần cấu hình mã ngân hàng, số tài khoản và tên chủ tài khoản để tạo VietQR.
            </p>
          )}
        </section>
      ) : (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="status">
          Thanh toán thẻ nội địa chưa thể thực hiện vì dự án chưa cấu hình nhà cung cấp thanh toán. Vui lòng chọn VietQR.
        </p>
      )}

      {errorMessage && (
        <p className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          <AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />{errorMessage}
        </p>
      )}

      {paymentSubmitted && (
        <p className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800" role="status">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          Đã gửi yêu cầu xác nhận. Giao dịch vẫn đang chờ hệ thống đối soát; vé chỉ được xác nhận sau khi nhận được kết quả thanh toán hợp lệ.
        </p>
      )}

      <button
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        type="button"
        disabled={isLoading || paymentSubmitted || paymentMethod !== 'vietqr' || !isBankConfigValid || totalAmount <= 0}
        onClick={handleConfirmTransfer}
      >
        {isLoading && <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />}
        {isLoading ? 'Đang gửi yêu cầu...' : paymentSubmitted ? 'Đã gửi yêu cầu xác nhận' : 'Xác nhận đã chuyển khoản'}
      </button>
    </main>
  )
}
