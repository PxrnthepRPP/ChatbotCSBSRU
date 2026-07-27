(https://img.shields.io/badge/Backend-Spring_Boot-6db33f?style=flat-square&logo=spring&logoColor=white)](https://spring.io/projects/spring-boot)
(https://img.shields.io/badge/Database-PostgreSQL_%2B_PGVector-336791?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)

ระบบสารสนเทศและแชทบอทปัญญาประดิษฐ์ สำหรับสนับสนุนส่งเสริมการทำงานทางวิชาการ ประจำสาขาวิชาวิทยาการคอมพิวเตอร์ มหาวิทยาลัยราชภัฏบ้านสมเด็จเจ้าพระยา (CS BSRU)

โปรเจกต์นี้เป็นการพัฒนาระบบ Web Application แบบ Single Page Application (SPA) ที่ผสานการทำงานของระบบจัดการข้อมูลส่วนบุคคล (ตารางเรียน, ผลการเรียน) เข้ากับระบบปัญญาประดิษฐ์ (AI Chatbot) ที่ใช้เทคโนโลยี Retrieval-Augmented Generation (RAG) เพื่อให้ข้อมูลและตอบคำถามวิชาการได้อย่างแม่นยำตลอด 24 ชั่วโมง

✨ ฟีเจอร์หลัก (Key Features)
👥 ระบบจัดการสิทธิ์ผู้ใช้งาน (Role-Based Access Control)
Student (นักศึกษา): เข้าถึง 7 โมดูลหลัก ได้แก่ ประวัตินักศึกษา, ตารางเรียน/สอบ, การเงิน/ทุนการศึกษา, ผลการเรียน, ตรวจสอบจบ, และกิจกรรม

Advisor (อาจารย์ที่ปรึกษา): ดูรายชื่อนักศึกษาในความดูแล พร้อมระบบ Batch Filter (กรองข้อมูลตามรุ่น เช่น รุ่น 66)

Admin (ผู้ดูแลระบบ): ระบบจัดการข้อมูล (CRUD) สำหรับควบคุมข้อมูลอาจารย์และนักศึกษาทั้งหมดในระบบ

🕵️ ระบบจำลองตัวตน (User Impersonation)
อาจารย์และผู้ดูแลระบบสามารถกดปุ่ม "Impersonate" เพื่อเข้าดูหน้าจอและข้อมูลเสมือนเป็นนักศึกษาคนนั้นๆ ได้โดยตรง (ระบบจะแสดง Warning Banner สีส้มเพื่อแจ้งเตือนสถานะการจำลองตัวตน)

🎨 UI/UX และการแสดงผล (Modern Frontend)
Responsive CSS Grid Timetable: ตารางเรียนที่แสดงผลแบบ Matrix บนหน้าจอคอมพิวเตอร์ และยุบตัวเป็นแบบการ์ดรายการ (Agenda View) อัตโนมัติเมื่อใช้งานบนสมาร์ทโฟน

Dark Mode & CS Branding: ธีมสีน้ำเงินเข้ม-ขาว (Deep Blue/Navy) อ้างอิงจากโลโก้สาขา CS พร้อมระบบสลับโหมดกลางคืนที่บันทึกค่าไว้ใน localStorage

Print-Optimized: รองรับการสั่งพิมพ์ (Print) ตารางเรียนและผลการเรียน โดยซ่อนเมนูที่ไม่จำเป็นและป้องกันตารางถูกตัดขาดครึ่งหน้ากระดาษ

Debounce Search: ช่องค้นหาข้อมูลแบบหน่วงเวลา (300ms) เพื่อความลื่นไหลและลดภาระเซิร์ฟเวอร์

🤖 แชทบอทปัญญาประดิษฐ์ (AI Assistant)
ใช้สถาปัตยกรรม Hybrid Intent-Router แยกแยะคำถามส่วนตัว (ดึงจาก SQL) และคำถามทั่วไป (ดึงจาก PGVector ด้วย RAG)

ออกแบบ UI แบบ Capability Transparency แจ้งความสามารถบอทชัดเจน และมีระบบกู้คืนข้อความผู้ใช้หากเซิร์ฟเวอร์ขัดข้อง

🛠️ เทคโนโลยีที่ใช้ (Tech Stack)
Frontend:

HTML5, CSS3 (CSS Grid/Flexbox)

Vanilla JavaScript (ES6 Modules, Centralized State Management)

Hosting: XAMPP (Apache Server)

Backend:

Java 21, Spring Boot 3.x

Spring Security (JWT & SwitchUserFilter)

LangChain4j (LLM Orchestration)

Database & AI:

PostgreSQL + PGVector Extension

Google Gemini API (gemini-1.5-flash)

🚀 การติดตั้งและการจำลองระบบ (Installation & Setup)
สิ่งที่ต้องมีเบื้องต้น (Prerequisites)
XAMPP (สำหรับรัน Frontend)

(https://www.docker.com/products/docker-desktop/) (สำหรับรัน PostgreSQL)

(https://adoptium.net/temurin/releases)

API Key จาก Google Gemini

ขั้นตอนการรันโปรเจกต์
1. ฝั่งฐานข้อมูล (Database)
เปิด Terminal ในโฟลเดอร์โปรเจกต์และรันคำสั่ง Docker เพื่อสร้างฐานข้อมูล PostgreSQL ที่รองรับ Vector:

Bash
docker-compose up -d
2. ฝั่งเซิร์ฟเวอร์ (Backend)
เปิดโปรเจกต์ Spring Boot นำ API Key ของ Gemini ไปใส่ใน application.properties และรันแอปพลิเคชัน (เซิร์ฟเวอร์จะทำงานที่ http://localhost:8080)

Bash
./mvnw spring-boot:run
3. ฝั่งหน้าเว็บ (Frontend)

นำโฟลเดอร์ไฟล์ Frontend ทั้งหมดไปวางไว้ในโฟลเดอร์ C:\xampp\htdocs\chatbot

เปิดโปรแกรม XAMPP Control Panel และกด Start ที่โมดูล Apache

เปิดเว็บเบราว์เซอร์และเข้าไปที่: http://localhost/chatbot/index.html

📂 โครงสร้างโปรเจกต์ (Project Structure)
📦 chatbot-academic-support
┣ 📂 backend (Spring Boot)
┃ ┣ 📂 src/main/java/com/bsru/cs/chatbot
┃ ┃ ┣ 📂 config       # การตั้งค่า Security, CORS, AI
┃ ┃ ┣ 📂 controller   # REST API Endpoints
┃ ┃ ┣ 📂 model        # JPA Entities (Student, Course, Enrollment)
┃ ┃ ┣ 📂 repository   # Spring Data JPA
┃ ┃ ┗ 📂 service      # AI Logic, RAG, Intent-Routing
┃ ┗ 📜 docker-compose.yml
┃
┗ 📂 frontend (XAMPP htdocs)
┣ 📜 index.html     # SPA Main Entry
┣ 📂 css
┃ ┣ 📜 main.css
┃ ┣ 📜 chatbot.css
┃ ┗ 📂 roles        # CSS แยกตาม Role (admin, advisor, student)
┗ 📂 js
┣ 📜 main.js      # App Initialization & Routing
┣ 📜 state.js     # Centralized State Management
┣ 📜 auth.js      # Login & Impersonation Logic
┣ 📂 components   # Chatbot UI Logic
┗ 📂 roles        # Module Logic (admin.js, advisor.js, student.js)

มหาวิทยาลัยราชภัฏบ้านสมเด็จเจ้าพระยา (BSRU)

สาขาวิชาวิทยาการคอมพิวเตอร์ (Computer Science)
