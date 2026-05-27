import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Helper: get current user (throws if not logged in)
export async function getCurrentUser() {
  const supabase = createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Not authenticated')
  return user
}

// Types
export type Staff = {
  id: string
  email: string
  name: string
  role: 'admin' | 'manager' | 'frontdesk'
  is_active: boolean
  created_at: string
  last_login_at: string | null
}

export type Booking = {
  id: string
  booking_ref: string
  guest_name: string
  guest_name_th: string | null
  guest_email: string | null
  guest_phone: string | null
  nationality: string | null
  passport_number: string | null
  room_number: string | null
  room_type: string | null
  check_in: string
  check_out: string
  num_adults: number
  num_children: number
  special_requests: string | null
  status: 'pending' | 'checked_in' | 'checked_out' | 'cancelled'
  created_at: string
}

export type GuestDocument = {
  id: string
  booking_ref: string
  staff_id: string
  gdrive_folder_id: string | null
  gdrive_folder_url: string | null
  registration_file_id: string | null
  signed_registration_file_id: string | null
  passport_file_id: string | null
  idcard_file_id: string | null
  pdpa_consent: boolean
  pdpa_consent_at: string | null
  status: 'in_progress' | 'complete' | 'upload_failed' | 'archived'
  finalized_at: string | null
  uploaded_at: string | null
  created_at: string
}

export type AuditLog = {
  id: string
  staff_id: string | null
  booking_ref: string | null
  action: string
  metadata: Record<string, unknown>
  created_at: string
}

// Booking with joined guest_documents (used in dashboard & history)
export type BookingWithDoc = Booking & {
  guest_documents: Array<{
    status: GuestDocument['status']
    gdrive_folder_url: string | null
    finalized_at: string | null
    uploaded_at: string | null
    form_uploaded_at: string | null
    signed_at: string | null
    passport_file_id: string | null
    idcard_file_id: string | null
  }>
}
