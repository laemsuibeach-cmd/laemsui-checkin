'use client'
import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { logAudit } from '@/lib/audit'
import CameraCapture from '@/components/CameraCapture'
import CheckinSteps from '@/components/CheckinSteps'
import toast from 'react-hot-toast'
import { ArrowRight, ArrowLeft } from 'lucide-react'

// Step 3: ถ่ายรูป Passport
export default function PassportPage() {
  const { ref } = useParams<{ ref: string }>()
  const router = useRouter()
  const [passportFile, setPassportFile] = useState<File | null>(null)

  async function handleNext() {
    if (!passportFile) { toast.error('กรุณาถ่ายรูป Passport ก่อน'); return }

    // เก็บใน sessionStorage (as base64)
    const reader = new FileReader()
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1]
      sessionStorage.setItem(`passport_${ref}`, base64)
      sessionStorage.setItem(`passport_name_${ref}`, passportFile.name)
      sessionStorage.setItem(`passport_type_${ref}`, passportFile.type)

      await logAudit('capture_passport', ref)
      router.push(`/checkin/${ref}/idcard`)
    }
    reader.readAsDataURL(passportFile)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-resort-teal text-white px-5 py-4">
        <button onClick={() => router.push(`/checkin/${ref}/sign`)} className="flex items-center gap-2 text-teal-200 mb-1">
          <ArrowLeft size={18} /> กลับ
        </button>
        <h1 className="text-xl font-bold">ถ่ายรูป Passport</h1>
        <p className="text-teal-200 text-sm">Ref: {ref}</p>
      </header>

      <CheckinSteps current={3} />

      <div className="flex-1 p-5 max-w-lg mx-auto w-full">
        <p className="text-gray-500 mb-5">
          วาง Passport ลงบนพื้นผิวเรียบ ถ่ายให้เห็นหน้าที่มีรูปและข้อมูลชัดเจน
        </p>

        <CameraCapture
          label="ถ่าย Passport"
          hint="กล้องหลัง · ให้เห็นหน้าข้อมูลครบถ้วน"
          onCapture={setPassportFile}
          capturedFile={passportFile}
        />

        <div className="card mt-4 text-sm text-gray-500 space-y-1">
          <p className="font-semibold text-gray-700">💡 Tips</p>
          <p>• วางบนพื้นหรือโต๊ะสีเข้ม</p>
          <p>• ไม่มีแสงสะท้อน</p>
          <p>• ถ่ายให้เห็นครบทั้งหน้า</p>
        </div>

        <button
          onClick={handleNext}
          disabled={!passportFile}
          className="btn-primary w-full mt-6 text-lg flex items-center justify-center gap-2"
        >
          ถัดไป: ถ่าย ID Card <ArrowRight size={20} />
        </button>
      </div>
    </div>
  )
}
