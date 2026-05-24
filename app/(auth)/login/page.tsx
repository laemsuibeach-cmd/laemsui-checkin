'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import toast from 'react-hot-toast'
import { Eye, EyeOff, LogIn } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      toast.error('Email หรือรหัสผ่านไม่ถูกต้อง')
      setLoading(false)
      return
    }

    try { await fetch('/api/ensure-staff', { method: 'POST' }) }
    catch (e) { console.warn('ensure-staff call failed (non-fatal):', e) }

    await logAudit('login')
    toast.success('เข้าสู่ระบบสำเร็จ')
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex">

      {/* ── LEFT: Resort photo (desktop only) ── */}
      <div className="hidden lg:block lg:w-1/2 relative">
        <Image
          src="/laemsui-resort.jpg"
          alt="Laem Sui Beach Resort"
          fill
          className="object-cover"
          priority
        />
        {/* Gradient overlay for text legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-black/10" />
        <div className="absolute bottom-10 left-10 right-10 text-white">
          <p className="text-sm font-medium tracking-[0.2em] uppercase text-white/70 mb-2">Welcome to</p>
          <h1 className="text-4xl font-bold leading-tight mb-1">Laem Sui Beach</h1>
          <p className="text-white/80 text-lg">แหลมซุย บีช · Surat Thani</p>
        </div>
      </div>

      {/* ── RIGHT: Login form ── */}
      <div className="flex-1 relative flex items-center justify-center bg-white">

        {/* Mobile background photo */}
        <div className="absolute inset-0 lg:hidden">
          <Image
            src="/laemsui-resort.jpg"
            alt="Laem Sui Beach Resort"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-black/50" />
        </div>

        {/* Form card */}
        <div className="relative z-10 w-full max-w-md px-8 py-10
                        lg:px-12 lg:py-0">

          {/* Logo */}
          <div className="flex flex-col items-center mb-10">
            <div className="w-24 h-24 relative mb-5 rounded-2xl overflow-hidden shadow-lg">
              <Image
                src="/laemsui-logo.png"
                alt="Laem Sui Beach Logo"
                fill
                className="object-cover"
              />
            </div>
            <p className="text-xs font-semibold tracking-[0.25em] uppercase text-white/70 lg:text-gray-400">
              Staff Portal
            </p>
            <h2 className="text-2xl font-bold mt-1 text-white lg:text-gray-800">
              เข้าสู่ระบบ
            </h2>
          </div>

          {/* Form */}
          <div className="bg-white/95 backdrop-blur-sm lg:bg-transparent rounded-2xl
                          p-6 lg:p-0 shadow-2xl lg:shadow-none">
            <form onSubmit={handleLogin} className="space-y-5">

              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="staff@laemsui.com"
                  className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-gray-50
                             text-gray-800 placeholder-gray-400 text-sm
                             focus:outline-none focus:ring-2 focus:ring-brand-red/30 focus:border-brand-red
                             transition-all"
                  required
                  autoCapitalize="none"
                  autoCorrect="off"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1.5">
                  รหัสผ่าน
                </label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-12 px-4 pr-12 rounded-xl border border-gray-200 bg-gray-50
                               text-gray-800 placeholder-gray-400 text-sm
                               focus:outline-none focus:ring-2 focus:ring-brand-red/30 focus:border-brand-red
                               transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400
                               hover:text-gray-600 p-1.5 transition-colors"
                  >
                    {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 mt-1 rounded-xl font-semibold text-white text-sm
                           flex items-center justify-center gap-2.5
                           bg-brand-red hover:bg-brand-red-dark active:scale-[0.98]
                           disabled:opacity-60 disabled:cursor-not-allowed
                           transition-all duration-150 shadow-md shadow-brand-red/30"
              >
                {loading
                  ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  : <LogIn size={17} />}
                {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
              </button>
            </form>

            <p className="text-center text-gray-400 text-xs mt-6">
              ติดต่อ Admin หากลืมรหัสผ่าน
            </p>
          </div>
        </div>
      </div>

    </div>
  )
}
