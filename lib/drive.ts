import { createClient } from './supabase'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

// แปลง File/Blob เป็น base64 string
export async function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // ตัด "data:...;base64," prefix ออก
      resolve(result.split(',')[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// สร้าง folder structure ใน Google Drive
export async function createDriveFolder(bookingRef: string, checkIn: string) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  const response = await fetch(`${SUPABASE_URL}/functions/v1/drive-create-folder`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify({ bookingRef, checkIn }),
  })

  if (!response.ok) {
    const err = await response.json()
    throw new Error(err.error || 'Failed to create Drive folder')
  }

  return response.json() as Promise<{ folderId: string; folderUrl: string }>
}

// อัปโหลดไฟล์เดี่ยวเข้า Google Drive
export async function uploadToDrive(
  folderId: string,
  fileName: string,
  file: File | Blob,
  mimeType: string
) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const fileBase64 = await fileToBase64(file)

  const response = await fetch(`${SUPABASE_URL}/functions/v1/drive-upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify({ folderId, fileName, fileBase64, mimeType }),
  })

  if (!response.ok) {
    const err = await response.json()
    throw new Error(err.error || 'Failed to upload to Drive')
  }

  return response.json() as Promise<{
    fileId: string
    fileName: string
    webViewLink: string
    size: string
  }>
}

// อัปโหลดทุกไฟล์ของ guest record พร้อมกัน
export async function finalizeGuestRecord(params: {
  bookingRef: string
  checkIn: string
  registrationPdf: Blob
  signedPdf: Blob
  passportPhoto: File
  idcardPhoto: File
  guestName: string
  staffName: string
}) {
  // Step 1: สร้าง folder
  const { folderId, folderUrl } = await createDriveFolder(
    params.bookingRef,
    params.checkIn
  )

  // Step 2: อัปโหลดทุกไฟล์ (sequential เพื่อป้องกัน rate limit)
  const registration = await uploadToDrive(
    folderId, 'registration.pdf', params.registrationPdf, 'application/pdf'
  )
  const signed = await uploadToDrive(
    folderId, 'signed-registration.pdf', params.signedPdf, 'application/pdf'
  )
  const passport = await uploadToDrive(
    folderId, 'passport.jpg', params.passportPhoto, 'image/jpeg'
  )
  const idcard = await uploadToDrive(
    folderId, 'idcard.jpg', params.idcardPhoto, 'image/jpeg'
  )

  // Step 3: สร้าง metadata.json
  const metadata = {
    bookingRef: params.bookingRef,
    guestName: params.guestName,
    checkIn: params.checkIn,
    staffName: params.staffName,
    uploadedAt: new Date().toISOString(),
    files: {
      registration: { fileId: registration.fileId },
      signedRegistration: { fileId: signed.fileId },
      passport: { fileId: passport.fileId },
      idcard: { fileId: idcard.fileId },
    },
    system: 'Laemsui Resort Check-in v1.0',
  }

  const metadataBlob = new Blob([JSON.stringify(metadata, null, 2)], {
    type: 'application/json',
  })
  const metadataFile = await uploadToDrive(
    folderId, 'metadata.json', metadataBlob, 'application/json'
  )

  return {
    folderId,
    folderUrl,
    files: {
      registrationFileId: registration.fileId,
      signedRegistrationFileId: signed.fileId,
      passportFileId: passport.fileId,
      idcardFileId: idcard.fileId,
      metadataFileId: metadataFile.fileId,
    },
  }
}
