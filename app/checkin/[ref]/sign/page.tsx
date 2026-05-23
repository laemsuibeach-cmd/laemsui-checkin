'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { embedSignatureInPdf } from '@/lib/pdf'
import { formatTimestamp } from '@/lib/utils'
import CheckinSteps from '@/components/CheckinSteps'
import toast from 'react-hot-toast'
import { ArrowRight, ArrowLeft, RotateCcw, Check } from 'lucide-react'

// Step 2: ลูกค้าเซ็นชื่อบน iPad
export default function SignPage() {
  const { ref } = useParams<{ ref: string }>()
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [sigPad, setSigPad] = useState<any>(null)
  const [isEmpty, setIsEmpty] = useState(true)
  const [guestName, setGuestName] = useState('')
  const [loading, setLoading] = useState(false)
  const [pdpaConsent, setPdpaConsent] = useState(false)
  const [showPdpa, setShowPdpa] = useState(true)

  useEffect(() => { loadGuestName() }, [ref])

  useEffect(() => {
    if (!showPdpa && canvasRef.current) initSignaturePad()
  }, [showPdpa])

  async function loadGuestName() {
    const supabase = createClient()
    const { data } = await supabase
      .from('bookings').select('guest_name').eq('booking_ref', ref).single()
    setGuestName(data?.guest_name || '')
  }

  async function initSignaturePad() {
    const SignaturePad = (await import('signature_pad')).default
    const canvas = canvasRef.current!

    // Retina display support
    const ratio = Math.max(window.devicePixelRatio || 1, 1)
    canvas.width  = canvas.offsetWidth  * ratio
    canvas.height = canvas.offsetHeight * ratio
    canvas.getContext('2d')!.scale(ratio, ratio)

    const pad = new SignaturePad(canvas, {
      backgroundColor: 'rgba(0,0,0,0)',
      penColor: 'rgb(0, 30, 100)',
      minWidth: 1.5,
      maxWidth: 4,
      velocityFilterWeight: 0.7,
    })

    // ป้องกัน scroll ขณะเซ็น
    canvas.addEventListener('touchstart', e => e.preventDefault(), { passive: false })
    canvas.addEventListener('touchmove',  e => e.preventDefault(), { passive: false })

    pad.addEventListener('beginStroke', () => setIsEmpty(false))
    setSigPad(pad)
  }

  function clearSignature() {
    sigPad?.clear()
    setIsEmpty(true)
  }

  async function handleNext() {
    if (!pdpaConsent) { toast.error('กรุณายินยอม PDPA ก่อน'); return }
    if (isEmpty || !sigPad || sigPad.isEmpty()) {
      toast.error('กรุณาให้ Guest เซ็นชื่อก่อน')
      return
    }
    setLoading(true)

    try {
      // ดึง original PDF จาก sessionStorage
      const originalBase64 = sessionStorage.getItem(`pdf_original_${ref}`)
      if (!originalBase64) {
        toast.error('ไม่พบไฟล์ PDF กรุณากลับไปอัปโหลดใหม่')
        router.push(`/checkin/${ref}/upload`)
        return
      }

      // แปลง base64 กลับเป็น ArrayBuffer
      const binaryString = atob(originalBase64)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i)
      const originalPdfBytes = bytes.buffer

      // ดึงลายเซ็น
      const signatureDataUrl = sigPad.toDataURL('image/png')
      const timestamp = formatTimestamp()

      // Embed ลายเซ็นลง PDF (client-side)
      const signedPdfBytes = await embedSignatureInPdf(
        originalPdfBytes,
        signatureDataUrl,
        guestName,
        ref,
        timestamp
      )

      // เก็บ signed PDF ใน sessionStorage
      // Chunked base64 to avoid stack overflow on large PDFs
      let signedBinary = ''
      for (let i = 0; i < signedPdfBytes.length; i += 8192) {
        signedBinary += String.fromCharCode(...Array.from(signedPdfBytes.subarray(i, i + 8192)))
      }
      const signedBase64 = btoa(signedBinary)
      sessionStorage.setItem(`pdf_signed_${ref}`, signedBase64)
      sessionStorage.setItem(`signature_${ref}`, signatureDataUrl)

      // อัปเดต DB
      const supabase = createClient()
      await supabase.from('guest_documents').update({
        pdpa_consent: true,
        pdpa_consent_at: new Date().toISOString(),
        signed_at: new Date().toISOString(),
      }).eq('booking_ref', ref)

      await logAudit('sign_pdf', ref)
      await logAudit('pdpa_consent', ref)

      router.push(`/checkin/${ref}/passport`)
    } catch (err) {
      console.error(err)
      toast.error('เกิดข้อผิดพลาด กรุณาลองใหม่')
      setLoading(false)
    }
  }

  // PDPA Consent Screen
  if (showPdpa) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <header className="bg-resort-teal text-white px-5 py-4">
          <button onClick={() => router.push(`/checkin/${ref}/upload`)} className="flex items-center gap-2 text-teal-200 mb-1">
            <ArrowLeft size={18} /> กลับ
          </button>
          <h1 className="text-xl font-bold">แจ้งข้อมูล PDPA</h1>
        </header>
        <CheckinSteps current={2} />

        <div className="flex-1 p-5 max-w-lg mx-auto w-full">
          <div className="card">
            <h2 className="text-xl font-bold text-gray-800 mb-4">📋 การเก็บข้อมูลส่วนบุคคล</h2>
            <div className="text-gray-600 space-y-3 text-base leading-relaxed">
              <p>
                ทางโรงแรมจะเก็บรวบรวมข้อมูลของท่าน ได้แก่ ชื่อ-นามสกุล,
                หมายเลขหนังสือเดินทาง/บัตรประชาชน, ภาพถ่าย และลายเซ็น
                เพื่อวัตถุประสงค์ดังนี้:
              </p>
              <ul className="space-y-2 pl-4">
                <li>✓ การลงทะเบียนเช็คอินตามกฎหมาย</li>
                <li>✓ ความปลอดภัยของโรงแรมและผู้เข้าพัก</li>
                <li>✓ การปฏิบัติตามกฎหมาย พ.ร.บ. โรงแรม</li>
              </ul>
              <p className="text-sm text-gray-500">
                ข้อมูลจะถูกเก็บรักษาเป็นเวลา 2 ปีหลังจากเช็คเอาท์
                และจะถูกลบออกโดยอัตโนมัติตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA)
              </p>
              <p className="text-sm text-gray-500">
                ท่านมีสิทธิ์ขอดู, แก้ไข หรือลบข้อมูลได้โดยติดต่อทางโรงแรม
              </p>
            </div>
          </div>

          <label className="flex items-start gap-3 mt-5 card cursor-pointer">
            <input
              type="checkbox"
              checked={pdpaConsent}
              onChange={e => setPdpaConsent(e.target.checked)}
              className="w-6 h-6 mt-0.5 accent-teal-600 flex-shrink-0"
            />
            <span className="text-base text-gray-700">
              ข้าพเจ้ารับทราบและยินยอมให้โรงแรมเก็บรวบรวมข้อมูลส่วนบุคคลของข้าพเจ้า
              ตามที่ระบุข้างต้น
            </span>
          </label>

          <button
            onClick={() => {
              if (!pdpaConsent) { toast.error('กรุณายินยอม PDPA ก่อน'); return }
              setShowPdpa(false)
            }}
            disabled={!pdpaConsent}
            className="btn-primary w-full mt-5 text-lg"
          >
            ยินยอม → ไปเซ็นชื่อ
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-resort-teal text-white px-5 py-4">
        <button onClick={() => setShowPdpa(true)} className="flex items-center gap-2 text-teal-200 mb-1">
          <ArrowLeft size={18} /> กลับ
        </button>
        <h1 className="text-xl font-bold">เซ็นชื่อ</h1>
        <p className="text-teal-200 text-sm">{guestName} · {ref}</p>
      </header>
      <CheckinSteps current={2} />

      <div className="flex-1 p-5 max-w-lg mx-auto w-full flex flex-col">
        <p className="text-center text-gray-500 mb-3">
          กรุณาเซ็นชื่อในกรอบด้านล่าง (นิ้ว หรือ Apple Pencil)
        </p>

        {/* Signature Canvas */}
        <div className="signature-container flex-1" style={{ minHeight: '280px' }}>
          <canvas
            ref={canvasRef}
            className="w-full h-full no-select"
            style={{ touchAction: 'none', minHeight: '280px' }}
          />
          {isEmpty && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-gray-300 text-xl">เซ็นชื่อที่นี่</p>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-4">
          <button
            onClick={clearSignature}
            className="btn-secondary flex items-center gap-2 flex-1 justify-center"
          >
            <RotateCcw size={18} /> ล้างใหม่
          </button>
          <button
            onClick={handleNext}
            disabled={isEmpty || loading}
            className="btn-primary flex items-center gap-2 flex-2 justify-center px-8"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <><Check size={18} /> ยืนยัน <ArrowRight size={18} /></>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
