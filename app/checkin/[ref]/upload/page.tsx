'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient, type Booking } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { readPdfFile } from '@/lib/pdf'
import CheckinSteps from '@/components/CheckinSteps'
import toast from 'react-hot-toast'
import { Upload, FileText, ArrowRight, ArrowLeft, CheckCircle, Tablet } from 'lucide-react'
import CheckinNav from '@/components/CheckinNav'

// Step 1: อัปโหลด Registration Form PDF จาก Little Hotelier
export default function UploadFormPage() {
  const { ref } = useParams<{ ref: string }>()
  const router = useRouter()
  const [booking, setBooking] = useState<Booking | null>(null)
  const [pdfFile, setPdfFile]   = useState<File | null>(null)
  const [loading, setLoading]   = useState(false)
  const [dragging, setDragging] = useState(false)
  const [uploaded, setUploaded] = useState(false)

  useEffect(() => { loadBooking() }, [ref])

  async function loadBooking() {
    try { await fetch('/api/ensure-staff', { method: 'POST' }) } catch {}
    const supabase = createClient()
    const { data } = await supabase
      .from('bookings').select('*').eq('booking_ref', ref).single()
    if (!data) { toast.error('ไม่พบ Booking'); router.push('/dashboard'); return }
    setBooking(data)
  }

  function handleFileSelect(file: File) {
    if (!file.name.endsWith('.pdf')) { toast.error('กรุณาเลือกไฟล์ PDF เท่านั้น'); return }
    if (file.size > 20 * 1024 * 1024) { toast.error('ไฟล์ใหญ่เกินไป (สูงสุด 20MB)'); return }
    setPdfFile(file)
  }

  async function handleNext() {
    if (!pdfFile) { toast.error('กรุณาเลือกไฟล์ PDF ก่อน'); return }
    setLoading(true)
    try {
      const arrayBuffer = await readPdfFile(pdfFile)
      const bytes = new Uint8Array(arrayBuffer)
      let binary = ''
      for (let i = 0; i < bytes.length; i += 8192)
        binary += String.fromCharCode(...Array.from(bytes.subarray(i, i + 8192)))
      const base64 = btoa(binary)
      sessionStorage.setItem(`pdf_original_${ref}`, base64)
      sessionStorage.setItem(`pdf_filename_${ref}`, pdfFile.name)

      await logAudit('upload_form', ref, { fileName: pdfFile.name, size: pdfFile.size })

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('guest_documents').upsert({
          booking_ref: ref,
          staff_id: user.id,
          form_uploaded_at: new Date().toISOString(),
          status: 'in_progress',
        }, { onConflict: 'booking_ref' })
      }
      setUploaded(true)
    } catch (err: any) {
      toast.error(`Error: ${err?.message || String(err)}`)
      setLoading(false)
    }
  }

  /* ── HANDOVER SCREEN — หลังอัปโหลดสำเร็จ ── */
  if (uploaded) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <header className="bg-green-600 text-white px-5 lg:px-8 py-3 lg:py-4">
          <h1 className="text-xl font-bold">✅ อัปโหลดสำเร็จ</h1>
          <p className="text-green-200 text-sm">{booking?.guest_name} · {ref}</p>
        </header>
        <CheckinSteps current={1} />

        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-6">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle size={48} className="text-green-500" />
          </div>

          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Registration Form พร้อมแล้ว</h2>
            <p className="text-gray-500">ยื่น iPad ให้ลูกค้าเพื่อดู, เซ็นชื่อ และถ่ายรูปเอกสาร</p>
          </div>

          <div className="w-full max-w-sm space-y-3 mt-2">
            {/* ปุ่มหลัก — ยื่นให้ลูกค้าเซ็นได้เลย */}
            <button
              onClick={() => router.push(`/checkin/${ref}/sign`)}
              className="btn-primary w-full text-lg flex items-center justify-center gap-2 py-4"
            >
              <Tablet size={22} /> ยื่น iPad ให้ลูกค้าเซ็น
            </button>

            {/* ปุ่มรอง — กลับ dashboard ทำทีหลัง */}
            <button
              onClick={() => router.push('/dashboard')}
              className="btn-secondary w-full flex items-center justify-center gap-2"
            >
              <ArrowLeft size={18} /> กลับ Dashboard (ทำทีหลัง)
            </button>
          </div>

          <p className="text-xs text-gray-400 mt-2">
            ถ้ากลับ Dashboard ลูกค้าสามารถกลับมาเซ็นได้ภายหลังจาก Booking ที่ Dashboard
          </p>
        </div>
        <CheckinNav bookingRef={ref} current="upload" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* Header */}
      <header className="bg-resort-teal text-white px-5 lg:px-8 py-3 lg:py-4">
        <button onClick={() => router.push('/dashboard')}
                className="flex items-center gap-2 text-teal-200 mb-1">
          <ArrowLeft size={18} /> กลับ
        </button>
        <h1 className="text-xl font-bold">{booking?.guest_name || 'Loading...'}</h1>
        <p className="text-teal-200 text-sm">ห้อง {booking?.room_number} · Ref: {ref}</p>
      </header>

      <CheckinSteps current={1} />

      {/* ── Content: 1-col portrait / 2-col landscape ── */}
      <div className="flex-1 p-5 lg:p-8 w-full max-w-lg lg:max-w-5xl mx-auto">
        <div className="lg:grid lg:grid-cols-2 lg:gap-8 lg:items-start">

          {/* LEFT: Upload zone */}
          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-1">อัปโหลด Registration Form</h2>
            <p className="text-gray-500 mb-5 text-sm">
              ดาวน์โหลด PDF จาก Little Hotelier แล้วเลือกไฟล์ที่นี่
            </p>

            <label
              className={`block border-2 border-dashed rounded-2xl p-10 text-center
                          cursor-pointer transition-colors ${
                dragging ? 'border-resort-teal bg-teal-50' :
                pdfFile  ? 'border-green-400 bg-green-50' :
                           'border-gray-300 bg-white hover:border-resort-teal hover:bg-teal-50'
              }`}
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => {
                e.preventDefault(); setDragging(false)
                const f = e.dataTransfer.files[0]; if (f) handleFileSelect(f)
              }}
            >
              <input type="file" accept=".pdf" className="hidden"
                     onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f) }} />

              {pdfFile ? (
                <div>
                  <FileText size={52} className="mx-auto text-green-500 mb-3" />
                  <p className="font-semibold text-green-700 text-lg">{pdfFile.name}</p>
                  <p className="text-green-500 text-sm mt-1">
                    {(pdfFile.size / 1024).toFixed(0)} KB · แตะเพื่อเปลี่ยน
                  </p>
                </div>
              ) : (
                <div>
                  <Upload size={52} className="mx-auto text-gray-300 mb-3" />
                  <p className="font-semibold text-gray-600 text-lg">เลือกไฟล์ PDF</p>
                  <p className="text-gray-400 text-sm mt-1">แตะที่นี่เพื่อเลือกไฟล์</p>
                </div>
              )}
            </label>
          </div>

          {/* RIGHT: Booking summary + button */}
          <div className="mt-6 lg:mt-0 space-y-5">
            {booking && (
              <div className="card space-y-3 text-sm">
                <h3 className="font-semibold text-gray-700 text-base">📋 ข้อมูล Booking</h3>
                <InfoRow label="ชื่อ Guest"  value={booking.guest_name} />
                <InfoRow label="ห้อง"        value={booking.room_number || '-'} />
                <InfoRow label="Check-in"    value={booking.check_in} />
                <InfoRow label="Check-out"   value={booking.check_out} />
                <InfoRow label="ผู้ใหญ่"     value={`${booking.num_adults} คน`} />
              </div>
            )}

            <button
              onClick={handleNext}
              disabled={!pdfFile || loading}
              className="btn-primary w-full text-lg flex items-center justify-center gap-2"
            >
              {loading
                ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                : <>ถัดไป: ให้ Guest เซ็นชื่อ <ArrowRight size={20} /></>}
            </button>
          </div>

        </div>
      </div>
      <CheckinNav bookingRef={ref} current="upload" />
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-0.5">
      <span className="text-gray-400">{label}</span>
      <span className="font-medium text-gray-700 text-right">{value}</span>
    </div>
  )
}
