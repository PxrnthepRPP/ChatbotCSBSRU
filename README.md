# BSRU Student Portal & AI Chatbot System

ระบบสารสนเทศนักศึกษาและผู้ช่วย AI อัจฉริยะ (RAG Pipeline)  
สาขาวิชาวิทยาการคอมพิวเตอร์ คณะวิทยาศาสตร์และเทคโนโลยี มหาวิทยาลัยราชภัฏบ้านสมเด็จเจ้าพระยา

---

## 📖 สารบัญเอกสาร (Documentation Index)

- 📘 **[คู่มือขั้นตอนการติดตั้งและใช้งานระบบ (USER_GUIDE.md)](USER_GUIDE.md)**: สรุปขั้นตอนการติดตั้ง สตาร์ท Docker, Spring Boot Backend, Apache XAMPP, ข้อมูลบัญชีผู้ใช้ทดสอบ และการแก้ปัญหาเบื้องต้น
- 📑 **[เอกสารสรุปภาพรวมและสถาปัตยกรรมระบบฉบับสมบูรณ์ (DOCUMENTATION.md)](DOCUMENTATION.md)**: สถาปัตยกรรม Full-Stack, Spring Security 6, JWT, LangChain4j, Google Gemini, PGVector, Data DDL Schema และ REST API Reference ทั้งหมด

---

## ⚡ เริ่มต้นใช้งานด่วน (Quick Start)

### 1. สตาร์ทฐานข้อมูล PostgreSQL 16 + pgvector (Docker)
> *โปรดตรวจสอบว่าได้เปิดโปรแกรม **Docker Desktop** ก่อนรันคำสั่ง*
```powershell
docker-compose up -d
```

### 2. รันระบบหลังบ้าน Spring Boot Backend (Port 8080)
```powershell
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot";
$env:PATH = "$env:JAVA_HOME\bin;C:\Users\beria\apache-maven-3.9.9\bin;$env:PATH";
.\mvnw.cmd spring-boot:run
```

### 3. เข้าใช้งานผ่าน Web Browser (XAMPP Port 80)
```text
http://localhost/ChatbotCSBSRU/
```

---

## 🔑 บัญชีทดสอบระบบ (Test Accounts)

| บทบาท (Role) | Username | Password | สิทธิ์ (JWT Role) |
|---|---|---|---|
| 🎓 **Student** | `6421100042` หรือ `student` | `1234` | `ROLE_STUDENT` |
| 👩‍🏫 **Advisor** | `ADV-01` หรือ `advisor` | `1234` | `ROLE_ADVISOR` |
| 👑 **Admin** | `admin` | `1234` | `ROLE_ADMIN` |
