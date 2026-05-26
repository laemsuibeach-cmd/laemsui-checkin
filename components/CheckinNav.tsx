'use client'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Home } from 'lucide-react'

const STEPS = ['upload', 'sign', 'passport', 'complete'] as const
type Step = typeof STEPS[number]

interface Props {
  bookingRef: string
  current: Step
}

export default function CheckinNav({ bookingRef, current }: Props) {
  const router = useRouter()
  const idx    = STEPS.indexOf(current)
  const prev   = idx > 0 ? STEPS[idx - 1] : null
  const next   = idx < STEPS.length - 1 ? STEPS[idx + 1] : null

  return (
    <div className="flex items-center gap-2 px-5 lg:px-8 py-3 bg-white border-t border-gray-100">
      {/* ← ก่อนหน้า */}
      <button
        onClick={() => prev
          ? router.push(`/checkin/${bookingRef}/${prev}`)
          : router.push('/dashboard')}
        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold
                   text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
      >
        <ArrowLeft size={16} />
        {prev ? 'ก่อนหน้า' : 'Dashboard'}
      </button>

      {/* 🏠 Dashboard (กลาง) */}
      <button
        onClick={() => router.push('/dashboard')}
        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold
                   text-gray-500 bg-gray-50 border border-gray-200 hover:bg-gray-100
                   transition-colors flex-1 justify-center"
      >
        <Home size={16} /> Dashboard
      </button>

      {/* ถัดไป → */}
      {next ? (
        <button
          onClick={() => router.push(`/checkin/${bookingRef}/${next}`)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold
                     text-white bg-resort-teal hover:bg-teal-700 transition-colors"
        >
          ถัดไป <ArrowRight size={16} />
        </button>
      ) : (
        <div className="px-4 py-2.5 w-24" /> // spacer
      )}
    </div>
  )
}
