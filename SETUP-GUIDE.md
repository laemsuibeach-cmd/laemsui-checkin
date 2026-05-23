# 🚀 Setup Guide — Hotel Check-in System
## คู่มือติดตั้งระบบ (ทำครั้งเดียว ใช้ได้ตลอด)

**เวลาที่ใช้:** ประมาณ 1-2 ชั่วโมง  
**ค่าใช้จ่าย:** $0 / เดือน  
**สิ่งที่ต้องมี:** Computer (Windows/Mac), Google Account

---

## ขั้นตอนทั้งหมด

1. Setup Supabase (Database + Auth)
2. Setup Google Drive (Service Account)  
3. Deploy ระบบขึ้น Vercel
4. ตั้งค่า Environment Variables
5. สร้าง Staff Account
6. ทดสอบบน iPad

---

## ขั้นตอนที่ 1: Setup Supabase

### 1.1 สร้าง Project

1. ไปที่ [supabase.com](https://supabase.com) → Sign Up ฟรี
2. คลิก **New Project**
3. ตั้งชื่อ: `laemsui-checkin`
4. ตั้ง Database Password (จำไว้!)
5. Region: **Southeast Asia (Singapore)**
6. รอ 2-3 นาที

### 1.2 รัน Database Schema

1. ใน Supabase → คลิก **SQL Editor** (เมนูซ้าย)
2. คลิก **New Query**
3. Copy ทั้งหมดจากไฟล์ `supabase/migrations/001_initial_schema.sql`
4. Paste แล้วกด **Run** (Ctrl+Enter)
5. ควรเห็น "Success. No rows returned"

### 1.3 เก็บ API Keys

1. ไปที่ **Settings** → **API**
2. จดไว้:
   - `Project URL` → จะใช้เป็น `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → จะใช้เป็น `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → จะใช้เป็น `SUPABASE_SERVICE_ROLE_KEY` (**เก็บเป็นความลับ!**)

---

## ขั้นตอนที่ 2: Setup Google Drive (Service Account)

### 2.1 สร้าง Google Cloud Project

1. ไปที่ [console.cloud.google.com](https://console.cloud.google.com)
2. คลิก **Select Project** (บนสุด) → **New Project**
3. ชื่อ: `laemsui-checkin`
4. คลิก **Create**

### 2.2 เปิดใช้ Google Drive API

1. ใน Google Cloud Console → ค้นหา "Drive API"
2. คลิก **Google Drive API** → **Enable**

### 2.3 สร้าง Service Account

1. ไปที่ **IAM & Admin** → **Service Accounts**
2. คลิก **Create Service Account**
3. ชื่อ: `laemsui-drive-bot`
4. คลิก **Create and Continue** → **Done**
5. คลิกที่ Service Account ที่สร้าง
6. ไปที่ Tab **Keys** → **Add Key** → **Create new key**
7. เลือก **JSON** → **Create**
8. ไฟล์ JSON จะดาวน์โหลดมา → **เก็บไว้อย่างปลอดภัย!**

### 2.4 สร้าง Google Drive Folder

1. ไปที่ [drive.google.com](https://drive.google.com)
2. สร้าง Folder ชื่อ **"Guest Documents"**
3. คลิกขวาที่ folder → **Share**
4. ใส่ email ของ Service Account (ดูจากไฟล์ JSON ที่ `client_email`)
   - ตัวอย่าง: `laemsui-drive-bot@laemsui-checkin.iam.gserviceaccount.com`
5. Permission: **Editor**
6. คลิก **Share**
7. คลิกที่ folder → ดู URL: `https://drive.google.com/drive/folders/FOLDER_ID_HERE`
8. จด **FOLDER_ID** (ส่วนหลัง `/folders/`)

### 2.5 เพิ่ม Secrets ใน Supabase

1. ใน Supabase → **Edge Functions** → **Secrets**
2. เพิ่ม secret ใหม่:

```
Name:  GOOGLE_SERVICE_ACCOUNT
Value: (วาง content ทั้งหมดจากไฟล์ JSON ที่ดาวน์โหลดมา)
```

```
Name:  GDRIVE_ROOT_FOLDER_ID
Value: (FOLDER_ID จากขั้นตอน 2.4)
```

```
Name:  SUPABASE_SERVICE_ROLE_KEY
Value: (service_role key จากขั้นตอน 1.3)
```

### 2.6 Deploy Edge Functions

```bash
# ติดตั้ง Supabase CLI ก่อน
npm install -g supabase

# Login
supabase login

# Link project
supabase link --project-ref YOUR_PROJECT_REF

# Deploy functions
supabase functions deploy drive-create-folder
supabase functions deploy drive-upload
supabase functions deploy pdpa-cleanup
```

---

## ขั้นตอนที่ 3: Deploy ระบบขึ้น Vercel

### 3.1 Upload โค้ดขึ้น GitHub

1. ไปที่ [github.com](https://github.com) → Sign Up ฟรี
2. สร้าง Repository ใหม่ชื่อ `hotel-checkin-system`
3. **Private** (สำคัญ!)
4. Upload ไฟล์โค้ดทั้งหมดขึ้นไป

### 3.2 Deploy ใน Vercel

1. ไปที่ [vercel.com](https://vercel.com) → Sign Up ด้วย GitHub
2. คลิก **Add New Project**
3. เลือก repository `hotel-checkin-system`
4. คลิก **Deploy**
5. รอ 2-3 นาที

---

## ขั้นตอนที่ 4: ตั้งค่า Environment Variables

1. ใน Vercel → Project → **Settings** → **Environment Variables**
2. เพิ่มทีละตัว:

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL จาก Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key จาก Supabase |
| `NEXT_PUBLIC_RESORT_NAME` | Laemsui Resort |
| `NEXT_PUBLIC_RESORT_PREFIX` | LS |

3. คลิก **Save** แล้ว **Redeploy**

---

## ขั้นตอนที่ 5: สร้าง Staff Account

1. ใน Supabase → **Authentication** → **Users**
2. คลิก **Invite User**
3. ใส่ email พนักงาน
4. พนักงานจะได้รับ email ให้ตั้ง password

5. เพิ่มข้อมูล Staff ใน SQL Editor:

```sql
-- เปลี่ยน user_id เป็น UUID ของ user ที่เพิ่งสร้าง (ดูจาก Authentication > Users)
INSERT INTO public.staff (id, email, name, role) VALUES
  ('USER_UUID_HERE', 'admin@laemsui.com', 'Admin', 'admin'),
  ('USER_UUID_HERE', 'staff@laemsui.com', 'Nong Staff', 'frontdesk');
```

---

## ขั้นตอนที่ 6: ทดสอบบน iPad

1. เปิด Safari บน iPad
2. ไปที่ URL ที่ได้จาก Vercel (เช่น `hotel-checkin-system.vercel.app`)
3. คลิก **Share** → **Add to Home Screen** (เพื่อใช้แบบ App)
4. ทดสอบ Login
5. ทดสอบ Check-in workflow ทั้งหมด

---

## ขั้นตอนที่ 7: Setup PDPA Auto-cleanup (GitHub Actions)

1. ใน GitHub Repository → **Settings** → **Secrets and variables** → **Actions**
2. เพิ่ม secrets:
   - `SUPABASE_FUNCTION_URL` = `https://YOUR_PROJECT.supabase.co/functions/v1`
   - `SUPABASE_SERVICE_KEY` = service_role key

3. สร้างไฟล์ `.github/workflows/pdpa-cleanup.yml`:

```yaml
name: PDPA Retention Cleanup
on:
  schedule:
    - cron: '0 19 * * *'  # 02:00 Bangkok (UTC+7)
  workflow_dispatch:       # รันมือได้

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - name: Run PDPA cleanup
        run: |
          curl -X POST "${{ secrets.SUPABASE_FUNCTION_URL }}/pdpa-cleanup" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_KEY }}" \
            -H "Content-Type: application/json"
```

---

## 🆘 แก้ปัญหาที่พบบ่อย

### "Upload failed" ทุกครั้ง
- ตรวจสอบ GOOGLE_SERVICE_ACCOUNT ใน Supabase Secrets
- ตรวจสอบว่า folder ใน Drive ได้ share ให้ service account แล้ว
- ตรวจสอบ GDRIVE_ROOT_FOLDER_ID ถูกต้อง

### ลายเซ็นไม่ขึ้น
- ลอง hard refresh (Ctrl+Shift+R)
- ตรวจสอบว่า Safari ไม่ได้ block JavaScript

### กล้องไม่เปิด
- ระบบต้องใช้ HTTPS เท่านั้น (Vercel ให้ HTTPS อัตโนมัติ)
- ให้สิทธิ์กล้องแก่ Safari ใน Settings > Safari > Camera

---

## 📞 ข้อมูลติดต่อ

หากพบปัญหา ติดต่อ developer ที่ laemsuibeach@gmail.com

---
*Setup Guide v1.0 | Laemsui Resort Check-in System*
