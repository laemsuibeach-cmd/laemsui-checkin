'use client'

type Step = { id: number; label: string; icon: string }

const STEPS: Step[] = [
  { id: 1, label: 'อัปโหลด Form', icon: '📄' },
  { id: 2, label: 'เซ็นชื่อ',     icon: '✍️' },
  { id: 3, label: 'ถ่ายเอกสาร', icon: '📷' },
  { id: 4, label: 'ยืนยัน',       icon: '✅' },
]

export default function CheckinSteps({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-between px-2 py-3 bg-white border-b border-gray-100">
      {STEPS.map((step, i) => (
        <div key={step.id} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                step.id < current  ? 'step-done' :
                step.id === current ? 'step-active' : 'step-inactive'
              }`}
            >
              {step.id < current ? '✓' : step.icon}
            </div>
            <span className={`text-xs mt-1 text-center leading-tight w-14 ${
              step.id === current ? 'text-resort-teal font-semibold' : 'text-gray-400'
            }`}>
              {step.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`h-0.5 w-5 mx-1 mt-[-10px] ${
              step.id < current ? 'bg-green-400' : 'bg-gray-200'
            }`} />
          )}
        </div>
      ))}
    </div>
  )
}
