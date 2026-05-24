import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

// Embed ลายเซ็นลงใน PDF (ทำงาน client-side ทั้งหมด)
export async function embedSignatureInPdf(
  originalPdfBytes: ArrayBuffer,
  signatureDataUrl: string,  // base64 PNG จาก signature_pad
  guestName: string,
  bookingRef: string,
  timestamp: string,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(originalPdfBytes)
  const pages  = pdfDoc.getPages()
  const lastPage = pages[pages.length - 1]
  const { width } = lastPage.getSize()

  // แปลง data URL เป็น PNG bytes
  const pngBase64 = signatureDataUrl.replace('data:image/png;base64,', '')
  const pngBytes  = Uint8Array.from(atob(pngBase64), c => c.charCodeAt(0))
  const signatureImage = await pdfDoc.embedPng(pngBytes)

  // วางลายเซ็นใกล้ด้านล่างของหน้าสุดท้าย
  const sigWidth  = 200
  const sigHeight = 60
  const sigX = width / 2 - sigWidth / 2
  const sigY = 80

  lastPage.drawImage(signatureImage, {
    x: sigX, y: sigY,
    width: sigWidth, height: sigHeight,
  })

  // เส้นใต้ลายเซ็น
  lastPage.drawLine({
    start: { x: sigX - 10,            y: sigY - 2 },
    end:   { x: sigX + sigWidth + 10, y: sigY - 2 },
    thickness: 0.5,
    color: rgb(0.5, 0.5, 0.5),
  })

  // ข้อความ timestamp + ชื่อ
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  lastPage.drawText(
    `${guestName}  |  Ref: ${bookingRef}  |  ${timestamp}`,
    { x: sigX - 10, y: sigY - 16, size: 7, font, color: rgb(0.4, 0.4, 0.4) },
  )

  return pdfDoc.save()
}

// อ่านไฟล์ PDF เป็น ArrayBuffer
export function readPdfFile(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}
