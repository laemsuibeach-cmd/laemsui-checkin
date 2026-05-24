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
    <div className="flex items-center px-4 lg:px-8 py-2 bg-white border-b border-gray-100">
      {STEPS.map((step, i) => (
        <div key={step.id} className="flex items-center flex-1">
          {/* Step circle + label */}
          <div className="flex items-center gap-2 flex-1">
            <div
              className={`w-8 h-8 lg:w-9 lg:h-9 flex-shrink-0 rounded-full flex items-center
                          justify-center text-sm font-bold transition-colors ${
                step.id < current   ? 'step-done'
                : step.id === current ? 'step-active'
                : 'step-inactive'
              }`}
            >
              {step.id < current ? '✓' : step.icon}
            </div>
            <span
              className={`text-xs leading-tight hidden sm:block lg:text-sm ${
                step.id === current
                  ? 'text-resort-teal font-semibold'
                  : 'text-gray-400'
              }`}
            >
              {step.label}
            </span>
          </div>

          {/* Connector line */}
          {i < STEPS.length - 1 && (
            <div
              className={`h-0.5 w-4 lg:w-8 mx-1 flex-shrink-0 ${
                step.id < current ? 'bg-green-400' : 'bg-gray-200'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  )
}
