/**
 * drive.ts — uploads guest documents to Google Drive via Supabase Edge Functions
 * Uses a Shared Drive (LaemsuiBeachSharedrive) so service account has storage quota
 * Folder structure: Root / YYYY / MM-MON / BOOKING_REF /
 *
 * Speed optimisations:
 *  1. Auth token fetched ONCE and reused across all parallel calls
 *  2. ALL file uploads run in a single Promise.all (no sequential rounds)
 *  3. metadata.json fired in background after main uploads return
 */
import { createClient } from './supabase'

const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// แปลง File/Blob เป็น base64 string
export async function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// เรียก Edge Function — รับ token ที่ fetch ล่วงหน้ามาแล้ว (ไม่ต้อง fetch ซ้ำทุกครั้ง)
async function callEdgeFunction(fnName: string, body: object, token: string): Promise<any> {
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
  extraPassportPhotos?: File[]
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
    extraPassportFileIds: string[]
  }
}> {
  const { bookingRef, checkIn } = params

  // 0. Fetch auth token ONCE — reused for every upload call
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token ?? SUPABASE_ANON_KEY

  // helper: convert → upload (uses pre-fetched token)
  async function uploadFile(blob: Blob, fileName: string, mimeType: string): Promise<string> {
    const base64 = await fileToBase64(blob)
    const result = await callEdgeFunction('drive-upload', { folderId, fileName, fileBase64: base64, mimeType }, token)
    return result.fileId
  }

  // 1. Create folder
  const { folderId, folderUrl } = await callEdgeFunction('drive-create-folder', { bookingRef, checkIn }, token)

  // sanitize ชื่อแขก
  const safeName = params.guestName.trim().replace(/\s+/g, '_').replace(/[^\w฀-๿]/g, '') || 'guest'

  // 2. Upload ALL files in one parallel batch (signed PDF + photos + extras combined)
  const uploadTasks: Promise<string | null>[] = [
    uploadFile(params.signedPdf, `signed-registration_${safeName}.pdf`, 'application/pdf'),
    params.passportPhoto
      ? uploadFile(params.passportPhoto, `passport_${safeName}.jpg`, 'image/jpeg')
      : Promise.resolve(null),
    params.idcardPhoto
      ? uploadFile(params.idcardPhoto, `idcard_${safeName}.jpg`, 'image/jpeg')
      : Promise.resolve(null),
    ...(params.extraPassportPhotos?.map((photo, i) =>
      uploadFile(photo, `passport_guest${i + 2}_${safeName}.jpg`, 'image/jpeg')
    ) ?? []),
  ]

  const [signedRegistrationFileId, passportFileId, idcardFileId, ...extraPassportFileIds] =
    await Promise.all(uploadTasks) as [string, string | null, string | null, ...string[]]

  // 3. Fire metadata.json in background — user doesn't need to wait for this
  const metadata = {
    bookingRef, guestName: params.guestName, checkIn,
    staffName: params.staffName, uploadedAt: new Date().toISOString(),
    storage: 'google-drive-shared', folderId, folderUrl,
    totalGuests: 1 + extraPassportFileIds.length,
    files: {
      signedRegistration: signedRegistrationFileId,
      passport: passportFileId,
      idcard: idcardFileId,
      extraPassports: extraPassportFileIds,
    },
    system: 'Laemsui Resort Check-in v1.0',
  }
  const metaBlob = new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' })
  // Fire-and-forget — ไม่ block การ return
  uploadFile(metaBlob, 'metadata.json', 'application/json').catch(console.warn)

  return {
    folderId,
    folderUrl,
    files: {
      signedRegistrationFileId,
      passportFileId,
      idcardFileId,
      metadataFileId: null,   // uploaded in background
      extraPassportFileIds: extraPassportFileIds.filter(Boolean) as string[],
    },
  }
}

// ลบ folder ใน Google Drive (เมื่อลบ booking)
export async function deleteDriveFolder(folderId: string): Promise<void> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token ?? SUPABASE_ANON_KEY
  await callEdgeFunction('drive-delete-folder', { folderId }, token)
}
