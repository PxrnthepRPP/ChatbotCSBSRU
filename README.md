# 🎓 BSRU Student Portal & AI Chatbot System

[![Java](https://img.shields.io/badge/Java-21%20LTS-orange.svg?style=flat-square&logo=openjdk)](https://adoptium.net/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.3.4-brightgreen.svg?style=flat-square&logo=springboot)](https://spring.io/projects/spring-boot)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16%20%2B%20pgvector-blue.svg?style=flat-square&logo=postgresql)](https://github.com/pgvector/pgvector)
[![LangChain4j](https://img.shields.io/badge/LangChain4j-0.35.0-red.svg?style=flat-square)](https://github.com/langchain4j/langchain4j)
[![Google Gemini](https://img.shields.io/badge/Google%20Gemini-3.5%20Flash%20Lite-4285F4.svg?style=flat-square&logo=google)](https://aistudio.google.com/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg?style=flat-square&logo=docker)](https://www.docker.com/)

ระบบสารสนเทศบริการการศึกษาและผู้ช่วยปัญญาประดิษฐ์ให้คำปรึกษาทางวิชาการอัจฉริยะ (RAG Pipeline)  
สาขาวิชาวิทยาการคอมพิวเตอร์ คณะวิทยาศาสตร์และเทคโนโลยี มหาวิทยาลัยราชภัฏบ้านสมเด็จเจ้าพระยา

---

## 🧭 แนะนำเอกสารในโปรเจกต์ (Documentation Hub)

เพื่อให้การศึกษาและใช้งานระบบเป็นไปอย่างมีประสิทธิภาพ เอกสารในโปรเจกต์ถูกแบ่งหน้าที่การทำงานออกเป็นส่วนหลักอย่างชัดเจน:

| เอกสาร | กลุ่มเป้าหมาย | ขอบเขตและเนื้อหาหลัก |
|---|---|---|
| 📘 [**`README.md`**](README.md) *(หน้านี้)* | **ทุกคน (General / Evaluator)** | ภาพรวมระบบ, ฟีเจอร์เด่น, แผนผังสถาปัตยกรรมระดับสูง และวิธีเริ่มต้นใช้งานด่วน |
| 🤖 [**`AI_SETUP.md`**](AI_SETUP.md) | **ผู้ติดตั้งระบบ / เพื่อนร่วมทีม** | คู่มือตั้งค่า Gemini API Key, โมเดล AI, การนำเข้าฐานความรู้ RAG และข้อมูลทดสอบที่มากับระบบ |
| 🚀 [**`USER_GUIDE.md`**](docs/USER_GUIDE.md) | **ผู้ใช้งาน / ผู้ทดสอบระบบ (User & Tester)** | ขั้นตอนการติดตั้งอย่างละเอียด, บัญชีทดสอบ (Credentials), คู่มือทดสอบฟังก์ชันทุกเมนู และตารางแก้ปัญหา (Troubleshooting) |
| 📑 [**`DOCUMENTATION.md`**](docs/DOCUMENTATION.md) | **นักพัฒนา / วิศวกร (Developer & Technical)** | สถาปัตยกรรมเชิงลึก, Spring Security 6 & JWT Lifecycle, LangChain4j RAG Pipeline, REST API Specs และ Database DDL Schema |
| 📝 [**`WORKLOG.md`**](WORKLOG.md) | **ทีมพัฒนา (Maintainers)** | บันทึกประวัติการพัฒนา การเปลี่ยนแปลงรายรอบ และสถานะล่าสุดของระบบ |

---

## ✨ จุดเด่นของระบบ (Key Features)

- 🎓 **ระบบสารสนเทศนักศึกษาครบวงจร (Student Portal)**:
  - ตรวจสอบและแก้ไขข้อมูลส่วนตัว (จัดรูปแบบชื่อภาษาอังกฤษเป็น Title Case อัตโนมัติ) พร้อมอัปเดต Avatar
  - **ลงทะเบียนเรียนด้วยตนเอง (Self-Registration)**: เพิ่มวิชาลงตารางเรียน Matrix Grid ได้ทันทีในช่วงเปิดลงทะเบียน มีระบบแนะนำรายวิชาที่เคยเปิด ตรวจสอบวิชา/Sec ซ้ำ และป้องกันเวลาเรียนชนอัตโนมัติ
  - ตรวจสอบผลการเรียนรายภาคและเกรดเฉลี่ยสะสม (รวมเกรดรายวิชาที่อาจารย์ส่งและแอดมินประกาศผลแล้ว) รองรับทั้ง Table View และ Mobile Cards View
  - ตารางสอบอัตโนมัติ, ตรวจสอบจบตามโครงสร้างหลักสูตร 8 เทอม พร้อมติดตามกิจกรรมบังคับ, บันทึกสายอาชีพบัณฑิต (Career Tracking) และยื่นคำร้องวิชาการพร้อมแนบเอกสาร
- 👩‍🏫 **ระบบอาจารย์ที่ปรึกษาและอาจารย์ผู้สอน (Advisor Portal)**:
  - แดชบอร์ดสถิตินักศึกษาในที่ปรึกษา (ผูกตามรุ่นปีที่เข้าศึกษา), รายการนักศึกษาที่ต้องติดตามเป็นพิเศษ (แยกกลุ่มเสี่ยงตามเกรด/กิจกรรม และกลุ่มพักการศึกษา) พร้อมบันทึกการให้คำปรึกษา
  - จัดการรายวิชาและกลุ่มเรียนที่สอน (สร้าง/แก้ไขแล้วมีผลทันที), ดูรายชื่อนักศึกษาในแต่ละ Sec, **บันทึกและส่งเกรดรายวิชา** ภายในวันกำหนดส่ง และประกาศตารางสอบ
  - รองรับการสลับไปหน้าผู้ดูแลระบบสำหรับอาจารย์ที่ได้รับสิทธิ์แอดมิน (`canAdmin`) และปุ่ม "เข้าใช้แทน" เพื่อดูระบบในมุมมองนักศึกษา (Impersonation Mode)
- 👑 **ระบบผู้ดูแลระบบ (Admin Portal)**:
  - แดชบอร์ดวิเคราะห์สถิตินักศึกษาแยกตามรุ่น (Batch Filter) และสถิติสายอาชีพบัณฑิตแบบ Real-time
  - จัดการข้อมูลนักศึกษาและอาจารย์ (CRUD, นำเข้า/ส่งออก CSV, กำหนดอาจารย์ที่ปรึกษาประจำรุ่น, ตั้ง Sec แรกเข้าแบบกลุ่ม, ตรวจสอบเลขบัตรประชาชน 13 หลักและรีเซ็ตรหัสผ่าน) พร้อมระบบกู้คืนฉบับร่างฟอร์มอัตโนมัติ (`sessionStorage`)
  - จัดการการลงทะเบียนและเกรด: เปิด/ปิดช่วงลงทะเบียนเรียน, ดูบันทึกการลงทะเบียนเรียน (ค้นหา/กรองภาค/ส่งออก CSV/ถอนรายวิชา), จัดการรายวิชาในระบบ, กำหนดวันส่งเกรดและประกาศผลเกรดรายวิชา
  - จัดการระบบ AI Chatbot: นำเข้าคลังความรู้ (RAG Knowledge Base), จัดการคำถามที่พบบ่อย (**FAQ** พร้อมระบบทดลองจับคู่คำถามและนำเข้า/ส่งออก CSV), ดู**ประวัติและสถิติการใช้งานแชทบอท (Chat Insights)**, กำหนดสิทธิ์ดูประวัติแชทเก่า และดูผลประเมินความพึงพอใจ
  - พิจารณาอนุมัติ/ปฏิเสธคำร้องวิชาการ
- 🤖 **BSRU CS AI Assistant (Hybrid FAQ + RAG + Live DB Context)**:
  - ผู้ช่วย AI ตอบคำถามหลักสูตร ระเบียบวิชาการ สถิติสายอาชีพ และข้อมูลรายบุคคลแบบเรียลไทม์ ขับเคลื่อนด้วย **Google Gemini** (`gemini-3.5-flash-lite`) ร่วมกับระบบจับคู่ **FAQ อัตโนมัติ (Bigram Similarity)**, Vector Database (**PGVector** `gemini-embedding-001`) และ Smart Local Fallback
  - **แยกขอบเขตข้อมูลตามสิทธิ์ผู้ใช้**: นักศึกษาดูข้อมูลตนเอง, อาจารย์ดูข้อมูลเชิงลึกได้ 2 ขอบเขต (นักศึกษาในที่ปรึกษาดูได้ครบยกเว้นข้อมูลส่วนบุคคล PDPA / นักศึกษาในวิชาที่สอนดูได้เฉพาะการลงทะเบียนและเกรดในวิชานั้น)
  - **จดจำบริบทบทสนทนาเก่าเฉพาะบุคคล** (สูงสุด 20 ข้อความล่าสุด) พร้อมปุ่มดูประวัติแชทเก่า (เมื่อได้รับสิทธิ์) และแบบประเมินความพึงพอใจ 3 ระดับหลังใช้งาน
  - **หน้าต่างแชทเริ่มใหม่ทุกครั้งที่ login หรือ logout**: ล้างหน้าจอแชทและสถานะรอบสนทนาปัจจุบัน (ขณะที่ประวัติถาวรยังเก็บในฐานข้อมูลตามสิทธิ์)
  - **ระหว่างที่ยังเปิดเว็บค้างไว้ แชทยังอยู่**: ปิดแล้วเปิดหน้าต่างแชทใหม่ หรือรีเฟรชหน้าในแท็บเดิม ประวัติรอบปัจจุบันยังอยู่ครบ และกดปุ่มถังขยะล้างหน้าจอแชทได้ทุกเมื่อ

---

## 🏗️ สถาปัตยกรรมระบบภาพรวม (High-Level Architecture)

```
┌─────────────────────────────────────────────────────────────────────────┐
│             FRONTEND LAYER (Docker Port 3000 / XAMPP Port 80)           │
│   Vanilla JS (ES6 Modules) + Modern CSS Design System (Mobile Ready)    │
│   [Student Portal]   [Advisor Portal]   [Admin Portal]   [AI Chatbot]   │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ REST API (JSON + JWT Bearer Token)
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   BACKEND LAYER (Spring Boot Port 8080)                 │
│   • Spring Security 6 (Stateless JWT Authentication & Strict CORS)      │
│   • Spring Data JPA & Hibernate ORM (Domain Entities & Repositories)    │
│   • LangChain4j 0.35 (Gemini 3.5 Flash Lite + gemini-embedding-001)     │
│   • Hybrid Chat Pipeline (Bigram FAQ Matcher + PGVector RAG + DB Context)│
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ PostgreSQL Protocol (Port 5432)
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                 DATABASE & VECTOR LAYER (Docker Port 5432)              │
│   PostgreSQL 16 + pgvector:                                             │
│   • Relational Tables: students, advisors, class_sections,              │
│     section_enrollments, instructor_grades, academic_petitions,         │
│     faqs, chat_log_entries, satisfaction_ratings                        │
│   • Vector Store Table: bsru_embeddings (768-dim Embeddings + Metadata) │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Clone แล้วรันได้ทันที (ด้วย Docker ทั้งระบบ)

ต้องมีแค่ **Git** และ **Docker Desktop** (เปิดไว้ก่อน) ไม่ต้องติดตั้ง Java / XAMPP / PostgreSQL บนเครื่อง

```powershell
git clone https://github.com/PxrnthepRPP/ChatbotCSBSRU.git
cd ChatbotCSBSRU
copy .env.example .env
```

เปิดไฟล์ `.env` แล้วตั้งค่าสำคัญอย่างน้อย 2 ค่า (และ `GEMINI_API_KEY` หากต้องการใช้งาน AI จริง):
```env
SPRING_DATASOURCE_PASSWORD=bsru_password
JWT_SECRET=ใส่ข้อความสุ่มยาวอย่างน้อย_32_ตัวอักษรขึ้นไป_หรือสร้างด้วย_openssl_rand_base64_64
GEMINI_API_KEY=AIza...ของคุณ (ไม่บังคับ ถ้ารันทดสอบทั่วไปแชทบอทจะใช้โหมดตอบสำรอง)
```

จากนั้นสั่งรันระบบทั้งหมด:
```powershell
docker compose up -d --build
```
ครั้งแรกใช้เวลาหลายนาที (ดาวน์โหลด image + build) จากนั้นเปิด **http://localhost:3000** แล้วเข้าสู่ระบบด้วย `admin`, `advisor` หรือ `student` (รหัสผ่าน `password` ดูตาราง "ข้อมูลบัญชีสำหรับทดสอบระบบ" ด้านล่าง)

- ระบบสร้างฐานข้อมูลและข้อมูลตัวอย่างให้เองทั้งหมด (นักศึกษา อาจารย์ ตารางเรียน ใบตรวจจบ ข้อมูลจำลองรุ่น 63–68 และข้อมูลทดสอบเพิ่มเติม)
- หลังแก้ไขไฟล์ `.env` ให้รัน `docker compose up -d backend` เพื่อให้ backend อ่านค่าใหม่ (ห้าม commit ไฟล์ `.env` ขึ้น Git)
- 📘 **รายละเอียดการตั้งค่า AI (Gemini), ฐานความรู้ RAG และข้อมูลทดสอบ ดูที่ [AI_SETUP.md](AI_SETUP.md)**
- พอร์ตที่ใช้: `3000` (เว็บ Frontend), `8080` (Backend API), `5432` (ฐานข้อมูล PostgreSQL) — ถ้ามีโปรแกรมอื่นใช้อยู่ต้องปิดก่อน
- หยุดระบบ: `docker compose down` · ล้างฐานข้อมูลเริ่มใหม่ทั้งหมด: `docker compose down -v`
- **กรณีอัปเดตโค้ดบนเครื่องที่มีฐานข้อมูล Docker เดิมอยู่แล้ว**: หากมีไฟล์ SQL ใหม่ใน `database/migrations/` ให้รัน migration เข้า container `bsru_vector_db` ก่อนตามลำดับไฟล์ แล้วสั่ง `docker compose up -d --build backend`

---

## ⚡ เริ่มต้นใช้งานด่วนสำหรับนักพัฒนา (Local Backend + XAMPP)

### 1. ตั้งค่า Environment Variables
คัดลอกไฟล์แม่แบบและตั้งค่ารหัสผ่านฐานข้อมูล (`SPRING_DATASOURCE_PASSWORD`) รวมถึง **Gemini API Key** (ขอรับฟรีได้ที่ [Google AI Studio](https://aistudio.google.com/apikey)):
```powershell
copy .env.example .env
```
*(หากเว้น `JWT_SECRET` ว่างไว้ สคริปต์ `start-backend.ps1` จะสุ่มค่าและบันทึกลง `.env` ให้อัตโนมัติ)*

### 2. สตาร์ทฐานข้อมูล PostgreSQL + pgvector (Docker)
> *โปรดตรวจสอบว่าได้เปิดโปรแกรม Docker Desktop ไว้แล้ว*
```powershell
docker compose up -d database
```

### 3. รันระบบ Spring Boot Backend (Port 8080)
- **PowerShell (แนะนำ):**
  ```powershell
  .\start-backend.ps1
  ```
- **Windows Command Prompt / ดับเบิลคลิก:** รันไฟล์ `start-backend.bat`  
*(สคริปต์จะโหลดตัวแปรจาก `.env` และเปิดใช้ profile `dev` ให้อัตโนมัติ)*

### 4. เข้าใช้งานผ่าน Web Browser (Port 80 / XAMPP Apache)
เปิดเว็บเบราว์เซอร์แล้วเข้าใช้งานผ่าน URL:
```text
http://localhost/ChatbotCSBSRU/
```
> ⚠️ **คำเตือนสำคัญ:** ห้ามดับเบิลคลิกเปิดไฟล์ `index.html` ผ่าน `file:///` โดยตรง เพราะระบบใช้โมดูล JavaScript ES6 ซึ่งเบราว์เซอร์จะบล็อกตามนโยบายความปลอดภัย CORS ต้องเข้าผ่าน `http://localhost/ChatbotCSBSRU/` บน XAMPP หรือ `http://localhost:3000/` บน Docker เท่านั้น

### 5. วิธีหยุดการทำงานและปิดระบบ (Shutdown)
- **หยุด Backend:** กด `Ctrl + C` ในหน้าต่าง Terminal ที่กำลังรันอยู่
- **หยุด PostgreSQL:** รัน `docker compose down` ใน PowerShell
- **หยุด Frontend:** กด **Stop** โมดูล Apache ใน XAMPP Control Panel

---

## 🔑 ข้อมูลบัญชีสำหรับทดสอบระบบ (Test Accounts)

ทุกบัญชีหลักด้านล่างใช้รหัสผ่าน `password` (สร้างอัตโนมัติตอน backend เริ่มทำงาน)

| บทบาท (Role) | Username สำหรับเข้าสู่ระบบ | รหัสผ่าน (Password) | สิทธิ์ระบบ (JWT Role) |
|---|---|---|---|
| 👑 **ผู้ดูแลระบบ (Admin)** | `admin` | `password` | `ROLE_ADMIN` |
| 👩‍🏫 **อาจารย์ (Advisor)** | `advisor` (= `ADV-01`, AI ดูได้ทุกคน) หรือ `ADV-01` ถึง `ADV-07` | `password` | `ROLE_ADVISOR` |
| 🎓 **นักศึกษา (Student)** | `student` (= `6621207042`) หรือ `6621207042`, `6621207015`, `6721207088`, `6721207120`, `6821207003` | `password` | `ROLE_STUDENT` |
| 🧪 **นักศึกษาข้อมูลทดสอบ** | `6621207044`, `6621207055`, `6621207034` | รหัสนักศึกษา (เข้าครั้งแรกต้องตั้งรหัสใหม่) | `ROLE_STUDENT` |

- `6621207042` (ปี 4) เป็นบัญชีตัวอย่างหลักของปุ่ม `student` (เปลี่ยนรหัสเป้าหมายได้ผ่าน `APP_DEMO_STUDENT_ID` ใน `.env`) มีผลการเรียน ตารางเรียน และใบตรวจจบครบ ส่วน `6721207120` และ `6621207034` เป็นนักศึกษาตัวอย่างที่มีผลการเรียนเสี่ยงสูง
- นักศึกษาที่เป็น **ข้อมูลจำลอง** (ป้าย "จำลอง" ในหน้าจัดการนักศึกษา) ใช้แสดงสถิติแดชบอร์ดเท่านั้น ไม่มีบัญชีเข้าสู่ระบบ
- นักศึกษาที่แอดมินเพิ่มใหม่ (ทีละคนหรือนำเข้า CSV) หรือถูกรีเซ็ตรหัสผ่าน:
  - **ชื่อผู้ใช้** = รหัสนักศึกษา 10 หลัก (ตัวเลขเท่านั้น)
  - **รหัสผ่านเริ่มต้น** = อักษรแรกของชื่อ + อักษรแรกของนามสกุล (ภาษาอังกฤษ พิมพ์ใหญ่) ตามด้วยเลขบัตรประชาชน 13 หลัก เช่น `Somchai Jaidee` เลขบัตร `1101700203450` → `SJ1101700203450` (ตอนเข้าครั้งแรกพิมพ์ตัวเล็ก/ใหญ่ได้ ถ้าไม่มีชื่ออังกฤษใช้อักษรไทยแทน)
  - เมื่อเข้าสู่ระบบครั้งแรก ระบบจะบังคับให้ตั้งรหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร ประกอบด้วยตัวพิมพ์ใหญ่ ตัวพิมพ์เล็ก และตัวเลข โดยไม่บังคับอักขระพิเศษ)
  - แอดมินต้องกรอกเลขบัตรประชาชน 13 หลักที่ถูกต้องตามหลักตรวจสอบเมื่อเพิ่มนักศึกษาจริง (CSV ต้องมีคอลัมน์ `nationalId`) และเลขเต็มถูกซ่อนไว้ ยกเว้นแอดมินกดดูในหน้าแก้ไข
- ใส่รหัสผ่านผิด 5 ครั้ง บัญชีจะถูกล็อกชั่วคราว 5 นาที
- ป้ายกรอกบัญชีทดลองในหน้า login แสดงเฉพาะเมื่อรัน backend ด้วย profile `dev` (`start-backend.ps1`) หรือตั้ง `APP_LOGIN_SHOW_DEMO_ACCOUNTS=true` ใน `.env`

---

## 📂 โครงสร้างโปรเจกต์สำคัญ (Key Project Structure)

```
ChatbotCSBSRU/
├── README.md                 # หน้านี้: สรุปภาพรวมและ Quick Start
├── AI_SETUP.md               # คู่มือตั้งค่า Gemini AI, RAG และข้อมูลทดสอบสำหรับเครื่องอื่น
├── WORKLOG.md                # บันทึกการทำงานและการอัปเดตระบบแต่ละรอบ
├── start-backend.bat         # ดับเบิลคลิกเพื่อเริ่ม Backend (เรียก start-backend.ps1)
├── start-backend.ps1         # สคริปต์เริ่ม Backend สำหรับ PowerShell (อ่าน .env อัตโนมัติ)
├── .env.example              # ตัวอย่าง Environment Variables (คัดลอกเป็น .env — ไม่ commit)
├── docker-compose.yml        # PostgreSQL 16 + pgvector, Backend และ Frontend (nginx)
├── Dockerfile                # Build image ของ Spring Boot Backend
├── nginx.conf                # ตั้งค่า Nginx สำหรับเสิร์ฟ Frontend ใน Docker (no-cache)
├── pom.xml                   # Maven Dependencies & Plugins
│
├── index.html                # ── Frontend Entry Point
├── assets/                   #    รูปภาพและโลโก้
├── css/                      #    Modular CSS Design System (base/, components/, roles/, theme-dark)
├── js/                       #    ES6 JavaScript Modules (main, api, auth, utils, components/, roles/)
│
├── src/main/                 # ── Backend: Java 21 & Spring Boot 3 Source Code & Resources
├── src/test/                 # ── Unit & Integration Tests (JUnit 5 / MockMvc)
│
├── database/
│   ├── init.sql              # เปิดใช้ส่วนขยาย pgvector ตอนสร้างฐานข้อมูลครั้งแรก
│   └── migrations/           # สคริปต์ SQL สำหรับอัปเกรดโครงสร้างตารางของฐานข้อมูลเดิม
├── docs/
│   ├── USER_GUIDE.md         # คู่มือการติดตั้งและทดสอบฟังก์ชันฉบับละเอียด
│   └── DOCUMENTATION.md      # เอกสารสถาปัตยกรรมและรายละเอียดเชิงเทคนิค
├── scripts/
│   └── ingest-knowledge.ps1  # นำเข้าเอกสารความรู้ให้ AI Chatbot (RAG)
└── tests/
    ├── test-e2e.mjs          # E2E API Test Suite (Node.js)
    ├── test-e2e-api.ps1      # E2E API Test Suite (PowerShell)
    ├── test-wp7-frontend.mjs # ทดสอบการทำงานของ Frontend
    ├── test-chatbot.ps1      # ส่งชุดคำถามทดสอบให้แชทบอทและสร้างรายงาน
    └── chatbot-test-questions.json
```

---

## 👥 ผู้พัฒนาและลิขสิทธิ์ (Authors & License)
- **สาขาวิชา**: วิทยาการคอมพิวเตอร์ (Computer Science)
- **คณะ**: วิทยาศาสตร์และเทคโนโลยี มหาวิทยาลัยราชภัฏบ้านสมเด็จเจ้าพระยา (BSRU)
- **ที่ปรึกษาโครงการ**: คณาจารย์ประจำสาขาวิชาวิทยาการคอมพิวเตอร์ BSRU


