//sprint 5 update thêm chức năng 
import type { CarriageType } from '../data/trainCarriages'

export type SeatRow = {
  id: string
  seat_number: number
  status: 'available' | 'held' | 'booked'
}

export type TravelDirection = 'northbound' | 'southbound' | 'unknown'

export type SeatRecommendationOptions = {
  seats: SeatRow[]
  carriageType: CarriageType
  carriageNumber: number
  totalCarriages: number
  departureTime: string
  direction: TravelDirection
  groupSize: number
  forElderlyOrChild: boolean
  scenicWindowNoSun: boolean
}

const elderlyRecommendationLabel = 'Phù hợp Trẻ em / Người cao tuổi (Gần lối đi, ít rung lắc)'

function isMiddleCarriage(carriageNumber: number, totalCarriages: number) {
  const middle = (totalCarriages + 1) / 2
  return Math.abs(carriageNumber - middle) <= 1
}

export function scoreSeatForElderlyOrChild(
  seatNumber: number,
  carriageType: CarriageType,
  carriageNumber: number,
  totalCarriages: number,
) {
  let score = isMiddleCarriage(carriageNumber, totalCarriages) ? 2 : 0

  if (carriageType === 'seat') {
    const positionInRow = (seatNumber - 1) % 4
    const rowNumber = Math.floor((seatNumber - 1) / 4)
    if (positionInRow === 1 || positionInRow === 2) score += 2
    if (rowNumber === 0 || rowNumber === 9) score += 2
  } else {
    const berthsPerCompartment = carriageType === 'berth4' ? 4 : 6
    const positionInCompartment = (seatNumber - 1) % berthsPerCompartment
    if (positionInCompartment < 2) score += 5
    if (positionInCompartment === 1 || positionInCompartment === 2) score += 1
  }

  return score
}

export function getWindowSide(seatNumber: number, carriageType: CarriageType): 'left' | 'right' | null {
  if (carriageType === 'seat') {
    const positionInRow = (seatNumber - 1) % 4
    if (positionInRow === 0) return 'left'
    if (positionInRow === 3) return 'right'
    return null
  }

  const berthsPerCompartment = carriageType === 'berth4' ? 4 : 6
  return Math.floor(((seatNumber - 1) % berthsPerCompartment) / 2) % 2 === 0 ? 'left' : 'right'
}

export type SunExposure = 'cool' | 'sun'

export function getSunExposure(departureTime: string) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(departureTime)
  if (!match) return {
    left: 'cool' as SunExposure,
    right: 'cool' as SunExposure,
    period: 'night',
  }

  const minutes = Number(match[1]) * 60 + Number(match[2])
  if (minutes >= 6 * 60 && minutes < 12 * 60) {
    return { left: 'sun' as SunExposure, right: 'cool' as SunExposure, period: 'morning' }
  }
  if (minutes >= 12 * 60 && minutes < 18 * 60) {
    return { left: 'cool' as SunExposure, right: 'sun' as SunExposure, period: 'afternoon' }
  }
  return { left: 'cool' as SunExposure, right: 'cool' as SunExposure, period: 'night' }
}

export function getAdjacentSeatGroups<T extends SeatRow>(seats: T[], carriageType: CarriageType, groupSize: number) {
  if (!Number.isInteger(groupSize) || groupSize < 2) return []

  const availableSeats = seats
    .filter((seat) => seat.status === 'available')
    .slice()
    .sort((first, second) => first.seat_number - second.seat_number)
  const seatsPerCompartment = carriageType === 'berth4' ? 4 : 6
  const groupMap = new Map<number, T[]>()

  for (const seat of availableSeats) {
    const groupingNumber = carriageType === 'seat'
      ? Math.floor((seat.seat_number - 1) / 4)
      : Math.floor((seat.seat_number - 1) / seatsPerCompartment)
    const group = groupMap.get(groupingNumber) ?? []
    group.push(seat)
    groupMap.set(groupingNumber, group)
  }

  const groups: T[][] = []
  for (const group of groupMap.values()) {
    for (let start = 0; start <= group.length - groupSize; start += 1) {
      const candidate = group.slice(start, start + groupSize)
      if (carriageType === 'seat') {
        const consecutive = candidate.every((seat, index) =>
          index === 0 || seat.seat_number === candidate[index - 1].seat_number + 1,
        )
        if (!consecutive) continue
        if (groupSize === 2) {
          const firstPosition = (candidate[0].seat_number - 1) % 4
          if (Math.floor(firstPosition / 2) !== Math.floor(((candidate[1].seat_number - 1) % 4) / 2)) continue
        }
      }
      groups.push(candidate)
    }
  }

  return groups
}

export function getBestRecommendedSeatGroup<T extends SeatRow>(
  seats: T[],
  carriageType: CarriageType,
  groupSize: number,
  departureTime: string,
  forElderlyOrChild: boolean,
  scenicWindowNoSun: boolean,
) {
  const candidates = getAdjacentSeatGroups(seats, carriageType, groupSize)
  if (candidates.length === 0) return []

  if (carriageType === 'seat') {
    const filtered = candidates.filter((candidate) => {
      if (forElderlyOrChild) {
        const rowIndex = Math.floor((candidate[0].seat_number - 1) / 4)
        if (rowIndex < 2 || rowIndex > 6) return false
      }
      if (scenicWindowNoSun) {
        const exposure = getSunExposure(departureTime)
        const shadeSide = exposure.left === 'cool' ? 'left' : exposure.right === 'cool' ? 'right' : null
        if (shadeSide) {
          const sides = candidate.map((seat) => getWindowSide(seat.seat_number, carriageType))
          if (sides.every((side) => side !== shadeSide)) return false
        }
      }
      return true
    })
    if (filtered.length > 0) return filtered[0]
  }

  return candidates[0]
}

export function getBestAdjacentSeatGroup<T extends SeatRow>(
  seats: T[],
  carriageType: CarriageType,
  groupSize: number,
  carriageNumber: number,
  totalCarriages: number,
) {
  return getAdjacentSeatGroups(seats, carriageType, groupSize)
    .sort((first, second) => {
      const scoreGroup = (group: SeatRow[]) => group.reduce(
        (score, seat) => score + scoreSeatForElderlyOrChild(
          seat.seat_number,
          carriageType,
          carriageNumber,
          totalCarriages,
        ),
        0,
      )
      return scoreGroup(second) - scoreGroup(first) ||
        first[0].seat_number - second[0].seat_number
    })[0] ?? []
}

export function getSeatRecommendations(options: SeatRecommendationOptions) {
  const recommendations = new Map<string, string[]>()
  const availableSeats = options.seats.filter((seat) => seat.status === 'available')
  const addReason = (seat: SeatRow, reason: string) => {
    const reasons = recommendations.get(seat.id) ?? []
    if (!reasons.includes(reason)) recommendations.set(seat.id, [...reasons, reason])
  }

  if (options.scenicWindowNoSun) {
    const exposure = getSunExposure(options.departureTime)
    for (const seat of availableSeats) {
      const side = getWindowSide(seat.seat_number, options.carriageType)
      if (!side) continue
      if (exposure.period === 'night') {
        addReason(seat, 'Cửa sổ ngắm cảnh đêm • Thoáng mát')
      } else if (side === 'left' && exposure.left === 'cool') {
        addReason(seat, 'Cửa sổ râm mát')
      } else if (side === 'right' && exposure.right === 'cool') {
        addReason(seat, 'Cửa sổ râm mát')
      } else {
        continue
      }
    }
  }

  if (options.forElderlyOrChild) {
    for (const seat of availableSeats) {
      if (options.carriageType !== 'seat') continue
      const rowIndex = Math.floor((seat.seat_number - 1) / 4)
      const position = (seat.seat_number - 1) % 4
      if (rowIndex >= 2 && rowIndex <= 6 && (position === 1 || position === 2)) {
        addReason(seat, elderlyRecommendationLabel)
      }
    }
  }

  if (options.groupSize >= 2) {
    const bestGroup = getBestRecommendedSeatGroup(
      options.seats,
      options.carriageType,
      options.groupSize,
      options.departureTime,
      options.forElderlyOrChild,
      options.scenicWindowNoSun,
    )
    for (const seat of bestGroup) {
      addReason(seat, `Cụm ghế liền kề ${options.groupSize} khách`)
    }
  }

  if (options.forElderlyOrChild && options.scenicWindowNoSun) {
    const bestGroup = getBestRecommendedSeatGroup(
      options.seats,
      options.carriageType,
      options.groupSize,
      options.departureTime,
      true,
      true,
    )
    recommendations.clear()
    for (const seat of bestGroup) {
      addReason(seat, 'Cụm râm mát • Gần lối đi')
    }
  }

  return recommendations
}
