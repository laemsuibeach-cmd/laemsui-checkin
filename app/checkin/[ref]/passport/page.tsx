'use client'
import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { logAudit } from '@/lib/audit'
import CameraCapture from '@/components/CameraCapture'
import CheckinSteps from '@/components/CheckinSteps'
import toast from 'react-hot-toast'
import { ArrowRight, ArrowLeft, SkipForward } from 'lucide-react'
import CheckinNav from '@/components/CheckinNav'

type DocType = 'passport' | 'idcard'

// Step 3: ถ่ายรูปเอกสาร — เลือก Passport หรือ บัตรประชาชน
export default function DocumentPage() {
  const { ref } = useParams<{ ref: string }>()
  const router = useRouter()
  const [docType, setDocType] = useState<DocType>('passport')
  const [docFile, setDocFile] = useState<File | null>(null)

  function handleTypeChange(type: DocType) { setDocType(type); setDocFile(null) }

  async function handleNext() {
    if (!docFile) {
      toast.error(docType === 'passport'
        ? 'กรุณาถ่ายรูป Passport ก่อน'
        : 'กรุณาถ่ายรูปบัตรประชาชนก่อน')
      return
    }
    const reader = new FileReader()
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1]
      clearDocKeys()
      const key = docType === 'passport' ? 'passport' : 'idcard'
      sessionStorage.setItem(`${key}_${ref}`,      base64)
      sessionStorage.setItem(`${key}_name_${ref}`, docFile.name)
      sessionStorage.setItem(`${key}_type_${ref}`, docFile.type)
      sessionStorage.setItem(`doc_type_${ref}`,    docType)
      await logAudit(docType === 'passport' ? 'capture_passport' : 'capture_idcard', ref)
      router.push(`/checkin/${ref}/complete`)
    }
    reader.readAsDataURL(docFile)
  }

  function clearDocKeys() {
    ['passport', 'passport_name', 'passport_type',
     'idcard', 'idcard_name', 'idcard_type', 'doc_type']
      .forEach(k => sessionStorage.removeItem(`${k}_${ref}`))
  }

  function handleSkip() { clearDocKeys(); router.push(`/checkin/${ref}/complete`) }

  const tips = docType === 'passport'
    ? ['วางบนพื้นหรือโต๊ะสีเข้ม', 'ไม่มีแสงสะท้อน', 'ถ่ายให้เห็นครบทั้งหน้า']
    : ['ถ่ายด้านหน้าที่มีรูปและชื่อ', 'ให้เห็นครบทั้งบัตร', 'แสงพอดี ไม่มีเงา']

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* Header */}
      <header className="bg-resort-teal text-white px-5 lg:px-8 py-3 lg:py-4">
        <button onClick={() => router.push(`/checkin/${ref}/sign`)}
                className="flex items-center gap-2 text-teal-200 mb-1">
          <ArrowLeft size={18} /> กลับ
        </button>
        <h1 className="text-xl font-bold">ถ่ายรูปเอกสาร</h1>
        <p className="text-teal-200 text-sm">Ref: {ref}</p>
      </header>

      <CheckinSteps current={3} />

      {/* ── Content: 1-col portrait / 2-col landscape ── */}
      <div className="flex-1 p-5 lg:p-8 max-w-lg lg:max-w-5xl mx-auto w-full">
        <div className="lg:grid lg:grid-cols-2 lg:gap-8 lg:items-start">

          {/* LEFT: Type toggle + Camera */}
          <div>
            <div className="flex rounded-xl overflow-hidden border border-gray-200 mb-5">
              <button
                onClick={() => handleTypeChange('passport')}
                className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                  docType === 'passport'
                    ? 'bg-resort-teal text-white'
                    : 'bg-white text-gray-500 hover:bg-gray-50'
                }`}
              >
                🛂 Passport
              </button>
              <button
                onClick={() => handleTypeChange('idcard')}
                className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                  docType === 'idcard'
                    ? 'bg-resort-teal text-white'
                    : 'bg-white text-gray-500 hover:bg-gray-50'
                }`}
              >
                🪪 บัตรประชาชน
              </button>
            </div>

            <p className="text-gray-500 mb-4 text-sm">
              {docType === 'passport'
                ? 'วาง Passport ลงบนพื้นผิวเรียบ ถ่ายให้เห็นหน้าที่มีรูปและข้อมูลชัดเจน'
                : 'ถ่ายบัตรประชาชน ให้เห็นรูปและข้อมูลครบถ้วนชัดเจน'}
            </p>

            <CameraCapture
              label={docType === 'passport' ? 'ถ่าย Passport' : 'ถ่าย บัตรประชาชน'}
              hint={docType === 'passport'
                ? 'กล้องหลัง · ให้เห็นหน้าข้อมูลครบถ้วน'
                : 'กล้องหลัง · ด้านหน้าบัตร'}
              onCapture={setDocFile}
              capturedFile={docFile}
            />
          </div>

          {/* RIGHT: Tips + Buttons */}
          <div className="mt-6 lg:mt-0 space-y-4">
            <div className="card text-sm text-gray-500 space-y-2">
              <p className="font-semibold text-gray-700 text-base">💡 Tips การถ่ายรูป</p>
              {tips.map((tip, i) => (
                <p key={i} className="flex items-start gap-2">
                  <span className="text-resort-teal font-bold">•</span> {tip}
                </p>
              ))}
            </div>

            <button
              onClick={handleNext}
              disabled={!docFile}
              className="btn-primary w-full text-lg flex items-center justify-center gap-2"
            >
              ถัดไป: ยืนยัน &amp; อัปโหลด <ArrowRight size={20} />
            </button>

            <button
              onClick={handleSkip}
              className="btn-secondary w-full flex items-center justify-center gap-2"
            >
              <SkipForward size={18} /> ข้ามขั้นตอนนี้
            </button>

            <p className="text-xs text-gray-400 text-center">
              รูปเอกสารเป็นตัวเลือก สามารถข้ามได้
            </p>
          </div>

        </div>
      </div>
      <CheckinNav bookingRef={ref} current="passport" />
    </div>
  )
}
