'use client'
import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { logAudit } from '@/lib/audit'
import CameraCapture from '@/components/CameraCapture'
import CheckinSteps from '@/components/CheckinSteps'
import toast from 'react-hot-toast'
import { ArrowRight, ArrowLeft, SkipForward, Plus, X } from 'lucide-react'
import CheckinNav from '@/components/CheckinNav'
import { setExtraPassports, clearExtraPassports } from '@/lib/passport-store'

type DocType = 'passport' | 'idcard'

// Step 3: ถ่ายรูปเอกสาร — เลือก Passport หรือ บัตรประชาชน
export default function DocumentPage() {
  const { ref } = useParams<{ ref: string }>()
  const router = useRouter()
  const [docType, setDocType]           = useState<DocType>('passport')
  const [docFile, setDocFile]           = useState<File | null>(null)
  // Extra passports for additional foreign guests (up to 4 more, 5 total)
  const [extraPassports, setExtraPassports] = useState<(File | null)[]>([])

  function handleTypeChange(type: DocType) {
    setDocType(type)
    setDocFile(null)
    setExtraPassports([])
  }

  function addExtraSlot() {
    if (extraPassports.length < 4) setExtraPassports(prev => [...prev, null])
  }

  function removeExtraSlot(i: number) {
    setExtraPassports(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateExtraPassport(i: number, file: File | null) {
    setExtraPassports(prev => { const next = [...prev]; next[i] = file; return next })
  }

  function fileToBase64Promise(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve((reader.result as string).split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  async function handleNext() {
    if (!docFile) {
      toast.error(docType === 'passport'
        ? 'กรุณาถ่ายรูป Passport ก่อน'
        : 'กรุณาถ่ายรูปบัตรประชาชนก่อน')
      return
    }

    clearDocKeys()

    // Save main document to sessionStorage (single file, within quota)
    const mainBase64 = await fileToBase64Promise(docFile)
    const key = docType === 'passport' ? 'passport' : 'idcard'
    sessionStorage.setItem(`${key}_${ref}`,      mainBase64)
    sessionStorage.setItem(`${key}_name_${ref}`, docFile.name)
    sessionStorage.setItem(`${key}_type_${ref}`, docFile.type)
    sessionStorage.setItem(`doc_type_${ref}`,    docType)

    // Save extra passports to in-memory store (avoids sessionStorage 5MB size limit)
    if (docType === 'passport') {
      const filled = extraPassports.filter(Boolean) as File[]
      setExtraPassports(filled)
      // Store only the count in sessionStorage (tiny string, no size issue)
      sessionStorage.setItem(`passport_extra_count_${ref}`, String(filled.length))
    } else {
      clearExtraPassports()
      sessionStorage.setItem(`passport_extra_count_${ref}`, '0')
    }

    await logAudit(docType === 'passport' ? 'capture_passport' : 'capture_idcard', ref)
    router.push(`/checkin/${ref}/complete`)
  }

  function clearDocKeys() {
    ['passport', 'passport_name', 'passport_type',
     'idcard', 'idcard_name', 'idcard_type', 'doc_type',
     'passport_extra_count',
     'passport_extra_1', 'passport_extra_2',
     'passport_extra_3', 'passport_extra_4']
      .forEach(k => sessionStorage.removeItem(`${k}_${ref}`))
  }

  function handleSkip() { clearDocKeys(); router.push(`/checkin/${ref}/complete`) }

  const tips = docType === 'passport'
    ? ['วางบนพื้นหรือโต๊ะสีเข้ม', 'ไม่มีแสงสะท้อน', 'ถ่ายให้เห็นครบทั้งหน้า']
    : ['ถ่ายด้านหน้าที่มีรูปและชื่อ', 'ให้เห็นครบทั้งบัตร', 'แสงพอดี ไม่มีเงา']

  const filledExtras = extraPassports.filter(Boolean).length

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

          {/* LEFT: Type toggle + Camera + Extra passports */}
          <div>
            {/* Doc type toggle */}
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

            {/* Main document camera */}
            <CameraCapture
              label={docType === 'passport' ? 'ถ่าย Passport (แขกหลัก)' : 'ถ่าย บัตรประชาชน'}
              hint={docType === 'passport'
                ? 'กล้องหลัง · ให้เห็นหน้าข้อมูลครบถ้วน'
                : 'กล้องหลัง · ด้านหน้าบัตร'}
              onCapture={setDocFile}
              capturedFile={docFile}
            />

            {/* ── Extra passports (foreign guests) ── */}
            {docType === 'passport' && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-semibold text-gray-700 text-sm">
                      🛂 แขกต่างชาติเพิ่มเติม
                    </p>
                    <p className="text-xs text-gray-400">
                      หากมีแขกหลายคน เพิ่มได้สูงสุด 5 คน
                    </p>
                  </div>
                  {extraPassports.length < 4 && (
                    <button
                      onClick={addExtraSlot}
                      className="flex items-center gap-1 bg-teal-50 text-resort-teal border border-teal-200
                                 text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-teal-100 transition-colors"
                    >
                      <Plus size={15} /> เพิ่ม
                    </button>
                  )}
                </div>

                {extraPassports.length === 0 && (
                  <p className="text-gray-400 text-xs text-center py-3 border border-dashed border-gray-200 rounded-xl">
                    กด "+ เพิ่ม" หากมีแขกชาวต่างชาติมากกว่า 1 คน
                  </p>
                )}

                <div className="space-y-4">
                  {extraPassports.map((file, i) => (
                    <div key={i} className="border border-gray-200 rounded-xl p-3 bg-white">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-semibold text-gray-700">
                          แขกคนที่ {i + 2}
                        </p>
                        <button
                          onClick={() => removeExtraSlot(i)}
                          className="text-red-400 hover:text-red-600 transition-colors"
                        >
                          <X size={16} />
                        </button>
                      </div>
                      <CameraCapture
                        label={`ถ่าย Passport แขกคนที่ ${i + 2}`}
                        hint="กล้องหลัง · ให้เห็นหน้าข้อมูลครบถ้วน"
                        onCapture={(f) => updateExtraPassport(i, f)}
                        capturedFile={file}
                      />
                    </div>
                  ))}
                </div>

                {filledExtras > 0 && (
                  <p className="text-xs text-teal-600 font-medium mt-2 text-center">
                    ✅ ถ่ายแล้ว {filledExtras + 1} รูป ({filledExtras + 1} คน)
                  </p>
                )}
              </div>
            )}
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
         