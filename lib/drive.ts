/**
 * drive.ts — uploads guest documents to Google Drive via Supabase Edge Functions
 * Edge Functions: drive-create-folder, drive-upload
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

// อัปโหลดทุกไฟล์ของ guest record ไปยัง Google Drive
export async function finalizeGuestRecord(params: {
  bookingRef: string
  checkIn: string
  registrationPdf: Blob
  signedPdf: Blob
  passportPhoto?: File
  idcardPhoto?: File
  guestName: string
  staffName: string
}): Promise<{
  folderId: string
  folderUrl: string
  files: {
    registrationFileId: string | null
    signedRegistrationFileId: string | null
    passportFileId: string | null
    idcardFileId: string | null
    metadataFileId: string | null
  }
}> {
  const { bookingRef, checkIn } = params

  // 1. สร้าง folder hierarchy ใน Drive
  const { folderId, folderUrl } = await callEdgeFunction('drive-create-folder', {
    bookingRef,
    checkIn,
  })

  // helper: แปลง Blob เป็น base64 แล้วอัปโหลด
  async function uploadFile(
    blob: Blob,
    fileName: string,
    mimeType: string
  ): Promise<string> {
    const base64 = await fileToBase64(blob)
    const result = await callEdgeFunction('drive-upload', {
      folderId,
      fileName,
      fileBase64: base64,
      mimeType,
    })
    return result.fileId
  }

  // 2. อัปโหลดไฟล์ทีละตัว
  const registrationFileId       = await uploadFile(params.registrationPdf, 'registration.pdf',        'application/pdf')
  const signedRegistrationFileId = await uploadFile(params.signedPdf,       'signed-registration.pdf', 'application/pdf')

  const passportFileId = params.passportPhoto
    ? await uploadFile(params.passportPhoto, 'passport.jpg', 'image/jpeg')
    : null

  const idcardFileId = params.idcardPhoto
    ? await uploadFile(params.idcardPhoto, 'idcard.jpg', 'image/jpeg')
    : null

  // 3. อัปโหลด metadata.json
  const metadata = {
    bookingRef,
    guestName: params.guestName,
    checkIn,
    staffName: params.staffName,
    uploadedAt: new Date().toISOString(),
    storage: 'google-drive',
    folderId,
    folderUrl,
    files: {
      registration:       registrationFileId,
      signedRegistration: signedRegistrationFileId,
      passport:           passportFileId,
      idcard:             idcardFileId,
    },
    system: 'Laemsui Resort Check-in v1.0',
  }
  const metaBlob = new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' })
  const metadataFileId = await uploadFile(metaBlob, 'metadata.json', 'application/json')

  return {
    folderId,
    folderUrl,
    files: {
      registrationFileId,
      signedRegistrationFileId,
      passportFileId,
      idcardFileId,
      metadataFileId,
    },
  }
}
