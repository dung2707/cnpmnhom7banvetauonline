import QRCode from 'qrcode'
import type { TicketQrCodeData } from '../types'

export async function generateTicketQrCode(ticket: TicketQrCodeData): Promise<string> {
  return QRCode.toDataURL(JSON.stringify(ticket), {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 224,
  })
}
