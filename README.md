# 🎓 BSRU Student Portal & AI Chatbot System

[![Java](https://img.shields.io/badge/Java-21%20LTS-orange.svg?style=flat-square&logo=openjdk)](https://adoptium.net/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.3.4-brightgreen.svg?style=flat-square&logo=springboot)](https://spring.io/projects/spring-boot)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16%20%2B%20pgvector-blue.svg?style=flat-square&logo=postgresql)](https://github.com/pgvector/pgvector)
[![LangChain4j](https://img.shields.io/badge/LangChain4j-0.35.0-red.svg?style=flat-square)](https://github.com/langchain4j/langchain4j)
[![Google Gemini](https://img.shields.io/badge/Google%20Gemini-1.5%20Flash-4285F4.svg?style=flat-square&logo=google)](https://aistudio.google.com/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg?style=flat-square&logo=docker)](https://www.docker.com/)

ระบบสารสนเทศบริการการศึกษาและผู้ช่วยปัญญาประดิษฐ์ให้คำปรึกษาทางวิชาการอัจฉริยะ (RAG Pipeline)  
สาขาวิชาวิทยาการคอมพิวเตอร์ คณะวิทยาศาสตร์และเทคโนโลยี มหาวิทยาลัยราชภัฏบ้านสมเด็จเจ้าพระยา

---

## 🧭 แนะนำเอกสารในโปรเจกต์ (Documentation Hub)

เพื่อให้การศึกษาและใช้งานระบบเป็นไปอย่างมีประสิทธิภาพ เอกสารในโปรเจกต์ถูกแบ่งหน้าที่การทำงานออกเป็น 3 ส่วนหลักอย่างชัดเจน:

| เอกสาร | กลุ่มเป้าหมาย | ขอบเขตและเนื้อหาหลัก |
|---|---|---|
| 📘 [**`README.md`**](README.md) *(หน้านี้)* | **ทุกคน (General / Evaluator)** | ภาพรวมระบบ, ฟีเจอร์เด่น, แผนผังสถาปัตยกรรมระดับสูง และวิธีเริ่มต้นใช้งานด่วนใน 3 นาที |
| 🚀 [**`USER_GUIDE.md`**](docs/USER_GUIDE.md) | **ผู้ใช้งาน / ผู้ทดสอบระบบ (User & Tester)** | ขั้นตอนการติดตั้งอย่างละเอียด, บัญชีทดสอบ (Credentials), คู่มือทดสอบฟังก์ชันทุกเมนู และตารางแก้ปัญหา (Troubleshooting) |
| 📑 [**`DOCUMENTATION.md`**](docs/DOCUMENTATION.md) | **นักพัฒนา / วิศวกร (Developer & Technical)** | สถาปัตยกรรมเชิงลึก, Spring Security 6 & JWT Lifecycle, LangChain4j RAG Pipeline, REST API Specs และ Database DDL Schema |

---

## ✨ จุดเด่นของระบบ (Key Features)

- 🎓 **ระบบสารสนเทศนักศึกษาครบวงจร (Student Portal)**: ตรวจสอบประวัติ, อัปเดตข้อมูลและ Avatar, ตารางเรียน Matrix Grid พร้อมป้องกันวิชาชน, ตารางสอบอัตโนมัติ, ตรวจสอบจบ 8 เทอม (รองรับทั้ง Table View และ Mobile Cards View), การบันทึกและอัปเดตสายอาชีพบัณฑิต (Career Tracking) และการยื่นคำร้องวิชาการ
- 👩‍🏫 **ระบบอาจารย์ที่ปรึกษา (Advisor Portal)**: แดชบอร์ดสถิตินักศึกษาในความดูแล, จัดการรายวิชาที่สอน, ประกาศตารางสอบ รายการนักศึกษาที่ต้องติดตาม (แยกกลุ่มพักการศึกษา) และปุ่ม "เข้าใช้แทน" เพื่อดูระบบในมุมมองนักศึกษา (Impersonation Mode)
- 👑 **ระบบผู้ดูแลระบบ (Admin Portal)**: แดชบอร์ดวิเคราะห์สถิตินักศึกษาแยกตามรุ่น (Batch Filter), แดชบอร์ดสถิติสายอาชีพบัณฑิตแบบ Real-time, จัดการข้อมูลอาจารย์-นักศึกษา (CRUD) พร้อมอัปเดตสายอาชีพ และระบบพิจารณาอนุมัติ/ปฏิเสธคำร้องวิชาการ (PATCH Status)
- 🤖 **BSRU CS AI Assistant (RAG Pipeline)**: ผู้ช่วย AI ตอบคำถามหลักสูตร ระเบียบวิชาการ และสถิติสายอาชีพบัณฑิตแบบเรียลไทม์ ขับเคลื่อนด้วย Google Gemini 1.5 Flash ร่วมกับ Vector Database (PGVector) พร้อม Smart Local Fallback
  - **แชทเริ่มใหม่ทุกครั้งที่ login หรือ logout**: ระบบลบประวัติแชทและ memory ของ AI ของผู้ใช้คนนั้นทั้งที่ server และในหน้าต่างแชท
  - **ระหว่างที่ยังเปิดเว็บค้างไว้ แชทยังอยู่**: ปิดแล้วเปิดหน้าต่างแชทใหม่ หรือรีเฟรชหน้าในแท็บเดิม ประวัติยังอยู่ครบ
  - ปุ่มถังขยะในหน้าต่างแชทล้างประวัติได้ทุกเมื่อ
  - ผู้ใช้ที่ไม่ได้ login มีแชทแยกต่อแท็บ (เก็บ id ไว้ใน `sessionStorage`)
  - ถ้า login บัญชีเดียวกันหลายแท็บหรือหลายเครื่อง ทุกแท็บใช้แชทชุดเดียวกัน แท็บใดแท็บหนึ่ง login หรือ logout แชทของแท็บอื่นจะถูกลบที่ server ด้วย

---

## 🏗️ สถาปัตยกรรมระบบภาพรวม (High-Level Architecture)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      FRONTEND LAYER (Browser Port 80)                   │
│   Vanilla JS (ES6 Modules) + Modern CSS Design System (Mobile Ready)    │
│   [Student Portal]   [Advisor Portal]   [Admin Portal]   [AI Chatbot]   │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ REST API (JSON + JWT Bearer Token)
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   BACKEND LAYER (Spring Boot Port 8080)                 │
│   • Spring Security 6 (Stateless JWT Authentication & Strict CORS)      │
│   • Spring Data JPA & Hibernate ORM (Domain Entities & Repositories)    │
│   • LangChain4j 0.35 (Gemini 1.5 Flash + text-embedding-004 + RAG)     │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ PostgreSQL Protocol (Port 5432)
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                 DATABASE & VECTOR LAYER (Docker Port 5432)              │
│   PostgreSQL 16 + pgvector:                                             │
│   • Relational Tables: students, advisors, academic_petitions           │
│   • Vector Store Table: bsru_embeddings (768-dim Embeddings + Metadata) │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Clone แล้วรันได้ทันที (สำหรับเพื่อนในทีม)

ต้องมีแค่ **Git** และ **Docker Desktop** (เปิดไว้ก่อน) ไม่ต้องติดตั้ง Java / XAMPP / PostgreSQL

```powershell
git clone https://github.com/PxrnthepRPP/ChatbotCSBSRU.git
cd ChatbotCSBSRU
git checkout feat/new-work   # ถ้ายังไม่ได้รวมเข้า main
docker compose up -d --build
```
ครั้งแรกใช้เวลาหลายนาที (ดาวน์โหลด image + build) จากนั้นเปิด **http://localhost:3000** แล้วเข้าสู่ระบบด้วย `admin`, `advisor` หรือ `student` (รหัสผ่าน `password` ดูตาราง "ข้อมูลบัญชีสำหรับทดสอบระบบ" ด้านล่าง)

- ระบบสร้างฐานข้อมูลและข้อมูลตัวอย่างให้เองทั้งหมด (นักศึกษา อาจารย์ ตารางเรียน ใบตรวจจบ ข้อมูลจำลองรุ่น 63–68)
- **ไม่ต้องมีไฟล์ `.env` ก็รันได้** แต่แชทบอท AI จะตอบแบบสำรอง (ไม่ได้ดึงข้อมูลจริง) จนกว่าจะใส่ Gemini API key:
  1. `copy .env.example .env`
  2. ใส่ `GEMINI_API_KEY=...` (ขอฟรีที่ [Google AI Studio](https://aistudio.google.com/apikey) หรือขอจากเจ้าของโปรเจกต์ทางแชทส่วนตัว — **ห้าม commit ไฟล์ `.env`**)
  3. `docker compose up -d backend`
- 📘 **ตั้งค่า AI (Gemini), ฐานความรู้ RAG, บัญชีทดลอง และข้อมูลทดสอบ ดูที่ [AI_SETUP.md](AI_SETUP.md)**
- พอร์ตที่ใช้: 3000 (เว็บ), 8080 (backend), 5432 (ฐานข้อมูล) — ถ้ามีโปรแกรมอื่นใช้อยู่ต้องปิดก่อน
- หยุดระบบ: `docker compose down` · ล้างฐานข้อมูลเริ่มใหม่: `docker compose down -v`

---

## ⚡ เริ่มต้นใช้งานด่วน (Quick Start)

### 1. ตั้งค่า Environment Variables
คัดลอกไฟล์แม่แบบและใส่ **Gemini API Key** ของคุณ (ขอรับฟรีได้ที่ [Google AI Studio](https://aistudio.google.com/apikey)):
```powershell
copy .env.example .env
```
เปิดไฟล์ `.env` แล้วระบุค่า:
```env
GEMINI_API_KEY=YOUR_ACTUAL_GEMINI_API_KEY
```

### 2. สตาร์ทฐานข้อมูล PostgreSQL + pgvector (Docker)
> *โปรดตรวจสอบว่าได้เปิดโปรแกรม Docker Desktop ไว้แล้ว*
```powershell
docker-compose up -d
```

### 3. รันระบบ Spring Boot Backend (Port 8080)
- **PowerShell (แนะนำ):**
  ```powershell
  .\start-backend.ps1
  ```
- **Windows Command Prompt / ดับเบิลคลิก:** รันไฟล์ `start-backend.bat`  
*(สคริปต์จะโหลดตัวแปรจาก `.env` ให้โดยอัตโนมัติ)*

### 4. เข้าใช้งานผ่าน Web Browser (Port 80 / XAMPP Apache)
เปิดเว็บเบราว์เซอร์แล้วเข้าใช้งานผ่าน URL:
```text
http://localhost/ChatbotCSBSRU/
```
> ⚠️ **คำเตือนสำคัญ:** ห้ามดับเบิลคลิกเปิดไฟล์ `index.html` ผ่าน `file:///` โดยตรง เพราะระบบใช้โมดูล JavaScript ES6 ซึ่งเบราว์เซอร์จะบล็อกตามนโยบายความปลอดภัย CORS ต้องเข้าผ่าน `http://localhost/ChatbotCSBSRU/` บน XAMPP เท่านั้น

### ทางเลือก: รันทั้งระบบใน Docker (ไม่ต้องใช้ XAMPP / Java บนเครื่อง)
ใส่ `GEMINI_API_KEY` ในไฟล์ `.env` ตามขั้นที่ 1 แล้วรัน:
```powershell
docker compose up -d --build
```
- เว็บไซต์: `http://localhost:3000/`
- Backend API: `http://localhost:8080/api`

หลังแก้ค่าใน `.env` ให้รัน `docker compose up -d backend` เพื่อให้ backend อ่านค่าใหม่

### 5. วิธีหยุดการทำงานและปิดระบบ (Shutdown)
- **หยุด Backend:** กด `Ctrl + C` ในหน้าต่าง Terminal ที่กำลังรันอยู่ (หรือกดปุ่มถังขยะ Kill Terminal ใน VS Code)
- **หยุด PostgreSQL:** รัน `docker-compose down` ใน PowerShell
- **หยุด Frontend:** กด **Stop** โมดูล Apache ใน XAMPP Control Panel

---

## 🔑 ข้อมูลบัญชีสำหรับทดสอบระบบ (Test Accounts)

ทุกบัญชีด้านล่างใช้รหัสผ่าน `password` (สร้างอัตโนมัติตอน backend เริ่มทำงาน ถ้ายังไม่มีบัญชีนั้น)

| บทบาท (Role) | Username สำหรับเข้าสู่ระบบ | รหัสผ่าน (Password) | สิทธิ์ระบบ (JWT Role) |
|---|---|---|---|
| 👑 **ผู้ดูแลระบบ (Admin)** | `admin` | `password` | `ROLE_ADMIN` |
| 👩‍🏫 **อาจารย์ (Advisor)** | `advisor` (= `ADV-01`) หรือ `ADV-01` ถึง `ADV-07` | `password` | `ROLE_ADVISOR` |
| 🎓 **นักศึกษา (Student)** | `student` (= `6621100042`) หรือ `6621100042`, `6621100015`, `6721100088`, `6721100120`, `6821100003` | `password` | `ROLE_STUDENT` |

- `6621100042` (ปี 4) เป็นบัญชีตัวอย่างหลัก มีผลการเรียน ตารางเรียน และใบตรวจจบครบ ส่วน `6721100120` เป็นนักศึกษาตัวอย่างที่ผลการเรียนตก (ใช้ทดสอบรายการเสี่ยงของอาจารย์)
- นักศึกษาที่เป็น **ข้อมูลจำลอง** (ป้าย "จำลอง" ในหน้าจัดการนักศึกษา) ไม่มีบัญชีเข้าสู่ระบบ
- นักศึกษาที่แอดมินเพิ่มใหม่ (ทีละคนหรือ CSV) หรือถูกรีเซ็ตรหัสผ่าน: ชื่อผู้ใช้ = รหัสนักศึกษา 10 หลัก, รหัสผ่านเริ่มต้น = อักษรแรกของชื่อ + อักษรแรกของนามสกุล (ภาษาอังกฤษ พิมพ์ใหญ่) ตามด้วยเลขบัตรประชาชน 13 หลัก เช่น Somchai Jaidee เลขบัตร 1101700203450 → `SJ1101700203450` (ตอนเข้าครั้งแรกพิมพ์ตัวเล็กได้ ถ้าไม่มีชื่ออังกฤษใช้อักษรไทยแทน) และต้องตั้งรหัสใหม่เมื่อเข้าครั้งแรก (อย่างน้อย 8 ตัว มีพิมพ์ใหญ่ พิมพ์เล็ก ตัวเลข อักขระพิเศษไม่บังคับ) · แอดมินต้องกรอกเลขบัตรประชาชนเมื่อเพิ่มนักศึกษาจริง (CSV ต้องมีคอลัมน์ `nationalId`) และเลขเต็มเห็นได้เฉพาะแอดมิน
- ใส่รหัสผ่านผิด 5 ครั้ง บัญชีถูกล็อก 5 นาที
- ป้ายกรอกบัญชีทดลองในหน้า login แสดงเฉพาะเมื่อรัน backend ด้วย profile `dev` (`start-backend.ps1`) หรือตั้ง `APP_LOGIN_SHOW_DEMO_ACCOUNTS=true` ส่วน docker-compose (profile `prod`) ซ่อนป้ายไว้ แต่บัญชียังใช้ได้ตามตารางนี้
- รหัสนักศึกษาเปลี่ยนจากชุด 64/65/66 เป็น 66/67/68 ถ้าฐานข้อมูลยังเป็นของเดิม ให้ลบ volume `pg_data` แล้วรันใหม่

---

## 📂 โครงสร้างโปรเจกต์สำคัญ (Key Project Structure)

```
ChatbotCSBSRU/
├── README.md                 # หน้านี้: สรุปภาพรวมและ Quick Start
├── start-backend.bat         # ดับเบิลคลิกเพื่อเริ่ม Backend (เรียก start-backend.ps1)
├── start-backend.ps1         # สคริปต์เริ่ม Backend สำหรับ PowerShell (อ่าน .env อัตโนมัติ)
├── .env.example              # ตัวอย่าง Environment Variables (คัดลอกเป็น .env — ไม่ commit)
├── docker-compose.yml        # PostgreSQL 16 + pgvector, Backend และ Frontend (nginx)
├── Dockerfile                # Build image ของ Spring Boot Backend
├── pom.xml                   # Maven Dependencies & Plugins
│
├── index.html                # ── Frontend (เสิร์ฟผ่าน XAMPP ที่ http://localhost/ChatbotCSBSRU/)
├── assets/                   #    รูปภาพและโลโก้
├── css/                      #    Modular CSS Design System (main, theme-dark, components/, roles/)
├── js/                       #    ES6 JavaScript Modules (main, api, auth, components/, roles/)
│
├── src/main/                 # ── Backend: Java Spring Boot 3 Source Code & Resources
│
├── database/
│   └── init.sql              # เปิดใช้ส่วนขยาย pgvector ตอนสร้างฐานข้อมูลครั้งแรก
├── docs/
│   ├── USER_GUIDE.md         # คู่มือการติดตั้งและทดสอบฟังก์ชันฉบับละเอียด
│   └── DOCUMENTATION.md      # เอกสารสถาปัตยกรรมและรายละเอียดเชิงเทคนิค
├── scripts/
│   └── ingest-knowledge.ps1  # นำเข้าเอกสารความรู้ให้ AI Chatbot (RAG)
└── tests/
    ├── test-e2e.mjs          # E2E API Test Suite (Node.js)
    ├── test-e2e-api.ps1      # E2E API Test Suite (PowerShell)
    ├── test-chatbot.ps1      # ส่งชุดคำถามทดสอบให้แชทบอทและสร้างรายงาน
    └── chatbot-test-questions.json
```

---

## 👥 ผู้พัฒนาและลิขสิทธิ์ (Authors & License)
- **สาขาวิชา**: วิทยาการคอมพิวเตอร์ (Computer Science)
- **คณะ**: วิทยาศาสตร์และเทคโนโลยี มหาวิทยาลัยราชภัฏบ้านสมเด็จเจ้าพระยา (BSRU)
- **ที่ปรึกษาโครงการ**: คณาจารย์ประจำสาขาวิชาวิทยาการคอมพิวเตอร์ BSRU


