export type CarriageType = 'seat' | 'berth6' | 'berth4'

export type TrainCarriage = {
  number: number
  title: string
  type: CarriageType
  typeLabel: string
  fareName: string
  seatNumbers: number[]
  soldSeatNumbers: number[]
  availableSeatCount: number
}

function createCarriage(number: number): TrainCarriage {
  const type: CarriageType = number <= 2 ? 'seat' : number <= 6 ? 'berth6' : 'berth4'
  const capacity = type === 'seat' ? 40 : type === 'berth6' ? 42 : 28
  const seatNumbers = Array.from({ length: capacity }, (_, index) => index + 1)
  const soldSeatNumbers: number[] = []

  return {
    number,
    title: `Toa ${number}`,
    type,
    typeLabel: type === 'seat'
      ? 'Ngồi mềm điều hòa'
      : type === 'berth6'
        ? 'Giường nằm K6 điều hòa'
        : 'Giường nằm K4 điều hòa VIP',
    fareName: type === 'seat'
      ? 'Ghế ngồi mềm điều hòa'
      : type === 'berth6'
        ? 'Giường nằm khoang 6'
        : 'Giường nằm khoang 4',
    seatNumbers,
    soldSeatNumbers,
    availableSeatCount: capacity,
  }
}

export const trainCarriages = Array.from({ length: 10 }, (_, index) => createCarriage(index + 1))