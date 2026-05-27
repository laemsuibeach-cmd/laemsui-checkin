/**
 * drive.ts — uploads guest documents to Google Drive via Supabase Edge Functions
 * Uses a Shared Drive (LaemsuiBeachSharedrive) so service account has storage quota
 * Folder structure: Root / YYYY / MM-MON / BOOKING_REF /
 *
 * Speed optimisations:
 *  1. Auth token fetched ONCE and reused across all parallel calls
 *  2. ALL file uploads run in a single Promise.allSettled (no sequential rounds)
 *  3. uploadFile defined AFTER folderId is assigned (avoids TDZ issue)
 */
import { createClient } from './supabase'

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL!
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

// เรียก Edge Function — รับ token ที่ fetch ล่วงหน้า (ไม่ต้อง fetch ซ้ำทุก call)
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
    failedUploads: string[]   // ชื่อไฟล์ที่ upload ไม่สำเร็จ
  }
}> {
  const { bookingRef, checkIn } = params

  // 0. Fetch auth token ONCE
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token ?? SUPABASE_ANON_KEY

  // 1. Create folder
  const { folderId, folderUrl } = await callEdgeFunction(
    'drive-create-folder', { bookingRef, checkIn }, token
  )

  // helper: convert → upload  (defined AFTER folderId is assigned — avoids TDZ bug)
  async function uploadFile(blob: Blob, fileName: string, mimeType: string): Promise<string> {
    const base64 = await fileToBase64(blob)
    const result = await callEdgeFunction(
      'drive-upload', { folderId, fileName, fileBase64: base64, mimeType }, token
    )
    return result.fileId
  }

  // sanitize ชื่อแขก
  const safeName = params.guestName.trim().replace(/\s+/g, '_').replace(/[^\w฀-๿]/g, '') || 'guest'

  // 2. Upload ALL files in ONE parallel batch using Promise.allSettled
  //    (allSettled = ไฟล์บางไฟล์ fail ไม่ทำให้ทั้งหมดพัง)
  type UploadTask = { blob: Blob; name: string; mime: string; key: string }
  const tasks: UploadTask[] = [
    { blob: params.signedPdf,  name: `signed-registration_${safeName}.pdf`, mime: 'application/pdf', key: 'signed' },
    ...(params.passportPhoto ? [{ blob: params.passportPhoto, name: `passport_${safeName}.jpg`,  mime: 'image/jpeg', key: 'passport' }] : []),
    ...(params.idcardPhoto   ? [{ blob: params.idcardPhoto,   name: `idcard_${safeName}.jpg`,    mime: 'image/jpeg', key: 'idcard'   }] : []),
    ...(params.extraPassportPhotos?.map((photo, i) => ({
      blob: photo, name: `passport_guest${i + 2}_${safeName}.jpg`, mime: 'image/jpeg', key: `extra_${i}`,
    })) ?? []),
  ]

  const results = await Promise.allSettled(
    tasks.map(t => uploadFile(t.blob, t.name, t.mime))
  )

  // แยก success / failed
  const failedUploads: string[] = []
  const fileIdMap: Record<string, string | null> = {}
  tasks.forEach((t, i) => {
    const r = results[i]
    if (r.status === 'fulfilled') {
      fileIdMap[t.key] = r.value
    } else {
      fileIdMap[t.key] = null
      failedUploads.push(t.name)
      console.warn(`Upload failed for ${t.name}:`, r.reason)
    }
  })

  const signedRegistrationFileId = fileIdMap['signed'] ?? null
  const passportFileId           = fileIdMap['passport'] ?? null
  const idcardFileId             = fileIdMap['idcard'] ?? null
  const extraPassportFileIds     = (params.extraPassportPhotos ?? [])
    .map((_, i) => fileIdMap[`extra_${i}`])
    .filter((id): id is string => id !== null)

  // 3. Upload metadata.json (รอ file IDs ก่อน เพื่อให้ข้อมูลครบ)
  const metadata = {
    bookingRef, guestName: params.guestName, checkIn,
    staffName: params.staffName, uploadedAt: new Date().toISOString(),
    storage: 'google-drive-shared', folderId, folderUrl,
    totalGuests: 1 + extraPassportFileIds.length,
    failedUploads,
    files: {
      signedRegistration: signedRegistrationFileId,
      passport: passportFileId, idcard: idcardFileId,
      extraPassports: extraPassportFileIds,
    },
    system: 'Laemsui Resort Check-in v1.0',
  }
  const metaBlob = new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' })
  let metadataFileId: string | null = null
  try {
    metadataFileId = await uploadFile(metaBlob, 'metadata.json', 'application/json')
  } catch (e) {
    console.warn('metadata.json upload failed (non-critical):', e)
  }

  return {
    folderId,
    folderUrl,
    files: { signedRegistrationFileId, passportFileId, idcardFileId, metadataFileId, extraPassportFileIds, failedUploads },
  }
}

// ลบ folder ใน Google Drive (เมื่อลบ booking)
export async function deleteDriveFolder(folderId: string): Promise<void> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token ?? SUPABASE_ANON_KEY
  await callEdgeFunction('drive-delete-folder', { folderId }, token)
}
