'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient, type BookingWithDoc } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { countNights } from '@/lib/utils'
import toast from 'react-hot-toast'
import {
  Plus, Search, LogOut, Users, CheckCircle,
  Clock, BedDouble, ChevronRight, CalendarCheck,
  History, ChevronLeft, ChevronRight as ChevronRightIcon,
  FileCheck, FileX,
} from 'lucide-react'

const today = () => new Date().toISOString().split('T')[0]

function addDays(date: string, days: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function formatDateTH(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('th-TH', {
    weekday: 'short', day: 'numeric', month: 'short', year: '2-digit',
  })
}

export default function DashboardPage() {
  const router = useRouter()
  const [bookings, setBookings]       = useState<BookingWithDoc[]>([])
  const [staffName, setStaffName]     = useState('')
  const [loading, setLoading]         = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showNewBooking, setShowNewBooking] = useState(false)
  const [selectedDate, setSelectedDate]   = useState(today())

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

  const isToday    = selectedDate === today()
  const isPast     = selectedDate < today()
  const filtered   = bookings.filter(b =>
    b.guest_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.booking_ref.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (b.room_number || '').includes(searchQuery)
  )

  const checkedIn  = bookings.filter(b => b.status === 'checked_in').length
  const checkedOut = bookings.filter(b => b.status === 'checked_out').length
  const pending    = bookings.filter(b => b.status === 'pending').length
  const docsOk     = bookings.filter(b =>
    b.guest_documents?.[0]?.status === 'complete'
  ).length

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Header ── */}
      <header className="bg-resort-teal text-white sticky top-0 z-10 shadow-md">
        <div className="flex items-center justify-between px-5 lg:px-8 py-3 max-w-5xl mx-auto">
          <div>
            <h1 className="text-xl font-bold">🏖️ Laemsui Resort</h1>
            <p className="text-teal-200 text-xs mt-0.5">{formatDateTH(selectedDate)}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push('/history')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10
                         hover:bg-white/20 transition-colors text-sm font-medium"
            >
              <History size={16} /> ประวัติ
            </button>
            <span className="text-sm text-teal-100 hidden md:block ml-1">👤 {staffName}</span>
            <button
              onClick={handleLogout}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors ml-1"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <div className="p-5 lg:px-8 lg:py-6 space-y-4 max-w-5xl mx-auto">

        {/* Date navigation */}
        <div className="flex items-center gap-2 bg-white rounded-2xl border border-gray-200
                        shadow-sm p-2 lg:p-3">
          <button
            onClick={() => goDate(-1)}
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors text-gray-600"
          >
            <ChevronLeft size={20} />
          </button>

          <div className="flex-1 flex items-center justify-center gap-3">
            <input
              type="date"
              value={selectedDate}
              max={today()}
              onChange={e => setSelectedDate(e.target.value)}
              className="text-center font-semibold text-gray-800 bg-transparent
                         focus:outline-none text-base lg:text-lg cursor-pointer"
            />
            {!isToday && (
              <button
                onClick={() => setSelectedDate(today())}
                className="px-3 py-1 bg-resort-teal text-white rounded-lg text-xs
                           font-semibold hover:bg-teal-700 transition-colors"
              >
                วันนี้
              </button>
            )}
          </div>

          <button
            onClick={() => goDate(1)}
            disabled={isToday}
            className="p-2 rounded-xl hover:bg-gray-100 disabled:opacity-30
                       transition-colors text-gray-600"
          >
            <ChevronRightIcon size={20} />
          </button>
        </div>

        {/* Past date banner */}
        {isPast && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5
                          flex items-center gap-2 text-amber-700 text-sm">
            <History size={16} className="flex-shrink-0" />
            <span>กำลังดูข้อมูลย้อนหลัง · สามารถอัปโหลดเอกสารเพิ่มเติมได้</span>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={<Users size={18} className="text-resort-teal" />}
                    value={bookings.length} label="Bookings" color="teal" />
          <StatCard icon={<Clock size={18} className="text-amber-500" />}
                    value={pending} label="รอดำเนินการ" color="amber" />
          <StatCard icon={<CheckCircle size={18} className="text-green-500" />}
                    value={checkedIn} label="Check-in แล้ว" color="green" />
          <StatCard icon={<FileCheck size={18} className="text-blue-500" />}
                    value={docsOk} label="เอกสารครบ" color="blue" />
        </div>

        {/* Search + Add */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              placeholder="ค้นหาชื่อ, Booking Ref, ห้อง..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="input-ipad !pl-11"
            />
          </div>
          <button
            onClick={() => setShowNewBooking(true)}
            className="btn-primary px-5 flex items-center gap-2"
          >
            <Plus size={20} />
            <span className="hidden sm:inline">เพิ่ม Booking</span>
          </button>
        </div>

        {/* Booking List */}
        {loading ? (
          <div className="text-center py-16 text-gray-400">
            <div className="w-8 h-8 border-2 border-resort-teal border-t-transparent
                            rounded-full animate-spin mx-auto mb-3" />
            กำลังโหลด...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <BedDouble size={52} className="mx-auto mb-3 opacity-40" />
            <p className="text-lg">ไม่มี Booking {isToday ? 'วันนี้' : formatDateTH(selectedDate)}</p>
            <p className="text-sm mt-1">กด "เพิ่ม Booking" เพื่อเริ่ม</p>
          </div>
        ) : (
          <div>
            <h2 className="text-gray-500 font-semibold text-sm mb-3">
              {filtered.length} รายการ
            </h2>
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
  icon, value, label, color,
}: { icon: React.ReactNode; value: number; label: string; color: string }) {
  const colors: Record<string, string> = {
    teal: 'text-resort-teal', amber: 'text-amber-500',
    green: 'text-green-500',  blue: 'text-blue-500',
  }
  return (
    <div className="card text-center py-4">
      <div className="flex justify-center mb-1">{icon}</div>
      <div className={`text-3xl font-bold ${colors[color]}`}>{value}</div>
      <div className="text-gray-500 text-xs mt-1">{label}</div>
    </div>
  )
}

/* ── Booking Card ── */
function BookingCard({ booking, onClick }: { booking: BookingWithDoc; onClick: () => void }) {
  const doc = booking.guest_documents?.[0]
  const docComplete = doc?.status === 'complete'
  const docInProgress = doc?.status === 'in_progress'

  const statusColors: Record<string, string> = {
    pending:     'bg-amber-100 text-amber-700',
    checked_in:  'bg-green-100 text-green-700',
    checked_out: 'bg-gray-100 text-gray-500',
    cancelled:   'bg-red-100 text-red-500',
  }
  const statusLabels: Record<string, string> = {
    pending:     'รอ Check-in',
    checked_in:  'Check-in แล้ว',
    checked_out: 'Check-out แล้ว',
    cancelled:   'ยกเลิก',
  }

  return (
    <button
      onClick={onClick}
      className="card w-full text-left hover:shadow-md active:scale-[0.98] transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
                              ${statusColors[booking.status]}`}>
              {statusLabels[booking.status]}
            </span>
            <span className="text-xs text-gray-400">{booking.booking_ref}</span>
          </div>
          <p className="text-lg font-bold text-gray-800 truncate">{booking.guest_name}</p>
          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 flex-wrap">
            <span className="flex items-center gap-1">
              <BedDouble size={13} /> ห้อง {booking.room_number || '-'}
            </span>
            <span>{countNights(booking.check_in, booking.check_out)} คืน</span>
            <span>{booking.num_adults} ผู้ใหญ่</span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <ChevronRight size={18} className="text-gray-300" />
          {docComplete ? (
            <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
              <FileCheck size={13} /> เอกสารครบ
            </span>
          ) : docInProgress ? (
            <span className="flex items-center gap-1 text-xs text-blue-500 font-medium">
              <Clock size={13} /> กำลังดำเนินการ
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-amber-500 font-medium">
              <FileX size={13} /> ยังไม่อัปโหลด
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

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end lg:items-center lg:justify-center">
      <div className="bg-white w-full rounded-t-3xl lg:rounded-3xl p-6 lg:p-8
                      max-h-[90vh] lg:max-w-2xl overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold">เพิ่ม Booking</h2>
            {defaultDate < new Date().toISOString().split('T')[0] && (
              <p className="text-sm text-amber-600 mt-0.5">📅 บันทึกย้อนหลัง: {formatDateTH(defaultDate)}</p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 text-2xl leading-none p-1">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Booking Ref *</label>
              <input className="input-ipad" placeholder="จาก Little Hotelier"
                     value={form.booking_ref} onChange={e => update('booking_ref', e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">เลขห้อง</label>
              <input className="input-ipad" placeholder="101"
                     value={form.room_number} onChange={e => update('room_number', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">ชื่อ Guest *</label>
            <input className="input-ipad" placeholder="Mr. John Smith"
                   value={form.guest_name} onChange={e => update('guest_name', e.target.value)} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Check-in *</label>
              <input type="date" className="input-ipad"
                     value={form.check_in} onChange={e => update('check_in', e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Check-out *</label>
              <input type="date" className="input-ipad"
                     value={form.check_out} onChange={e => update('check_out', e.target.value)} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">ผู้ใหญ่</label>
              <input type="number" min={1} max={10} className="input-ipad"
                     value={form.num_adults} onChange={e => update('num_adults', parseInt(e.target.value))} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">เด็ก</label>
              <input type="number" min={0} max={10} className="input-ipad"
                     value={form.num_children} onChange={e => update('num_children', parseInt(e.target.value))} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">สัญชาติ</label>
            <input className="input-ipad" placeholder="Thai, British, etc."
                   value={form.nationality} onChange={e => update('nationality', e.target.value)} />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full text-lg">
            {loading ? 'กำลังบันทึก...' : '✅ บันทึก Booking'}
          </button>
        </form>
      </div>
    </div>
  )
}
