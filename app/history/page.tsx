'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient, type BookingWithDoc, type AuditLog } from '@/lib/supabase'
import { countNights } from '@/lib/utils'
import toast from 'react-hot-toast'
import {
  ArrowLeft, Calendar, Filter, FileCheck, FileX, Clock,
  BedDouble, ExternalLink, Upload, RefreshCw, User,
  Trash2, CheckSquare, Square, X,
} from 'lucide-react'

const today = () => new Date().toISOString().split('T')[0]

function addDays(date: string, days: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function formatDateTH(dateStr: string) {
  const d = new Date(dateStr)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yy = String(d.getFullYear()).slice(-2)
  return `${dd}/${mm}/${yy}`
}

function formatDateTimeTH(dateStr: string) {
  const d = new Date(dateStr)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yy = String(d.getFullYear()).slice(-2)
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yy} ${hh}:${min}`
}

const ACTION_LABELS: Record<string, string> = {
  login:           '🔑 เข้าสู่ระบบ',
  logout:          '🚪 ออกจากระบบ',
  create_booking:  '➕ สร้าง Booking',
  view_booking:    '👁 ดู Booking',
  upload_doc:      '📎 อัปโหลดเอกสาร',
  sign_pdpa:       '✅ รับรอง PDPA',
  checkin_complete:'✔️ Check-in เสร็จสิ้น',
  skip_passport:   '⏭ ข้ามหนังสือเดินทาง',
  skip_idcard:     '⏭ ข้ามบัตรประชาชน',
}

export default function HistoryPage() {
  const router = useRouter()
  const [tab, setTab]               = useState<'bookings' | 'audit'>('bookings')
  const [startDate, setStartDate]   = useState(addDays(today(), -6))
  const [endDate, setEndDate]       = useState(today())
  const [bookings, setBookings]     = useState<BookingWithDoc[]>([])
  const [auditLogs, setAuditLogs]   = useState<(AuditLog & { staff_name?: string })[]>([])
  const [loading, setLoading]       = useState(false)
  const [staffId, setStaffId]       = useState<string | null>(null)
  const [myLogsOnly, setMyLogsOnly] = useState(false)

  // quick date range presets
  function setRange(days: number) {
    setStartDate(addDays(today(), -(days - 1)))
    setEndDate(today())
  }

  const loadBookings = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('bookings')
      .select('*, guest_documents(status, gdrive_folder_url, finalized_at, uploaded_at)')
      .gte('check_in', startDate)
      .lte('check_in', endDate)
      .order('check_in', { ascending: false })

    if (error) { toast.error('โหลดข้อมูลไม่สำเร็จ'); setLoading(false); return }
    setBookings((data as BookingWithDoc[]) || [])
    setLoading(false)
  }, [startDate, endDate])

  const loadAudit = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    // Get current user id once
    if (!staffId) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setStaffId(user.id)
    }

    let query = supabase
      .from('audit_logs')
      .select('*')
      .gte('created_at', startDate + 'T00:00:00')
      .lte('created_at', endDate + 'T23:59:59')
      .order('created_at', { ascending: false })
      .limit(200)

    if (myLogsOnly && staffId) {
      query = query.eq('staff_id', staffId)
    }

    const { data, error } = await query
    if (error) { toast.error('โหลด Audit log ไม่สำเร็จ'); setLoading(false); return }

    // Enrich with staff names
    if (data && data.length > 0) {
      const staffIds = [...new Set(data.map((l: AuditLog) => l.staff_id).filter(Boolean))]
      const { data: staffList } = await supabase
        .from('staff').select('id, name').in('id', staffIds as string[])
      const staffMap = Object.fromEntries((staffList || []).map((s: { id: string; name: string }) => [s.id, s.name]))
      setAuditLogs(data.map((l: AuditLog) => ({
        ...l,
        staff_name: l.staff_id ? staffMap[l.staff_id] || 'ไม่ทราบ' : 'ระบบ',
      })))
    } else {
      setAuditLogs([])
    }
    setLoading(false)
  }, [startDate, endDate, myLogsOnly, staffId])

  useEffect(() => {
    if (tab === 'bookings') loadBookings()
    else loadAudit()
  }, [tab, startDate, endDate, myLogsOnly])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Header ── */}
      <header className="bg-resort-teal text-white sticky top-0 z-10 shadow-md">
        <div className="flex items-center gap-3 px-5 lg:px-8 py-3 max-w-5xl mx-auto">
          <button
            onClick={() => router.push('/dashboard')}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">ประวัติการดำเนินการ</h1>
            <p className="text-teal-200 text-xs mt-0.5">
              {formatDateTH(startDate)} – {formatDateTH(endDate)}
            </p>
          </div>
          <button
            onClick={() => { if (tab === 'bookings') loadBookings(); else loadAudit() }}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
            title="รีเฟรช"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      <div className="p-5 lg:px-8 lg:py-6 space-y-4 max-w-5xl mx-auto">

        {/* ── Date range filter ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-3">
          <div className="flex items-center gap-2 text-gray-700 font-semibold text-sm">
            <Filter size={16} /> กรองช่วงวันที่
          </div>

          <div className="flex gap-2 flex-wrap">
            {[
              { label: 'วันนี้', days: 1 },
              { label: '7 วัน', days: 7 },
              { label: '30 วัน', days: 30 },
            ].map(({ label, days }) => {
              const active = startDate === addDays(today(), -(days - 1)) && endDate === today()
              return (
                <button
                  key={label}
                  onClick={() => setRange(days)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                    ${active
                      ? 'bg-resort-teal text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {label}
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Calendar size={15} className="text-gray-400" />
              <span className="text-sm text-gray-500">จาก</span>
              <div className="relative">
                <div className="h-9 px-3 rounded-lg border border-gray-200 text-sm
                                flex items-center font-medium text-gray-700 bg-white min-w-[90px]">
                  {formatDateTH(startDate)}
                </div>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="absolute inset-0 opacity-0 w-full cursor-pointer"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">ถึง</span>
              <div className="relative">
                <div className="h-9 px-3 rounded-lg border border-gray-200 text-sm
                                flex items-center font-medium text-gray-700 bg-white min-w-[90px]">
                  {formatDateTH(endDate)}
                </div>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="absolute inset-0 opacity-0 w-full cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 bg-gray-200 rounded-xl p-1">
          <button
            onClick={() => setTab('bookings')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors
              ${tab === 'bookings'
                ? 'bg-white text-resort-teal shadow-sm'
                : 'text-gray-500 hover:text-gray-700'}`}
          >
            🛏 Bookings ({bookings.length})
          </button>
          <button
            onClick={() => setTab('audit')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors
              ${tab === 'audit'
                ? 'bg-white text-resort-teal shadow-sm'
                : 'text-gray-500 hover:text-gray-700'}`}
          >
            📋 Audit Log ({auditLogs.length})
          </button>
        </div>

        {/* ── Content ── */}
        {loading ? (
          <div className="text-center py-16 text-gray-400">
            <div className="w-8 h-8 border-2 border-resort-teal border-t-transparent
                            rounded-full animate-spin mx-auto mb-3" />
            กำลังโหลด...
          </div>
        ) : tab === 'bookings' ? (
          <BookingsTab
            bookings={bookings}
            onUpload={(ref) => router.push(`/checkin/${ref}/upload`)}
            onDeleted={() => loadBookings()}
          />
        ) : (
          <AuditTab
            logs={auditLogs}
            myLogsOnly={myLogsOnly}
            onToggleMyLogs={() => setMyLogsOnly(p => !p)}
          />
        )}
      </div>
    </div>
  )
}

/* ── Bookings Tab ── */
function BookingsTab({
  bookings,
  onUpload,
  onDeleted,
}: {
  bookings: BookingWithDoc[]
  onUpload: (ref: string) => void
  onDeleted: () => void
}) {
  const [selectMode, setSelectMode]         = useState(false)
  const [selectedIds, setSelectedIds]       = useState<Set<string>>(new Set())
  const [showConfirm, setShowConfirm]       = useState(false)
  const [deleting, setDeleting]             = useState(false)

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selectedIds.size === bookings.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(bookings.map(b => b.id)))
  }

  async function handleDelete() {
    setDeleting(true)
    const supabase = createClient()
    const ids  = [...selectedIds]
    const refs = bookings.filter(b => ids.includes(b.id)).map(b => b.booking_ref)

    await supabase.from('guest_documents').delete().in('booking_ref', refs)
    const { error } = await supabase.from('bookings').delete().in('id', ids)

    if (error) { toast.error('ลบไม่สำเร็จ: ' + error.message); setDeleting(false); return }

    toast.success(`ลบ ${ids.length} Booking เรียบร้อย`)
    setShowConfirm(false)
    setSelectMode(false)
    setSelectedIds(new Set())
    onDeleted()
    setDeleting(false)
  }

  if (bookings.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <BedDouble size={52} className="mx-auto mb-3 opacity-40" />
        <p>ไม่มี Booking ในช่วงวันที่นี้</p>
      </div>
    )
  }

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

  const grouped = bookings.reduce<Record<string, BookingWithDoc[]>>((acc, b) => {
    const key = b.check_in
    if (!acc[key]) acc[key] = []
    acc[key].push(b)
    return acc
  }, {})

  return (
    <div className="space-y-4">

      {/* Select / delete toolbar */}
      {!selectMode ? (
        <div className="flex justify-end">
          <button
            onClick={() => setSelectMode(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium
                       bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <CheckSquare size={16} /> เลือกเพื่อลบ
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 bg-white rounded-xl border border-gray-200 px-4 py-2.5">
          <button onClick={toggleAll} className="flex items-center gap-2 text-sm text-gray-600 font-medium">
            {selectedIds.size === bookings.length && bookings.length > 0
              ? <CheckSquare size={20} className="text-red-500" />
              : <Square size={20} className="text-gray-400" />}
            เลือกทั้งหมด ({bookings.length})
          </button>
          <div className="flex-1" />
          {selectedIds.size > 0 && (
            <button
              onClick={() => setShowConfirm(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-500
                         text-white text-sm font-semibold hover:bg-red-600 transition-colors"
            >
              <Trash2 size={15} /> ลบ {selectedIds.size} รายการ
            </button>
          )}
          <button
            onClick={() => { setSelectMode(false); setSelectedIds(new Set()) }}
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Grouped list */}
      {Object.entries(grouped).map(([date, group]) => (
        <div key={date}>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">
            Check-in: {new Date(date).toLocaleDateString('th-TH', {
              weekday: 'long', day: 'numeric', month: 'long',
            })}
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {group.map(b => {
              const doc = b.guest_documents?.[0]
              const docDone   = doc?.status === 'complete'
              const docInProg = doc?.status === 'in_progress'
              const selected  = selectedIds.has(b.id)

              return (
                <div key={b.id}
                     onClick={() => selectMode && toggleSelect(b.id)}
                     className={`bg-white rounded-2xl border shadow-sm p-4 flex gap-3 items-start
                                 transition-all
                                 ${selectMode ? 'cursor-pointer' : ''}
                                 ${selected ? 'border-red-400 ring-2 ring-red-100' : 'border-gray-200'}`}>

                  {/* Checkbox or doc icon */}
                  <div className="flex-shrink-0 mt-1">
                    {selectMode
                      ? selected
                        ? <CheckSquare size={20} className="text-red-500" />
                        : <Square size={20} className="text-gray-300" />
                      : docDone
                        ? <FileCheck size={20} className="text-green-500" />
                        : docInProg
                        ? <Clock size={20} className="text-blue-400" />
                        : <FileX size={20} className="text-amber-400" />}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColors[b.status]}`}>
                        {statusLabels[b.status]}
                      </span>
                      <span className="text-xs text-gray-400">{b.booking_ref}</span>
                    </div>
                    <p className="font-bold text-gray-800 truncate">{b.guest_name}</p>
                    <div className="flex items-center gap-3 text-sm text-gray-500 mt-0.5 flex-wrap">
                      <span className="flex items-center gap-1">
                        <BedDouble size={12} /> ห้อง {b.room_number || '-'}
                      </span>
                      <span>{countNights(b.check_in, b.check_out)} คืน</span>
                      <span>{formatDateTH(b.check_in)} → {formatDateTH(b.check_out)}</span>
                    </div>
                    {docDone && doc?.gdrive_folder_url && (
                      <a href={doc.gdrive_folder_url} target="_blank" rel="noopener noreferrer"
                         onClick={e => e.stopPropagation()}
                         className="inline-flex items-center gap-1 text-xs text-resort-teal font-medium mt-2 hover:underline">
                        <ExternalLink size={11} /> ดูไฟล์ใน Google Drive
                      </a>
                    )}
                    {doc?.finalized_at && (
                      <p className="text-xs text-gray-400 mt-1">อัปโหลดเสร็จ: {formatDateTimeTH(doc.finalized_at)}</p>
                    )}
                  </div>

                  {/* Action button (hidden in select mode) */}
                  {!selectMode && (
                    <button
                      onClick={() => onUpload(b.booking_ref)}
                      className="flex-shrink-0 flex items-center gap-1 px-3 py-2 rounded-xl
                                 bg-resort-teal/10 text-resort-teal text-xs font-semibold
                                 hover:bg-resort-teal/20 active:scale-[0.97] transition-all"
                    >
                      <Upload size={14} />
                      {docDone ? 'ดู/แก้ไข' : 'อัปโหลด'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Delete confirm modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-5">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-red-100 mx-auto mb-4">
              <Trash2 size={28} className="text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-center text-gray-800 mb-2">ยืนยันการลบ</h2>
            <p className="text-center text-gray-500 text-sm mb-6">
              ลบ <span className="font-bold text-gray-800">{selectedIds.size} Booking</span> นี้?<br />
              ข้อมูลและเอกสารที่เกี่ยวข้องจะถูกลบถาวร
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-3 rounded-xl font-semibold text-gray-600
                           bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-3 rounded-xl font-semibold text-white
                           bg-red-500 hover:bg-red-600 disabled:opacity-60 transition-colors"
              >
                {deleting ? 'กำลังลบ...' : 'ลบเลย'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Audit Tab ── */
function AuditTab({
  logs,
  myLogsOnly,
  onToggleMyLogs,
}: {
  logs: (AuditLog & { staff_name?: string })[]
  myLogsOnly: boolean
  onToggleMyLogs: () => void
}) {
  if (logs.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p>ไม่มีประวัติการดำเนินการในช่วงวันที่นี้</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Filter: my logs only */}
      <div className="flex justify-end">
        <button
          onClick={onToggleMyLogs}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
            ${myLogsOnly
              ? 'bg-resort-teal text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          <User size={14} /> เฉพาะของฉัน
        </button>
      </div>

      {/* Log list */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
        {logs.map(log => (
          <div key={log.id} className="px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-gray-800">
                  {ACTION_LABELS[log.action] || `⚙️ ${log.action}`}
                </span>
                {log.booking_ref && (
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-mono">
                    {log.booking_ref}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400 flex-wrap">
                <span className="flex items-center gap-1">
                  <User size={11} /> {log.staff_name}
                </span>
                <span>{formatDateTimeTH(log.created_at)}</span>
                {log.metadata && Object.keys(log.metadata).length > 0 && (
                  <span className="text-gray-300">
                    {Object.entries(log.metadata)
                      .filter(([, v]) => v !== null && v !== undefined)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(' · ')}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
