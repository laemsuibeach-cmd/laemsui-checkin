'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient, type Booking } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { finalizeGuestRecord } from '@/lib/drive'
import { useCheckinContext } from '../layout'
import { retentionExpiry } from '@/lib/utils'
import CheckinSteps from '@/components/CheckinSteps'
import toast from 'react-hot-toast'
import { CheckCircle, ExternalLink, Home, AlertCircle, Upload, Cloud, RefreshCw } from 'lucide-react'
import CheckinNav from '@/components/CheckinNav'

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error'

export default function CompletePage() {
  const { ref } = useParams<{ ref: string }>()
  const router = useRouter()
  const { extraPassports: ctxExtraPassports, clearExtraPassports } = useCheckinContext()
  const [booking, setBooking]     = useState<Booking | null>(null)
  const [bookingError, setBookingError] = useState(false)
  const [status, setStatus]       = useState<UploadStatus>('idle')
  const [progress, setProgress]   = useState('')
  const [driveUrl, setDriveUrl]   = useState('')
  const [error, setError]         = useState('')
  const [failedFiles, setFailedFiles] = useState<string[]>([])
  const retryCountRef = useRef(0)

  const hasPdf    = !!sessionStorage.getItem(`pdf_original_${ref}`)
  const hasSigned = !!sessionStorage.getItem(`pdf_signed_${ref}`)
  const hasPassport = !!sessionStorage.getItem(`passport_${ref}`)
  const hasIdcard   = !!sessionStorage.getItem(`idcard_${ref}`)
  const hasDoc      = hasPassport || hasIdcard

  // #5 fix: ใช้ Context.length แทน sessionStorage count เพื่อให้ตรงกับ Files จริง
  const extraPassportCount = ctxExtraPassports.length
  // ตรวจสอบ: sessionStorage บอกว่ามี extra แต่ Context หาย (refresh กลางทาง)
  const storedCount = parseInt(sessionStorage.getItem(`passport_extra_count_${ref}`) || '0')
  const extraPassportsMissing = storedCount > 0 && ctxExtraPassports.length === 0

  const allReady = hasPdf && hasSigned

  useEffect(() => { loadBooking() }, [ref])

  async function loadBooking() {
    setBookingError(false)  // #12 fix: reset ก่อน retry เสมอ
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('bookings').select('*').eq('booking_ref', ref).single()
      if (error || !data) { setBookingError(true); return }
      setBooking(data)
    } catch {
      setBookingError(true)  // #6 fix: track booking load failure
    }
  }

  function base64ToBlob(base64: string, mimeType: string): Blob {
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
    return new Blob([bytes], { type: mimeType })
  }

  function base64ToFile(base64: string, name: string, mimeType: string): File {
    return new File([base64ToBlob(base64, mimeType)], name, { type: mimeType })
  }

  async function handleUpload() {
    if (!allReady) return

    // #6 fix: บอกสาเหตุถ้า booking โหลดไม่ขึ้น
    if (!booking) {
      toast.error('โหลดข้อมูล Booking ไม่สำเร็จ — กรุณา Refresh หน้านี้แล้วลองใหม่')
      return
    }

    setStatus('uploading'); setError(''); setFailedFiles([])

    try {
      setProgress('กำลังเตรียมไฟล์...')

      // #13 fix: null check แทน ! — ถ้าหายระหว่าง session ให้แจ้ง error ชัดเจน
      const signedBase64 = sessionStorage.getItem(`pdf_signed_${ref}`)
      if (!signedBase64) {
        toast.error('ไม่พบไฟล์ที่เซ็น — กรุณากลับไปเซ็นใหม่')
        setStatus('idle')
        return
      }
      const passportBase64 = sessionStorage.getItem(`passport_${ref}`)
      const idcardBase64   = sessionStorage.getItem(`idcard_${ref}`)

      setProgress('กำลังอัปโหลด...')
      const supabase = createClient()

      // #2 fix: ตรวจ user ก่อน ถ้า null แสดง error แทน crash
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('Session หมดอายุ — กรุณา Login ใหม่')
        router.push('/login')
        return
      }

      const { data: staffData } = await supabase
        .from('staff').select('name').eq('id', user.id).single()

      const result = await finalizeGuestRecord({
        bookingRef: ref,
        checkIn: booking.check_in,
        signedPdf:           base64ToBlob(signedBase64, 'application/pdf'),
        passportPhoto:       passportBase64 ? base64ToFile(passportBase64, 'passport.jpg', 'image/jpeg') : undefined,
        idcardPhoto:         idcardBase64   ? base64ToFile(idcardBase64,   'idcard.jpg',   'image/jpeg') : undefined,
        extraPassportPhotos: ctxExtraPassports.length > 0 ? ctxExtraPassports : undefined,
        guestName: booking.guest_name,
        staffName: staffData?.name || 'Staff',
      })

      // #11 fix (Critical): ถ้า signed PDF upload ไม่สำเร็จ → หยุดทันที อย่าบันทึก checked_in
      if (!result.files.signedRegistrationFileId) {
        throw new Error('ไม่สามารถอัปโหลด Registration Form ที่เซ็นแล้วได้ — เอกสารสำคัญหาย กรุณาลองใหม่')
      }

      // #8 fix: แจ้งถ้ามีไฟล์อื่น upload ไม่สำเร็จบางส่วน (เอกสารรอง เช่น รูป passport)
      if (result.files.failedUploads.length > 0) {
        setFailedFiles(result.files.failedUploads)
      }

      setProgress('กำลังบันทึกข้อมูล...')
      await supabase.from('guest_documents').upsert({
        booking_ref:                 ref,
        staff_id:                    user.id,
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
      }, { onConflict: 'booking_ref' })

      await supabase.from('bookings').update({ status: 'checked_in' }).eq('booking_ref', ref)
      await logAudit('upload_success', ref, {
        folderId: result.folderId,
        folderUrl: result.folderUrl,
        failedUploads: result.files.failedUploads,
      })

      ;['pdf_original', 'pdf_signed', 'pdf_filename', 'signature', 'passport', 'idcard',
        'passport_name', 'idcard_name', 'passport_type', 'idcard_type', 'doc_type',
        'passport_extra_count']
        .forEach(k => sessionStorage.removeItem(`${k}_${ref}`))
      clearExtraPassports()

      setDriveUrl(result.folderUrl)
      setStatus('success')
    } catch (err: any) {
      console.error('Upload failed:', err)
      setError(err.message || 'เกิดข้อผิดพลาดในการอัปโหลด')
      setStatus('error')
      retryCountRef.current += 1  // #14 fix: นับจริง ไม่ hardcode
      await logAudit('upload_failed', ref, { error: err.message })
      await createClient().from('guest_documents').update({
        status: 'upload_failed', last_error: err.message, upload_retry_count: retryCountRef.current,
      }).eq('booking_ref', ref)
    }
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
          <p className="text-gray-500 mb-4">เอกสารทั้งหมดอัปโหลดสำเร็จแล้ว</p>

          {/* แสดง warning ถ้ามีไฟล์บางไฟล์ upload ไม่สำเร็จ */}
          {failedFiles.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-left w-full max-w-sm">
              <p className="text-amber-700 font-semibold text-sm mb-1">⚠️ ไฟล์บางไฟล์ upload ไม่สำเร็จ</p>
              {failedFiles.map(f => (
                <p key={f} className="text-amber-600 text-xs">• {f}</p>
              ))}
              <p className="text-amber-600 text-xs mt-1">เอกสารหลักบันทึกครบแล้ว แต่รูปบางรูปอาจขาด</p>
            </div>
          )}

          <div className="w-full space-y-3 max-w-sm">
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

  const docLabel = hasPassport
    ? `📷 Passport${extraPassportCount > 0 ? ` (+${extraPassportCount} แขกเพิ่ม)` : ''}`
    : hasIdcard ? '🪪 บัตรประชาชน' : '📷 รูปเอกสาร'

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

      <div className="flex-1 p-5 lg:p-8 max-w-lg lg:max-w-5xl mx-auto w-full">
        <div className="lg:grid lg:grid-cols-2 lg:gap-8 lg:items-start">

          {/* LEFT: Checklist */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-800">สรุปเอกสารที่จะอัปโหลด</h2>

            {/* #6 fix: แสดง error ถ้า booking โหลดไม่ขึ้น */}
            {bookingError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
                <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-700">
                  <p className="font-semibold">โหลดข้อมูล Booking ไม่สำเร็จ</p>
                  <p className="mt-1">กรุณา Refresh หน้านี้ หรือกลับ Dashboard แล้วลองใหม่</p>
                  <button onClick={loadBooking}
                    className="mt-2 flex items-center gap-1 text-red-600 font-semibold underline text-xs">
                    <RefreshCw size={12} /> ลองโหลดใหม่
                  </button>
                </div>
              </div>
            )}

            <div className="card space-y-3">
              <FileStatusRow label="📄 Registration Form (ต้นฉบับ)" ready={hasPdf}    required />
              <FileStatusRow label="✍️ Registration Form (เซ็นแล้ว)"  ready={hasSigned} required />
              <FileStatusRow label={docLabel}                           ready={hasDoc}    required={false} />
            </div>

            {/* #3 fix: warning ถ้า refresh ทำให้ extra passports หาย */}
            {extraPassportsMissing && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
                <AlertCircle size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-700">
                  <p className="font-semibold">รูป Passport เพิ่มเติมหาย</p>
                  <p className="mt-1">เกิดจากการ Refresh หน้า — กรุณากลับหน้าถ่ายรูปแล้วถ่าย Passport ใหม่อีกครั้ง</p>
                </div>
              </div>
            )}

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

          {/* RIGHT: Upload button */}
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
              disabled={!allReady || status === 'uploading' || bookingError}
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
            