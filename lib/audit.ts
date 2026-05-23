import { createClient } from './supabase'

type AuditAction =
  | 'login' | 'logout'
  | 'create_booking' | 'view_booking'
  | 'upload_form' | 'sign_pdf'
  | 'capture_passport' | 'capture_idcard'
  | 'finalize_checkin' | 'upload_success' | 'upload_failed'
  | 'search_records' | 'view_document'
  | 'pdpa_consent' | 'pdpa_auto_delete'

export async function logAudit(
  action: AuditAction,
  bookingRef?: string,
  metadata?: Record<string, unknown>
) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    await supabase.from('audit_logs').insert({
      staff_id: user?.id ?? null,
      booking_ref: bookingRef ?? null,
      action,
      metadata: metadata ?? {},
    })
  } catch (e) {
    // Audit failures should never block the user
    console.error('Audit log failed:', e)
  }
}
