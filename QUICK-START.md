# ⚡ QUICK START — Deploy ใน 30 นาที
## ทำตามลำดับนี้เลย ห้ามข้าม

---

## สิ่งที่ต้องมีก่อน (ฟรีทั้งหมด)
- [ ] Google account (มีแล้ว ✅)
- [ ] Computer ที่ติดตั้ง [Node.js](https://nodejs.org) (ดาวน์โหลด LTS)
- [ ] [Git](https://git-scm.com/downloads) (ดาวน์โหลด)

---

## ขั้นที่ 1 — Supabase (10 นาที)

### 1A. สร้าง Project
1. เปิด → **[supabase.com/dashboard](https://supabase.com/dashboard)**
2. **Sign Up** (ใช้ Google login ได้เลย)
3. **New Project** → ชื่อ: `laemsui-checkin` → Region: **Singapore** → **Create Project**
4. รอ ~2 นาที

### 1B. รัน Database
1. คลิก **SQL Editor** (เมนูซ้าย) → **New Query**
2. เปิดไฟล์ `supabase/migrations/001_initial_schema.sql` แล้ว **copy ทั้งหมด**
3. **Paste** ใน SQL Editor → กด **Run** ✅

### 1C. จด Keys
ไปที่ **Settings → API** แล้วจด:
```
Project URL:      https://xxxxxxxxxx.supabase.co
anon key:         eyJhbGci...
service_role key: eyJhbGci...  ← เก็บเป็นความลับ!
```

---

## ขั้นที่ 2 — Google Drive (10 นาที)

### 2A. เปิด Google Cloud Console
1. เปิด → **[console.cloud.google.com](https://console.cloud.google.com)**
2. **New Project** → ชื่อ: `laemsui-checkin` → **Create**
3. ค้นหา "Google Drive API" → **Enable**

### 2B. สร้าง Service Account
1. **IAM & Admin → Service Accounts → Create Service Account**
2. ชื่อ: `drive-bot` → **Create and Continue → Done**
3. คลิกที่ service account → **Keys → Add Key → JSON → Create**
4. ไฟล์ JSON จะดาวน์โหลดมา → **เก็บไว้!**

### 2C. สร้าง Drive Folder
1. เปิด **[drive.google.com](https://drive.google.com)**
2. New Folder → ชื่อ: **"Guest Documents"**
3. คลิกขวา folder → **Share** → ใส่ email จากไฟล์ JSON (`client_email`)
4. Permission: **Editor** → **Share**
5. คลิก folder → จด Folder ID จาก URL:
   `drive.google.com/drive/folders/`**`THIS_IS_FOLDER_ID`**

### 2D. ใส่ Secrets ใน Supabase
ไปที่ **Supabase → Edge Functions → Secrets → Add secret** แล้วเพิ่ม 3 ตัว:

| Name | Value |
|------|-------|
| `GOOGLE_SERVICE_ACCOUNT` | วาง content ทั้งหมดของไฟล์ JSON |
| `GDRIVE_ROOT_FOLDER_ID` | Folder ID จากขั้น 2C |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key จากขั้น 1C |

---

## ขั้นที่ 3 — Deploy (10 นาที)

### เปิด Terminal (Command Prompt / PowerShell)

```bash
# ไปที่ folder project
cd "G:\OneDrive\Claude on OneDrive\Check in Laemsui Flow\hotel-checkin-system"

# ติดตั้ง packages
npm install

# Login Supabase CLI
npx supabase login
# (จะเปิด browser ให้ login)

# เชื่อม project (ใส่ Project ID จาก Supabase URL)
npx supabase link --project-ref YOUR_PROJECT_ID

# Deploy Edge Functions
npx supabase functions deploy drive-create-folder --no-verify-jwt
npx supabase functions deploy drive-upload --no-verify-jwt
npx supabase functions deploy pdpa-cleanup

# Deploy Frontend
npx vercel
# (จะถามให้ login → ใช้ Google login)
# ตอบ: Y, Y, N, N
```

### ตั้งค่า Environment Variables ใน Vercel
ไปที่ **Vercel → Project → Settings → Environment Variables** เพิ่ม:

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL จาก Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |
| `NEXT_PUBLIC_RESORT_NAME` | Laemsui Resort |
| `NEXT_PUBLIC_RESORT_PREFIX` | LS |

แล้วกด **Redeploy**

---

## ขั้นที่ 4 — สร้าง Staff Account (2 นาที)

1. **Supabase → Authentication → Users → Invite User**
2. ใส่ email พนักงาน → **Send Invite**
3. รัน SQL นี้ใน SQL Editor (เปลี่ยน UUID และ email):

```sql
INSERT INTO public.staff (id, email, name, role)
SELECT id, email, 'Admin', 'admin'
FROM auth.users
WHERE email = 'YOUR_EMAIL_HERE';
```

---

## ✅ เสร็จแล้ว!

URL ของระบบ: `https://your-project.vercel.app`

**ทดสอบบน iPad:**
1. เปิด Safari → ไปที่ URL
2. Share → **Add to Home Screen** (ได้เป็น App เลย)
3. Login → ทดสอบ Check-in

---

## 🆘 ติดปัญหา?

ส่งข้อความใน Claude บอก error ที่เจอ จะช่วยแก้ให้ทันทีครับ
