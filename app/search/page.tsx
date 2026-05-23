'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient, type Booking, type GuestDocument } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { formatDate } from '@/lib/utils'
import { Search, ArrowLeft, ExternalLink, FileText } from 'lucide-react'

type SearchResult = Booking & { guest_documents: GuestDocument[] }

export default function SearchPage() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setSearched(true)

    const supabase = createClient()
    const { data } = await supabase
      .from('bookings')
      .select('*, guest_documents(*)')
      .or(`guest_name.ilike.%${query}%,booking_ref.ilike.%${query}%,room_number.ilike.%${query}%`)
      .order('check_in', { ascending: false })
      .limit(20)

    await logAudit('search_records', undefined, { query })
    setResults(data || [])
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-resort-teal text-white px-5 py-4 sticky top-0 z-10">
        <button onClick={() => router.push('/dashboard')} className="flex items-center gap-2 text-teal-200 mb-1">
          <ArrowLeft size={18} /> กลับ
        </button>
        <h1 className="text-xl font-bold">ค้นหาเอกสาร</h1>
      </header>

      <div className="p-5 max-w-2xl mx-auto">
        <form onSubmit={handleSearch} className="flex gap-3 mb-5">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              placeholder="ชื่อ Guest, Booking Ref, เลขห้อง..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="input-ipad pl-10"
              autoCapitalize="none"
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary px-5">
            {loading ? '...' : 'ค้นหา'}
          </button>
        </form>

        {loading && (
          <div className="text-center py-10 text-gray-400">
            <div className="w-8 h-8 border-2 border-resort-teal border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            กำลังค้นหา...
          </div>
        )}

        {!loading && searched && results.length === 0 && (
          <div className="text-center py-10 text-gray-400">
            <Search size={48} className="mx-auto mb-3 opacity-30" />
            <p>ไม่พบผลลัพธ์สำหรับ "{query}"</p>
          </div>
        )}

        {!loading && results.map(booking => {
          const doc = booking.guest_documents?.[0]
          return (
            <div key={booking.id} className="card mb-3">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-bold text-gray-800 text-lg">{booking.guest_name}</p>
                  <p className="text-sm text-gray-400">{booking.booking_ref} · ห้อง {booking.room_number || '-'}</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                  doc?.status === 'complete' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {doc?.status === 'complete' ? '✅ ครบแล้ว' : '⏳ ยังไม่ครบ'}
                </span>
              </div>

              <div className="flex gap-4 text-sm text-gray-500 mb-3">
                <span>Check-in: {formatDate(booking.check_in)}</span>
                <span>Check-out: {formatDate(booking.check_out)}</span>
              </div>

              {doc?.gdrive_folder_url && (
                <a
                  href={doc.gdrive_folder_url} target="_blank" rel="noopener noreferrer"
                  onClick={() => logAudit('view_document', booking.booking_ref)}
                  className="flex items-center gap-2 text-resort-teal font-semibold text-sm"
                >
                  <ExternalLink size={16} /> ดูเอกสารใน Google Drive
                </a>
              )}
              {!doc && (
                <button
                  onClick={() => router.push(`/checkin/${booking.booking_ref}/upload`)}
                  className="flex items-center gap-2 text-amber-600 font-semibold text-sm"
                >
                  <FileText size={16} /> เริ่ม Check-in
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
