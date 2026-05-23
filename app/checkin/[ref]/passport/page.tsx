'use client'
import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { logAudit } from '@/lib/audit'
import CameraCapture from '@/components/CameraCapture'
import CheckinSteps from '@/components/CheckinSteps'
import toast from 'react-hot-toast'
import { ArrowRight, ArrowLeft } from 'lucide-react'

type DocType = 'passport' | 'idcard'

// Step 3: ถ่ายรูปเอกสาร — เลือก Passport หรือ บัตรประชาชน
export default function DocumentPage() {
  const { ref } = useParams<{ ref: string }>()
  const router = useRouter()
  const [docType, setDocType] = useState<DocType>('passport')
  const [docFile, setDocFile] = useState<File | null>(null)

  function handleTypeChange(type: DocType) {
    setDocType(type)
    setDocFile(null)
  }

  async function handleNext() {
    if (!docFile) {
      toast.error(docType === 'passport' ? 'กรุณาถ่ายรูป Passport ก่อน' : 'กรุณาถ่ายรูปบัตรประชาชนก่อน')
      return
    }

    const reader = new FileReader()
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1]

      // ล้างทั้งสอง key แล้วเก็บเฉพาะที่เลือก
      sessionStorage.removeItem(`passport_${ref}`)
      sessionStorage.removeItem(`passport_name_${ref}`)
      sessionStorage.removeItem(`passport_type_${ref}`)
      sessionStorage.removeItem(`idcard_${ref}`)
      sessionStorage.removeItem(`idcard_name_${ref}`)
      sessionStorage.removeItem(`idcard_type_${ref}`)

      const key = docType === 'passport' ? 'passport' : 'idcard'
      sessionStorage.setItem(`${key}_${ref}`, base64)
      sessionStorage.setItem(`${key}_name_${ref}`, docFile.name)
      sessionStorage.setItem(`${key}_type_${ref}`, docFile.type)
      sessionStorage.setItem(`doc_type_${ref}`, docType)

      await logAudit(docType === 'passport' ? 'capture_passport' : 'capture_idcard', ref)
      router.push(`/checkin/${ref}/complete`)
    }
    reader.readAsDataURL(docFile)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-resort-teal text-white px-5 py-4">
        <button onClick={() => router.push(`/checkin/${ref}/sign`)} className="flex items-center gap-2 text-teal-200 mb-1">
          <ArrowLeft size={18} /> กลับ
        </button>
        <h1 className="text-xl font-bold">ถ่ายรูปเอกสาร</h1>
        <p className="text-teal-200 text-sm">Ref: {ref}</p>
      </header>

      <CheckinSteps current={3} />

      <div className="flex-1 p-5 max-w-lg mx-auto w-full">
        {/* Toggle เลือกประเภทเอกสาร */}
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

        {docType === 'passport' ? (
          <>
            <p className="text-gray-500 mb-5">
              วาง Passport ลงบนพื้นผิวเรียบ ถ่ายให้เห็นหน้าที่มีรูปและข้อมูลชัดเจน
            </p>
            <CameraCapture
              label="ถ่าย Passport"
              hint="กล้องหลัง · ให้เห็นหน้าข้อมูลครบถ้วน"
              onCapture={setDocFile}
              capturedFile={docFile}
            />
            <div className="card mt-4 text-sm text-gray-500 space-y-1">
              <p className="font-semibold text-gray-700">💡 Tips</p>
              <p>• วางบนพื้นหรือโต๊ะสีเข้ม</p>
              <p>• ไม่มีแสงสะท้อน</p>
              <p>• ถ่ายให้เห็นครบทั้งหน้า</p>
            </div>
          </>
        ) : (
          <>
            <p className="text-gray-500 mb-5">
              ถ่ายบัตรประชาชน ให้เห็นรูปและข้อมูลครบถ้วนชัดเจน
            </p>
            <CameraCapture
              label="ถ่าย บัตรประชาชน"
              hint="กล้องหลัง · ด้านหน้าบัตร"
              onCapture={setDocFile}
              capturedFile={docFile}
            />
            <div className="card mt-4 text-sm text-gray-500 space-y-1">
              <p className="font-semibold text-gray-700">💡 Tips</p>
              <p>• ถ่ายด้านหน้าที่มีรูปและชื่อ</p>
              <p>• ให้เห็นครบทั้งบัตร</p>
              <p>• แสงพอดี ไม่มีเงา</p>
            </div>
          </>
        )}

        <button
          onClick={handleNext}
          disabled={!docFile}
          className="btn-primary w-full mt-6 text-lg flex items-center justify-center gap-2"
        >
          ถัดไป: ยืนยัน & อัปโหลด <ArrowRight size={20} />
        </button>

        <button
          onC