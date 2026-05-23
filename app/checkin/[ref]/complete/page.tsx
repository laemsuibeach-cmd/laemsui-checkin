'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient, type Booking } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { finalizeGuestRecord } from '@/lib/drive'
import { retentionExpiry } from '@/lib/utils'
import CheckinSteps from '@/components/CheckinSteps'
import toast from 'react-hot-toast'
import { CheckCircle, ExternalLink, Home, AlertCircle, Upload } from 'lucide-react'

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error'

// Step 4: ยืนยัน + Upload ทุกอย่างขึ้น Google Drive
export default function CompletePage() {
  const { ref } = useParams<{ ref: string }>()
  const router = useRouter()
  const [booking, setBooking] = useState<Booking | null>(null)
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [progress, setProgress] = useState('')
  const [driveUrl, setDriveUrl] = useState('')
  const [error, setError] = useState('')

  // ตรวจสอบว่าข้อมูลครบไหม
  const hasPdf      = !!sessionStorage.getItem(`pdf_original_${ref}`)
  const hasSigned   = !!sessionStorage.getItem(`pdf_signed_${ref}`)
  const hasPassport = !!sessionStorage.getItem(`passport_${ref}`)
  const hasIdcard   = !!sessionStorage.getItem(`idcard_${ref}`)
  const hasDoc      = hasPassport || hasIdcard
  const allReady    = hasPdf && hasSigned && hasDoc

  useEffect(() => { loadBooking() }, [ref])

  async function loadBooking() {
    const supabase = createClient()
    const { data } = await supabase
      .from('bookings').select('*').eq('booking_ref', ref).single()
    setBooking(data)
  }

  function base64ToBlob(base64: string, mimeType: string): Blob {
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
    return new Blob([bytes], { type: mimeType })
  }

  function base64ToFile(base64: string, name: string, mimeType: string): File {
    const blob = base64ToBlob(base64, mimeType)
    return new File([blob], name, { type: mimeType })
  }

  async function handleUpload() {
    if (!allReady || !booking) return
    setStatus('uploading')
    setError('')

    try {
      setProgress('กำลังสร้าง folder ใน Google Drive...')

      const originalBase64 = sessionStorage.getItem(`pdf_original_${ref}`)!
      const signedBase64   = sessionStorage.getItem(`pdf_signed_${ref}`)!
      const passportBase64 = sessionStorage.getItem(`passport_${ref}`)
      const idcardBase64   = sessionStorage.getItem(`idcard_${ref}`)

      const registrationPdf = base64ToBlob(originalBase64, 'application/pdf')
      const signedPdf       = base64ToBlob(signedBase64, 'application/pdf')
      const passportPhoto   = passportBase64 ? base64ToFile(passportBase64, 'passport.jpg', 'image/jpeg') : undefined
      const idcardPhoto     = idcardBase64   ? base64ToFile(idcardBase64,   'idcard.jpg',   'image/jpeg') : undefined

      setProgress('กำลังอัปโหลดเอกสาร...')

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const { data: staffData } = await supabase
        .from('staff').select('name').eq('id', user!.id).single()

      const result = await finalizeGuestRecord({
        bookingRef: ref,
        checkIn: booking.check_in,
        registrationPdf,
        signedPdf,
        passportPhoto,
        idcardPhoto,
        guestName: booking.guest_name,
        staffName: staffData?.name || 'Staff',
      })

      setProgress('กำลังบันทึกข้อมูล...')

      await supabase.from('guest_documents').update({
        gdrive_folder_id:             result.folderId,
        gdrive_folder_url:            result.folderUrl,
        registration_file_id:         result.files.registrationFileId,
        signed_registration_file_id:  result.files.signedRegistrationFileId,
        passport_file_id:             result.files.passportFileId,
        idcard_file_id:               result.files.idcardFileId,
        metadata_file_id:             result.files.metadataFileId,
        finalized_at:                 new Date().toISOString(),
        uploaded_at:                  new Date().toISOString(),
        retention_expires_at:         retentionExpiry(booking.check_out),
        status:                       'complete',
      }).eq('booking_ref', ref)

      await supabase.from('bookings')
        .update({ status: 'checked_in' })
        .eq('booking_ref', ref)

      await logAudit('upload_success', ref, {
        folderId: result.folderId,
        folderUrl: result.folderUrl,
      })

      const keys = ['pdf_original', 'pdf_signed', 'pdf_filename', 'signature', 'passport', 'idcard',
                    'passport_name', 'idcard_name', 'passport_type', 'idcard_type', 'doc_type']
      keys.forEach(k => sessionStorage.removeItem(`${k}_${ref}`))

      setDriveUrl(result.folderUrl)
      setStatus('success')

    } catch (err: any) {
      console.error('Upload failed:', err)
      setError(err.message || 'เกิดข้อผิดพลาดในการอัปโหลด')
      setStatus('error')

      await logAudit('upload_failed', ref, { error: err.message })
      await createClient().from('guest_documents').update({
        status: 'upload_failed',
        last_error: err.message,
        upload_retry_count: 1,
      }).eq('booking_ref', ref)
    }
  }

  // SUCCESS STATE
  if (status === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="bg-green-500 text-white px-5 py-4">
          <h1 className="text-xl font-bold">✅ Check-in สำเร็จ!</h1>
        </div>
        <CheckinSteps current={4} />

        <div className="flex-1 p-5 max-w-lg mx-auto w-full text-center">
          <CheckCircle size={80} className="text-green-500 mx-auto mb-5" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            {booking?.guest_name}
          </h2>
          <p className="text-gray-500 mb-1">ห้อง {booking?.room_number} · {ref}</p>
          <p className="text-gray-500 mb-6">
            เอกสารทั้งหมดอัปโหลดสำเร็จแล้ว
          </p>

          {driveUrl && (
            <a
              href={driveUrl} target="_blank" rel="noopener noreferrer"
              className="btn-secondary flex items-center justify-center gap-2 w-full mb-4"
            >
              <ExternalLink size={18} /> ดูไฟล์ที่เซ็นแล้ว
            </a>
          )}

          <button
            onClick={() => router.push('/dashboard')}
            className="btn-primary w-full flex items-center justify-center gap-2 text-lg"
          >
            <Home size={20} /> กลับหน้าหลัก
          </button>
        </div>
      </div>
    )
  }

  const docLabel = hasPassport ? '📷 รูปเอกสาร (Passport)' : hasIdcard ? '🪪 รูปเอกสาร (บัตรประชาชน)' : '📷 รูปเอกสาร'

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-resort-teal text-white px-5 py-4">
        <button onClick={() => router.push(`/checkin/${ref}/passport`)} className="flex items-center gap-2 text-teal-200 mb-1">
          ← กลับ
        </button>
        <h1 className="text-xl font-bold">ยืนยัน & อัปโหลด</h1>
      </header>
      <CheckinSteps current={4} />

      <div className="flex-1 p-5 max-w-lg mx-auto w-full">
        <h2 className="text-lg font-bold text-gray-800 mb-4">สรุปเอกสารที่จะอัปโหลด</h2>

        {/* Checklist */}
        <div className="card space-y-3 mb-5">
          <FileStatusRow label="📄 Registration Form (Original)" ready={hasPdf} />
          <FileStatusRow label="✍️ Registration Form (เซ็นแล้ว)"  ready={hasSigned} />
          <FileStatusRow label={docLabel}                          ready={hasDoc} />
        </div>

        {!allReady && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 flex gap-3">
            <AlertCircle size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-700">
              <p className="font-semibold mb-1">ยังขาดเอกสาร</p>
              {!hasPdf    && <p>• กลับไป อัปโหลด Registration Form</p>}
              {!hasSigned && <p>• กลับไป เซ็นชื่อ</p>}
              {!hasDoc    && <p>• กลับไป ถ่ายรูปเอกสาร (Passport หรือ บัตรประชาชน)</p>}
            </div>
          </div>
        )}

        {/* Storage destination */}
        <div className="card bg-blue-50 border-blue-100 text-sm mb-5">
          <p className="font-semibold text-blue-700 mb-1">📁 จะบันทึกไว้ที่</p>
          <p className="text-blue-600 font-mono">
            Guest Documents / {booking?.check_in?.slice(0,4)} / {new Date(booking?.check_in || Date.now()).toLocaleString('en', {month:'short'}).toUpperCase()} / {ref}
          </p>
        </div>

        {/* Error state */}
        {status === 'error' && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 flex gap-3">
            <AlertCircle size={20} className="text-red-500 flex-shrink-0" />
            <div className="text-sm text-red-700">
              <p className="font-semibold">อัปโหลดไม่สำเร็จ</p>
              <p className="mt-1">{error}</p>
              <p className="mt-1">กรุณาตรวจสอบ internet แล้วลองใหม่</p>
            </div>
          </div>
        )}

        {/* Upload Button */}
        <button
          onClick={handleUpload}
          disabled={!allReady || status === 'uploading'}
          className="btn-primary w-full text-lg flex items-center justify-center gap-2"
        >
          {status === 'uploading' ? (
            <>
              <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              {progress || 'กำลังอัปโหลด...'}
            </>
          ) : (
            <>
              <Upload size={20} />
              {status === 'error' ? '🔄 ลองอีกครั้ง' : '☁️ อัปโหลดทุกอย่าง'}
            </>
          )}
        </button>
      </div>
    </div>
  )
}

function FileStatusRow({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-700">{label}</span>
      {ready ? (
        <span className="text-green-500 font-semibold text-sm">✅ พร้อม</span>
      ) : (
        <span className="text-red-400 font-semibold text-sm">❌ ขาด</span>
      )}
    </div>
  )
}
