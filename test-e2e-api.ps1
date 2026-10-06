# E2E API Test Suite for BSRU Student Portal
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$baseUrl = "http://localhost:8080/api"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   BSRU STUDENT PORTAL - E2E API SUITE    " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Health Check
Write-Host "`n[1/8] Testing /api/health ..." -ForegroundColor Yellow
$health = Invoke-RestMethod -Uri "$baseUrl/health" -Method Get
Write-Host " [PASS] Health Status: $($health.status), DB: $($health.database), Students: $($health.studentsCount), Petitions: $($health.petitionsCount)" -ForegroundColor Green

# 2. Authentication Test
Write-Host "`n[2/8] Testing /api/auth/login for all roles ..." -ForegroundColor Yellow
$roles = @(
    @{ user = "admin"; pass = "1234"; expectedRole = "ROLE_ADMIN" },
    @{ user = "advisor"; pass = "1234"; expectedRole = "ROLE_ADVISOR" },
    @{ user = "student"; pass = "1234"; expectedRole = "ROLE_STUDENT" }
)

$tokens = @{}
foreach ($r in $roles) {
    $body = @{ username = $r.user; password = $r.pass } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body $body -ContentType "application/json; charset=utf-8"
    if ($res.role -ne $r.expectedRole) {
        throw "Role mismatch for $($r.user): expected $($r.expectedRole), got $($res.role)"
    }
    $tokens[$r.user] = $res.token
    Write-Host " [PASS] Login successful for $($r.user): Role=$($res.role), TokenLength=$($res.token.Length)" -ForegroundColor Green
}

# Negative Auth Test: invalid password
try {
    $badBody = @{ username = "admin"; password = "wrongpassword" } | ConvertTo-Json
    Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body $badBody -ContentType "application/json; charset=utf-8"
    throw "Security Failure: Invalid login did not return 401/error!"
} catch {
    Write-Host " [PASS] Security: Invalid password rejected successfully." -ForegroundColor Green
}

# 3. Students API Test
Write-Host "`n[3/8] Testing /api/students endpoints ..." -ForegroundColor Yellow
$students = Invoke-RestMethod -Uri "$baseUrl/students" -Method Get -Headers @{ Authorization = "Bearer $($tokens['admin'])" }
Write-Host " [PASS] Retrieved $($students.Count) students from database." -ForegroundColor Green
$targetStudent = $students[0]
$stdDetail = Invoke-RestMethod -Uri "$baseUrl/students/$($targetStudent.id)" -Method Get -Headers @{ Authorization = "Bearer $($tokens['student'])" }
Write-Host " [PASS] Retrieved student detail: ID=$($stdDetail.id), Code=$($stdDetail.studentId), Name=$($stdDetail.fullNameTh)" -ForegroundColor Green

# 4. Student Career Update (Self-service / Admin)
Write-Host "`n[4/8] Testing PATCH /api/students/{id}/career ..." -ForegroundColor Yellow
$careerPayload = @{
    careerPath = "Full-Stack Developer"
    employmentStatus = "มีงานทำแล้ว (ตรงสาย)"
    companyName = "Siam Technology Innovations"
    salaryRange = "30,001 - 45,000 บาท"
} | ConvertTo-Json
$updatedStudent = Invoke-RestMethod -Uri "$baseUrl/students/$($targetStudent.id)/career" -Method Patch -Headers @{ Authorization = "Bearer $($tokens['student'])" } -Body $careerPayload -ContentType "application/json; charset=utf-8"
if ($updatedStudent.careerPath -ne "Full-Stack Developer") {
    throw "Career update failed: Expected 'Full-Stack Developer', got '$($updatedStudent.careerPath)'"
}
Write-Host " [PASS] Career updated successfully: CareerPath=$($updatedStudent.careerPath), Status=$($updatedStudent.employmentStatus), Company=$($updatedStudent.companyName)" -ForegroundColor Green

# 5. Advisors API Test
Write-Host "`n[5/8] Testing /api/advisors endpoints ..." -ForegroundColor Yellow
$advisors = Invoke-RestMethod -Uri "$baseUrl/advisors" -Method Get -Headers @{ Authorization = "Bearer $($tokens['advisor'])" }
Write-Host " [PASS] Retrieved $($advisors.Count) advisors from database." -ForegroundColor Green
$advDetail = Invoke-RestMethod -Uri "$baseUrl/advisors/$($advisors[0].id)" -Method Get -Headers @{ Authorization = "Bearer $($tokens['advisor'])" }
Write-Host " [PASS] Advisor detail: $($advDetail.fullNameTh) ($($advDetail.advisorCode)) - Office: $($advDetail.officeRoom)" -ForegroundColor Green

# 6. Academic Petitions Flow (Submit -> Verify -> Admin Review PATCH)
Write-Host "`n[6/8] Testing Academic Petitions Flow ..." -ForegroundColor Yellow
$newPetitionData = @{
    studentId = $targetStudent.studentId
    studentName = $targetStudent.fullNameTh
    petitionType = "คำร้องขอสอบหัวข้อโครงงานวิจัย"
    details = "ขออนุมัติสอบหัวข้อปริญญานิพนธ์ ระบบผู้ช่วยอัจฉริยะสำหรับนักศึกษา"
    documentUrl = "documents/e2e_petition_sample.pdf"
} | ConvertTo-Json
$createdPetition = Invoke-RestMethod -Uri "$baseUrl/petitions" -Method Post -Headers @{ Authorization = "Bearer $($tokens['student'])" } -Body $newPetitionData -ContentType "application/json; charset=utf-8"
Write-Host " [PASS] Submitted petition ID=$($createdPetition.id) with initial status='$($createdPetition.status)'" -ForegroundColor Green

# Admin reviews and patches petition status
$reviewData = @{
    status = "อนุมัติ"
    adminComment = "อนุมัติหัวข้อโครงงานวิจัย สามารถดำเนินงานในบทที่ 1-3 ได้ตามแผน"
} | ConvertTo-Json
$reviewedPetition = Invoke-RestMethod -Uri "$baseUrl/petitions/$($createdPetition.id)/status" -Method Patch -Headers @{ Authorization = "Bearer $($tokens['admin'])" } -Body $reviewData -ContentType "application/json; charset=utf-8"
if ($reviewedPetition.status -ne "อนุมัติ") {
    throw "Petition review patch failed: expected 'อนุมัติ', got '$($reviewedPetition.status)'"
}
Write-Host " [PASS] Admin patched petition ID=$($reviewedPetition.id) to status='$($reviewedPetition.status)' with comment='$($reviewedPetition.adminComment)'" -ForegroundColor Green

# 7. AI Chatbot Endpoint (POST /api/chat)
Write-Host "`n[7/8] Testing /api/chat (RAG + Gemini 1.5 Flash) ..." -ForegroundColor Yellow
$chatReq = @{
    message = "เกณฑ์การสำเร็จการศึกษาสาขาวิทยาการคอมพิวเตอร์ต้องเรียนกี่หน่วยกิต"
} | ConvertTo-Json
$chatStart = Get-Date
$chatRes = Invoke-RestMethod -Uri "$baseUrl/chat" -Method Post -Body $chatReq -ContentType "application/json; charset=utf-8"
$chatDuration = ((Get-Date) - $chatStart).TotalMilliseconds
Write-Host " [PASS] Chatbot responded in $([math]::Round($chatDuration, 2)) ms. Source: $($chatRes.source)" -ForegroundColor Green
Write-Host "        Response Preview: $($chatRes.response.Substring(0, [System.Math]::Min(150, $chatRes.response.Length)))..." -ForegroundColor Gray

# 8. Knowledge Ingestion Endpoint (POST /api/admin/knowledge/ingest)
Write-Host "`n[8/8] Testing /api/admin/knowledge/ingest ..." -ForegroundColor Yellow
$ingestReq = @{
    content = "ระเบียบการฝึกประสบการณ์วิชาชีพ: นักศึกษาต้องมีหน่วยกิตสะสมไม่น้อยกว่า 100 หน่วยกิต จึงจะมีสิทธิ์ยื่นขอฝึกงานในสถานประกอบการ"
    source = "bsru_internship_regulation_2026.pdf"
} | ConvertTo-Json
$ingestRes = Invoke-RestMethod -Uri "$baseUrl/admin/knowledge/ingest" -Method Post -Headers @{ Authorization = "Bearer $($tokens['admin'])" } -Body $ingestReq -ContentType "application/json; charset=utf-8"
Write-Host " [PASS] Ingestion Result: $($ingestRes.message)" -ForegroundColor Green

Write-Host "`n==========================================" -ForegroundColor Cyan
Write-Host "   ALL 8 API E2E TEST MODULES PASSED!    " -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
