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
| 🚀 [**`USER_GUIDE.md`**](USER_GUIDE.md) | **ผู้ใช้งาน / ผู้ทดสอบระบบ (User & Tester)** | ขั้นตอนการติดตั้งอย่างละเอียด, บัญชีทดสอบ (Credentials), คู่มือทดสอบฟังก์ชันทุกเมนู และตารางแก้ปัญหา (Troubleshooting) |
| 📑 [**`DOCUMENTATION.md`**](DOCUMENTATION.md) | **นักพัฒนา / วิศวกร (Developer & Technical)** | สถาปัตยกรรมเชิงลึก, Spring Security 6 & JWT Lifecycle, LangChain4j RAG Pipeline, REST API Specs และ Database DDL Schema |

---

## ✨ จุดเด่นของระบบ (Key Features)

- 🎓 **ระบบสารสนเทศนักศึกษาครบวงจร (Student Portal)**: ตรวจสอบประวัติ, อัปเดตข้อมูลและ Avatar, ตารางเรียน Matrix Grid พร้อมป้องกันวิชาชน, ตารางสอบอัตโนมัติ, ตรวจสอบจบ 8 เทอม (รองรับทั้ง Table View และ Mobile Cards View) และการยื่นคำร้องวิชาการ
- 👩‍🏫 **ระบบอาจารย์ที่ปรึกษา (Advisor Portal)**: แดชบอร์ดสถิตินักศึกษาในความดูแล, จัดการรายวิชาที่สอน, ประกาศตารางสอบ และโหมดจำลองมุมมองนักศึกษา (Impersonation Mode)
- 👑 **ระบบผู้ดูแลระบบ (Admin Portal)**: แดชบอร์ดวิเคราะห์สถิตินักศึกษาแยกตามรุ่น (Batch Filter), จัดการข้อมูลอาจารย์-นักศึกษา (CRUD) และระบบพิจารณาอนุมัติ/ปฏิเสธคำร้องวิชาการ (PATCH Status)
- 🤖 **BSRU CS AI Assistant (RAG Pipeline)**: ผู้ช่วย AI ตอบคำถามหลักสูตรและระเบียบวิชาการแบบเรียลไทม์ ขับเคลื่อนด้วย Google Gemini 1.5 Flash ร่วมกับ Vector Database (PGVector) พร้อม Smart Local Fallback

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
git checkout feat/chatbot-student-grades   # ถ้ายังไม่ได้รวมเข้า main
docker compose up -d --build
```
ครั้งแรกใช้เวลาหลายนาที (ดาวน์โหลด image + build) จากนั้นเปิด **http://localhost:3000** แล้วกดป้าย ADMIN / ADVISOR / STUDENT ในหน้า login เพื่อกรอกบัญชีทดลอง (รหัสผ่าน `password`)

- ระบบสร้างฐานข้อมูลและข้อมูลตัวอย่างให้เองทั้งหมด (นักศึกษา อาจารย์ ตารางเรียน ใบตรวจจบ ข้อมูลจำลองรุ่น 61–66)
- **ไม่ต้องมีไฟล์ `.env` ก็รันได้** แต่แชทบอท AI จะตอบแบบสำรอง (ไม่ได้ดึงข้อมูลจริง) จนกว่าจะใส่ Gemini API key:
  1. `copy .env.example .env`
  2. ใส่ `GEMINI_API_KEY=...` (ขอฟรีที่ [Google AI Studio](https://aistudio.google.com/apikey) หรือขอจากเจ้าของโปรเจกต์ทางแชทส่วนตัว — **ห้าม commit ไฟล์ `.env`**)
  3. `docker compose up -d backend`
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

---

## 🔑 ข้อมูลบัญชีสำหรับทดสอบระบบ (Test Accounts)

| บทบาท (Role) | Username สำหรับเข้าสู่ระบบ | รหัสผ่าน (Password) | สิทธิ์ระบบ (JWT Role) |
|---|---|---|---|
| 🎓 **นักศึกษา (Student)** | `6421100042` หรือ `student` | `password` | `ROLE_STUDENT` |
| 👩‍🏫 **อาจารย์ (Advisor)** | `ADV-01` หรือ `advisor` | `password` | `ROLE_ADVISOR` |
| 👑 **ผู้ดูแลระบบ (Admin)** | `admin` | `password` | `ROLE_ADMIN` |

---

## 📂 โครงสร้างโปรเจกต์สำคัญ (Key Project Structure)

```
ChatbotCSBSRU/
├── README.md                 # หน้านี้: สรุปภาพรวมและ Quick Start
├── USER_GUIDE.md             # คู่มือการติดตั้งและทดสอบฟังก์ชันฉบับละเอียด
├── DOCUMENTATION.md          # เอกสารสถาปัตยกรรมและรายละเอียดเชิงเทคนิค
├── .env.example              # ตัวอย่าง Environment Variables
├── .env                      # ค่าจริง (Ignored by Git ปลอดภัยจากคีย์รั่วไหล)
├── start-backend.ps1         # สคริปต์เริ่ม Backend สำหรับ PowerShell
├── start-backend.bat         # สคริปต์เริ่ม Backend สำหรับ Windows CMD
├── docker-compose.yml        # คอนฟิกูเรชัน PostgreSQL 16 + pgvector
├── pom.xml                   # Maven Dependencies & Plugins
├── index.html                # Single Page Application UI Entry Point
├── js/                       # ES6 JavaScript Modules (Roles, Components, API, Auth)
├── css/                      # Modular CSS Design System (Theme, Mobile Styles)
└── src/                      # Java Spring Boot 3 Source Code & Resources
```

---

## 👥 ผู้พัฒนาและลิขสิทธิ์ (Authors & License)
- **สาขาวิชา**: วิทยาการคอมพิวเตอร์ (Computer Science)
- **คณะ**: วิทยาศาสตร์และเทคโนโลยี มหาวิทยาลัยราชภัฏบ้านสมเด็จเจ้าพระยา (BSRU)
- **ที่ปรึกษาโครงการ**: คณาจารย์ประจำสาขาวิชาวิทยาการคอมพิวเตอร์ BSRU


