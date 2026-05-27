/**
 * drive.ts — uploads guest documents to Google Drive via Supabase Edge Functions
 * Uses a Shared Drive (LaemsuiBeachSharedrive) so service account has storage quota
 * Folder structure: Root / YYYY / MM-MON / BOOKING_REF /
 */
import { createClient } from './supabase'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// แปลง File/Blob เป็น base64 string
export async function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// เรียก Edge Function พร้อม auth header
async function callEdgeFunction(fnName: string, body: object): Promise<any> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token ?? SUPABASE_ANON_KEY

  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `Edge Function ${fnName} failed (${res.status})`)
  return data
}

// อัปโหลดทุกไฟล์ของ guest record ไปยัง Google Shared Drive
export async function finalizeGuestRecord(params: {
  bookingRef: string
  checkIn: string
  signedPdf: Blob
  passportPhoto?: File
  idcardPhoto?: File
  guestName: string
  staffName: string
}): Promise<{
  folderId: string
  folderUrl: string
  files: {
    signedRegistrationFileId: string | null
    passportFileId: string | null
    idcardFileId: string | null
    metadataFileId: string | null
  }
}> {
  const { bookingRef, checkIn } = params

  // 1. สร้าง folder hierarchy ใน Shared Drive
  const { folderId, folderUrl } = await callEdgeFunction('drive-create-folder', {
    bookingRef,
    checkIn,
  })

  // helper: แปลง Blob เป็น base64 แล้วอัปโหลด
  async function uploadFile(blob: Blob, fileName: string, mimeType: string): Promise<string> {
    const base64 = await fileToBase64(blob)
    const result = await callEdgeFunction('drive-upload', {
      folderId,
      fileName,
      fileBase64: base64,
      mimeType,
    })
    return result.fileId
  }

  // sanitize ชื่อแขกสำหรับใส่ในชื่อไฟล์ (แทน space ด้วย _ ลบอักขระพิเศษ)
  const safeName = params.guestName.trim().replace(/\s+/g, '_').replace(/[^\w฀-๿]/g, '') || 'guest'

  // 2. อัปโหลดไฟล์ทั้งหมดพร้อมกัน (parallel) — เฉพาะไฟล์ที่เซ็นแล้วเท่านั้น
  const [
    signedRegistrationFileId,
    passportFileId,
    idcardFileId,
  ] = await Promise.all([
    uploadFile(params.signedPdf, `signed-registration_${safeName}.pdf`, 'application/pdf'),
    params.passportPhoto
      ? uploadFile(params.passportPhoto, `passport_${safeName}.jpg`, 'image/jpeg')
      : Promise.resolve(null),
    params.idcardPhoto
      ? uploadFile(params.idcardPhoto, `idcard_${safeName}.jpg`, 'image/jpeg')
      : Promise.resolve(null),
  ])

  // 3. อัปโหลด metadata.json (ต้องรอ file IDs ข้างบนก่อน)
  const metadata = {
    bookingRef, guestName: params.guestName, checkIn,
    staffName: params.staffName, uploadedAt: new Date().toISOString(),
    storage: 'google-drive-shared', folderId, folderUrl,
    files: {
      signedRegistration: signedRegistrationFileId,
      passport: passportFileId, idcard: idcardFileId,
    },
    system: 'Laemsui Resort Check-in v1.0',
  }
  const metaBlob = new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' })
  const metadataFileId = await uploadFile(metaBlob, 'metadata.json', 'application/json')

  return {
    folderId,
    folderUrl,
    files: { signedRegistrationFileId, passportFileId, idcardFileId, metadataFileId },
  }
}

// ลบ folder ใน Google Drive (เมื่อลบ booking)
export async function deleteDriveFolder(folderId: string): Promise<void> {
  await callEdgeFunction('drive-delete-folder', { folderId })
}
