# 🚀 คู่มือ Deploy: Crazy Snooker App ขึ้น Render + Aiven (ฟรีทั้งคู่ ไม่ใช้บัตรเครดิต)

ใช้เวลาประมาณ 30–45 นาที ทำตามลำดับได้เลย

---

## สถาปัตยกรรม

```
ผู้ใช้ → Render (Web Service, Singapore, HTTPS อัตโนมัติ)
              └── MySQL ──→ Aiven Free MySQL (1GB, ฟรีถาวร)
cron-job.org (ฟรี) ──ping──→ /api/health ทุก 5 นาที (กัน sleep)
                 ──cron──→ /api/scheduled/near-end-alerts ทุก 1 นาที (แจ้งเตือนใกล้หมดเวลา)
```

---

## ขั้นที่ 1 — Push โค้ดขึ้น GitHub (~5 นาที)

```powershell
cd C:\Projects\crazy-snooker-app
git init
git add -A
git commit -m "Crazy Snooker App — production ready"
# สร้าง repo ใหม่ (private) ที่ github.com/new ชื่อ crazy-snooker-app แล้ว:
git remote add origin https://github.com/<username>/crazy-snooker-app.git
git branch -M main
git push -u origin main
```

> ✅ `.gitignore` กัน `.env` และ `config/secrets.enc.json` ไว้แล้ว — ค่าลับไม่หลุดขึ้น git

## ขั้นที่ 2 — สร้างฐานข้อมูล Aiven Free MySQL (~10 นาที)

1. สมัครที่ **aiven.io** → ไม่ต้องใช้บัตรเครดิต
2. **Create service** → เลือก **MySQL** → แผน **Free** → region ใกล้สุด (เช่น Singapore) → ตั้งชื่อ เช่น `snooker-db`
3. รอสถานะเป็น **Running** (~2 นาที)
4. หน้า service → แท็บ **Overview** เก็บค่าเหล่านี้ไว้:
   - Host, Port, User (`avnadmin`), Password
   - **Service URI** (รูปแบบ `mysql://avnadmin:xxx@host:port/defaultdb?ssl-mode=REQUIRED`) ← ใช้อันนี้ได้เลย
5. Import schema:
   - เปิดเมนู **... → Connect** หรือใช้ MySQL client ในเครื่อง (XAMPP มี `mysql.exe`):
     ```powershell
     C:\xampp\mysql\bin\mysql.exe -h <host> -P <port> -u avnadmin -p --ssl-mode=REQUIRED defaultdb < C:\Projects\crazy-snooker-app\database\init.sql
     ```
   - หรือวางเนื้อไฟล์ `database/init.sql` ในเครื่องมือ query ของ Aiven (แท็บ **Query** บนเว็บ)
6. ✅ ตรวจว่ามี 5 ตาราง: `club_tables`, `near_end_alerts`, `near_end_scheduler_config`, `feedback_reports`, `feedback_internal_notes`

## ขั้นที่ 3 — Deploy บน Render (~10 นาที)

1. สมัคร **render.com** ด้วย GitHub account
2. **New → Blueprint** → เลือก repo `crazy-snooker-app`
   (Render จะอ่าน `render.yaml` เอง: Node, region Singapore, plan Free, build+start command, health check `/api/health`)
3. กด **Apply** → รอ build ครั้งแรก (~3–5 นาที)
4. ได้ URL ประมาณ `https://crazy-snooker-app.onrender.com`
5. เข้า **service → Environment** เพิ่มตัวแปร (กด Save → redeploy อัตโนมัติ):

   | Key | ค่า |
   |---|---|
   | `DATABASE_URL` | Service URI จาก Aiven (ตัด `?ssl-mode=REQUIRED` ท้ายออกก็ได้) |
   | `DATABASE_SSL` | `true` |
   | `DATABASE_CA` | (ทางเลือก) CA cert ของ Aiven — โหลดจากหน้า service → **CA Certificate** แล้ววางทั้งก้อน ใส่แล้วปลอดภัยขึ้น (verify cert จริง) |
   | `JWT_SECRET` | สุ่มยาวๆ เช่นรัน `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
   | `ADMIN_FEEDBACK_KEY` | รหัสแอดมินตั้งเอง (ใช้เปิดหน้า feedback admin) |
   | `PROMPTPAY_RECIPIENT` | เบอร์/เลขพร้อมเพย์ร้าน — **ใส่เมื่อได้เลขจริง** (ยังไม่ใส่ก็ได้ ระบบจะแสดง "รอตั้งค่า" สุภาพ) |
   | `LINE_CHANNEL_ACCESS_TOKEN` / `LINE_NOTIFY_TO` | จาก LINE OA — ใส่เมื่อพร้อม |
   | `RESEND_API_KEY` / `RECEIPT_EMAIL_FROM` | อีเมลใบเสร็จ — ทีหลัง |

6. เปิด `https://<app>.onrender.com/api/health` → ต้องได้ `{"ok":true,...}` ✅
7. เปิดหน้าเว็บหลัก → กระดานโต๊ะต้องแสดง 5 โต๊ะจากฐานข้อมูลจริง ✅

## ขั้นที่ 4 — ตั้ง cron-job.org (~5 นาที, ฟรี)

สมัคร **cron-job.org** แล้วสร้าง 2 jobs:

| Job | URL | ความถี่ | หน้าที่ |
|---|---|---|---|
| keep-alive | `https://<app>.onrender.com/api/health` | ทุก 5 นาที | กัน Render free sleep (หลับถ้าเงียบ 15 นาที) |
| near-end alerts | `https://<app>.onrender.com/api/scheduled/near-end-alerts` | ทุก 1 นาที | ส่ง LINE เตือนใกล้หมดเวลา |

> Job ที่ 2 ต้องตั้งค่า auth ตามระบบ cronAuth ของแอพ (ดู `server/cronAuth.mjs`) — ถ้ายังไม่ได้ตั้ง LINE ข้ามไปก่อนได้

## ขั้นที่ 5 — ตรวจสอบหลัง deploy

- [ ] `/api/health` ตอบ `ok:true`
- [ ] หน้าเว็บเปิดได้ + กระดานโต๊ะอัปเดต real-time (เปิด 2 แท็บแล้วเปลี่ยนสถานะโต๊ะดู)
- [ ] หน้า Help → ส่ง feedback ทดสอบ → เข้า admin ด้วย `ADMIN_FEEDBACK_KEY` เห็นรายการ
- [ ] หน้า Integration readiness (`/api/integrations/readiness`) แสดงสถานะ PromptPay/Email ถูกต้อง

---

## บทเรียนจากการ deploy จริง (สำคัญมาก ถ้า deploy ใหม่)

1. **`NODE_ENV=production` ทำให้ `npm install` ข้าม devDependencies → build พังด้วย `vite: not found`**
   → ต้องตั้ง build command เป็น **`npm install --include=dev && npm run build`** (ค่าตั้งต้นใน `render.yaml` แก้ไว้แล้ว)

2. **Render API: `PUT /env-vars` แทนที่ env ทั้งชุด**
   ถ้าเพิ่ม/แก้ env ผ่าน API ต้องส่ง **ทุกตัว** ไปในคำสั่งเดียว ไม่งั้นตัวที่ไม่ได้ส่งจะถูกลบ (บน Dashboard ทำทีละตัวไม่เป็นปัญหา)

3. **หลังเปลี่ยน env ต้อง trigger deploy ใหม่** — Render จะหยิบค่าใหม่ตอนสร้าง instance เท่านั้น (`POST /services/{id}/deploys`)

4. **ระหว่าง rollout อาจมี 2 instance ตอบพร้อมกันชั่วครู่** — ถ้า read-back ได้ค่าเก่า ให้รอ ~30 วินาทีแล้วยิงซ้ำ

5. **Aiven + mysql2**: ต้องเปิด SSL (`DATABASE_SSL=true`) เพราะ Aiven บังคับ TLS; mysql client เก่าของ XAMPP เชื่อมไม่ได้ (plugin `caching_sha2_password` ไม่มี) → ใช้ `scripts/import-aiven-schema.mjs` แทน:
   ```powershell
   $env:DATABASE_URL="mysql://avnadmin:...@host:port/defaultdb"
   node scripts/import-aiven-schema.mjs
   ```

---

## ⚠️ ข้อควรรู้ (Free tier)

1. **Render free sleep หลัง 15 นาที** — cron keep-alive ในขั้นที่ 4 จัดการให้ แต่ถ้า cron ล่ม ครั้งแรกที่เปิดเว็บจะช้า ~50 วินาที (cold start) ไม่มีข้อมูลหาย
2. **Render free ไม่มี persistent disk** — อย่าใช้ `config/secrets.enc.json` บน Render ให้ตั้ง env ตรงใน Dashboard แทน (ปลอดภัยพอกัน เพราะ Render encrypt อยู่แล้ว)
3. **Aiven free จะปิด service ถ้าไม่ได้ใช้นาน** — จะมีอีเมลเตือนล่วงหน้า แค่เข้าไปเปิดใหม่
4. **รายการชำระ PromptPay ที่ค้างอยู่เก็บใน memory** — ถ้า server restart รายการ "รอยืนยัน" จะหาย (รายการที่ยืนยันแล้วอยู่ในหน้าประวัติได้ตามปกติ) ถ้าอยากให้คงทน ให้บอกผมย้ายลง MySQL เพิ่ม
5. ฟรีทั้งคู่เหมาะกับร้านขนาดเล็ก–กลาง ถ้าลูกค้าเยอะขึ้นค่อยอัปเกรด Render ($7/เดือน ไม่ sleep) ทีหลัง
