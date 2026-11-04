import trips from '../data/trips.json'

export const stations = [
  { name: 'Hà Nội', latitude: 21.0245, longitude: 105.8412 },
  { name: 'Nam Định', latitude: 20.4286, longitude: 106.1683 },
  { name: 'Vinh', latitude: 18.6796, longitude: 105.6813 },
  { name: 'Huế', latitude: 16.4637, longitude: 107.5909 },
  { name: 'Đà Nẵng', latitude: 16.068, longitude: 108.212 },
  { name: 'Nha Trang', latitude: 12.2486, longitude: 109.1848 },
  { name: 'Sài Gòn', latitude: 10.7811, longitude: 106.6782 },
]

export function seededRandom(seed: string) {
  let value = 2166136261
  for (const character of seed) {
    value ^= character.charCodeAt(0)
    value = Math.imul(value, 16777619)
  }
  return () => {
    value += 0x6d2b79f5
    let next = value
    next = Math.imul(next ^ (next >>> 15), next | 1)
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61)
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296
  }
}

export function generateTripsForDate(origin: string, destination: string, date: string) {
  const random = seededRandom(`${origin}|${destination}|${date}`)
  const originIndex = stations.findIndex((station) => station.name === origin)
  const destinationIndex = stations.findIndex((station) => station.name === destination)
  if (originIndex < 0 || destinationIndex < 0) return []

  const routeStations = stations
    .slice(Math.min(originIndex, destinationIndex), Math.max(originIndex, destinationIndex) + 1)
    .map((station) => station.name)
  if (originIndex > destinationIndex) routeStations.reverse()

  const generatedTemplates = [...trips]
    .sort(() => random() - 0.5)
    .slice(0, 4)
  const fullTripIndex = Math.floor(random() * generatedTemplates.length)
  const generatedSeatCounts = new Set<number>([0])

  return generatedTemplates.map((template, index) => {
    const departureMinutes = Math.floor(random() * 24 * 60)
    const durationMinutes = Math.max(120, Math.round(template.durationMinutes * (0.8 + random() * 0.4)))
    const arrivalMinutes = departureMinutes + durationMinutes
    const departureTime = `${String(Math.floor(departureMinutes / 60)).padStart(2, '0')}:${String(departureMinutes % 60).padStart(2, '0')}`
    const arrivalTime = `${String(Math.floor(arrivalMinutes / 60) % 24).padStart(2, '0')}:${String(arrivalMinutes % 60).padStart(2, '0')}`
    const minimumPrice = Math.round(template.minimumPrice * (0.85 + random() * 0.3) / 1000) * 1000
    const maximumPrice = Math.max(minimumPrice, Math.round(template.maximumPrice * (0.85 + random() * 0.3) / 1000) * 1000)
    let availableSeats = 0
    if (index !== fullTripIndex) {
      do {
        availableSeats = 5 + Math.floor(random() * 176)
      } while (generatedSeatCounts.has(availableSeats))
      generatedSeatCounts.add(availableSeats)
    }
    const routeSuffix = `${originIndex + 1}${destinationIndex + 1}`
    return {
      ...template,
      id: `${template.code}-${routeSuffix}-${date}`,
      code: `${template.code}-${routeSuffix}`,
      origin,
      destination,
      departureTime,
      arrivalTime,
      arrivalDayOffset: Math.floor(arrivalMinutes / (24 * 60)),
      durationMinutes,
      minimumPrice,
      maximumPrice,
      availableSeats,
      stops: routeStations.map((station, stopIndex) => ({
        station,
        time: stopIndex === 0 ? departureTime : stopIndex === routeStations.length - 1 ? arrivalTime : departureTime,
      })),
      scheduleDate: date,
    }
  })
}
