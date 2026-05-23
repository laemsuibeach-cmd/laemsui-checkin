'use client'
import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { logAudit } from '@/lib/audit'
import CameraCapture from '@/components/CameraCapture'
import CheckinSteps from '@/components/CheckinSteps'
import toast from 'react-hot-toast'
import { ArrowRight, ArrowLeft } from 'lucide-react'

// Step 4: ถ่ายรูป ID Card / บัตรประชาชน
export default function IdCardPage() {
  const { ref } = useParams<{ ref: string }>()
  const router = useRouter()
  const [idcardFile, setIdcardFile] = useState<File | null>(null)

  async function handleNext() {
    if (!idcardFile) { toast.error('กรุณาถ่ายรูป ID Card ก่อน'); return }

    const reader = new FileReader()
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1]
      sessionStorage.setItem(`idcard_${ref}`, base64)
      sessionStorage.setItem(`idcard_name_${ref}`, idcardFile.name)
      sessionStorage.setItem(`idcard_type_${ref}`, idcardFile.type)

      await logAudit('capture_idcard', ref)
      router.push(`/checkin/${ref}/complete`)
    }
    reader.readAsDataURL(idcardFile)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-resort-teal text-white px-5 py-4">
        <button onClick={() => router.push(`/checkin/${ref}/passport`)} className="flex items-center gap-2 text-teal-200 mb-1">
          <ArrowLeft size={18} /> กลับ
        </button>
        <h1 className="text-xl font-bold">ถ่ายรูป ID Card</h1>
        <p className="text-teal-200 text-sm">Ref: {ref}</p>
      </header>

      <CheckinSteps current={4} />

      <div className="flex-1 p-5 max-w-lg mx-auto w-full">
        <p className="text-gray-500 mb-5">
          ถ่ายบัตรประชาชน หรือเอกสารแสดงตน ให้เห็นข้อมูลครบถ้วน
        </p>

        <CameraCapture
          label="ถ่าย ID Card / บัตรประชาชน"
          hint="กล้องหลัง · ด้านหน้าบัตร"
          onCapture={setIdcardFile}
          capturedFile={idcardFile}
        />

        <div className="card mt-4 text-sm text-gray-500 space-y-1">
          <p className="font-semibold text-gray-700">💡 Tips</p>
          <p>• ถ่ายด้านหน้าที่มีรูปและชื่อ</p>
          <p>• ให้เห็นครบทั้งบัตร</p>
          <p>• แสงพอดี ไม่มีเงา</p>
        </div>

        <button
          onClick={handleNext}
          disabled={!idcardFile}
          className="btn-primary w-full mt-6 text-lg flex items-center justify-center gap-2"
        >
          ถัดไป: ยืนยัน & อัปโหลด <ArrowRight size={20} />
        </button>
      </div>
    </div>
  )
}
