'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient, type BookingWithDoc } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { countNights } from '@/lib/utils'
import toast from 'react-hot-toast'
import {
  Plus, Search, LogOut, Users, CheckCircle,
  Clock, BedDouble, ChevronRight, History,
  ChevronLeft, ChevronRight as ChevronRightIcon,
  FileCheck, FileX, CalendarDays,
} from 'lucide-react'

const today = () => new Date().toISOString().split('T')[0]

function addDays(date: string, days: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function formatDateTH(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('th-TH', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function formatDateShort(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('th-TH', {
    day: 'numeric', month: 'short', year: '2-digit',
  })
}

export default function DashboardPage() {
  const router = useRouter()
  const [bookings, setBookings]             = useState<BookingWithDoc[]>([])
  const [staffName, setStaffName]           = useState('')
  const [loading, setLoading]               = useState(true)
  const [searchQuery, setSearchQuery]       = useState('')
  const [showNewBooking, setShowNewBooking] = useState(false)
  const [selectedDate, setSelectedDate]     = useState(today())

  const loadData = useCallback(async (date: string) => {
    setLoading(true)
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    if (!staffName) {
      const { data: staff } = await supabase
        .from('staff').select('name').eq('id', user.id).single()
      setStaffName(staff?.name || user.email || 'Staff')
    }

    const { data: bk } = await supabase
      .from('bookings')
      .select('*, guest_documents(status, gdrive_folder_url, finalized_at, uploaded_at)')
      .eq('check_in', date)
      .order('created_at', { ascending: false })

    setBookings((bk as BookingWithDoc[]) || [])
    setLoading(false)
  }, [router, staffName])

  useEffect(() => { loadData(selectedDate) }, [selectedDate])

  async function handleLogout() {
    const supabase = createClient()
    await logAudit('logout')
    await supabase.auth.signOut()
    router.push('/login')
  }

  function goDate(delta: number) {
    setSelectedDate(prev => addDays(prev, delta))
  }

  const isToday  = selectedDate === today()
  const isPast   = selectedDate < today()
  const filtered = bookings.filter(b =>
    b.guest_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.booking_ref.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (b.room_number || '').includes(searchQuery)
  )

  const pending   = bookings.filter(b => b.status === 'pending').length
  const checkedIn = bookings.filter(b => b.status === 'checked_in').length
  const docsOk    = bookings.filter(b => b.guest_documents?.[0]?.status === 'complete').length

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Hero Header ── */}
      <header className="relative h-44 lg:h-52 overflow-hidden">
        {/* Background photo */}
        <Image
          src="/DSC02439.JPEG"
          alt="Laemsui Beach Resort"
          fill
          className="object-cover object-center"
          priority
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/70" />

        {/* Content */}
        <div className="relative z-10 h-full flex flex-col justify-between
                        px-5 lg:px-8 py-4 max-w-5xl mx-auto w-full">
          {/* Top row: logo + name + actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl overflow-hidden shadow-lg border-2 border-white/30 flex-shrink-0">
                <Image src="/laemsui-logo.png" alt="Logo" width={44} height={44} className="object-cover" />
              </div>
              <div>
                <h1 className="text-white font-bold text-lg lg:text-xl leading-tight">
                  Laemsui Beach Resort
                </h1>
                <p className="text-white/60 text-xs">Staff Portal</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push('/history')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl
                           bg-white/15 hover:bg-white/25 text-white text-sm
                           font-medium transition-colors backdrop-blur-sm border border-white/20"
              >
                <History size={15} />
                <span className="hidden sm:inline">ประวัติ</span>
              </button>
              <div className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-xl
                              bg-white/10 text-white/80 text-sm backdrop-blur-sm border border-white/10">
                <span className="text-xs">👤</span>
                <span>{staffName}</span>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white
                           transition-colors backdrop-blur-sm border border-white/20"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>

          {/* Bottom: date label */}
          <div>
            <p className="text-white/50 text-xs font-medium uppercase tracking-widest mb-0.5">
              {isToday ? 'วันนี้' : isPast ? 'ย้อนหลัง' : ''}
            </p>
            <p className="text-white font-semibold text-base lg:text-lg">
              {formatDateTH(selectedDate)}
            </p>
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <div className="px-5 lg:px-8 pb-10 space-y-4 max-w-5xl mx-auto -mt-2">

        {/* Date navigation — floats over hero edge */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-2 flex items-center gap-2">
          <button
            onClick={() => goDate(-1)}
            className="p-2.5 rounded-xl hover:bg-gray-100 transition-colors text-gray-500"
          >
            <ChevronLeft size={20} />
          </button>

          <div className="flex-1 flex items-center justify-center gap-3">
            <CalendarDays size={16} className="text-brand-red flex-shrink-0" />
            <input
              type="date"
              value={selectedDate}
              max={today()}
              onChange={e => setSelectedDate(e.target.value)}
              className="text-center font-semibold text-gray-800 bg-transparent
                         focus:outline-none text-base cursor-pointer"
            />
            {!isToday && (
              <button
                onClick={() => setSelectedDate(today())}
                className="px-3 py-1 bg-brand-red text-white rounded-lg text-xs
                           font-semibold hover:bg-brand-red-dark transition-colors"
              >
                วันนี้
              </button>
            )}
          </div>

          <button
            onClick={() => goDate(1)}
            disabled={isToday}
            className="p-2.5 rounded-xl hover:bg-gray-100 disabled:opacity-30
                       transition-colors text-gray-500"
          >
            <ChevronRightIcon size={20} />
          </button>
        </div>

        {/* Past date banner */}
        {isPast && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5
                          flex items-center gap-2 text-amber-700 text-sm font-medium">
            <History size={15} className="flex-shrink-0 text-amber-500" />
            กำลังดูข้อมูลย้อนหลัง · สามารถอัปโหลดเอกสารเพิ่มเติมได้
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            icon={<Users size={20} />}
            value={bookings.length}
            label="Bookings ทั้งหมด"
            gradient="from-brand-red to-brand-red-dark"
            light="bg-red-50 text-brand-red"
          />
          <StatCard
            icon={<Clock size={20} />}
            value={pending}
            label="รอดำเนินการ"
            gradient="from-amber-500 to-orange-500"
            light="bg-amber-50 text-amber-600"
          />
          <StatCard
            icon={<CheckCircle size={20} />}
            value={checkedIn}
            label="Check-in แล้ว"
            gradient="from-emerald-500 to-teal-600"
            light="bg-emerald-50 text-emerald-600"
          />
          <StatCard
            icon={<FileCheck size={20} />}
            value={docsOk}
            label="เอกสารครบ"
            gradient="from-blue-500 to-indigo-600"
            light="bg-blue-50 text-blue-600"
          />
        </div>

        {/* Search + Add */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="search"
              placeholder="ค้นหาชื่อ, Booking Ref, ห้อง..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="input-search"
            />
          </div>
          <button
            onClick={() => setShowNewBooking(true)}
            className="flex items-center gap-2 px-5 py-3 rounded-xl font-semibold
                       text-white bg-brand-red hover:bg-brand-red-dark
                       active:scale-[0.97] transition-all shadow-md shadow-brand-red/20
                       min-h-[52px] touch-manipulation"
          >
            <Plus size={20} />
            <span className="hidden sm:inline">เพิ่ม Booking</span>
          </button>
        </div>

        {/* Booking List */}
        {loading ? (
          <div className="text-center py-16 text-gray-400">
            <div className="w-8 h-8 border-2 border-brand-red border-t-transparent
                            rounded-full animate-spin mx-auto mb-3" />
            กำลังโหลด...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <BedDouble size={52} className="mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium text-gray-500">
              ไม่มี Booking {isToday ? 'วันนี้' : formatDateShort(selectedDate)}
            </p>
            <p className="text-sm mt-1">กด "เพิ่ม Booking" เพื่อเริ่ม</p>
          </div>
        ) : (
          <div>
            <p className="text-gray-400 text-sm mb-3 font-medium">
              {filtered.length} รายการ
            </p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {filtered.map(booking => (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  onClick={() => {
                    logAudit('view_booking', booking.booking_ref)
                    router.push(`/checkin/${booking.booking_ref}/upload`)
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {showNewBooking && (
        <NewBookingModal
          defaultDate={selectedDate}
          onClose={() => setShowNewBooking(false)}
          onCreated={() => { setShowNewBooking(false); loadData(selectedDate) }}
        />
      )}
    </div>
  )
}

/* ── Stat Card ── */
function StatCard({
  icon, value, label, gradient, light,
}: {
  icon: React.ReactNode
  value: number
  label: string
  gradient: string
  light: string
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 lg:p-5">
      <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl mb-3 ${light}`}>
        {icon}
      </div>
      <div className="text-3xl font-bold text-gray-800 leading-none mb-1">{value}</div>
      <div className="text-gray-400 text-xs font-medium">{label}</div>
    </div>
  )
}

/* ── Booking Card ── */
function BookingCard({ booking, onClick }: { booking: BookingWithDoc; onClick: () => void }) {
  const doc = booking.guest_documents?.[0]
  const docComplete   = doc?.status === 'complete'
  const docInProgress = doc?.status === 'in_progress'

  const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
    pending:     { bg: 'bg-amber-100',  text: 'text-amber-700',  label: 'รอ Check-in' },
    checked_in:  { bg: 'bg-green-100',  text: 'text-green-700',  label: 'Check-in แล้ว' },
    checked_out: { bg: 'bg-gray-100',   text: 'text-gray-500',   label: 'Check-out แล้ว' },
    cancelled:   { bg: 'bg-red-100',    text: 'text-red-500',    label: 'ยกเลิก' },
  }
  const s = statusConfig[booking.status] || statusConfig.pending

  return (
    <button
      onClick={onClick}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4
                 text-left w-full hover:shadow-md hover:border-gray-200
                 active:scale-[0.98] transition-all group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Status + ref */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${s.bg} ${s.text}`}>
              {s.label}
            </span>
            <span className="text-xs text-gray-300 font-mono">{booking.booking_ref}</span>
          </div>

          {/* Guest name */}
          <p className="text-base font-bold text-gray-800 truncate mb-1.5">
            {booking.guest_name}
          </p>

          {/* Details row */}
          <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
            <span className="flex items-center gap-1 font-medium text-gray-600">
              <BedDouble size={12} /> ห้อง {booking.room_number || '—'}
            </span>
            <span>{countNights(booking.check_in, booking.check_out)} คืน</span>
            <span>{booking.num_adults} ผู้ใหญ่{booking.num_children > 0 ? ` · ${booking.num_children} เด็ก` : ''}</span>
          </div>
        </div>

        {/* Right: arrow + doc status */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <ChevronRight size={18} className="text-gray-200 group-hover:text-gray-400 transition-colors" />
          {docComplete ? (
            <span className="flex items-center gap-1 text-xs text-emerald-600 font-semibold
                             bg-emerald-50 px-2 py-0.5 rounded-full">
              <FileCheck size={11} /> เอกสารครบ
            </span>
          ) : docInProgress ? (
            <span className="flex items-center gap-1 text-xs text-blue-500 font-semibold
                             bg-blue-50 px-2 py-0.5 rounded-full">
              <Clock size={11} /> กำลังดำเนินการ
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-amber-500 font-semibold
                             bg-amber-50 px-2 py-0.5 rounded-full">
              <FileX size={11} /> ยังไม่อัปโหลด
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

/* ── New Booking Modal ── */
function NewBookingModal({
  defaultDate, onClose, onCreated,
}: { defaultDate: string; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    booking_ref: '', guest_name: '', room_number: '',
    room_type: '', check_in: defaultDate, check_out: '',
    num_adults: 1, num_children: 0, nationality: '', special_requests: '',
  })
  const [loading, setLoading] = useState(false)

  function update(field: string, value: string | number) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.booking_ref || !form.guest_name || !form.check_out) {
      toast.error('กรุณากรอกข้อมูลที่จำเป็น'); return
    }
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.from('bookings').insert(form)
    if (error) {
      toast.error('เพิ่ม Booking ไม่สำเร็จ: ' + error.message)
      setLoading(false); return
    }
    await logAudit('create_booking', form.booking_ref, { guestName: form.guest_name })
    toast.success('เพิ่ม Booking สำเร็จ')
    onCreated()
  }

  const isPastDate = defaultDate < new Date().toISOString().split('T')[0]

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end lg:items-center lg:justify-center">
      <div className="bg-white w-full rounded-t-3xl lg:rounded-3xl
                      max-h-[92vh] lg:max-w-2xl overflow-y-auto">

        {/* Modal header */}
        <div className="sticky top-0 bg-white rounded-t-3xl border-b border-gray-100 px-6 pt-5 pb-4 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-800">เพิ่ม Booking</h2>
              {isPastDate && (
                <p className="text-sm text-amber-600 mt-0.5 font-medium">
                  📅 บันทึกย้อนหลัง: {formatDateShort(defaultDate)}
                </p>
              )}
            </div>
            <button onClick={onClose}
                    className="w-9 h-9 flex items-center justify-center rounded-xl
                               bg-gray-100 hover:bg-gray-200 text-gray-500 text-lg transition-colors">
              ✕
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">Booking Ref *</label>
              <input className="input-ipad" placeholder="จาก Little Hotelier"
                     value={form.booking_ref} onChange={e => update('booking_ref', e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">เลขห้อง</label>
              <input className="input-ipad" placeholder="101"
                     value={form.room_number} onChange={e => update('room_number', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1.5">ชื่อ Guest *</label>
            <input className="input-ipad" placeholder="Mr. John Smith"
                   value={form.guest_name} onChange={e => update('guest_name', e.target.value)} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">Check-in *</label>
              <input type="date" className="input-ipad"
                     value={form.check_in} onChange={e => update('check_in', e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">Check-out *</label>
              <input type="date" className="input-ipad"
                     value={form.check_out} onChange={e => update('check_out', e.target.value)} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">ผู้ใหญ่</label>
              <input type="number" min={1} max={10} className="input-ipad"
                     value={form.num_adults} onChange={e => update('num_adults', parseInt(e.target.value))} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">เด็ก</label>
              <input type="number" min={0} max={10} className="input-ipad"
                     value={form.num_children} onChange={e => update('num_children', parseInt(e.target.value))} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1.5">สัญชาติ</label>
            <input className="input-ipad" placeholder="Thai, British, etc."
                   value={form.nationality} onChange={e => update('nationality', e.target.value)} />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-xl font-bold text-white text-base
                       bg-brand-red hover:bg-brand-red-dark disabled:opacity-60
                       active:scale-[0.98] transition-all shadow-lg shadow-brand-red/20"
          >
            {loading ? 'กำลังบันทึก...' : '✅ บันทึก Booking'}
          </button>
        </form>
      </div>
    </div>
  )
}
