//them tinh nang moi
export type TrainScheduleStation = {
  name: 'Hà Nội' | 'Nam Định' | 'Vinh' | 'Huế' | 'Đà Nẵng' | 'Nha Trang' | 'Sài Gòn'
  distanceKm: number
  arrivalTime: string
  departureTime: string
  stopMinutes: number
}

export type TrainSchedule = {
  code: string
  direction: 'Bắc → Nam' | 'Nam → Bắc'
  status: 'Đúng giờ'
  stations: TrainScheduleStation[]
}

export const TRACKER_STATIONS = [
  'Hà Nội',
  'Nam Định',
  'Vinh',
  'Huế',
  'Đà Nẵng',
  'Nha Trang',
  'Sài Gòn',
] as const

const northboundMinutes = [20 * 60 + 55, 22 * 60 + 20, 1 * 60 + 40, 6 * 60 + 20, 9 * 60 + 35, 15 * 60 + 25, 20 * 60 + 55]
const northboundDepartures = [20 * 60 + 55, 22 * 60 + 25, 1 * 60 + 50, 6 * 60 + 28, 9 * 60 + 50, 15 * 60 + 35, 20 * 60 + 55]
const stopMinutes = [0, 5, 10, 8, 15, 10, 0]
const cumulativeDistance = [0, 90, 319, 688, 791, 1315, 1710]

function formatMinutes(minutes: number) {
  const normalized = ((minutes % 1440) + 1440) % 1440
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`
}

function buildSchedule(code: string, direction: 'Bắc → Nam' | 'Nam → Bắc', offsetMinutes = 0): TrainSchedule {
  const stations = direction === 'Bắc → Nam'
    ? TRACKER_STATIONS.map((name, index) => ({
        name,
        distanceKm: cumulativeDistance[index],
        arrivalTime: index === 0 ? formatMinutes(northboundMinutes[index] + offsetMinutes) : formatMinutes(northboundMinutes[index] + offsetMinutes),
        departureTime: index === TRACKER_STATIONS.length - 1 ? formatMinutes(northboundMinutes[index] + offsetMinutes) : formatMinutes(northboundDepartures[index] + offsetMinutes),
        stopMinutes: stopMinutes[index],
      }))
    : [...TRACKER_STATIONS].reverse().map((name, reverseIndex) => {
        const index = TRACKER_STATIONS.length - 1 - reverseIndex
        const departureBase = 14 * 60 + 45 + reverseIndex * (195 - reverseIndex * 18)
        return {
          name,
          distanceKm: cumulativeDistance[index],
          arrivalTime: reverseIndex === 0 ? formatMinutes(departureBase + offsetMinutes) : formatMinutes(departureBase + reverseIndex * 22 + offsetMinutes),
          departureTime: reverseIndex === TRACKER_STATIONS.length - 1 ? formatMinutes(departureBase + offsetMinutes + 1270) : formatMinutes(departureBase + reverseIndex * 22 + stopMinutes[index] + offsetMinutes),
          stopMinutes: stopMinutes[index],
        }
      })

  return { code, direction, status: 'Đúng giờ', stations }
}

export const TRACKER_TRAIN_CODES = [
  'SE21-12',
  'SE22-12',
  'SE1',
  'SE3',
  'SE2',
  'SE21',
  'SE22',
  'SNT2',
] as const

export const TRAIN_SCHEDULES: TrainSchedule[] = [
  buildSchedule('SE21-12', 'Nam → Bắc', 15),
  buildSchedule('SE22-12', 'Bắc → Nam', 0),
  buildSchedule('SE1', 'Bắc → Nam', -20),
  buildSchedule('SE3', 'Bắc → Nam', 10),
  buildSchedule('SE2', 'Nam → Bắc', 20),
  buildSchedule('SE21', 'Nam → Bắc', 15),
  buildSchedule('SE22', 'Bắc → Nam', 0),
  buildSchedule('SNT2', 'Bắc → Nam', 35),
]

export function findTrainSchedule(code: string) {
  const normalized = code.trim().toUpperCase()
  if (!normalized) return undefined
  return TRAIN_SCHEDULES.find((schedule) =>
    schedule.code === normalized ||
    normalized.startsWith(schedule.code),
  )
}
