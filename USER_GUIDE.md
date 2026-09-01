# 🚀 คู่มือขั้นตอนการติดตั้งและใช้งานระบบ (Quickstart & User Guide)
### BSRU Student Portal, REST API & AI Chatbot System
สาขาวิชาวิทยาการคอมพิวเตอร์ คณะวิทยาศาสตร์และเทคโนโลยี มหาวิทยาลัยราชภัฏบ้านสมเด็จเจ้าพระยา

---

## 📋 1. สิ่งที่ต้องติดตั้งล่วงหน้า (Prerequisites)

ก่อนเริ่มใช้งานระบบ กรุณาตรวจสอบว่าเครื่องของท่านติดตั้งซอฟต์แวร์ดังต่อไปนี้แล้ว:
1. **Docker Desktop** (สำหรับรัน PostgreSQL 16 + pgvector)
2. **Java 21 LTS** (เช่น Microsoft JDK 21 หรือ OpenJDK 21)
3. **Apache Maven 3.9+** (หรือใช้ Maven Wrapper `mvnw.cmd` ที่มีในโปรเจกต์)
4. **XAMPP / Apache Web Server** (สำหรับโฮสต์ Frontend บน Port 80)
5. **Google Chrome / Microsoft Edge / Web Browser รุ่นล่าสุด**

---

## 🛠️ 2. ขั้นตอนการเริ่มต้นระบบ (Step-by-Step Setup & Run)

```
┌─────────────────────────┐     ┌─────────────────────────┐     ┌─────────────────────────┐
│       ขั้นตอนที่ 1       │     │       ขั้นตอนที่ 2       │     │       ขั้นตอนที่ 3       │
│    เปิด Docker Desktop   │ ──> │  รัน Spring Boot Backend│ ──> │    เปิด Web Browser     │
│   & รัน pgvector (5432) │     │      (Port 8080)        │     │  http://localhost/...   │
└─────────────────────────┘     └─────────────────────────┘     └─────────────────────────┘
```

### ขั้นตอนที่ 1: สตาร์ทฐานข้อมูล PostgreSQL 16 + pgvector
1. เปิดโปรแกรม **Docker Desktop** บนคอมพิวเตอร์ของคุณ และรอจนกระทั่งไอคอนด้านล่างซ้ายขึ้นสถานะ **Engine running (สีเขียว)**
2. เปิด PowerShell หรือ Command Prompt เข้าไปที่โฟลเดอร์โปรเจกต์:
   ```powershell
   cd c:\xampp\htdocs\ChatbotCSBSRU
   ```
3. สตาร์ท Container ฐานข้อมูลด้วยคำสั่ง:
   ```powershell
   docker-compose up -d
   ```
4. ตรวจสอบว่าคอนเทนเนอร์ `bsru_vector_db` ทำงานเรียบร้อย:
   ```powershell
   docker ps
   ```

---

### ขั้นตอนที่ 2: รันระบบหลังบ้าน Spring Boot Backend (Port 8080)
1. เปิดหน้าต่าง PowerShell ใหม่ในโฟลเดอร์โปรเจกต์
2. กำหนด Path ของ Java 21 และสั่งรัน Spring Boot:
   ```powershell
   $env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot";
   $env:PATH = "$env:JAVA_HOME\bin;C:\Users\beria\apache-maven-3.9.9\bin;$env:PATH";
   .\mvnw.cmd spring-boot:run
   ```
3. เมื่อระบบสตาร์ทสำเร็จ จะแสดงข้อความ:
   ```text
   Started BsruStudentPortalApplication in X.XXX seconds
   Tomcat started on port 8080 (http) with context path '/'
   ```
4. ตรวจสอบสถานะ Backend ผ่านเว็บเบราว์เซอร์ที่:
   👉 **`http://localhost:8080/api/health`**  
   (จะได้รับ JSON ตอบกลับสถานะ `UP` พร้อมจำนวนข้อมูลในฐานข้อมูล)

---

### ขั้นตอนที่ 3: เปิดใช้งานหน้าบ้าน Frontend (Port 80 / XAMPP)
1. เปิดโปรแกรม **XAMPP Control Panel** แล้วคลิกปุ่ม **Start** ที่โมดูล **Apache**
2. เปิดเบราว์เซอร์แล้วเข้าใช้งานระบบผ่าน URL:
   👉 **`http://localhost/ChatbotCSBSRU/`**

---

## 🔑 3. บัญชีผู้ใช้งานสำหรับทดสอบระบบ (Test Accounts & Credentials)

ระบบมีระบบ **DataSeeder** สร้างข้อมูลผู้ใช้งานจำลองลงฐานข้อมูล PostgreSQL ให้อัตโนมัติ:

| บทบาท (Role) | Username สำหรับเข้าสู่ระบบ | รหัสผ่าน (Password) | สิทธิ์ระบบ (JWT Role) | วัตถุประสงค์ในการทดสอบ |
|---|---|---|---|---|
| 🎓 **นักศึกษา (Student)** | `6421100042` หรือ `student` | อะไรก็ได้ (เช่น `1234`) | `ROLE_STUDENT` | • ดูและแก้ไขประวัตินักศึกษา + เปลี่ยนรูป Avatar<br>• ลงตารางเรียนเอง + ตรวจสอบตารางสอบอัตโนมัติ<br>• ตรวจสอบจบ 8 เทอม (Table & Mobile Cards View)<br>• ยื่นคำร้องวิชาการลง PostgreSQL<br>• สนทนากับ AI Chatbot อัจฉริยะ |
| 👩‍🏫 **อาจารย์ (Advisor)** | `ADV-01` หรือ `advisor` | อะไรก็ได้ (เช่น `1234`) | `ROLE_ADVISOR` | • ดูแดชบอร์ดนักศึกษาในความดูแล<br>• ปุ่มจำลองมุมมอง (Impersonation Mode)<br>• จัดการรายวิชาที่สอน และประกาศตารางสอบ |
| 👑 **ผู้ดูแลระบบ (Admin)** | `admin` | อะไรก็ได้ (เช่น `1234`) | `ROLE_ADMIN` | • แดชบอร์ดกรองตามรุ่น (Batch Filter) + Donut Chart<br>• จัดการข้อมูลอาจารย์และนักศึกษา (CRUD)<br>• พิจารณาอนุมัติ/ปฏิเสธคำร้องวิชาการ (PATCH)<br>• นำเข้าเอกสารความรู้ AI (Data Ingestion) |

---

## 🎯 4. คู่มือการทดสอบฟังก์ชันสำคัญ (Feature Walkthrough)

### 4.1 การยื่นและพิจารณาคำร้องวิชาการ (Academic Petition Flow)
1. **ฝั่งนักศึกษา**:
   - เข้าสู่ระบบด้วย `6421100042`
   - ไปที่เมนู **"ยื่นคำร้องวิชาการ"** ในแถบเมนูด้านซ้าย
   - เลือกประเภทคำร้อง (เช่น *ยื่นขอสอบหัวข้อโปรเจคจบ*), พิมพ์ชื่อหัวข้อ, รายละเอียด และแนบไฟล์ `.pdf`
   - กดปุ่ม **"ส่งคำร้องวิชาการ"** $\rightarrow$ ข้อมูลจะถูกบันทึกลงตาราง `academic_petitions` บน PostgreSQL
2. **ฝั่งผู้ดูแลระบบ (Admin)**:
   - เข้าสู่ระบบด้วย `admin`
   - ไปที่เมนู **"รายการคำร้อง"**
   - คลิกที่รายการคำร้องเพื่อเปิด **Modal ตรวจสอบคำร้อง**
   - พิมพ์ความคิดเห็น และกดปุ่มลัด **"อนุมัติคำร้อง"** หรือ **"ปฏิเสธคำร้อง"** $\rightarrow$ ระบบจะยิง `PATCH /api/petitions/{id}/status` และซิงค์ผลไปยังหน้านักศึกษาทันที

---

### 4.2 การใช้งาน BSRU AI Chatbot (RAG Assistant)
1. คลิกที่ไอคอน **🤖 Floating Chatbot** บริเวณมุมขวาล่างของหน้าจอ
2. พิมพ์คำถามเกี่ยวกับหลักสูตรและระเบียบวิชาการ เช่น:
   - *"ขั้นตอนการยื่นคำร้องขอสอบหัวข้อปริญญานิพนธ์ทำอย่างไร"*
   - *"เกณฑ์การสำเร็จการศึกษาสาขาวิทยาการคอมพิวเตอร์ต้องเรียนกี่หน่วยกิต"*
   - *"ติดต่ออาจารย์ที่ปรึกษาได้ที่ห้องไหน"*
3. AI จะดึงข้อมูลจากตาราง `bsru_embeddings` บน PostgreSQL ผ่าน **ContentRetriever** แล้วประมวลผลคำตอบที่แม่นยำออกมาแบบเรียลไทม์

---

### 4.3 การนำเข้าเอกสารความรู้ใหม่เข้าสู่ AI Vector Database (Admin Ingestion)
ผู้ดูแลระบบสามารถส่งเอกสาร PDF / ข้อความคู่มือหลักสูตรใหม่เข้าสู่ระบบ RAG ได้ผ่าน REST API:
```powershell
# 1. เข้าสู่ระบบเพื่อรับ Token
$login = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/login" -Method Post -Body (@{ username = "admin"; password = "password" } | ConvertTo-Json) -ContentType "application/json; charset=utf-8";

# 2. ส่งเอกสารความรู้เข้าสู่ระบบ
$doc = @{
    content = "ข้อบังคับมหาวิทยาลัยราชภัฏบ้านสมเด็จเจ้าพระยา: นักศึกษาที่ประสงค์จะขอเปิดรายวิชาเรียนกรณีพิเศษ ต้องมีจำนวนนักศึกษาลงชื่อไม่น้อยกว่า 10 คน และได้รับความเห็นชอบจากอาจารย์ผู้สอนและหัวหน้าสาขาวิชา";
    source = "bsru_special_course_regulation.pdf";
} | ConvertTo-Json;

Invoke-RestMethod -Uri "http://localhost:8080/api/admin/knowledge/ingest" -Method Post -Headers @{ "Authorization" = "Bearer " + $login.token } -Body ([System.Text.Encoding]::UTF8.GetBytes($doc)) -ContentType "application/json; charset=utf-8";
```

---

## 🔧 5. การแก้ไขปัญหาที่พบบ่อย (Troubleshooting)

| ปัญหาที่พบ | สาเหตุ | วิธีแก้ไข |
|---|---|---|
| **`failed to connect to docker API`** | ยังไม่ได้เปิดโปรแกรม Docker Desktop | เปิดโปรแกรม **Docker Desktop** และรอให้ Engine เริ่มทำงานก่อนรัน `docker-compose up -d` |
| **`Connection to localhost:5432 refused`** | คอนเทนเนอร์ PostgreSQL ยังไม่เริ่มทำงาน | รันคำสั่ง `docker start bsru_vector_db` หรือ `docker-compose up -d` ในโฟลเดอร์โปรเจกต์ |
| **`Port 8080 is already in use`** | มีโปรเซส Spring Boot เดิมค้างอยู่ | รันคำสั่งค้นหาและปิดโปรเซส: <br>`Get-Process -Id (Get-NetTCPConnection -LocalPort 8080).OwningProcess | Stop-Process -Force` |
| **เข้าหน้าเว็บไม่ได้ (404 Not Found)** | ยังไม่ได้ Start Apache ใน XAMPP หรือโฟลเดอร์ไม่อยู่ใน htdocs | ตรวจสอบว่าโปรเจกต์อยู่ที่ `c:\xampp\htdocs\ChatbotCSBSRU` และเปิด Apache ใน XAMPP Control Panel |

---

## 📞 6. ข้อมูลติดต่อและผู้พัฒนา
- **สาขาวิชา**: วิทยาการคอมพิวเตอร์ (Computer Science)
- **คณะ**: วิทยาศาสตร์และเทคโนโลยี มหาวิทยาลัยราชภัฏบ้านสมเด็จเจ้าพระยา (BSRU)
- **เว็บไซต์หลัก**: [http://localhost/ChatbotCSBSRU/](http://localhost/ChatbotCSBSRU/)
- **เอกสารสถาปัตยกรรมฉบับเต็ม**: ดูเพิ่มเติมได้ที่ [`DOCUMENTATION.md`](file:///c:/xampp/htdocs/ChatbotCSBSRU/DOCUMENTATION.md)
