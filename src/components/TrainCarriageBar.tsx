import { TrainFront } from 'lucide-react'
import type { TrainCarriage, CarriageType } from '../data/trainCarriages'

type Props = {
  cars: TrainCarriage[]
  selectedCarNumber: number
  trainCode: string
  onSelectCar: (carNumber: number) => void
}

const carriageColors: Record<CarriageType, { shell: string; badge: string; selected: string }> = {
  seat: {
    shell: 'border-emerald-300 bg-emerald-50 text-emerald-950',
    badge: 'bg-emerald-700 text-white',
    selected: 'ring-2 ring-emerald-500 ring-offset-2',
  },
  berth6: {
    shell: 'border-orange-300 bg-orange-50 text-orange-950',
    badge: 'bg-orange-600 text-white',
    selected: 'ring-2 ring-orange-500 ring-offset-2',
  },
  berth4: {
    shell: 'border-sky-300 bg-sky-50 text-sky-950',
    badge: 'bg-sky-700 text-white',
    selected: 'ring-2 ring-sky-500 ring-offset-2',
  },
}

export function TrainCarriageBar({ cars, selectedCarNumber, trainCode, onSelectCar }: Props) {
  return (
    <div className="train-carriage-viewport overflow-x-auto px-5 py-4" aria-label="Sơ đồ đoàn tàu">
      <div className="flex w-max min-w-full items-end gap-2">
        <div className="train-locomotive flex w-20 shrink-0 flex-col items-center gap-1" aria-label={`Đầu tàu ${trainCode}`}>
          <div className="flex h-[58px] w-full flex-col items-center justify-center rounded-t-2xl rounded-br-md bg-slate-800 text-white shadow-sm">
            <TrainFront size={22} aria-hidden="true" />
            <strong className="text-[10px]">{trainCode}</strong>
          </div>
          <div className="flex h-3 items-center gap-5">
            <i className="train-wheel" /><i className="train-wheel" />
          </div>
        </div>
        <div className="h-1 w-3 shrink-0 self-center rounded bg-slate-400" aria-hidden="true" />
        <div className="flex items-end gap-2">
          {cars.map((car) => {
            const colors = carriageColors[car.type]
            const isSelected = selectedCarNumber === car.number
            return (
              <button
                className={`train-car-button group relative flex w-[104px] shrink-0 flex-col items-center gap-1 rounded-md p-1 transition-transform hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 ${isSelected ? colors.selected : ''}`}
                type="button"
                key={car.number}
                aria-pressed={isSelected}
                aria-label={`${car.title}, ${car.typeLabel}, còn ${car.availableSeatCount} chỗ`}
                onClick={() => onSelectCar(car.number)}
              >
                <span className={`train-car-body flex h-[58px] w-full flex-col items-center justify-center gap-1 rounded-t-lg border px-1 ${colors.shell}`}>
                  <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-bold leading-none ${colors.badge}`}>Còn {car.availableSeatCount} chỗ</span>
                  <strong className="text-[10px] leading-none">{car.title}</strong>
                  <small className="max-w-full truncate text-[8px] leading-none opacity-75">{car.typeLabel}</small>
                </span>
                <span className="flex h-3 items-center gap-5 px-3" aria-hidden="true">
                  <i className="train-wheel" /><i className="train-wheel" />
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}