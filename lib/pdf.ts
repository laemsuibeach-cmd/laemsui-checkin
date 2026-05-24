import { PDFDocument, rgb, StandardFonts, PDFPage } from 'pdf-lib'

// ─── PDPA Certificate Page ────────────────────────────────────────────────────
// Adds a PDPA consent certificate as the last page of the PDF, then embeds
// the guest's signature on that page.  Returns the final PDF bytes.

export async function addPdpaPageAndSign(
  originalPdfBytes: ArrayBuffer,
  signatureDataUrl: string,
  guestName: string,
  bookingRef: string,
  timestamp: string,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(originalPdfBytes)
  const font   = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontB  = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  // ── Add PDPA Certificate page ──
  const page = pdfDoc.addPage([595, 842]) // A4 portrait
  const { width, height } = page.getSize()

  const col  = rgb(0.05, 0.43, 0.43)   // resort-teal #0f766e
  const dark = rgb(0.15, 0.15, 0.15)
  const mid  = rgb(0.4, 0.4, 0.4)
  const lite = rgb(0.85, 0.85, 0.85)

  let y = height - 50

  // ── Header bar ──
  page.drawRectangle({ x: 0, y: height - 80, width, height: 80, color: col })
  page.drawText('Laemsui Beach Resort', {
    x: 40, y: height - 36, size: 18, font: fontB, color: rgb(1, 1, 1),
  })
  page.drawText('Personal Data Protection Act (PDPA) — Consent Certificate',
    { x: 40, y: height - 58, size: 9, font, color: rgb(0.8, 1, 0.95) })

  y = height - 110

  // ── Booking info box ──
  page.drawRectangle({ x: 40, y: y - 70, width: width - 80, height: 78, color: rgb(0.97, 0.97, 0.97), borderColor: lite, borderWidth: 1 })
  infoRow(page, font, fontB, 55, y - 18, 'Guest Name',   guestName)
  infoRow(page, font, fontB, 55, y - 38, 'Booking Ref',  bookingRef)
  infoRow(page, font, fontB, 55, y - 58, 'Date & Time',  timestamp)

  y -= 90

  // ── Section: What was collected ──
  section(page, fontB, 40, y, 'Purpose of Data Collection', col)
  y -= 22

  const purposes = [
    'Check-in registration as required by the Hotel Act (Thailand)',
    'Hotel and guest security management',
    'Compliance with the Personal Data Protection Act B.E. 2562 (2019)',
  ]
  for (const p of purposes) {
    page.drawText(`•  ${p}`, { x: 52, y, size: 10, font, color: dark })
    y -= 18
  }

  y -= 10
  section(page, fontB, 40, y, 'Data Collected', col)
  y -= 22
  const items = [
    'Full name and nationality',
    'Passport number or national ID number',
    'Photograph of identification document',
    'Guest signature',
  ]
  for (const item of items) {
    page.drawText(`•  ${item}`, { x: 52, y, size: 10, font, color: dark })
    y -= 18
  }

  y -= 10
  section(page, fontB, 40, y, 'Retention & Rights', col)
  y -= 22
  page.drawText('Data will be retained for 2 years after check-out and deleted automatically.', { x: 52, y, size: 10, font, color: dark }); y -= 18
  page.drawText('You have the right to access, correct, or request deletion of your data by', { x: 52, y, size: 10, font, color: dark }); y -= 18
  page.drawText('contacting the hotel directly.', { x: 52, y, size: 10, font, color: dark }); y -= 26

  // ── Consent statement box ──
  page.drawRectangle({ x: 40, y: y - 42, width: width - 80, height: 50, color: rgb(0.93, 0.99, 0.97), borderColor: col, borderWidth: 1.5 })
  page.drawText('[  X  ]', { x: 52, y: y - 14, size: 11, font: fontB, color: col })
  page.drawText('I have been informed of and CONSENT to the collection of my personal data', { x: 92, y: y - 14, size: 9, font: fontB, color: dark })
  page.drawText('as described above, for the purpose of hotel check-in registration.', { x: 92, y: y - 26, size: 9, font, color: mid })

  y -= 65

  // ── Signature area ──
  section(page, fontB, 40, y, 'Guest Signature', col)
  y -= 14

  // Signature box
  const sigBoxX = 40
  const sigBoxY = y - 100
  const sigBoxW = width - 80
  const sigBoxH = 100
  page.drawRectangle({ x: sigBoxX, y: sigBoxY, width: sigBoxW, height: sigBoxH, color: rgb(1, 1, 1), borderColor: lite, borderWidth: 1 })

  // Embed actual signature
  const pngBase64 = signatureDataUrl.replace('data:image/png;base64,', '')
  const pngBytes  = Uint8Array.from(atob(pngBase64), c => c.charCodeAt(0))
  const sigImage  = await pdfDoc.embedPng(pngBytes)

  const sigW = Math.min(sigBoxW - 40, 260)
  const sigH = 70
  page.drawImage(sigImage, {
    x: sigBoxX + (sigBoxW - sigW) / 2,
    y: sigBoxY + (sigBoxH - sigH) / 2,
    width: sigW, height: sigH,
  })

  // Signature line
  page.drawLine({
    start: { x: sigBoxX + 20, y: sigBoxY + 18 },
    end:   { x: sigBoxX + sigBoxW - 20, y: sigBoxY + 18 },
    thickness: 0.5, color: lite,
  })
  page.drawText(`${guestName}  |  Ref: ${bookingRef}  |  ${timestamp}`, {
    x: sigBoxX + 20, y: sigBoxY + 6, size: 7, font, color: rgb(0.6, 0.6, 0.6),
  })

  y = sigBoxY - 16

  // ── Footer ──
  page.drawLine({ start: { x: 40, y: 45 }, end: { x: width - 40, y: 45 }, thickness: 0.5, color: lite })
  page.drawText('This certificate was generated automatically at the time of check-in. | Laemsui Beach Resort, Surat Thani, Thailand', {
    x: 40, y: 32, size: 7, font, color: rgb(0.65, 0.65, 0.65),
  })

  return pdfDoc.save()
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function section(page: PDFPage, fontB: any, x: number, y: number, text: string, color: ReturnType<typeof rgb>) {
  page.drawText(text.toUpperCase(), { x, y, size: 9, font: fontB, color })
  page.drawLine({ start: { x, y: y - 4 }, end: { x: 555, y: y - 4 }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) })
}

function infoRow(page: PDFPage, font: any, fontB: any, x: number, y: number, label: string, value: string) {
  page.drawText(label + ':', { x, y, size: 9, font, color: rgb(0.5, 0.5, 0.5) })
  page.drawText(value,       { x: x + 90, y, size: 9, font: fontB, color: rgb(0.15, 0.15, 0.15) })
}

// ─── Original embed (kept for backwards compat) ───────────────────────────────
export async function embedSignatureInPdf(
  originalPdfBytes: ArrayBuffer,
  signatureDataUrl: string,
  guestName: string,
  bookingRef: string,
  timestamp: string,
): Promise<Uint8Array> {
  // Delegate to the new full implementation
  return addPdpaPageAndSign(originalPdfBytes, signatureDataUrl, guestName, bookingRef, timestamp)
}

// ─── File reader ──────────────────────────────────────────────────────────────
export function readPdfFile(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}
