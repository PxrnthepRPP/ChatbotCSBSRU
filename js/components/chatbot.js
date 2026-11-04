/* ================================================================
   BSRU Student Portal — Chatbot Component (Google Gemini + RAG AI)
   ================================================================
   Features:
   - Capability Transparency: structured welcome with capability chips
   - Micro-Feedback: smooth typing indicator with label text
   - Integration: Secure REST API call (POST /api/chat) with JWT Bearer Token
   - Official BSRU Form Attachments: interactive PDF preview & download cards
   - Markdown & formatting support for AI responses
   - Unhappy Path: preserves user input on error for easy retry
   - Expand/Collapse button for tall mode
   - Desktop drag-to-resize via corner handle
   - Mobile: swipe-to-dismiss via header drag
   ================================================================ */

import { confirmDialog } from './confirmDialog.js';
import { getAuthState } from '../auth.js';
import { fetchAPI, API_BASE_URL } from '../api.js';
import { loadComponentCSS } from '../css-loader.js';
import { showToast } from '../utils.js';

let _chatbotInitialized = false;

/**
 * คลังเอกสารคำร้องและแบบฟอร์มทางการ มบส. (16 รายการ) สำหรับแสดงการ์ดดาวน์โหลด PDF และรองรับโหมดออฟไลน์
 */
export const CLIENT_FORMS_CATALOG = [
    {
        code: 'ทบ.1',
        title: 'คำร้องทั่วไป (General Request Form)',
        fileName: 'R1.pdf',
        downloadName: 'ทบ.1-คำร้องทั่วไป.pdf',
        summary: 'ใช้ยื่นคำร้องทั่วไปเกี่ยวกับการศึกษาที่ไม่มีแบบฟอร์มเฉพาะ',
        pattern: /(?:ทบ\.?\s*1|ar\s*1|\br1\b)(?!\d)/i,
        keywords: ['คำร้องทั่วไป', 'general request'],
        explanation: '**ทบ.1 / AR 1 — คำร้องทั่วไป (General Request Form)**\n- **วัตถุประสงค์**: ใช้ยื่นเรื่องทั่วไปทางการศึกษาที่ไม่มีแบบฟอร์มเฉพาะ\n- **ขั้นตอน**: กรอกรายละเอียดและเหตุผล → เสนออาจารย์ที่ปรึกษา → อาจารย์ผู้สอน (ถ้าเกี่ยวข้อง) → ประธานสาขาวิชา → คณบดี → ส่งสำนักส่งเสริมวิชาการและงานทะเบียน (ติดตามผลที่ `http://mis.bsru.ac.th`)'
    },
    {
        code: 'ทบ.2',
        title: 'คำร้องขอมีบัตรประจำตัวนักศึกษา',
        fileName: 'R2.pdf',
        downloadName: 'ทบ.2-คำร้องขอมีบัตรประจำตัวนักศึกษา.pdf',
        summary: 'ขอทำบัตรนักศึกษาใหม่ กรณีหาย ชำรุด เปลี่ยนชื่อ-สกุล หรือเปลี่ยนสาขา/คณะ',
        pattern: /(?:ทบ\.?\s*2|ar\s*2|\br2\b)(?!\d)/i,
        keywords: ['บัตรนักศึกษา', 'บัตรประจำตัวนักศึกษา', 'บัตรหาย', 'บัตรชำรุด', 'ทำบัตรใหม่'],
        explanation: '**ทบ.2 / AR 2 — คำร้องขอมีบัตรประจำตัวนักศึกษา**\n- **วัตถุประสงค์**: ขอทำบัตรใหม่กรณีทำหาย/ชำรุด เปลี่ยนชื่อ-สกุล ชื่อผิดพลาด หรือเปลี่ยนสาขา/คณะ\n- **ขั้นตอน**: ยื่น ทบ.2 ตรวจสถานภาพที่สำนักส่งเสริมฯ แล้วนำไปทำบัตรที่ **ธนาคารไทยพาณิชย์ (SCB) สาขา มบส.** พร้อมสำเนาบัตรประชาชน สมุดบัญชี SCB (หายแนบใบแจ้งความ) และรูปถ่ายชุดนักศึกษา 1 นิ้ว 1 รูป'
    },
    {
        code: 'ทบ.4',
        title: 'คำร้องขอใบรายงานผลการศึกษา (Transcript)',
        fileName: 'R4.pdf',
        downloadName: 'ทบ.4-คำร้องขอใบรายงานผลการศึกษา-Transcript.pdf',
        summary: 'ขอใบรายงานผลการศึกษา (Transcript) ภาษาไทย/ภาษาอังกฤษ',
        pattern: /(?:ทบ\.?\s*4|ar\s*4|\br4\b)(?!\d)/i,
        keywords: ['ใบรายงานผลการศึกษา', 'ทรานสคริปต์', 'ทรานสคริป', 'transcript', 'ขอใบเกรด'],
        explanation: '**ทบ.4 — คำร้องขอใบรายงานผลการศึกษา (Transcript)**\n- **วัตถุประสงค์**: ขอ Transcript ภาษาไทย และ/หรือ ภาษาอังกฤษ\n- **ค่าธรรมเนียมและเงื่อนไข**: ปริญญาตรี ฉบับละ **100 บาท** · รับเอกสารได้หลังยื่น **3 วันทำการ** และต้องมารับภายใน **60 วัน** (ตรวจตัวสะกดชื่อ-สกุลไทย/อังกฤษให้ถูกต้อง)'
    },
    {
        code: 'ทบ.5',
        title: 'คำร้องขอใบรับรองสถานภาพ',
        fileName: 'R5.pdf',
        downloadName: 'ทบ.5-คำร้องขอใบรับรองสถานภาพ.pdf',
        summary: 'ขอใบรับรองการเป็นนักศึกษา ความประพฤติ ภาคเรียนสุดท้าย หรือเรียนครบหลักสูตร',
        pattern: /(?:ทบ\.?\s*5|ar\s*5|\br5\b)(?!\d)/i,
        keywords: ['ใบรับรองสถานภาพ', 'ใบรับรองการเป็นนักศึกษา', 'ใบรับรองความประพฤติ', 'ใบรับรองเรียนครบ', 'ใบรับรองเวลาเรียน', 'ขอใบรับรอง'],
        explanation: '**ทบ.5 — คำร้องขอใบรับรองสถานภาพ**\n- **ประเภทที่ขอได้ (ไทย/อังกฤษ)**: ใบรับรองการเป็นนักศึกษา, ใบรับรองความประพฤติ, ใบรับรองการเรียนเป็นภาคเรียนสุดท้าย (ต้องส่ง ทบ.17 แล้ว), ใบรับรองเรียนครบตามหลักสูตร\n- **ค่าธรรมเนียมและเงื่อนไข**: ปริญญาตรี ฉบับละ **100 บาท** · รับเอกสารหลังยื่น **3 วันทำการ** และมารับภายใน **90 วัน**'
    },
    {
        code: 'ทบ.6',
        title: 'คำร้องขอพักการเรียน / คืนสภาพ',
        fileName: 'R6.pdf',
        downloadName: 'ทบ.6-คำร้องขอพักการเรียน-คืนสภาพ.pdf',
        summary: 'ขอลาพักการเรียนเพื่อรักษาสภาพนักศึกษา หรือขอคืนสภาพการเป็นนักศึกษา',
        pattern: /(?:ทบ\.?\s*6|ar\s*6|\br6\b)(?!\d)/i,
        keywords: ['พักการเรียน', 'ลาพักการเรียน', 'ลาพักการศึกษา', 'รักษาสภาพ', 'คืนสภาพ'],
        explanation: '**ทบ.6 — คำร้องขอพักการเรียน / คืนสภาพ**\n- **วัตถุประสงค์**: ขอพักการเรียนเพื่อรักษาสภาพ หรือขอคืนสภาพกรณีไม่ได้ชำระเงินรักษาสภาพ\n- **ขั้นตอน**: ขอความเห็นชอบจากอาจารย์ที่ปรึกษา → ส่งสำนักส่งเสริมวิชาการและงานทะเบียน → ชำระค่าธรรมเนียมที่กองคลัง (เวลารักษาสภาพนับรวมในเวลาศึกษาตามหลักสูตร)'
    },
    {
        code: 'ทบ.7',
        title: 'คำร้องขอลาออก / ย้ายมหาวิทยาลัย',
        fileName: 'R7.pdf',
        downloadName: 'ทบ.7-คำร้องขอลาออก-ย้ายมหาวิทยาลัย.pdf',
        summary: 'ขอลาออกจากการเป็นนักศึกษา หรือขอย้ายไปศึกษาต่อมหาวิทยาลัยอื่น',
        pattern: /(?:ทบ\.?\s*7|ar\s*7|\br7\b)(?!\d)/i,
        keywords: ['ขอลาออก', 'ใบลาออก', 'ลาออกจาก', 'ย้ายมหาวิทยาลัย'],
        explanation: '**ทบ.7 — คำร้องขอลาออก / ย้ายมหาวิทยาลัย**\n- **เงื่อนไขย้ายมหาวิทยาลัย**: GPA ไม่ต่ำกว่า 2.00, ไม่มีเกรด I หรือ E ค้าง, ไม่ค้างชำระหนี้\n- **ขั้นตอน**: อาจารย์ที่ปรึกษาลงความเห็น → สำนักวิทยบริการฯ ตรวจหนังสือค้าง → กองคลังตรวจค่าธรรมเนียม → ส่งสำนักส่งเสริมวิชาการและงานทะเบียน'
    },
    {
        code: 'ทบ.8',
        title: 'คำร้องขอเรียนสมทบต่างมหาวิทยาลัย',
        fileName: 'R8.pdf',
        downloadName: 'ทบ.8-คำร้องขอเรียนสมทบต่างมหาวิทยาลัย.pdf',
        summary: 'ขออนุญาตลงทะเบียนเรียนรายวิชาสมทบ ณ มหาวิทยาลัยอื่น',
        pattern: /(?:ทบ\.?\s*8|ar\s*8|\br8\b)(?!\d)/i,
        keywords: ['เรียนสมทบ', 'สมทบต่างมหาวิทยาลัย'],
        explanation: '**ทบ.8 — คำร้องขอเรียนสมทบต่างมหาวิทยาลัย**\n- **ขั้นตอน**: ติดต่อประธานสาขาวิชาพิจารณาปรับเทียบวิชา → ส่งสำนักส่งเสริมฯ → คำร้องสมบูรณ์เมื่อนำใบเสร็จลงทะเบียนกับมหาวิทยาลัยอื่นมายื่นที่ฝ่ายทะเบียน'
    },
    {
        code: 'ทบ.9',
        title: 'คำร้องขอยกเว้นการเรียนรายวิชา',
        fileName: 'R9.pdf',
        downloadName: 'ทบ.9-คำร้องขอยกเว้นการเรียนรายวิชา.pdf',
        summary: 'ขอยกเว้นรายวิชาจากประวัติการศึกษาเดิม (เกรดไม่ต่ำกว่า C หรือ ผ.)',
        pattern: /(?:ทบ\.?\s*9|ar\s*9|\br9\b)(?!\d)/i,
        keywords: ['ยกเว้นการเรียนรายวิชา', 'ยกเว้นรายวิชา', 'ขอยกเว้นวิชา'],
        explanation: '**ทบ.9 — คำร้องขอยกเว้นการเรียนรายวิชา**\n- **เงื่อนไข**: แนบสำเนาผลการเรียนและคำอธิบายรายวิชา · เกรดวิชาเดิมไม่ต่ำกว่า C หรือ ผ. · ยกเว้นได้ไม่เกิน 2 ใน 3 ของหน่วยกิตขั้นต่ำ และไม่มีสิทธิ์รับเกียรตินิยม'
    },
    {
        code: 'ทบ.10',
        title: 'คำร้องขอยกเว้นกลุ่มวิชาศึกษาทั่วไป',
        fileName: 'R10.pdf',
        downloadName: 'ทบ.10-คำร้องขอยกเว้นกลุ่มวิชาศึกษาทั่วไป.pdf',
        summary: 'ขอยกเว้นกลุ่มวิชาศึกษาทั่วไป สำหรับผู้สำเร็จการศึกษาระดับ ปวส. หรือสูงกว่า',
        pattern: /(?:ทบ\.?\s*10|ar\s*10|\br10\b)(?!\d)/i,
        keywords: ['ยกเว้นกลุ่มวิชาศึกษาทั่วไป', 'ยกเว้นวิชาศึกษาทั่วไป', 'เทียบโอน ปวส', 'จบ ปวส'],
        explanation: '**ทบ.10 — คำร้องขอยกเว้นกลุ่มวิชาศึกษาทั่วไป**\n- **เงื่อนไข**: สำหรับผู้สำเร็จการศึกษา **ปวส. หรือสูงกว่า** · แนบ Transcript ที่ระบุวันสำเร็จการศึกษา · ยกเว้น 18 หรือ 30 หน่วยกิต และไม่มีสิทธิ์รับเกียรตินิยม'
    },
    {
        code: 'ทบ.11',
        title: 'คำร้องขอโอนผลการเรียน',
        fileName: 'R11.pdf',
        downloadName: 'ทบ.11-คำร้องขอโอนผลการเรียน.pdf',
        summary: 'ขอโอนผลการเรียนกรณีเคยศึกษาที่ มบส. แล้วกลับเข้ามาศึกษาใหม่ในระดับเดียวกัน',
        pattern: /(?:ทบ\.?\s*11|ar\s*11|\br11\b)(?!\d)/i,
        keywords: ['โอนผลการเรียน', 'ขอโอนเกรด', 'เทียบโอนผลการเรียน'],
        explanation: '**ทบ.11 — คำร้องขอโอนผลการเรียน**\n- **เงื่อนไข**: สำหรับผู้ที่เคยศึกษาที่ มบส. แล้วกลับเข้ามาศึกษาใหม่ในระดับเดียวกัน · ไม่เคยถูกสั่งให้ออกเพราะความประพฤติ · รายวิชาที่โอนต้องสอบได้มาไม่เกิน 10 ปี'
    },
    {
        code: 'ทบ.12',
        title: 'คำร้องขอยกเลิกรายวิชา (ถอนวิชา W)',
        fileName: 'R12.pdf',
        downloadName: 'ทบ.12-คำร้องขอยกเลิกรายวิชา.pdf',
        summary: 'ขอยกเลิก/ถอนรายวิชาที่ลงทะเบียนเรียนไว้ (บันทึกผลการเรียนเป็น W)',
        pattern: /(?:ทบ\.?\s*12|ar\s*12|\br12\b)(?!\d)/i,
        keywords: ['ยกเลิกรายวิชา', 'ถอนรายวิชา', 'ถอนวิชา', 'ดรอปวิชา', 'ติด w', 'ขอถอน'],
        explanation: '**ทบ.12 — คำร้องขอยกเลิกรายวิชา (ถอนรายวิชาติด W)**\n- **ขั้นตอน**: แนบหลักฐานตารางเรียน → อาจารย์ที่ปรึกษาลงนาม (กรณียกเลิกล่าช้าต้องผ่านอาจารย์ผู้สอน → ประธานสาขาวิชา → คณบดี เพิ่มเติม) → ส่งกองคลังและงานทะเบียน'
    },
    {
        code: 'ทบ.14',
        title: 'คำร้องขอเปิดรายวิชาเป็นกรณีพิเศษ',
        fileName: 'R14.pdf',
        downloadName: 'ทบ.14-คำร้องขอเปิดรายวิชาเป็นกรณีพิเศษ.pdf',
        summary: 'ขอเปิดรายวิชาเป็นกรณีพิเศษ (เช่น นักศึกษาภาคเรียนสุดท้ายก่อนจบการศึกษา)',
        pattern: /(?:ทบ\.?\s*14|ar\s*14|\br14\b)(?!\d)/i,
        keywords: ['เปิดรายวิชาเป็นกรณีพิเศษ', 'เปิดวิชาเป็นกรณีพิเศษ', 'เปิดหมู่เรียนพิเศษ', 'ขอเปิดวิชา', 'ขอเปิดเซค'],
        explanation: '**ทบ.14 — คำร้องขอเปิดรายวิชาเป็นกรณีพิเศษ**\n- **ขั้นตอน**: เสนอประธานสาขาวิชากำหนดวัน-เวลาและอาจารย์ผู้สอน → คณบดี → รองอธิการบดีฝ่ายวิชาการอนุมัติ → นักศึกษาต้องลงทะเบียนเรียนด้วยตนเองในช่วงเวลาที่กำหนด'
    },
    {
        code: 'ทบ.15',
        title: 'คำร้องขอเปลี่ยนสาขาวิชา / คณะ',
        fileName: 'R15.pdf',
        downloadName: 'ทบ.15-คำร้องขอเปลี่ยนสาขาวิชา.pdf',
        summary: 'ขอเปลี่ยนสาขาวิชา และ/หรือ ขอเปลี่ยนคณะ (มีผลในภาคเรียนถัดไป)',
        pattern: /(?:ทบ\.?\s*15|ar\s*15|\br15\b)(?!\d)/i,
        keywords: ['เปลี่ยนสาขา', 'ย้ายสาขา', 'เปลี่ยนคณะ', 'ย้ายคณะ'],
        explanation: '**ทบ.15 — คำร้องขอเปลี่ยนสาขาวิชา / คณะ**\n- **เงื่อนไข**: ไม่ค้างค่าเทอม ยื่นได้ตั้งแต่เทอม 2 ปี 1 (มีผลภาคถัดไป) · ผ่าน 7 ขั้นตอน: สำนักวิทยบริการฯ → กองคลัง → อาจารย์ที่ปรึกษาเดิม → ประธานสาขาเดิม → ประธานสาขาใหม่ → คณบดีคณะใหม่ → ผอ.สำนักส่งเสริมฯ'
    },
    {
        code: 'ทบ.17',
        title: 'คำร้องแจ้งขอเรียนเป็นภาคเรียนสุดท้าย',
        fileName: 'R17.pdf',
        downloadName: 'ทบ.17-คำร้องแจ้งขอเรียนเป็นภาคเรียนสุดท้าย.pdf',
        summary: 'แจ้งลงทะเบียนเรียนเป็นภาคเรียนสุดท้ายเพื่อขอสำเร็จการศึกษา',
        pattern: /(?:ทบ\.?\s*17|ar\s*17|\br17\b)(?!\d)/i,
        keywords: ['เรียนเป็นภาคเรียนสุดท้าย', 'ภาคเรียนสุดท้าย', 'ภาคสุดท้าย', 'แจ้งจบ', 'ขอจบการศึกษา', 'ขอสำเร็จการศึกษา'],
        explanation: '**ทบ.17 — คำร้องแจ้งขอเรียนเป็นภาคเรียนสุดท้าย (แจ้งจบ)**\n- **รายการตรวจสอบ 8 ข้อ**: (1) ลงทะเบียนครบหลักสูตร (2) ตรวจประวัติ MIS ไทย/อังกฤษ (3) ชำระค่าเทอมครบ (4) ผลสอบ CEFR (5) ผลอบรม/สอบ DL (6) กิจกรรมครบเกณฑ์ (7) คะแนนความประพฤติ 100 (8) ไม่ค้างอุปกรณ์กิจการนักศึกษา'
    },
    {
        code: 'กยศ./กรอ.',
        title: 'แบบฟอร์มบันทึกการทำกิจกรรมโครงการจิตอาสา (กยศ./กรอ.)',
        fileName: 'volunteer-form.pdf',
        downloadName: 'แบบฟอร์มบันทึกกิจกรรมจิตอาสา-กยศ-กรอ.pdf',
        summary: 'บันทึกชั่วโมงและภาพกิจกรรมจิตอาสาสำหรับผู้กู้ยืม กยศ. และ กรอ.',
        pattern: /(?:volunteer-form|แบบฟอร์มจิตอาสา)/i,
        keywords: ['แบบฟอร์มจิตอาสา', 'โครงการจิตอาสา', 'บันทึกจิตอาสา', 'ชั่วโมงจิตอาสา', 'กยศ', 'กรอ'],
        explanation: '**แบบฟอร์มบันทึกการทำกิจกรรมโครงการจิตอาสา (กยศ. / กรอ.)**\n- **สิ่งที่ต้องทำ**: กรอกข้อมูลผู้กู้ยืม → ติดภาพถ่ายขณะทำกิจกรรม **2 ภาพ** → บันทึกรายละเอียด วัน เวลา สถานที่ และชั่วโมง → ให้ผู้รับรองลงนามพร้อม **ประทับตราหน่วยงาน**'
    },
    {
        code: 'ใบลา',
        title: 'ใบลาป่วย / ลากิจ ของนักศึกษา BSRU',
        fileName: 'leave-form.pdf',
        downloadName: 'ใบลาป่วย-ลากิจ-นักศึกษา-BSRU.pdf',
        summary: 'แบบฟอร์มขอลาป่วยหรือลากิจสำหรับยื่นต่ออาจารย์ผู้สอนประจำรายวิชา',
        pattern: /(?:leave-form|ใบลา|ลาป่วย|ลากิจ)/i,
        keywords: ['ใบลา', 'ขอใบลา', 'ใบลาป่วย', 'ใบลากิจ', 'ขอลาป่วย', 'ขอลากิจ', 'ลาป่วย', 'ลากิจ', 'ใบลาเรียน', 'ลาหยุดเรียน', 'การลา', 'แบบฟอร์มใบลา'],
        explanation: '**ใบลาป่วย / ลากิจ ของนักศึกษา BSRU**\n- **เงื่อนไข**: ยื่นต่ออาจารย์ผู้สอนประจำรายวิชา · ต้องมีคำรับรองและลายมือชื่อผู้ปกครองพร้อมเบอร์โทรศัพท์ · **กรณีลาป่วยเกิน 3 วัน ต้องแนบใบรับรองแพทย์**'
    }
];

function isGeneralFormCatalogQuery(q) {
    return (
        q.includes('เอกสารทั้งหมด') || q.includes('แบบฟอร์มทั้งหมด') || q.includes('คำร้องทั้งหมด') ||
        q.includes('มีแบบฟอร์มอะไร') || q.includes('มีแบบฟอร์มคำร้อง') || q.includes('มีเอกสารอะไร') ||
        q.includes('มีใบคำร้องอะไร') || q.includes('ขอแบบฟอร์มคำร้อง') || q.includes('รวมแบบฟอร์ม') ||
        q.includes('ดาวน์โหลดแบบฟอร์ม') || q.includes('ดาวน์โหลดเอกสาร') || q.includes('ดาวน์โหลดไฟล์') ||
        q.includes('เอกสาร ทบ') || q.includes('ขอ ทบ') || q.includes('แบบฟอร์ม ทบ') ||
        q.includes('ขอเอกสาร') || q.includes('ขอแบบฟอร์ม') || q.includes('ขอฟอร์ม') ||
        q.includes('ขอใบคำร้อง') || q.includes('ส่งเอกสาร') || q.includes('ส่งแบบฟอร์ม') ||
        q.includes('ส่งไฟล์') || q.includes('ขอไฟล์') || q.includes('เอกสารคำร้อง') ||
        q.includes('แบบฟอร์มคำร้อง') || q.includes('ใบคำร้องทั้งหมด') ||
        (q.includes('เอกสาร') && (q.includes('ขอ') || q.includes('โหลด') || q.includes('ดาวน์โหลด') || q.includes('ส่ง') || q.includes('ดู') || q.includes('มี'))) ||
        (q.includes('แบบฟอร์ม') && (q.includes('ขอ') || q.includes('โหลด') || q.includes('ดาวน์โหลด') || q.includes('ส่ง') || q.includes('ดู') || q.includes('มี'))) ||
        (q.includes('ทบ') && (q.includes('ขอ') || q.includes('โหลด') || q.includes('ดาวน์โหลด') || q.includes('ส่ง') || q.includes('มี')))
    );
}

export function matchClientForms(query) {
    if (!query || !query.trim()) return [];
    const q = query.toLowerCase().trim();
    const matched = [];
    for (const item of CLIENT_FORMS_CATALOG) {
        if (item.pattern.test(query) || item.keywords.some(kw => q.includes(kw.toLowerCase()))) {
            matched.push(item);
        }
    }
    if (matched.length === 0 && isGeneralFormCatalogQuery(q)) {
        return [...CLIENT_FORMS_CATALOG];
    }
    return matched;
}

function inferAttachmentsFromBotText(text) {
    if (!text) return [];
    if (text.includes('รายการแบบฟอร์มคำร้องและเอกสารทางการของนักศึกษา BSRU ทั้งหมด')) {
        return [...CLIENT_FORMS_CATALOG];
    }
    // Only infer when the bot message explicitly explains or references official forms
    if (!text.includes('เปิดดู PDF') && !text.includes('ดาวน์โหลด') && !/(?:ทบ\.\d+|ใบลาป่วย|โครงการจิตอาสา)/.test(text)) {
        return [];
    }
    // Ignore casual examples in sentences (e.g. เช่น ทบ.1, ทบ.4 ฯลฯ)
    const cleanedText = text.replace(/(?:เช่น|ตัวอย่างเช่น|อาทิเช่น)[^\n.]+/g, '');
    const matched = [];
    for (const item of CLIENT_FORMS_CATALOG) {
        if (item.pattern.test(cleanedText)) {
            matched.push(item);
        }
    }
    return matched;
}

/** Open the chatbot and send a question, e.g. from the advisor's "ให้ AI วิเคราะห์" buttons */
export function askChatbot(question) {
    window.dispatchEvent(new CustomEvent('bsru:ask-chatbot', { detail: question }));
}

/**
 * Escape HTML characters to prevent XSS
 */
export function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Check if a line is a markdown table separator (e.g. |---|---| or | :--- | :---: |)
 */
function isTableSeparator(line) {
    if (!line || !line.includes('|')) return false;
    let trimmed = line.trim();
    if (trimmed.startsWith('|')) trimmed = trimmed.slice(1);
    if (trimmed.endsWith('|')) trimmed = trimmed.slice(0, -1);
    const parts = trimmed.split('|').map(p => p.trim());
    if (parts.length === 0) return false;
    return parts.every(p => /^:?-+:?$/.test(p));
}

function isTableRow(line) {
    return Boolean(line && line.includes('|'));
}

function buildTableHtml(lines) {
    function splitRow(row) {
        let trimmed = row.trim();
        if (trimmed.startsWith('|')) trimmed = trimmed.slice(1);
        if (trimmed.endsWith('|')) trimmed = trimmed.slice(0, -1);
        return trimmed.split('|').map(c => c.trim());
    }

    const headers = splitRow(lines[0]);
    const sepParts = splitRow(lines[1]);

    const alignments = sepParts.map(p => {
        if (p.startsWith(':') && p.endsWith(':')) return 'center';
        if (p.endsWith(':')) return 'right';
        if (p.startsWith(':')) return 'left';
        return '';
    });

    let html = '<div class="cw-table-wrapper"><table class="cw-md-table"><thead><tr>';
    headers.forEach((h, idx) => {
        const align = alignments[idx] ? ` style="text-align: ${alignments[idx]};"` : '';
        html += `<th${align}>${h}</th>`;
    });
    html += '</tr></thead><tbody>';

    for (let r = 2; r < lines.length; r++) {
        const cells = splitRow(lines[r]);
        if (cells.length === 1 && cells[0] === '') continue;
        html += '<tr>';
        for (let c = 0; c < headers.length; c++) {
            const cellVal = cells[c] !== undefined ? cells[c] : '';
            const align = alignments[c] ? ` style="text-align: ${alignments[c]};"` : '';
            html += `<td${align}>${cellVal}</td>`;
        }
        html += '</tr>';
    }

    html += '</tbody></table></div>';
    return html;
}

function renderMarkdownTables(text) {
    const lines = text.split(/\r?\n/);
    const output = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];
        if (i + 1 < lines.length && isTableRow(line) && isTableSeparator(lines[i + 1])) {
            const tableLines = [line, lines[i + 1]];
            i += 2;
            while (i < lines.length && isTableRow(lines[i])) {
                tableLines.push(lines[i]);
                i++;
            }
            output.push(buildTableHtml(tableLines));
        } else {
            output.push(line);
            i++;
        }
    }
    return output.join('\n');
}

/**
 * Robust & XSS-safe Markdown parser for chat messages
 */
export function renderSafeMarkdown(text) {
    if (!text) return '';
    let safe = escapeHtml(text);

    // 1. Code blocks (extract before formatting)
    const codeBlocks = [];
    safe = safe.replace(/```([a-zA-Z0-9_-]*)\r?\n([\s\S]*?)```/g, (match, lang, code) => {
        const idx = codeBlocks.length;
        const langClass = lang ? ` class="language-${lang.trim()}"` : '';
        codeBlocks.push(`<pre class="cw-code-block"><code${langClass}>${code.trim()}</code></pre>`);
        return `\n%%%CODEBLOCK${idx}%%%\n`;
    });

    // 2. Inline code (extract before bold/italics)
    const inlineCodes = [];
    safe = safe.replace(/`([^`\n]+)`/g, (match, code) => {
        const idx = inlineCodes.length;
        inlineCodes.push(`<code class="cw-inline-code">${code}</code>`);
        return `%%%INLINECODE${idx}%%%`;
    });

    // 3. Markdown tables
    safe = renderMarkdownTables(safe);

    // 4. Headings
    safe = safe.replace(/^(?:&gt;\s*)?####\s+(.+)$/gm, '<h4 class="cw-md-h4">$1</h4>');
    safe = safe.replace(/^(?:&gt;\s*)?###\s+(.+)$/gm, '<h3 class="cw-md-h3">$1</h3>');
    safe = safe.replace(/^(?:&gt;\s*)?##\s+(.+)$/gm, '<h2 class="cw-md-h2">$1</h2>');
    safe = safe.replace(/^(?:&gt;\s*)?#\s+(.+)$/gm, '<h1 class="cw-md-h1">$1</h1>');

    // 5. Lists
    safe = safe.replace(/(?:^[ \t]*[-*•]\s+(.+)(?:\r?\n|$))+/gm, (match) => {
        const items = match.trim().split(/\r?\n/).map(line => {
            return line.replace(/^[ \t]*[-*•]\s+/, '').trim();
        }).filter(Boolean);
        return '<ul class="cw-md-ul">' + items.map(it => `<li>${it}</li>`).join('') + '</ul>\n';
    });

    safe = safe.replace(/(?:^[ \t]*\d+\.\s+(.+)(?:\r?\n|$))+/gm, (match) => {
        const items = match.trim().split(/\r?\n/).map(line => {
            return line.replace(/^[ \t]*\d+\.\s+/, '').trim();
        }).filter(Boolean);
        return '<ol class="cw-md-ol">' + items.map(it => `<li>${it}</li>`).join('') + '</ol>\n';
    });

    // 6. Bold & Italics
    safe = safe.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    safe = safe.replace(/__(.+?)__/g, '<strong>$1</strong>');
    safe = safe.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
    safe = safe.replace(/_([^_\n]+)_/g, '<em>$1</em>');

    // 7. Line breaks
    safe = safe.replace(/\r?\n/g, '<br>');

    // Clean up unnecessary <br> around block-level elements
    const blockTags = 'div|table|thead|tbody|tr|th|td|ul|ol|li|h1|h2|h3|h4|h5|h6|pre';
    const blockOpenRegex = new RegExp(`(<br>\\s*)+(<\\/?(?:${blockTags})[^>]*>)`, 'gi');
    const blockCloseRegex = new RegExp(`(<\\/(?:${blockTags})>)(\\s*<br>)+`, 'gi');
    safe = safe.replace(blockOpenRegex, '$2');
    safe = safe.replace(blockCloseRegex, '$1');
    safe = safe.replace(/(<br>\s*){3,}/gi, '<br><br>');

    // 8. Restore code tokens
    inlineCodes.forEach((codeHtml, idx) => {
        safe = safe.split(`%%%INLINECODE${idx}%%%`).join(codeHtml);
    });
    codeBlocks.forEach((blockHtml, idx) => {
        safe = safe.split(`%%%CODEBLOCK${idx}%%%`).join(blockHtml);
    });

    return safe.trim();
}

/* ── Chat lifetime: one conversation per login ──
   History is kept on the server (so a refresh or reopening the panel in the same visit keeps it),
   but every login and every logout starts over: the server copy and the AI memory are deleted
   and the panel is emptied. */
let resetChatView = () => {};

/** Delete the signed-in user's chat history + AI memory and empty the panel. Never throws. */
export async function resetChatSession() {
    try {
        await fetchAPI('/chat/history', 'DELETE', null, 5000);
    } catch (e) {
        console.warn('⚠️ [Chatbot] Could not clear chat history:', e.message);
    }
    resetChatView();
}

export function initChatbot() {
    if (_chatbotInitialized) return;
    _chatbotInitialized = true;

    const chatbotFab = document.getElementById('chatbotFab');
    const chatbotWindow = document.getElementById('chatbotWindow');
    const cwCloseBtn = document.getElementById('cwCloseBtn');
    const cwExpandBtn = document.getElementById('cwExpandBtn');
    const cwClearBtn = document.getElementById('cwClearBtn');
    const cwHeader = document.getElementById('cwHeader');
    const cwMessages = document.getElementById('cwMessages');
    const cwInput = document.getElementById('cwInput');
    const cwSendBtn = document.getElementById('cwSendBtn');
    const fabBadge = document.getElementById('fabBadge');

    let chatbotOpen = false;
    let cwWaiting = false;
    let welcomeShown = false;
    let historyLoaded = false;

    if (!chatbotFab) return;

    resetChatView = () => {
        cwMessages.innerHTML = '';
        historyLoaded = false;
        welcomeShown = false;
        if (chatbotOpen) loadChatHistory();   // shows the welcome message for the empty history
    };

    const GUEST_SESSION_STORAGE_KEY = 'bsru_chat_guest_id';

    function generateGuestId() {
        if (window.crypto?.randomUUID) return window.crypto.randomUUID();
        // crypto.randomUUID ใช้ได้เฉพาะ HTTPS/localhost — เปิดผ่าน IP ในวง LAN (http) ใช้ getRandomValues แทน
        const bytes = new Uint8Array(16);
        window.crypto.getRandomValues(bytes);
        return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * ผู้ใช้ที่ login: คืน null — server ใช้ตัวตนจาก JWT เท่านั้น
     * ผู้ใช้ทั่วไป: id สุ่มของแท็บนี้ (เก็บใน sessionStorage ประวัติจึงอยู่แค่ในแท็บนี้)
     */
    function getSessionId() {
        const state = getAuthState();
        if (state.user) return null;
        let guestId = null;
        try { guestId = sessionStorage.getItem(GUEST_SESSION_STORAGE_KEY); } catch (e) { /* storage blocked */ }
        if (!guestId || !/^[A-Za-z0-9-]{16,64}$/.test(guestId)) {
            guestId = generateGuestId();
            try { sessionStorage.setItem(GUEST_SESSION_STORAGE_KEY, guestId); } catch (e) { /* storage blocked */ }
        }
        return guestId;
    }

    function chatHistoryEndpoint() {
        const sessionId = getSessionId();
        return sessionId ? `/chat/history?sessionId=${encodeURIComponent(sessionId)}` : '/chat/history';
    }

    async function loadChatHistory() {
        if (historyLoaded) return;
        try {
            console.log('📜 [Chatbot] Loading chat history...');
            const data = await fetchAPI(chatHistoryEndpoint(), 'GET', null, 10000);
            const list = Array.isArray(data) ? data : (data?.history || []);
            if (Array.isArray(list) && list.length > 0) {
                historyLoaded = true;
                welcomeShown = true;
                cwMessages.innerHTML = '';
                list.forEach(entry => {
                    const role = (entry.role || (entry.sender?.toLowerCase() === 'user' ? 'user' : 'bot'));
                    const text = entry.messageText || entry.message || '';
                    let sources = [];
                    if (entry.sources) {
                        try {
                            sources = typeof entry.sources === 'string' ? JSON.parse(entry.sources) : entry.sources;
                        } catch (e) {
                            sources = [entry.sources];
                        }
                    }
                    const attachments = role === 'bot'
                        ? (Array.isArray(entry.attachments) && entry.attachments.length ? entry.attachments : inferAttachmentsFromBotText(text))
                        : [];
                    addCwMsg(role, text, sources, attachments);
                });
                return;
            }
        } catch (e) {
            console.warn('⚠️ [Chatbot] Could not load prior chat history:', e.message);
        }
        if (!welcomeShown && !cwMessages.children.length) {
            showWelcomeMessage();
            welcomeShown = true;
        }
    }

    // Load chatbot CSS dynamically
    loadComponentCSS('chatbot');

    // ── Open / Close ──
    chatbotFab.addEventListener('click', toggleChatbot);
    if (cwCloseBtn) cwCloseBtn.addEventListener('click', toggleChatbot);

    function toggleChatbot() {
        chatbotOpen = !chatbotOpen;
        chatbotWindow.classList.toggle('open', chatbotOpen);
        chatbotFab.classList.toggle('open', chatbotOpen);
        if (chatbotOpen) {
            if (fabBadge) fabBadge.classList.add('hidden');
            cwInput.focus();
            if (!historyLoaded) {
                loadChatHistory();
            } else if (!welcomeShown && !cwMessages.children.length) {
                showWelcomeMessage();
                welcomeShown = true;
            }
        }
    }

    // ── Clear Chat History ──
    if (cwClearBtn) {
        cwClearBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!await confirmDialog('คุณต้องการล้างประวัติการสนทนาทั้งหมดใช่หรือไม่?')) return;
            cwClearBtn.disabled = true;
            try {
                await fetchAPI(chatHistoryEndpoint(), 'DELETE', null, 10000);
                cwMessages.innerHTML = '';
                showWelcomeMessage();
                welcomeShown = true;
                historyLoaded = true;
                showToast('info', 'ล้างประวัติการสนทนาเรียบร้อยแล้ว');
            } catch (err) {
                console.error('❌ [Chatbot] Failed to clear history:', err);
                showToast('error', 'ไม่สามารถล้างประวัติการสนทนาได้');
            } finally {
                cwClearBtn.disabled = false;
            }
        });
    }

    // ── Expand / Collapse ──
    if (cwExpandBtn) {
        cwExpandBtn.addEventListener('click', () => {
            const isExpanded = chatbotWindow.classList.toggle('expanded');
            cwExpandBtn.title = isExpanded ? 'ย่อหน้าต่าง' : 'ขยายหน้าต่าง';
            cwExpandBtn.setAttribute('aria-label', isExpanded ? 'ย่อหน้าต่าง' : 'ขยายหน้าต่าง');
        });
    }

    // Double-click header to toggle expanded mode
    if (cwHeader) {
        cwHeader.addEventListener('dblclick', (e) => {
            if (e.target.closest('button')) return;
            if (cwExpandBtn) cwExpandBtn.click();
        });
    }

    // ESC key closes the chatbot window
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && chatbotOpen) {
            toggleChatbot();
        }
    });

    // ── Mobile swipe-to-dismiss ──
    let _swipeInitialized = false;
    function initMobileSwipeDismiss(header) {
        if (_swipeInitialized) return;
        _swipeInitialized = true;

        let touchStartY = 0;
        let currentTranslateY = 0;

        header.addEventListener('touchstart', (e) => {
            touchStartY = e.touches[0].clientY;
            chatbotWindow.style.transition = 'none';
        }, { passive: true });

        header.addEventListener('touchmove', (e) => {
            const dy = e.touches[0].clientY - touchStartY;
            if (dy > 0) {
                currentTranslateY = dy;
                chatbotWindow.style.transform = `translateY(${dy}px)`;
            }
        }, { passive: true });

        header.addEventListener('touchend', () => {
            chatbotWindow.style.transition = '';
            if (currentTranslateY > 120) {
                toggleChatbot(); // Close on swipe-down
            } else {
                chatbotWindow.style.transform = '';
            }
            currentTranslateY = 0;
        });
    }

    // ── Mobile: swipe-down header to dismiss ──
    if (cwHeader && isMobile()) {
        initMobileSwipeDismiss(cwHeader);
    }

    // Re-check on resize (orientation change etc.)
    window.addEventListener('resize', () => {
        if (isMobile() && cwHeader) {
            initMobileSwipeDismiss(cwHeader);
        }
    });

    function isMobile() {
        return window.innerWidth <= 560;
    }

    // ── Welcome Message ──
    function showWelcomeMessage() {
        if (cwMessages.querySelector('.cw-welcome')) return;
        const welcomeDiv = document.createElement('div');
        welcomeDiv.className = 'cw-welcome';
        welcomeDiv.innerHTML = `
            <div class="cw-welcome-header">
                <div class="cw-welcome-avatar">
                    <svg viewBox="0 0 24 24" fill="none"><path d="M12 2C8.686 2 6 4.686 6 8V10H5C4.448 10 4 10.448 4 11V19C4 19.552 4.448 20 5 20H19C19.552 20 20 19.552 20 19V11C20 10.448 19.552 10 19 10H18V8C18 4.686 15.314 2 12 2ZM9 13C9.552 13 10 13.448 10 14V16C10 16.552 9.552 17 9 17C8.448 17 8 16.552 8 16V14C8 13.448 8.448 13 9 13ZM15 13C15.552 13 16 13.448 16 14V16C16 16.552 15.552 17 15 17C14.448 17 14 16.552 14 16V14C14 13.448 14.448 13 15 13ZM8 8C8 5.791 9.791 4 12 4C14.209 4 16 5.791 16 8V10H8V8Z" fill="currentColor"/></svg>
                </div>
                <div>
                    <h4>สวัสดีครับ! 👋 ผมคือ BSRU CS AI Assistant</h4>
                    <p>ผู้ช่วยอัจฉริยะสาขาวิทยาการคอมพิวเตอร์ BSRU</p>
                </div>
            </div>
            <div class="cw-welcome-body">
                <span class="cw-welcome-label">สอบถามข้อมูลหรือขอเอกสารแบบฟอร์มได้เลยครับ:</span>
                <div class="cw-capabilities">
                    <button class="cw-capability-chip" data-query="มีแบบฟอร์มคำร้องและเอกสารอะไรให้ดาวน์โหลดบ้าง">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        <span>ขอเอกสาร/ใบคำร้อง (ทบ.)</span>
                    </button>
                    <button class="cw-capability-chip" data-query="ขั้นตอนการยื่นคำร้องวิชาการ">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        <span>ยื่นคำร้องวิชาการ</span>
                    </button>
                    <button class="cw-capability-chip" data-query="ตารางเรียนและตารางสอบ">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        <span>ตารางเรียน/สอบ</span>
                    </button>
                    <button class="cw-capability-chip" data-query="ตรวจสอบผลการเรียนและ GPA">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                        <span>ผลการเรียน</span>
                    </button>
                    <button class="cw-capability-chip" data-query="วางแผนลงทะเบียนเรียนเทอมถัดไปให้หน่อย">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                        <span>วางแผนลงทะเบียนเรียน</span>
                    </button>
                    <button class="cw-capability-chip" data-query="สถิติสายอาชีพของบัณฑิต">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                        <span>สถิติสายอาชีพบัณฑิต</span>
                    </button>
                </div>
            </div>
        `;
        cwMessages.appendChild(welcomeDiv);
        cwMessages.scrollTop = cwMessages.scrollHeight;

        // Make capability chips clickable
        welcomeDiv.querySelectorAll('.cw-capability-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const query = chip.dataset.query;
                cwInput.value = query;
                cwSendBtn.disabled = false;
                handleCwSend();
            });
        });
    }

    // Other pages can open the chatbot with a question (see askChatbot below)
    window.addEventListener('bsru:ask-chatbot', (e) => {
        if (!chatbotOpen) toggleChatbot();
        cwInput.value = e.detail;
        cwSendBtn.disabled = false;
        handleCwSend();
    });

    cwSendBtn.addEventListener('click', handleCwSend);
    cwInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); handleCwSend(); } });
    cwInput.addEventListener('input', () => { cwSendBtn.disabled = !cwInput.value.trim() || cwWaiting; });

    function getSmartOfflineReply(query, matchedForms = []) {
        if (matchedForms.length > 0) {
            if (matchedForms.length === CLIENT_FORMS_CATALOG.length) {
                const listText = CLIENT_FORMS_CATALOG
                    .map(f => `- **${f.code}** — ${f.title}: ${f.summary}`)
                    .join('\n');
                return `📄 **รายการแบบฟอร์มคำร้องและเอกสารทางการของนักศึกษา BSRU ทั้งหมด ${CLIENT_FORMS_CATALOG.length} รายการ**\nคุณสามารถกด **เปิดดู PDF** หรือ **ดาวน์โหลด** เอกสารที่ต้องการจากการ์ดไฟล์ด้านล่างได้เลยครับ:\n\n${listText}`;
            }
            const details = matchedForms.map(f => f.explanation).join('\n\n---\n\n');
            return `จัดเตรียมไฟล์เอกสารที่คุณต้องการให้เรียบร้อยแล้วครับ 📄 สามารถกด **เปิดดู PDF** หรือ **ดาวน์โหลดเอกสาร** จากการ์ดด้านล่างได้เลย โดยมีรายละเอียดและขั้นตอนดังนี้ครับ:\n\n${details}`;
        }

        const q = (query || '').toLowerCase().trim();
        if (q.includes('คำร้อง') || q.includes('ยื่นคำร้อง') || q.includes('petition')) {
            return "สำหรับการยื่นคำร้องวิชาการ คุณสามารถไปที่เมนู **'ยื่นคำร้องวิชาการ'** ในแถบเมนูด้านซ้าย เลือกประเภทคำร้อง กรอกรายละเอียด และแนบไฟล์ PDF จากนั้นกดส่งคำร้องได้ทันทีครับ\n\n📄 หากต้องการไฟล์แบบฟอร์มทางการ สามารถพิมพ์ขอได้ทันที เช่น **ทบ.1–ทบ.17**, **ใบลาป่วย/ลากิจ**, หรือ **แบบฟอร์มจิตอาสา กยศ./กรอ.** ครับ";
        }
        if (q.includes('สายอาชีพ') || q.includes('อาชีพ') || q.includes('ทำงาน') || q.includes('บัณฑิต') || q.includes('career') || q.includes('งาน')) {
            return "📊 **สถิติสายอาชีพของบัณฑิต สาขาวิชาวิทยาการคอมพิวเตอร์ BSRU**:\nส่วนใหญ่ประกอบอาชีพตรงสาย (IT & CS) เช่น:\n- 💻 **Full-Stack Developer**\n- 📊 **Data Analyst**\n- ⚙️ **DevOps Engineer**\n- ☁️ **Cloud Architect**\n- 🎨 **UX/UI Designer**\n- 🔒 **Cybersecurity Analyst**\nรวมถึงกลุ่ม **ธุรกิจส่วนตัว / สตาร์ทอัพ**\n\n📌 สำหรับบัณฑิตที่สำเร็จการศึกษา สามารถกดอัปเดตสายอาชีพของท่านได้ที่เมนู **'ตรวจสอบจบ'** หรือ **'ประวัตินักศึกษา'** เพื่อร่วมเป็นส่วนหนึ่งในการพัฒนาหลักสูตรครับ";
        }
        if (q.includes('เกรด') || q.includes('ผลการเรียน') || q.includes('gpa')) {
            return "คุณสามารถตรวจสอบผลการเรียนรายภาคเรียนและเกรดเฉลี่ยสะสม (GPA) ได้ที่เมนู **'ผลการเรียน'** โดยระบบจะแสดงรายการวิชาที่ผ่าน หน่วยกิตสะสม และผลการเรียนย้อนหลังครบถ้วนครับ";
        }
        if (q.includes('ตารางเรียน') || q.includes('ตารางสอบ') || q.includes('schedule')) {
            return "ตารางเรียนและตารางสอบภาคเรียนปัจจุบัน สามารถดูได้ที่เมนู **'ตารางเรียน'** ในรูปแบบ Matrix Grid รายสัปดาห์ พร้อมระบุห้องเรียนและชื่ออาจารย์ผู้สอนครับ";
        }
        if (q.includes('อาจารย์') || q.includes('ที่ปรึกษา') || q.includes('advisor')) {
            return "อาจารย์ประจำสาขาวิชาวิทยาการคอมพิวเตอร์ BSRU มีรายนามดังนี้ครับ:\n- **ผศ.ดร.วิชัย เทคโนโลยี** (หัวหน้าสาขาวิชา/อาจารย์ที่ปรึกษา)\n- **อ.สุภา โปรแกรม**\n- **ผศ.มานะ ดาต้า**\n- **ผศ.ดร.ณัฐ เน็ตเวิร์ค**\n- **อ.พิมพ์ เว็บเทค**\nสามารถดูข้อมูลการติดต่อได้ที่เมนูประวัตินักศึกษาครับ";
        }
        if (q.includes('สวัสดี') || q.includes('hello') || q.includes('hi') || q.includes('หวัดดี')) {
            return "สวัสดีครับ! 👋 ผมคือ **BSRU CS AI Assistant** ยินดีให้คำแนะนำและตอบคำถามเกี่ยวกับระบบสารสนเทศนักศึกษา การลงทะเบียนเรียน ตารางเรียน ผลการเรียน สถิติสายอาชีพ รวมถึงจัดส่งไฟล์แบบฟอร์มคำร้อง (ทบ.) ให้ดาวน์โหลดครับ มีอะไรให้ผมช่วยเหลือไหมครับ?";
        }
        return `ขอบคุณสำหรับคำถามครับ! คุณสามารถสอบถามข้อมูลระบบสารสนเทศนักศึกษา สาขาวิทยาการคอมพิวเตอร์ BSRU ได้หลากหลายหัวข้อ เช่น:\n- 📄 ขอไฟล์เอกสารคำร้องทางการ (ทบ.1–ทบ.17, ใบลาป่วย/ลากิจ, จิตอาสา กยศ.)\n- 📝 ขั้นตอนการยื่นคำร้องวิชาการ\n- 📅 ตารางเรียนและตารางสอบ\n- 📊 ตรวจสอบผลการเรียนและเกรดเฉลี่ย\n- 💼 สถิติสายอาชีพของบัณฑิต`;
    }

    async function handleCwSend() {
        const text = cwInput.value.trim();
        if (!text || cwWaiting) return;

        addCwMsg('user', text);
        cwInput.value = '';
        cwSendBtn.disabled = true;
        cwWaiting = true;

        // Show typing indicator
        const typing = document.createElement('div');
        typing.className = 'cw-typing';
        typing.id = 'cwTyping';
        typing.innerHTML = `
            <div class="cw-typing-dots">
                <span class="cw-typing-dot"></span>
                <span class="cw-typing-dot"></span>
                <span class="cw-typing-dot"></span>
            </div>
            <span class="cw-typing-label">AI กำลังประมวลผล...</span>
        `;
        cwMessages.appendChild(typing);
        cwMessages.scrollTop = cwMessages.scrollHeight;

        let reply = '';
        let sources = [];
        let attachments = [];

        try {
            console.log('🤖 [Chatbot] Sending user query to Spring Boot AI Backend (/api/chat)...');

            const sessionId = getSessionId();
            const payload = { message: text };
            if (sessionId) payload.sessionId = sessionId; // ผู้ใช้ที่ login ไม่ต้องส่ง (server ใช้ JWT)
            const data = await fetchAPI('/chat', 'POST', payload, 90000); // Gemini thinks before answering and may call several tools, so allow up to 90s

            console.log('✨ [Chatbot] Received AI Response:', data);
            reply = data.reply || data.message || 'ขออภัยครับ ไม่พบข้อมูลตอบกลับจากระบบ';
            if (Array.isArray(data.sources)) {
                sources = data.sources;
            }
            if (Array.isArray(data.attachments)) {
                attachments = data.attachments;
            }
            if (!attachments || attachments.length === 0) {
                const clientMatched = matchClientForms(text);
                if (clientMatched.length > 0) {
                    attachments = clientMatched;
                } else {
                    attachments = inferAttachmentsFromBotText(reply);
                }
            }
        } catch (err) {
            console.warn('⚠️ [Chatbot] Backend offline or unreachable, using domain assistant mode:', err.message);
            const offlineForms = matchClientForms(text);
            reply = getSmartOfflineReply(text, offlineForms);
            sources = [];
            attachments = offlineForms;
        }

        const t = document.getElementById('cwTyping');
        if (t) t.remove();

        addCwMsg('bot', reply, sources, attachments);

        cwWaiting = false;
        cwSendBtn.disabled = !cwInput.value.trim();
        cwInput.focus();
    }

    function buildAttachmentUrls(att) {
        const safeFile = encodeURIComponent(att.fileName || '');
        return {
            previewUrl: `${API_BASE_URL}/forms/${safeFile}`,
            downloadUrl: `${API_BASE_URL}/forms/${safeFile}?download=true`
        };
    }

    function addCwMsg(role, text, sources = [], attachments = []) {
        const div = document.createElement('div');
        div.className = `cw-msg ${role}`;

        if (role === 'bot') {
            if (text && text.includes('|')) {
                div.classList.add('has-table');
            }

            const contentDiv = document.createElement('div');
            contentDiv.className = 'cw-msg-content';
            contentDiv.innerHTML = renderSafeMarkdown(text);
            div.appendChild(contentDiv);

            const validAttachments = Array.isArray(attachments)
                ? attachments.filter(a => a && a.fileName)
                : [];

            if (validAttachments.length > 0) {
                div.classList.add('has-attachments');
                const attContainer = document.createElement('div');
                attContainer.className = 'cw-attachments';

                const attHeader = document.createElement('div');
                attHeader.className = 'cw-attachments-label';
                attHeader.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                    </svg>
                    <span>ไฟล์เอกสารแนบ (${validAttachments.length} ไฟล์)</span>
                `;
                attContainer.appendChild(attHeader);

                const attList = document.createElement('div');
                attList.className = 'cw-attachments-list';

                validAttachments.forEach(att => {
                    const { previewUrl, downloadUrl } = buildAttachmentUrls(att);
                    const downloadName = att.downloadName || att.fileName;
                    const card = document.createElement('div');
                    card.className = 'cw-attachment-card';
                    card.innerHTML = `
                        <div class="cw-att-icon" aria-hidden="true">PDF</div>
                        <div class="cw-att-info">
                            <div class="cw-att-title">
                                <span class="cw-att-code">${escapeHtml(att.code || 'เอกสาร')}</span>
                                <span>${escapeHtml(att.title || att.fileName)}</span>
                            </div>
                            ${att.summary ? `<div class="cw-att-summary">${escapeHtml(att.summary)}</div>` : ''}
                        </div>
                        <div class="cw-att-actions">
                            <a class="cw-att-btn preview" href="${escapeHtml(previewUrl)}" target="_blank" rel="noopener noreferrer" title="เปิดดูไฟล์ PDF ในแท็บใหม่">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                <span>เปิดดู</span>
                            </a>
                            <a class="cw-att-btn download" href="${escapeHtml(downloadUrl)}" download="${escapeHtml(downloadName)}" title="ดาวน์โหลดไฟล์ PDF">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                <span>ดาวน์โหลด</span>
                            </a>
                        </div>
                    `;
                    attList.appendChild(card);
                });

                attContainer.appendChild(attList);
                div.appendChild(attContainer);
            }

            const cleanSources = Array.isArray(sources)
                ? [...new Set(sources.filter(s => typeof s === 'string' && s.trim().length > 0))]
                : [];

            if (cleanSources.length > 0) {
                const citeContainer = document.createElement('div');
                citeContainer.className = 'cw-citations';

                const citeHeader = document.createElement('div');
                citeHeader.className = 'cw-citations-label';
                citeHeader.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                    </svg>
                    <span>แหล่งอ้างอิง:</span>
                `;
                citeContainer.appendChild(citeHeader);

                const badgesList = document.createElement('div');
                badgesList.className = 'cw-citations-list';

                cleanSources.forEach(src => {
                    const badge = document.createElement('button');
                    badge.type = 'button';
                    badge.className = 'cw-citation-badge';
                    badge.title = `คลิกเพื่อสอบถามข้อมูลเพิ่มเติมเกี่ยวกับ "${src}"`;
                    badge.setAttribute('aria-label', `แหล่งอ้างอิง ${src}`);
                    badge.innerHTML = `
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                        </svg>
                        <span>${escapeHtml(src)}</span>
                    `;
                    badge.addEventListener('click', () => {
                        cwInput.value = `ขอรายละเอียดเพิ่มเติมเกี่ยวกับ ${src}`;
                        cwSendBtn.disabled = false;
                        cwInput.focus();
                    });
                    badgesList.appendChild(badge);
                });

                citeContainer.appendChild(badgesList);
                div.appendChild(citeContainer);
            }
        } else {
            div.textContent = text;
        }

        cwMessages.appendChild(div);
        cwMessages.scrollTop = cwMessages.scrollHeight;
    }

    function addCwErrorMsg(text) {
        const div = document.createElement('div');
        div.className = 'cw-msg bot error';
        div.innerHTML = `
            <div class="cw-error-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
            </div>
            <div class="cw-error-text">
                <strong>เกิดข้อผิดพลาด</strong>
                <span>${text}</span>
            </div>
        `;
        cwMessages.appendChild(div);
        cwMessages.scrollTop = cwMessages.scrollHeight;
    }
}
