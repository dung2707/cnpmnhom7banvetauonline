import { useEffect, useMemo, useState, type FormEvent } from 'react'

export type PassengerType = 'adult' | 'child' | 'student' | 'senior'

export interface BookingSeat {
  id: string
  carNumber: number
  seatNumber: number
  price: number
  carriageTitle?: string
}

export interface PassengerDetails {
  seatId: string
  fullName: string
  phone: string
  email: string
  type: PassengerType
}

interface PassengerFormValues {
  fullName: string
  phone: string
  email: string
  type: PassengerType
}

type PassengerField = keyof PassengerFormValues
type PassengerErrors = Partial<Record<PassengerField, string>>

export interface PassengerFormProps {
  seats: BookingSeat[]
  onContinue: (passengers: PassengerDetails[]) => void | Promise<void>
  isSubmitting?: boolean
}

const passengerTypeOptions: { value: PassengerType; label: string }[] = [
  { value: 'adult', label: 'Người lớn' },
  { value: 'child', label: 'Trẻ em (giảm 25%)' },
  { value: 'student', label: 'Sinh viên (giảm 10%)' },
  { value: 'senior', label: 'Người cao tuổi (giảm 15%)' },
]

const emptyPassenger: PassengerFormValues = {
  fullName: '',
  phone: '',
  email: '',
  type: 'adult',
}

function validatePassenger(values: PassengerFormValues): PassengerErrors {
  const errors: PassengerErrors = {}
  const fullName = values.fullName.trim()
  const phone = values.phone.trim()
  const email = values.email.trim()

  if (!fullName) {
    errors.fullName = 'Vui lòng nhập họ và tên hành khách.'
  } else if (fullName.length < 2 || fullName.length > 100) {
    errors.fullName = 'Họ và tên phải có từ 2 đến 100 ký tự.'
  }

  if (!phone) {
    errors.phone = 'Vui lòng nhập số điện thoại.'
  } else if (!/^0(?:3|5|7|8|9)\d{8}$/.test(phone)) {
    errors.phone = 'Số điện thoại phải gồm 10 số và bắt đầu bằng 03, 05, 07, 08 hoặc 09.'
  }

  if (!email) {
    errors.email = 'Vui lòng nhập email nhận vé.'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    errors.email = 'Email không đúng định dạng, ví dụ ten@example.com.'
  }

  return errors
}

export function PassengerForm({ seats, onContinue, isSubmitting = false }: PassengerFormProps) {
  const [valuesBySeatId, setValuesBySeatId] = useState<Record<string, PassengerFormValues>>(() =>
    Object.fromEntries(seats.map((seat) => [seat.id, { ...emptyPassenger }])),
  )
  const [touchedBySeatId, setTouchedBySeatId] = useState<Record<string, Partial<Record<PassengerField, boolean>>>>({})
  const [submissionError, setSubmissionError] = useState('')
  const seatIdsKey = seats.map((seat) => seat.id).join('|')

  useEffect(() => {
    setValuesBySeatId((currentValues) => Object.fromEntries(
      seats.map((seat) => [seat.id, currentValues[seat.id] ?? { ...emptyPassenger }]),
    ))
    setTouchedBySeatId((currentTouched) => Object.fromEntries(
      seats
        .filter((seat) => currentTouched[seat.id])
        .map((seat) => [seat.id, currentTouched[seat.id]]),
    ))
  }, [seatIdsKey])

  const errorsBySeatId = useMemo(
    () => Object.fromEntries(
      seats.map((seat) => [
        seat.id,
        validatePassenger(valuesBySeatId[seat.id] ?? emptyPassenger),
      ]),
    ) as Record<string, PassengerErrors>,
    [seats, valuesBySeatId],
  )

  const isValid = seats.length > 0 && seats.every((seat) =>
    Object.keys(errorsBySeatId[seat.id] ?? {}).length === 0,
  )

  function updateField(seatId: string, field: PassengerField, value: string) {
    setSubmissionError('')
    setValuesBySeatId((currentValues) => ({
      ...currentValues,
      [seatId]: {
        ...(currentValues[seatId] ?? emptyPassenger),
        [field]: value,
      },
    }))
  }

  function markTouched(seatId: string, field: PassengerField) {
    setTouchedBySeatId((currentTouched) => ({
      ...currentTouched,
      [seatId]: { ...currentTouched[seatId], [field]: true },
    }))
  }

  function getVisibleError(seatId: string, field: PassengerField) {
    return touchedBySeatId[seatId]?.[field] ? errorsBySeatId[seatId]?.[field] : undefined
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!isValid || isSubmitting) return

    const passengers = seats.map((seat) => ({
      seatId: seat.id,
      ...valuesBySeatId[seat.id],
      fullName: valuesBySeatId[seat.id].fullName.trim(),
      phone: valuesBySeatId[seat.id].phone.trim(),
      email: valuesBySeatId[seat.id].email.trim(),
    }))

    setSubmissionError('')
    try {
      await onContinue(passengers)
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : 'Không thể tiếp tục đặt vé. Vui lòng thử lại.')
    }
  }

  if (seats.length === 0) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900" role="status">
        Vui lòng chọn ít nhất một ghế trước khi nhập thông tin hành khách.
      </section>
    )
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit} noValidate>
      <header>
        <h2 className="text-xl font-bold text-slate-900">Thông tin hành khách</h2>
        <p className="mt-1 text-sm text-slate-600">Nhập chính xác thông tin để nhận vé điện tử cho từng ghế.</p>
      </header>

      {seats.map((seat, index) => {
        const values = valuesBySeatId[seat.id] ?? emptyPassenger
        const seatLabel = `${seat.carriageTitle ?? `Toa ${seat.carNumber}`} · Ghế ${seat.seatNumber}`
        const nameError = getVisibleError(seat.id, 'fullName')
        const phoneError = getVisibleError(seat.id, 'phone')
        const emailError = getVisibleError(seat.id, 'email')

        return (
          <fieldset className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5" key={seat.id}>
            <legend className="px-1 text-sm font-bold text-slate-800">
              Hành khách {index + 1} <span className="font-medium text-slate-500">— {seatLabel}</span>
            </legend>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor={`passenger-name-${seat.id}`}>
                Họ và tên
              </label>
              <input
                autoComplete="name"
                className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition focus:ring-2 ${nameError ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : 'border-slate-300 focus:border-emerald-600 focus:ring-emerald-100'}`}
                id={`passenger-name-${seat.id}`}
                maxLength={100}
                value={values.fullName}
                aria-invalid={Boolean(nameError)}
                aria-describedby={nameError ? `passenger-name-error-${seat.id}` : undefined}
                onBlur={() => markTouched(seat.id, 'fullName')}
                onChange={(event) => updateField(seat.id, 'fullName', event.target.value)}
                placeholder="Nhập họ và tên"
                required
              />
              {nameError && <p className="mt-1 text-sm text-red-600" id={`passenger-name-error-${seat.id}`}>{nameError}</p>}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor={`passenger-phone-${seat.id}`}>
                  Số điện thoại
                </label>
                <input
                  autoComplete="tel"
                  className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition focus:ring-2 ${phoneError ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : 'border-slate-300 focus:border-emerald-600 focus:ring-emerald-100'}`}
                  id={`passenger-phone-${seat.id}`}
                  inputMode="numeric"
                  maxLength={10}
                  value={values.phone}
                  aria-invalid={Boolean(phoneError)}
                  aria-describedby={phoneError ? `passenger-phone-error-${seat.id}` : undefined}
                  onBlur={() => markTouched(seat.id, 'phone')}
                  onChange={(event) => updateField(seat.id, 'phone', event.target.value)}
                  placeholder="09xxxxxxxx"
                  required
                />
                {phoneError && <p className="mt-1 text-sm text-red-600" id={`passenger-phone-error-${seat.id}`}>{phoneError}</p>}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor={`passenger-email-${seat.id}`}>
                  Email nhận vé
                </label>
                <input
                  autoComplete="email"
                  className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition focus:ring-2 ${emailError ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : 'border-slate-300 focus:border-emerald-600 focus:ring-emerald-100'}`}
                  id={`passenger-email-${seat.id}`}
                  type="email"
                  value={values.email}
                  aria-invalid={Boolean(emailError)}
                  aria-describedby={emailError ? `passenger-email-error-${seat.id}` : undefined}
                  onBlur={() => markTouched(seat.id, 'email')}
                  onChange={(event) => updateField(seat.id, 'email', event.target.value)}
                  placeholder="ten@example.com"
                  required
                />
                {emailError && <p className="mt-1 text-sm text-red-600" id={`passenger-email-error-${seat.id}`}>{emailError}</p>}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor={`passenger-type-${seat.id}`}>
                Loại hành khách
              </label>
              <select
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                id={`passenger-type-${seat.id}`}
                value={values.type}
                onChange={(event) => updateField(seat.id, 'type', event.target.value as PassengerType)}
              >
                {passengerTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </fieldset>
        )
      })}

      {submissionError && (
        <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          {submissionError}
        </p>
      )}

      <button
        className="w-full rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        type="submit"
        disabled={!isValid || isSubmitting}
      >
        {isSubmitting ? 'Đang xử lý...' : 'Tiếp tục'}
      </button>
    </form>
  )
}
