'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient, type Booking } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { finalizeGuestRecord } from '@/lib/drive'
import { retentionExpiry } from '@/lib/utils'
import CheckinSteps from '@/components/CheckinSteps'
import toast from 'react-hot-toast'
import { CheckCircle, ExternalLink, Home, AlertCircle, Upload, Cloud } from 'lucide-react'

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error'

// Step 4: ยืนยัน + Upload ทุกอย่างขึ้น Supabase Storage
export default function CompletePage() {
  const { ref } = useParams<{ ref: string }>()
  const router = useRouter()
  const [booking, setBooking] = useState<Booking | null>(null)
  const [status, setStatus]   = useState<UploadStatus>('idle')
  const [progress, setProgress] = useState('')
  const [driveUrl, setDriveUrl] = useState('')
  const [error, setError]     = useState('')
  const [showActivities, setShowActivities] = useState(false)

  const hasPdf      = !!sessionStorage.getItem(`pdf_original_${ref}`)
  const hasSigned   = !!sessionStorage.getItem(`pdf_signed_${ref}`)
  const hasPassport = !!sessionStorage.getItem(`passport_${ref}`)
  const hasIdcard   = !!sessionStorage.getItem(`idcard_${ref}`)
  const hasDoc      = hasPassport || hasIdcard
  const allReady    = hasPdf && hasSigned  // รูปเอกสารเป็น optional

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
    return new File([base64ToBlob(base64, mimeType)], name, { type: mimeType })
  }

  async function handleUpload() {
    if (!allReady || !booking) return
    setStatus('uploading'); setError('')
    try {
      setProgress('กำลังเตรียมไฟล์...')
      const signedBase64 = sessionStorage.getItem(`pdf_signed_${ref}`)!
      const passportBase64 = sessionStorage.getItem(`passport_${ref}`)
      const idcardBase64   = sessionStorage.getItem(`idcard_${ref}`)

      setProgress('กำลังอัปโหลด...')
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const { data: staffData } = await supabase
        .from('staff').select('name').eq('id', user!.id).single()

      const result = await finalizeGuestRecord({
        bookingRef: ref,
        checkIn: booking.check_in,
        signedPdf:     base64ToBlob(signedBase64, 'application/pdf'),
        passportPhoto: passportBase64 ? base64ToFile(passportBase64, 'passport.jpg', 'image/jpeg') : undefined,
        idcardPhoto:   idcardBase64   ? base64ToFile(idcardBase64,   'idcard.jpg',   'image/jpeg') : undefined,
        guestName: booking.guest_name,
        staffName: staffData?.name || 'Staff',
      })

      setProgress('กำลังบันทึกข้อมูล...')
      await supabase.from('guest_documents').update({
        gdrive_folder_id:            result.folderId,
        gdrive_folder_url:           result.folderUrl,
        registration_file_id:        null,
        signed_registration_file_id: result.files.signedRegistrationFileId,
        passport_file_id:            result.files.passportFileId,
        idcard_file_id:              result.files.idcardFileId,
        metadata_file_id:            result.files.metadataFileId,
        finalized_at:                new Date().toISOString(),
        uploaded_at:                 new Date().toISOString(),
        retention_expires_at:        retentionExpiry(booking.check_out),
        status:                      'complete',
      }).eq('booking_ref', ref)

      await supabase.from('bookings').update({ status: 'checked_in' }).eq('booking_ref', ref)
      await logAudit('upload_success', ref, { folderId: result.folderId, folderUrl: result.folderUrl })

      ;['pdf_original', 'pdf_signed', 'pdf_filename', 'signature', 'passport', 'idcard',
        'passport_name', 'idcard_name', 'passport_type', 'idcard_type', 'doc_type']
        .forEach(k => sessionStorage.removeItem(`${k}_${ref}`))

      setDriveUrl(result.folderUrl)
      setStatus('success')
    } catch (err: any) {
      console.error('Upload failed:', err)
      setError(err.message || 'เกิดข้อผิดพลาดในการอัปโหลด')
      setStatus('error')
      await logAudit('upload_failed', ref, { error: err.message })
      await createClient().from('guest_documents').update({
        status: 'upload_failed', last_error: err.message, upload_retry_count: 1,
      }).eq('booking_ref', ref)
    }
  }

  /* ── ACTIVITIES STATE ── */
  if (status === 'success' && showActivities) {
    return (
      <div className="h-screen bg-white flex flex-col overflow-hidden">
        <header className="bg-resort-teal text-white px-5 lg:px-8 py-3 flex-shrink-0 flex items-center justify-between">
          <div>
            <button onClick={() => setShowActivities(false)}
                    className="flex items-center gap-2 text-teal-200 mb-0.5 text-sm">
              ← กลับ
            </button>
            <h1 className="text-xl font-bold">กิจกรรม &amp; สิ่งอำนวยความสะดวก</h1>
          </div>
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/15
                       hover:bg-white/25 text-white text-sm font-semibold transition-colors"
          >
            <Home size={16} /> หน้าหลัก
          </button>
        </header>
        {/* object tag รองรับ iOS Safari ดีกว่า iframe สำหรับ PDF */}
        <object
          data="/activities.pdf"
          type="application/pdf"
          className="flex-1 w-full border-0"
        >
          {/* Fallback สำหรับ browser ที่ไม่รองรับ embed PDF */}
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
            <p className="text-gray-500 text-base">กรุณาเปิด PDF ในหน้าต่างใหม่</p>
            <a
              href="/activities.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary flex items-center gap-2 px-6 py-3"
            >
              <ExternalLink size={18} /> เปิด PDF
            </a>
          </div>
        </object>
      </div>
    )
  }

  /* ── SUCCESS STATE ── */
  if (status === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="bg-green-500 text-white px-5 lg:px-8 py-4">
          <h1 className="text-xl font-bold">✅ Check-in สำเร็จ!</h1>
        </div>
        <CheckinSteps current={4} />

        <div className="flex-1 p-5 lg:p-8 max-w-lg lg:max-w-3xl mx-auto w-full
                        flex flex-col items-center justify-center text-center">
          <CheckCircle size={80} className="text-green-500 mb-5" />
          <h2 className="text-2xl font-bold text-gray-800 mb-1">{booking?.guest_name}</h2>
          <p className="text-gray-500 mb-1">ห้อง {booking?.room_number} · {ref}</p>
          <p className="text-gray-500 mb-8">เอกสารทั้งหมดอัปโหลดสำเร็จแล้ว</p>

          <div className="w-full space-y-3 max-w-sm">
            {/* Activities brochure — แสดงให้ guest ดู */}
            <button
              onClick={() => setShowActivities(true)}
              className="btn-primary w-full flex items-center justify-center gap-2 text-lg lg:py-5 lg:text-xl"
            >
              🏖️ แนะนำกิจกรรม &amp; สิ่งอำนวยความสะดวก
            </button>

            {driveUrl && (
              <a href={driveUrl} target="_blank" rel="noopener noreferrer"
                 className="btn-secondary flex items-center justify-center gap-2 w-full">
                <ExternalLink size={18} /> ดูไฟล์ที่เซ็นแล้ว
              </a>
            )}
            <button
              onClick={() => router.push('/dashboard')}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl
                         font-semibold text-gray-500 hover:text-gray-700 transition-colors text-sm"
            >
              <Home size={18} /> กลับหน้าหลัก
            </button>
          </div>
        </div>
      </div>
    )
  }

  const docLabel = hasPassport ? '📷 Passport' : hasIdcard ? '🪪 บัตรประชาชน' : '📷 รูปเอกสาร'

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-resort-teal text-white px-5 lg:px-8 py-3 lg:py-4">
        <button onClick={() => router.push(`/checkin/${ref}/passport`)}
                className="flex items-center gap-2 text-teal-200 mb-1">
          ← กลับ
        </button>
        <h1 className="text-xl font-bold">ยืนยัน &amp; อัปโหลด</h1>
      </header>
      <CheckinSteps current={4} />

      {/* ── Content: 1-col portrait / 2-col landscape ── */}
      <div className="flex-1 p-5 lg:p-8 max-w-lg lg:max-w-5xl mx-auto w-full">
        <div className="lg:grid lg:grid-cols-2 lg:gap-8 lg:items-start">

          {/* LEFT: Checklist + storage info */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-800">สรุปเอกสารที่จะอัปโหลด</h2>

            <div className="card space-y-3">
              <FileStatusRow label="📄 Registration Form (ต้นฉบับ)" ready={hasPdf}    required />
              <FileStatusRow label="✍️ Registration Form (เซ็นแล้ว)"  ready={hasSigned} required />
              <FileStatusRow label={docLabel}                           ready={hasDoc}    required={false} />
            </div>

            {!allReady && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
                <AlertCircle size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-700">
                  <p className="font-semibold mb-1">ยังขาดเอกสาร</p>
                  {!hasPdf    && <p>• กลับไป อัปโหลด Registration Form</p>}
                  {!hasSigned && <p>• กลับไป เซ็นชื่อ</p>}
                </div>
              </div>
            )}

            {/* Storage path */}
            <div className="card bg-blue-50 border-blue-100 text-sm">
              <p className="font-semibold text-blue-700 mb-1 flex items-center gap-1">
                <Cloud size={14} /> จะบันทึกที่
              </p>
              <p className="text-blue-600 font-mono text-xs break-all">
                {booking?.check_in?.slice(0,4)} /&nbsp;
                {new Date(booking?.check_in || Date.now())
                  .toLocaleString('en', { month: 'short' }).toUpperCase()} /&nbsp;
                {ref}
              </p>
            </div>
          </div>

          {/* RIGHT: Error + Upload button */}
          <div className="mt-5 lg:mt-0 space-y-4">
            {status === 'error' && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
                <AlertCircle size={20} className="text-red-500 flex-shrink-0" />
                <div className="text-sm text-red-700">
                  <p className="font-semibold">อัปโหลดไม่สำเร็จ</p>
                  <p className="mt-1">{error}</p>
                  <p className="mt-1">กรุณาตรวจสอบ internet แล้วลองใหม่</p>
                </div>
              </div>
            )}

            <button
              onClick={handleUpload}
              disabled={!allReady || status === 'uploading'}
              className="btn-primary w-full text-lg flex items-center justify-center gap-2 lg:py-5 lg:text-xl"
            >
              {status === 'uploading' ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  {progress || 'กำลังอัปโหลด...'}
                </>
              ) : (
                <>
                  <Upload size={22} />
                  {status === 'error' ? '🔄 ลองอีกครั้ง' : '☁️ อัปโหลดทุกอย่าง'}
                </>
              )}
            </button>

            {allReady && status === 'idle' && (
              <p className="text-xs text-gray-400 text-center">
                กดปุ่มด้านบนเพื่ออัปโหลดเอกสารทั้งหมดขึ้น Cloud
              </p>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}

function FileStatusRow({
  label, ready, required = true,
}: { label: string; ready: boolean; required?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-700">{label}</span>
      {ready ? (
        <span className="text-green-500 font-semibold text-sm">✅ พร้อม</span>
      ) : required ? (
        <span className="text-red-400 font-semibold text-sm">❌ ขาด</span>
      ) : (
        <span className="text-gray-400 font-semibold text-sm">— ข้าม</span>
      )}
    </div>
  )
}
