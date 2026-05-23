'use client'
import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'

// ขั้นตอนนี้ถูกรวมเข้ากับหน้า passport แล้ว — redirect อัตโนมัติ
export default function IdCardRedirect() {
  const { ref } = useParams<{ ref: string }>()
  const router = useRouter()
  useEffect(() => { router.replace(`/checkin/${ref}/passport`) }, [ref, router])
  return null
}
