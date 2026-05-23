-- ============================================================
-- Hotel Check-in System — Initial Schema
-- Run this in Supabase > SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- STAFF TABLE
-- ============================================================
CREATE TABLE public.staff (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'frontdesk'
                  CHECK (role IN ('admin', 'manager', 'frontdesk')),
  pin           TEXT,                    -- 4-digit PIN (stored as bcrypt hash via Edge Function)
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

-- ============================================================
-- BOOKINGS TABLE
-- ============================================================
CREATE TABLE public.bookings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_ref     TEXT UNIQUE NOT NULL,  -- จาก Little Hotelier
  guest_name      TEXT NOT NULL,
  guest_name_th   TEXT,                  -- ชื่อภาษาไทย (ถ้ามี)
  guest_email     TEXT,
  guest_phone     TEXT,
  nationality     TEXT,
  passport_number TEXT,
  room_number     TEXT,
  room_type       TEXT,
  check_in        DATE NOT NULL,
  check_out       DATE NOT NULL,
  num_adults      INT DEFAULT 1,
  num_children    INT DEFAULT 0,
  special_requests TEXT,
  status          TEXT DEFAULT 'pending'
                    CHECK (status IN ('pending','checked_in','checked_out','cancelled')),
  created_by      UUID REFERENCES public.staff(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- GUEST DOCUMENTS TABLE
-- ============================================================
CREATE TABLE public.guest_documents (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_ref                 TEXT NOT NULL REFERENCES public.bookings(booking_ref) ON DELETE CASCADE,
  staff_id                    UUID NOT NULL REFERENCES public.staff(id),

  -- Google Drive
  gdrive_folder_id            TEXT,
  gdrive_folder_url           TEXT,

  -- File IDs in Google Drive
  registration_file_id        TEXT,
  signed_registration_file_id TEXT,
  passport_file_id            TEXT,
  idcard_file_id              TEXT,
  metadata_file_id            TEXT,

  -- Step timestamps
  form_uploaded_at            TIMESTAMPTZ,
  signed_at                   TIMESTAMPTZ,
  passport_captured_at        TIMESTAMPTZ,
  idcard_captured_at          TIMESTAMPTZ,
  finalized_at                TIMESTAMPTZ,
  uploaded_at                 TIMESTAMPTZ,

  -- PDPA
  pdpa_consent                BOOLEAN DEFAULT false,
  pdpa_consent_at             TIMESTAMPTZ,
  retention_expires_at        TIMESTAMPTZ,  -- check_out + 2 years

  -- Status tracking
  status                      TEXT DEFAULT 'in_progress'
                                CHECK (status IN ('in_progress','complete','upload_failed','archived')),
  upload_retry_count          INT DEFAULT 0,
  last_error                  TEXT,

  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AUDIT LOG TABLE
-- ============================================================
CREATE TABLE public.audit_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id      UUID REFERENCES public.staff(id),
  booking_ref   TEXT,
  action        TEXT NOT NULL,
  resource_type TEXT,
  resource_id   TEXT,
  ip_address    TEXT,
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_bookings_check_in    ON public.bookings(check_in);
CREATE INDEX idx_bookings_status      ON public.bookings(status);
CREATE INDEX idx_bookings_guest_name  ON public.bookings(guest_name);
CREATE INDEX idx_docs_booking_ref     ON public.guest_documents(booking_ref);
CREATE INDEX idx_docs_status          ON public.guest_documents(status);
CREATE INDEX idx_docs_retention       ON public.guest_documents(retention_expires_at);
CREATE INDEX idx_audit_booking        ON public.audit_logs(booking_ref);
CREATE INDEX idx_audit_staff          ON public.audit_logs(staff_id);
CREATE INDEX idx_audit_created        ON public.audit_logs(created_at);

-- ============================================================
-- AUTO-UPDATE updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_docs_updated_at
  BEFORE UPDATE ON public.guest_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE public.staff          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs     ENABLE ROW LEVEL SECURITY;

-- Staff can read all bookings (authenticated users)
CREATE POLICY "Authenticated staff can view bookings"
  ON public.bookings FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated staff can insert bookings"
  ON public.bookings FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated staff can update bookings"
  ON public.bookings FOR UPDATE
  TO authenticated USING (true);

-- Guest documents — authenticated staff full access
CREATE POLICY "Authenticated staff can manage documents"
  ON public.guest_documents FOR ALL
  TO authenticated USING (true);

-- Audit logs — insert only for authenticated, read for authenticated
CREATE POLICY "Authenticated staff can insert audit logs"
  ON public.audit_logs FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated staff can view audit logs"
  ON public.audit_logs FOR SELECT
  TO authenticated USING (true);

-- Staff table — read own profile, admin reads all
CREATE POLICY "Staff can view own profile"
  ON public.staff FOR SELECT
  TO authenticated USING (auth.uid() = id);

-- ============================================================
-- SEED DATA — Default Admin Account
-- (เปลี่ยน email และ password หลัง setup)
-- ============================================================
-- Note: สร้าง admin user ผ่าน Supabase Auth ก่อน แล้วค่อย insert ที่นี่
-- ดูคู่มือใน SETUP-GUIDE.md
