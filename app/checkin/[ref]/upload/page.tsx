'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient, type Booking } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { readPdfFile } from '@/lib/pdf'
import CheckinSteps from '@/components/CheckinSteps'
import toast from 'react-hot-toast'
import { Upload, FileText, ArrowRight, ArrowLeft } from 'lucide-react'

// Step 1: อัปโหลด Registration Form PDF จาก Little Hotelier
export default function UploadFormPage() {
  const { ref } = useParams<{ ref: string }>()
  const router = useRouter()
  const [booking, setBooking] = useState<Booking | null>(null)
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [dragging, setDragging] = useState(false)

  useEffect(() => { loadBooking() }, [ref])

  async function loadBooking() {
    const supabase = createClient()
    const { data } = await supabase
      .from('bookings').select('*').eq('booking_ref', ref).single()
    if (!data) { toast.error('ไม่พบ Booking'); router.push('/dashboard'); return }
    setBooking(data)
  }

  function handleFileSelect(file: File) {
    if (!file.name.endsWith('.pdf')) {
      toast.error('กรุณาเลือกไฟล์ PDF เท่านั้น')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error('ไฟล์ใหญ่เกินไป (สูงสุด 20MB)')
      return
    }
    setPdfFile(file)
  }

  async function handleNext() {
    if (!pdfFile) { toast.error('กรุณาเลือกไฟล์ PDF ก่อน'); return }
    setLoading(true)

    try {
      // แปลง PDF เป็น ArrayBuffer แล้วเก็บใน sessionStorage ชั่วคราว
      const arrayBuffer = await readPdfFile(pdfFile)
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
      sessionStorage.setItem(`pdf_original_${ref}`, base64)
      sessionStorage.setItem(`pdf_filename_${ref}`, pdfFile.name)

      await logAudit('upload_form', ref, { fileName: pdfFile.name, size: pdfFile.size })

      // สร้าง/อัปเดต guest_documents record
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('guest_documents').upsert({
        booking_ref: ref,
        staff_id: user!.id,
        form_uploaded_at: new Date().toISOString(),
        status: 'in_progress',
      }, { onConflict: 'booking_ref' })

      router.push(`/checkin/${ref}/sign`)
    } catch (err) {
      toast.error('เกิดข้อผิดพลาด กรุณาลองใหม่')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-resort-teal text-white px-5 py-4">
        <button onClick={() => router.push('/dashboard')} className="flex items-center gap-2 text-teal-200 mb-1">
          <ArrowLeft size={18} /> กลับ
        </button>
        <h1 className="text-xl font-bold">{booking?.guest_name || 'Loading...'}</h1>
        <p className="text-teal-200 text-sm">ห้อง {booking?.room_number} · Ref: {ref}</p>
      </header>

      <CheckinSteps current={1} />

      <div className="flex-1 p-5 max-w-lg mx-auto w-full">
        <h2 className="text-xl font-bold text-gray-800 mb-2">อัปโหลด Registration Form</h2>
        <p className="text-gray-500 mb-6">
          ดาวน์โหลด PDF จาก Little Hotelier แล้วเลือกไฟล์ที่นี่
        </p>

        {/* Drop zone */}
        <label
          className={`block border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors ${
            dragging ? 'border-resort-teal bg-teal-50' :
            pdfFile  ? 'border-green-400 bg-green-50' : 'border-gray-300 bg-white'
          }`}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => {
            e.preventDefault(); setDragging(false)
            const f = e.dataTransfer.files[0]
            if (f) handleFileSelect(f)
          }}
        >
          <input
            type="file" accept=".pdf" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f) }}
          />

          {pdfFile ? (
            <div>
              <FileText size={48} className="mx-auto text-green-500 mb-3" />
              <p className="font-semibold text-green-700 text-lg">{pdfFile.name}</p>
              <p className="text-green-500 text-sm mt-1">
                {(pdfFile.size / 1024).toFixed(0)} KB · คลิกเพื่อเปลี่ยน
              </p>
            </div>
          ) : (
            <div>
              <Upload size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="font-semibold text-gray-600 text-lg">เลือกไฟล์ PDF</p>
              <p className="text-gray-400 text-sm mt-1">
                แตะที่นี่เพื่อเลือกไฟล์ Registration Form
              </p>
            </div>
          )}
        </label>

        {/* Guest Info Summary */}
        {booking && (
          <div className="card mt-5 space-y-2 text-sm">
            <h3 className="font-semibold text-gray-700 mb-2">ข้อมูล Booking</h3>
            <InfoRow label="ชื่อ" value={booking.guest_name} />
            <InfoRow label="ห้อง" value={booking.room_number || '-'} />
            <InfoRow label="Check-in" value={booking.check_in} />
            <InfoRow label="Check-out" value={booking.check_out} />
            <InfoRow label="ผู้ใหญ่" value={`${booking.num_adults} คน`} />
          </div>
        )}

        {/* Next Button */}
        <button
          onClick={handleNext}
          disabled={!pdfFile || loading}
          className="btn-primary w-full mt-6 text-lg flex items-center justify-center gap-2"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : (
            <>ถัดไป: ให้ Guest เซ็นชื่อ <ArrowRight size={20} /></>
          )}
        </button>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-400">{label}</span>
      <span className="font-medium text-gray-700">{value}</span>
    </div>
  )
}
