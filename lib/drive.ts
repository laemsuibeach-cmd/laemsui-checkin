/**
 * drive.ts — now uses Supabase Storage instead of Google Drive
 * Bucket: guest-documents (private, authenticated access only)
 * Path:   {year}/{month-shortname}/{bookingRef}/{filename}
 */
import { createClient } from './supabase'

const BUCKET = 'guest-documents'

// แปลง File/Blob เป็น base64 string (ยังคงใช้ใน sign page)
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

// สร้าง path prefix สำหรับ booking นี้
function storagePath(checkIn: string, bookingRef: string, filename: string): string {
  const year  = checkIn.slice(0, 4)
  const month = new Date(checkIn).toLocaleString('en', { month: 'short' }).toUpperCase()
  return `${year}/${month}/${bookingRef}/${filename}`
}

// อัปโหลดไฟล์เดี่ยวเข้า Supabase Storage
export async function uploadToStorage(
  path: string,
  file: File | Blob,
  mimeType: string
): Promise<{ path: string; url: string }> {
  const supabase = createClient()

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType: mimeType,
      upsert: true,
    })

  if (error) throw new Error(`Storage upload failed: ${error.message}`)

  // สร้าง signed URL อายุ 7 วัน (สำหรับ private bucket)
  const { data: signedData, error: signErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 7)

  if (signErr || !signedData?.signedUrl) {
    // Fallback: return path only
    return { path, url: '' }
  }

  return { path, url: signedData.signedUrl }
}

// อัปโหลดทุกไฟล์ของ guest record
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

  // Upload registration PDF
  const reg = await uploadToStorage(
    storagePath(checkIn, bookingRef, 'registration.pdf'),
    params.registrationPdf,
    'application/pdf'
  )

  // Upload signed PDF
  const signed = await uploadToStorage(
    storagePath(checkIn, bookingRef, 'signed-registration.pdf'),
    params.signedPdf,
    'application/pdf'
  )

  // Upload passport (if any)
  const passport = params.passportPhoto
    ? await uploadToStorage(
        storagePath(checkIn, bookingRef, 'passport.jpg'),
        params.passportPhoto,
        'image/jpeg'
      )
    : null

  // Upload ID card (if any)
  const idcard = params.idcardPhoto
    ? await uploadToStorage(
        storagePath(checkIn, bookingRef, 'idcard.jpg'),
        params.idcardPhoto,
        'image/jpeg'
      )
    : null

  // Upload metadata.json
  const metadata = {
    bookingRef,
    guestName: params.guestName,
    checkIn,
    staffName: params.staffName,
    uploadedAt: new Date().toISOString(),
    storage: 'supabase',
    bucket: BUCKET,
    files: {
      registration:      reg.path,
      signedRegistration: signed.path,
      passport:          passport?.path ?? null,
      idcard:            idcard?.path   ?? null,
    },
    system: 'Laemsui Resort Check-in v1.0',
  }

  const metaBlob = new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' })
  const meta = await uploadToStorage(
    storagePath(checkIn, bookingRef, 'metadata.json'),
    metaBlob,
    'application/json'
  )

  // folderUrl = signed URL ของ signed PDF (สิ่งที่พนักงานอยากดูบ่อยที่สุด)
  const year  = checkIn.slice(0, 4)
  const month = new Date(checkIn).toLocaleString('en', { month: 'short' }).toUpperCase()
  const folderPath = `${year}/${month}/${bookingRef}`

  return {
    folderId:  folderPath,
    folderUrl: signed.url || reg.url,   // signed URL ของ PDF ที่เซ็นแล้ว
    files: {
      registrationFileId:        reg.path,
      signedRegistrationFileId:  signed.path,
      passportFileId:            passport?.path  ?? null,
      idcardFileId:              idcard?.path    ?? null,
      metadataFileId:            meta.path,
    },
  }
}
