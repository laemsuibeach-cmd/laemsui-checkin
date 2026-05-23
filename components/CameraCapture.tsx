'use client'
import { useState, useRef } from 'react'
import { compressImage } from '@/lib/utils'
import { Camera, RotateCcw, Check } from 'lucide-react'

interface CameraCaptureProps {
  label: string
  hint: string
  onCapture: (file: File) => void
  capturedFile?: File | null
}

export default function CameraCapture({
  label, hint, onCapture, capturedFile
}: CameraCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [compressing, setCompressing] = useState(false)

  async function handleCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCompressing(true)

    try {
      // Compress ก่อนเก็บ
      const compressed = await compressImage(file)

      // Preview
      const objectUrl = URL.createObjectURL(compressed)
      setPreview(objectUrl)

      onCapture(compressed as File)
    } catch (err) {
      console.error('Compression failed:', err)
      // ถ้า compress ไม่ได้ ให้ใช้ original
      const objectUrl = URL.createObjectURL(file)
      setPreview(objectUrl)
      onCapture(file)
    } finally {
      setCompressing(false)
      // รีเซ็ต input เพื่อให้ถ่ายใหม่ได้
      e.target.value = ''
    }
  }

  function retake() {
    setPreview(null)
    // Revoke URL เพื่อ free memory
    if (preview) URL.revokeObjectURL(preview)
    inputRef.current?.click()
  }

  return (
    <div className="space-y-3">
      {/* Hidden camera input — capture="environment" = กล้องหลัง */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCapture}
      />

      {preview ? (
        /* แสดง preview + ปุ่มถ่ายใหม่ */
        <div className="relative">
          <img
            src={preview}
            alt={label}
            className="camera-preview"
          />
          <div className="absolute top-3 right-3 bg-green-500 text-white rounded-full p-1.5">
            <Check size={16} />
          </div>
          <button
            onClick={retake}
            className="absolute bottom-3 right-3 bg-black/50 text-white rounded-xl px-3 py-2 flex items-center gap-2 text-sm"
          >
            <RotateCcw size={16} /> ถ่ายใหม่
          </button>
        </div>
      ) : (
        /* ปุ่มถ่ายรูป */
        <button
          onClick={() => inputRef.current?.click()}
          disabled={compressing}
          className="w-full border-2 border-dashed border-gray-300 rounded-2xl p-10
                     bg-white text-center hover:border-resort-teal hover:bg-teal-50
                     transition-colors active:scale-[0.98]"
        >
          {compressing ? (
            <div>
              <div className="w-10 h-10 border-2 border-resort-teal border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-gray-500">กำลังประมวลผล...</p>
            </div>
          ) : (
            <div>
              <Camera size={52} className="mx-auto text-gray-300 mb-3" />
              <p className="font-semibold text-gray-600 text-lg">{label}</p>
              <p className="text-gray-400 text-sm mt-1">{hint}</p>
            </div>
          )}
        </button>
      )}
    </div>
  )
}
