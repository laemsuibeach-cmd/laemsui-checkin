'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { embedSignatureInPdf } from '@/lib/pdf'
import { formatTimestamp } from '@/lib/utils'
import CheckinSteps from '@/components/CheckinSteps'
import toast from 'react-hot-toast'
import { ArrowRight, ArrowLeft, RotateCcw, Check, FileText, ZoomIn, ZoomOut } from 'lucide-react'
import CheckinNav from '@/components/CheckinNav'

type Screen = 'preview' | 'pdpa' | 'sign'

export default function SignPage() {
  const { ref } = useParams<{ ref: string }>()
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [sigPad, setSigPad]       = useState<any>(null)
  const [isEmpty, setIsEmpty]     = useState(true)
  const [guestName, setGuestName] = useState('')
  const [loading, setLoading]     = useState(false)
  const [pdpaConsent, setPdpaConsent] = useState(false)
  const [screen, setScreen]       = useState<Screen>('preview')
  const [pdfUrl, setPdfUrl]       = useState<string | null>(null)
  const [pdfName, setPdfName]     = useState('')

  useEffect(() => { loadGuestName(); buildPdfUrl() }, [ref])

  useEffect(() => {
    if (screen === 'sign' && canvasRef.current) {
      requestAnimationFrame(() => initSignaturePad())
    }
  }, [screen])

  // Clean up blob URL on unmount
  useEffect(() => {
    return () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl) }
  }, [pdfUrl])

  async function loadGuestName() {
    const supabase = createClient()
    const { data } = await supabase
      .from('bookings').select('guest_name').eq('booking_ref', ref).single()
    setGuestName(data?.guest_name || '')
  }

  function buildPdfUrl() {
    try {
      const base64 = sessionStorage.getItem(`pdf_original_${ref}`)
      const name   = sessionStorage.getItem(`pdf_filename_${ref}`) || 'registration.pdf'
      if (!base64) return
      const binary = atob(base64)
      const bytes  = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const blob = new Blob([bytes], { type: 'application/pdf' })
      setPdfUrl(URL.createObjectURL(blob))
      setPdfName(name)
    } catch (e) {
      console.warn('Could not build PDF preview URL', e)
    }
  }

  async function initSignaturePad() {
    const SignaturePad = (await import('signature_pad')).default
    const canvas    = canvasRef.current!
    const container = canvas.parentElement!

    // Create pad first — resizeCanvas references it via closure below
    const pad = new SignaturePad(canvas, {
      backgroundColor: 'rgba(0,0,0,0)',
      penColor: 'rgb(0, 30, 100)',
      minWidth: 1.5, maxWidth: 4, velocityFilterWeight: 0.7,
    })

    function resizeCanvas() {
      const ratio = Math.max(window.devicePixelRatio || 1, 1)
      const w = container.clientWidth
      const h = container.clientHeight
      // Save strokes before resizing so signature isn't wiped
      const savedData = pad.toData()
      canvas.width  = w * ratio
      canvas.height = h * ratio
      canvas.style.width  = w + 'px'
      canvas.style.height = h + 'px'
      canvas.getContext('2d')!.scale(ratio, ratio)
      pad.clear()
      // Restore strokes after resize
      if (savedData.length > 0) pad.fromData(savedData)
    }

    canvas.addEventListener('touchstart', e => e.preventDefault(), { passive: false })
    canvas.addEventListener('touchmove',  e => e.preventDefault(), { passive: false })
    pad.addEventListener('beginStroke', () => setIsEmpty(false))

    resizeCanvas()

    const ro = new ResizeObserver(() => {
      resizeCanvas()
      // Only reset isEmpty if signature was truly lost (shouldn't happen now)
      if (pad.isEmpty()) setIsEmpty(true)
    })
    ro.observe(container)
    setSigPad(pad)
  }

  function clearSignature() { sigPad?.clear(); setIsEmpty(true) }

  async function handleNext() {
    if (!pdpaConsent) { toast.error('Please accept the privacy notice first.'); return }
    if (isEmpty || !sigPad || sigPad.isEmpty()) {
      toast.error('Please ask the guest to sign first.'); return
    }
    setLoading(true)
    try {
      const originalBase64 = sessionStorage.getItem(`pdf_original_${ref}`)
      if (!originalBase64) {
        toast.error('PDF not found — please go back and re-upload.')
        router.push(`/checkin/${ref}/upload`); return
      }
      const binaryString = atob(originalBase64)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i)

      const signatureDataUrl = sigPad.toDataURL('image/png')
      const timestamp = formatTimestamp()
      const signedPdfBytes = await embedSignatureInPdf(
        bytes.buffer, signatureDataUrl, guestName, ref, timestamp,
      )

      let signedBinary = ''
      for (let i = 0; i < signedPdfBytes.length; i += 8192)
        signedBinary += String.fromCharCode(...Array.from(signedPdfBytes.subarray(i, i + 8192)))
      sessionStorage.setItem(`pdf_signed_${ref}`, btoa(signedBinary))
      sessionStorage.setItem(`signature_${ref}`, signatureDataUrl)

      // #19 fix: upsert แทน update — ป้องกัน silent fail ถ้าพนักงาน
      //         เปิด URL sign โดยตรงโดยไม่ผ่านหน้า upload ก่อน
      const supabase = createClient()
      await supabase.from('guest_documents').upsert({
        booking_ref: ref,
        pdpa_consent: true,
        pdpa_consent_at: new Date().toISOString(),
        signed_at: new Date().toISOString(),
      }, { onConflict: 'booking_ref' })

      await logAudit('sign_pdf', ref)
      await logAudit('pdpa_consent', ref)
      router.push(`/checkin/${ref}/passport`)
    } catch (err) {
      console.error(err)
      toast.error('Something went wrong, please try again.')
      setLoading(false)
    }
  }

  /* ── SHARED HEADER ── */
  const headerTitles: Record<Screen, string> = {
    preview: 'Review Registration Form',
    pdpa:    'Privacy Notice (PDPA)',
    sign:    'Guest Signature',
  }
  const headerBack: Record<Screen, () => void> = {
    preview: () => router.push(`/checkin/${ref}/upload`),
    pdpa:    () => setScreen('preview'),
    sign:    () => setScreen('pdpa'),
  }

  /* ── PDF PREVIEW SCREEN ── */
  if (screen === 'preview') {
    return (
      <div className="h-screen bg-white flex flex-col overflow-hidden">
        <header className="bg-resort-teal text-white px-5 lg:px-8 py-3 flex-shrink-0">
          <button onClick={headerBack.preview}
                  className="flex items-center gap-2 text-teal-200 mb-1">
            <ArrowLeft size={18} /> Back
          </button>
          <h1 className="text-xl font-bold">{headerTitles.preview}</h1>
          <p className="text-teal-200 text-sm">{guestName} · {ref}</p>
        </header>
        <div className="flex-shrink-0"><CheckinSteps current={2} /></div>

        {/* PDF viewer */}
        <div className="flex-1 min-h-0 flex flex-col">
          {pdfUrl ? (
            <iframe
              src={pdfUrl}
              className="flex-1 w-full border-0"
              title="Registration Form"
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-400">
              <FileText size={48} className="opacity-40" />
              <p className="text-sm">
                {sessionStorage.getItem(`pdf_original_${ref}`)
                  ? 'Loading PDF…'
                  : 'No PDF found — please go back and upload the form.'}
              </p>
            </div>
          )}

          {/* Bottom bar */}
          <div className="flex-shrink-0 px-5 py-4 lg:px-8 bg-white border-t border-gray-100 flex items-center justify-between gap-4">
            <p className="text-sm text-gray-400 truncate flex-1">
              <FileText size={14} className="inline mr-1.5 -mt-0.5" />
              {pdfName}
            </p>
            <button
              onClick={() => setScreen('pdpa')}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold
                         text-white bg-resort-teal hover:bg-teal-700
                         active:scale-[0.97] transition-all min-h-[52px]"
            >
              Looks good <ArrowRight size={18} />
            </button>
          </div>
        </div>
        <CheckinNav bookingRef={ref} current="sign" />
      </div>
    )
  }

  /* ── PDPA SCREEN ── */
  if (screen === 'pdpa') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <header className="bg-resort-teal text-white px-5 lg:px-8 py-3 lg:py-4">
          <button onClick={headerBack.pdpa}
                  className="flex items-center gap-2 text-teal-200 mb-1">
            <ArrowLeft size={18} /> Back
          </button>
          <h1 className="text-xl font-bold">{headerTitles.pdpa}</h1>
        </header>
        <CheckinSteps current={2} />

        <div className="flex-1 p-5 lg:p-8 max-w-lg lg:max-w-5xl mx-auto w-full">
          <div className="lg:grid lg:grid-cols-2 lg:gap-8 lg:items-start">

            {/* LEFT: PDPA text */}
            <div className="card">
              <h2 className="text-xl font-bold text-gray-800 mb-4">📋 Personal Data Collection Notice</h2>
              <div className="text-gray-600 space-y-3 text-base leading-relaxed">
                <p>
                  Laemsui Beach Resort collects your personal data — including full name,
                  passport / national ID number, photograph, and signature — for the following purposes:
                </p>
                <ul className="space-y-2 pl-2">
                  <li>✓ Guest check-in registration as required by Thai law</li>
                  <li>✓ Hotel and guest security management</li>
                  <li>✓ Compliance with the Hotel Act (Thailand)</li>
                </ul>
                <p className="text-sm text-gray-500">
                  Your data will be retained for 2 years after check-out and then permanently
                  deleted in accordance with the Personal Data Protection Act B.E. 2562 (PDPA).
                </p>
                <p className="text-sm text-gray-500">
                  You have the right to access, correct, or request deletion of your data
                  by contacting the hotel directly.
                </p>
              </div>
            </div>

            {/* RIGHT: Consent + button */}
            <div className="mt-5 lg:mt-0 space-y-4">
              <label className="flex items-start gap-3 card cursor-pointer">
                <input
                  type="checkbox"
                  checked={pdpaConsent}
                  onChange={e => setPdpaConsent(e.target.checked)}
                  className="w-6 h-6 mt-0.5 accent-teal-600 flex-shrink-0"
                />
                <span className="text-base text-gray-700">
                  I have read and understood the above notice, and I consent to the
                  collection of my personal data for hotel check-in purposes.
                </span>
              </label>

              <button
                onClick={() => {
                  if (!pdpaConsent) { toast.error('Please accept the privacy notice first.'); return }
                  setScreen('sign')
                }}
                disabled={!pdpaConsent}
                className="btn-primary w-full text-lg"
              >
                I Agree → Proceed to Sign
              </button>
            </div>
          </div>
        </div>
        <CheckinNav bookingRef={ref} current="sign" />
      </div>
    )
  }

  /* ── SIGNATURE SCREEN ── */
  return (
    <div className="h-screen bg-white flex flex-col overflow-hidden">
      <header className="bg-resort-teal text-white px-5 lg:px-8 py-3 flex-shrink-0">
        <button onClick={headerBack.sign}
                className="flex items-center gap-2 text-teal-200 mb-1">
          <ArrowLeft size={18} /> Back
        </button>
        <h1 className="text-xl font-bold">{headerTitles.sign}</h1>
        <p className="text-teal-200 text-sm">{guestName} · {ref}</p>
      </header>
      <div className="flex-shrink-0"><CheckinSteps current={2} /></div>

      <div className="flex-1 flex flex-col px-4 pt-3 pb-4 lg:px-8 min-h-0">
        <p className="text-center text-gray-400 mb-3 text-sm flex-shrink-0">
          Please sign below using your finger or Apple Pencil
        </p>

        <div className="signature-container flex-1 min-h-0">
          <canvas
            ref={canvasRef}
            className="no-select"
            style={{ touchAction: 'none', display: 'block' }}
          />
          {isEmpty && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-gray-300 text-2xl lg:text-3xl select-none">✍️ Sign here</p>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-3 flex-shrink-0">
          <button
            onClick={clearSignature}
            className="btn-secondary flex items-center gap-2 flex-1 justify-center"
          >
            <RotateCcw size={18} /> Clear
          </button>
          <button
            onClick={handleNext}
            disabled={isEmpty || loading}
            className="btn-primary flex items-center gap-2 flex-[2] justify-center"
          >
            {loading
              ? <div className="w-5 h-5 bord