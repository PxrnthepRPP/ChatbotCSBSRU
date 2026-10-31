/* ============================================================
   BSRU Student Portal — Student Graduation Audit Checklist View
   ============================================================ */

import { esc, statusBadge } from '../../utils.js';
import { fetchAPI } from '../../api.js';
import { openStudentCareerModal } from './profile.js';

/* ============================================================
   GRADUATION AUDIT (ตรวจสอบจบตามเกณฑ์หลักสูตร)
   ============================================================ */
export const MOCK_GRADUATION = {
    requiredCredits: 132, earnedCredits: 96,
    coreRequired: 72, coreEarned: 54,
    geRequired: 30, geEarned: 24,
    electiveRequired: 18, electiveEarned: 12,
    freeRequired: 12, freeEarned: 6,
    gpaRequired: 2.0, currentGpa: 3.42,
    activityRequired: 6, activityCompleted: 4,
    status: 'กำลังดำเนินการ',
};

export const MOCK_GRADUATION_AUDIT = {
    summary: {
        totalRequiredCredits: 127,
        totalEarnedCredits: 115,
        currentGpa: 3.96,
        minGpa: 2.00,
        status: 'ยังไม่ผ่านเงื่อนไข',
        passedCategories: 6,
        totalCategories: 9,
        pendingRequirements: [
            '2.2.2 หมวดวิชาเฉพาะด้าน (เลือก) — ขาดอีก 6 หน่วยกิต (ผ่านแล้ว 15/21 CR)',
            '2.3 วิชาพื้นฐานวิชาชีพ — ขาดโครงงาน 2 (SC17402) และฝึกงาน (SC17411/12) ขาดอีก 6 หน่วยกิต',
            '4. กลุ่มทักษะ — รอผลการทดสอบ CEFR และทักษะดิจิทัล DL',
        ],
    },
    sections: [
        {
            id: 'sec-1',
            title: '1. หมวดวิชาศึกษาทั่วไป',
            subsections: [
                {
                    id: 'sec-1-1',
                    title: '1.1 วิชาศึกษาทั่วไปบังคับ',
                    status: 'PASS', minCr: 20, passCr: 20, gpa: '4.00',
                    groups: [
                        {
                            code: '1.1.1', title: 'กลุ่มที่ 1 ศาสตร์พระราชาและวิถีแห่งสังคม',
                            status: 'PASS', minCr: 3, passCr: 3, gpa: '4.00',
                            courses: [
                                { code: 'GE01101', name: 'ศาสตร์พระราชาสู่การพัฒนาท้องถิ่น', credits: '3(3-0-6)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 2: 'A 2/66' } }
                            ]
                        },
                        {
                            code: '1.1.2', title: 'กลุ่มที่ 2 ภาษาและเทคโนโลยีทางการสื่อสาร',
                            status: 'PASS', minCr: 6, passCr: 6, gpa: '4.00',
                            courses: [
                                { code: 'GE02101', name: 'ภาษาอังกฤษเพื่อการสื่อสารในยุคดิจิทัล', credits: '3(3-0-6)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 2: 'A 2/66' } },
                                { code: 'GE02102', name: 'ภาษาไทยเพื่อการสื่อสารร่วมสมัย', credits: '3(3-0-6)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 1: 'A 1/66' } }
                            ]
                        },
                        {
                            code: '1.1.3', title: 'กลุ่มที่ 3 คุณภาพชีวิตและคุณค่าของความเป็นมนุษย์',
                            status: 'PASS', minCr: 2, passCr: 2, gpa: '4.00',
                            courses: [
                                { code: 'GE03101', name: 'ชีวิตดีมีความสุข', credits: '2(1-2-3)', ca: 2, pt: 8.0, avg: '4.00', max: '4.00', terms: { 3: 'A 1/67' } }
                            ]
                        },
                        {
                            code: '1.1.4', title: 'กลุ่มที่ 4 ศิลปะแห่งการจัดการและการเป็นผู้ประกอบการ',
                            status: 'PASS', minCr: 3, passCr: 3, gpa: '4.00',
                            courses: [
                                { code: 'GE04101', name: 'ประกอบการธุรกิจเชิงสร้างสรรค์', credits: '3(3-0-6)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 1: 'A 1/66' } }
                            ]
                        },
                        {
                            code: '1.1.5', title: 'กลุ่มที่ 5 ศาสตร์แห่งการคิดและการสร้างสรรค์นวัตกรรม',
                            status: 'PASS', minCr: 6, passCr: 6, gpa: '4.00',
                            courses: [
                                { code: 'GE05101', name: 'รู้คิดชีวิตก้าวหน้า', credits: '3(3-0-6)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 1: 'A 1/66' } },
                                { code: 'GE05102', name: 'ทักษะการใช้เทคโนโลยีดิจิทัล', credits: '3(2-2-5)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 2: 'A 2/66' } }
                            ]
                        }
                    ]
                },
                {
                    id: 'sec-1-2',
                    title: '1.2 วิชาศึกษาทั่วไปเลือกกลุ่มละ 1 วิชา จำนวน 3 รายวิชา จาก 5 กลุ่มและเลือกเรียนได้กลุ่มละ 1 วิชาเท่านั้น',
                    status: 'PASS', minCr: 9, passCr: 9, gpa: '4.00',
                    groups: [
                        {
                            code: '1.2.1', title: 'กลุ่มที่ 1 ศาสตร์พระราชาและวิถีแห่งสังคม',
                            status: 'PASS', minCr: null, passCr: null, gpa: '0.00',
                            courses: [
                                { code: 'GE01201', name: 'วิถีพลเมืองและกฎหมายในชีวิตประจำวัน', credits: '3(3-0-6)', ca: null, pt: null, avg: null, max: null, terms: {} },
                                { code: 'GE01202', name: 'พลวัตสังคมไทยและสังคมโลก', credits: '3(3-0-6)', ca: null, pt: null, avg: null, max: null, terms: {} }
                            ]
                        },
                        {
                            code: '1.2.2', title: 'กลุ่มที่ 2 ภาษาและเทคโนโลยีทางการสื่อสาร',
                            status: 'PASS', minCr: null, passCr: null, gpa: '0.00',
                            courses: [
                                { code: 'GE02201', name: 'การรู้เท่าทันสื่อและสารสนเทศ', credits: '3(3-0-6)', ca: null, pt: null, avg: null, max: null, terms: {} },
                                { code: 'GE02202', name: 'ภาษาเกาหลีในชีวิตประจำวัน', credits: '3(3-0-6)', ca: null, pt: null, avg: null, max: null, terms: {} },
                                { code: 'GE02203', name: 'ภาษาเขมรในชีวิตประจำวัน', credits: '3(3-0-6)', ca: null, pt: null, avg: null, max: null, terms: {} },
                                { code: 'GE02204', name: 'ภาษาจีนในชีวิตประจำวัน', credits: '3(3-0-6)', ca: null, pt: null, avg: null, max: null, terms: {} },
                                { code: 'GE02205', name: 'ภาษาญี่ปุ่นในชีวิตประจำวัน', credits: '3(3-0-6)', ca: null, pt: null, avg: null, max: null, terms: {} },
                                { code: 'GE02206', name: 'ภาษามลายูในชีวิตประจำวัน', credits: '3(3-0-6)', ca: null, pt: null, avg: null, max: null, terms: {} },
                                { code: 'GE02207', name: 'ภาษาลาวในชีวิตประจำวัน', credits: '3(3-0-6)', ca: null, pt: null, avg: null, max: null, terms: {} },
                                { code: 'GE02208', name: 'ภาษาเวียดนามในชีวิตประจำวัน', credits: '3(3-0-6)', ca: null, pt: null, avg: null, max: null, terms: {} },
                                { code: 'GE02209', name: 'ภาษาสเปนในชีวิตประจำวัน', credits: '3(3-0-6)', ca: null, pt: null, avg: null, max: null, terms: {} }
                            ]
                        },
                        {
                            code: '1.2.3', title: 'กลุ่มที่ 3 คุณภาพชีวิตและคุณค่าของความเป็นมนุษย์',
                            status: 'PASS', minCr: null, passCr: 3, gpa: '4.00',
                            courses: [
                                { code: 'GE03201', name: 'ศิลปะและความงามของชีวิต', credits: '3(3-0-6)', ca: null, pt: null, avg: null, max: null, terms: {} },
                                { code: 'GE03202', name: 'ศิลปะการใช้ชีวิต', credits: '3(3-0-6)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 4: 'A 2/67' } }
                            ]
                        },
                        {
                            code: '1.2.4', title: 'กลุ่มที่ 4 ศิลปะแห่งการจัดการและการเป็นผู้ประกอบการ',
                            status: 'PASS', minCr: null, passCr: 3, gpa: '4.00',
                            courses: [
                                { code: 'GE04201', name: 'การวางแผนทางการเงินเพื่อความมั่นคง', credits: '3(3-0-6)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 4: 'A 2/67' } },
                                { code: 'GE04202', name: 'การทำงานอย่างมีความสุข', credits: '3(3-0-6)', ca: null, pt: null, avg: null, max: null, terms: {} }
                            ]
                        },
                        {
                            code: '1.2.5', title: 'กลุ่มที่ 5 ศาสตร์แห่งการคิดและการสร้างสรรค์นวัตกรรม',
                            status: 'PASS', minCr: null, passCr: 3, gpa: '4.00',
                            courses: [
                                { code: 'GE05201', name: 'เทคโนโลยีดิจิทัลสำหรับนักธุรกิจมือใหม่', credits: '3(2-2-5)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 3: 'A 1/67' } },
                                { code: 'GE05202', name: 'รักษ์โลกรักเรา', credits: '3(3-0-6)', ca: null, pt: null, avg: null, max: null, terms: {} }
                            ]
                        }
                    ]
                },
                {
                    id: 'sec-1-3',
                    title: '1.3 วิชาศึกษาทั่วไปบังคับเลือก',
                    status: 'PASS', minCr: 1, passCr: 1, gpa: '4.00',
                    groups: [
                        {
                            code: '1.3', title: 'วิชาศึกษาทั่วไปบังคับเลือก',
                            status: 'PASS', minCr: 1, passCr: 1, gpa: '4.00',
                            courses: [
                                { code: 'GE03301', name: 'จังหวะของชีวิต', credits: '1(0-2-1)', ca: null, pt: null, avg: null, max: null, terms: {} },
                                { code: 'GE03302', name: 'การออกกำลังกายเพื่อสุขภาพ', credits: '1(0-2-1)', ca: 1, pt: 4.0, avg: '4.00', max: '4.00', terms: { 3: 'A 1/67' } },
                                { code: 'GE03303', name: 'การเต้นสมัยใหม่', credits: '1(0-2-1)', ca: null, pt: null, avg: null, max: null, terms: {} }
                            ]
                        }
                    ]
                }
            ]
        },
        {
            id: 'sec-2',
            title: '2. หมวดวิชาเฉพาะไม่น้อยกว่า',
            subsections: [
                {
                    id: 'sec-2-1',
                    title: '2.1 วิชาแกน',
                    status: 'PASS', minCr: 18, passCr: 18, gpa: '4.00',
                    groups: [
                        {
                            code: '2.1', title: 'วิชาแกน', status: 'PASS', minCr: 18, passCr: 18, gpa: '4.00',
                            courses: [
                                { code: 'SC01001', name: 'คณิตศาสตร์เบื้องต้น', credits: '3(3-0-6)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 1: 'A 1/66' } },
                                { code: 'SC01002', name: 'แคลคูลัสเบื้องต้น', credits: '3(3-0-6)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 2: 'A 2/66' } },
                                { code: 'SC01012', name: 'เทคโนโลยีดิจิทัลสำหรับนักวิทยาศาสตร์', credits: '3(2-2-5)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 2: 'A 2/66' } },
                                { code: 'SC01013', name: 'ภาษาอังกฤษสำหรับนักวิทยาศาสตร์', credits: '3(3-0-6)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 4: 'A 2/67' } },
                                { code: 'SC17205', name: 'คณิตศาสตร์ดิสครีตและทฤษฎีการคำนวณ', credits: '3(3-0-6)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 4: 'A 2/67' } },
                                { code: 'SC17301', name: 'สถิติเพื่อการวิจัยทางวิทยาศาสตร์', credits: '3(2-2-5)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 5: 'A 1/68' } }
                            ]
                        }
                    ]
                },
                {
                    id: 'sec-2-2',
                    title: '2.2 วิชาเฉพาะด้าน',
                    subsections: [
                        {
                            id: 'sec-2-2-1',
                            title: '2.2.1 บังคับ',
                            groups: [
                                {
                                    code: '2.2.1.1', title: 'กลุ่มประเด็นด้านองค์กรและระบบสารสนเทศ', status: 'PASS', minCr: 6, passCr: 6, gpa: '3.50',
                                    courses: [
                                        { code: 'SC17204', name: 'การวิเคราะห์และออกแบบระบบ', credits: '3(2-2-5)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 3: 'A 1/67' } },
                                        { code: 'SC17302', name: 'ภาษาอังกฤษสำหรับวิทยาการคอมพิวเตอร์', credits: '3(3-0-6)', ca: 3, pt: 9.0, avg: '3.00', max: '3.00', terms: { 5: 'B 1/68' } }
                                    ]
                                },
                                {
                                    code: '2.2.1.2', title: 'กลุ่มเทคโนโลยีเพื่องานประยุกต์', status: 'PASS', minCr: 12, passCr: 12, gpa: '4.00',
                                    courses: [
                                        { code: 'SC17207', name: 'ปฏิสัมพันธ์ระหว่างมนุษย์และคอมพิวเตอร์', credits: '3(2-2-5)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 4: 'A 2/67' } },
                                        { code: 'SC17208', name: 'การจัดการฐานข้อมูลและสารสนเทศ', credits: '3(2-2-5)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 4: 'A 2/67' } },
                                        { code: 'SC17304', name: 'ความมั่นคงปลอดภัยทางคอมพิวเตอร์', credits: '3(3-0-6)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 5: 'A 1/68' } },
                                        { code: 'SC17306', name: 'สัมมนาทางคอมพิวเตอร์', credits: '3(3-0-6)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 6: 'A 2/68' } }
                                    ]
                                },
                                {
                                    code: '2.2.1.3', title: 'กลุ่มเทคโนโลยีและวิธีการทางซอฟต์แวร์', status: 'PASS', minCr: 12, passCr: 12, gpa: '4.00',
                                    courses: [
                                        { code: 'SC17101', name: 'การเขียนโปรแกรมคอมพิวเตอร์และอัลกอริทึม', credits: '3(2-2-5)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 1: 'A 1/66' } },
                                        { code: 'SC17102', name: 'โครงสร้างข้อมูลและการเขียนโปรแกรม', credits: '3(2-2-5)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 2: 'A 2/66' } },
                                        { code: 'SC17202', name: 'การเขียนโปรแกรมเชิงวัตถุ', credits: '3(2-2-5)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 3: 'A 1/67' } },
                                        { code: 'SC17206', name: 'วิศวกรรมซอฟต์แวร์', credits: '3(2-2-5)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 4: 'A 2/67' } }
                                    ]
                                },
                                {
                                    code: '2.2.1.4', title: 'กลุ่มโครงสร้างพื้นฐานของระบบ', status: 'PASS', minCr: 12, passCr: 12, gpa: '4.00',
                                    courses: [
                                        { code: 'SC17201', name: 'ระบบปฏิบัติการ', credits: '3(3-0-6)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 3: 'A 1/67' } },
                                        { code: 'SC17203', name: 'เครือข่ายคอมพิวเตอร์และการสื่อสารข้อมูล', credits: '3(2-2-5)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 3: 'A 1/67' } },
                                        { code: 'SC17303', name: 'คอมพิวเตอร์กราฟิก', credits: '3(2-2-5)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 5: 'A 1/68' } },
                                        { code: 'SC17305', name: 'ปัญญาประดิษฐ์และระบบชาญฉลาด', credits: '3(2-2-5)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 6: 'A 2/68' } }
                                    ]
                                },
                                {
                                    code: '2.2.1.5', title: 'กลุ่มฮาร์ดแวร์และสถาปัตยกรรมคอมพิวเตอร์', status: 'PASS', minCr: 3, passCr: 3, gpa: '4.00',
                                    courses: [
                                        { code: 'SC17103', name: 'สถาปัตยกรรมคอมพิวเตอร์', credits: '3(3-0-6)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 1: 'A 1/66' } }
                                    ]
                                }
                            ]
                        },
                        {
                            id: 'sec-2-2-2',
                            title: '2.2.2 เลือกไม่น้อยกว่า',
                            status: 'FAIL', minCr: 21, passCr: 15, gpa: '3.90',
                            groups: [
                                {
                                    code: '2.2.2', title: 'เลือกไม่น้อยกว่า 21 หน่วยกิต', status: 'FAIL', minCr: 21, passCr: 15, gpa: '3.90',
                                    courses: [
                                        { code: 'SC17311', name: 'พื้นฐานอินเทอร์เน็ตทุกสรรพสิ่ง', credits: '3(2-2-5)', ca: null, pt: null, avg: null, max: null, terms: {} },
                                        { code: 'SC17312', name: 'การพัฒนาระบบอินเทอร์เน็ตทุกสรรพสิ่ง', credits: '3(2-2-5)', ca: null, pt: null, avg: null, max: null, terms: {} },
                                        { code: 'SC17321', name: 'วิทยาการข้อมูล', credits: '3(2-2-5)', ca: null, pt: null, avg: null, max: null, terms: {} },
                                        { code: 'SC17322', name: 'คลังข้อมูล', credits: '3(2-2-5)', ca: null, pt: null, avg: null, max: null, terms: {} },
                                        { code: 'SC17331', name: 'วิศวกรรมเว็บและการพัฒนาเว็บแอปพลิเคชัน', credits: '3(2-2-5)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 5: 'A 1/68' } },
                                        { code: 'SC17332', name: 'การพัฒนาเว็บแอปพลิเคชันที่ประมวลผลทางฝั่งเครื่องลูกข่าย', credits: '3(2-2-5)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 6: 'A 2/68' } },
                                        { code: 'SC17333', name: 'การพัฒนาเว็บไซต์ด้วยระบบจัดการเนื้อหา', credits: '3(2-2-5)', ca: null, pt: null, avg: null, max: null, terms: {} },
                                        { code: 'SC17341', name: 'การพัฒนาแอปพลิเคชันบนอุปกรณ์เคลื่อนที่ 1', credits: '3(2-2-5)', ca: null, pt: null, avg: null, max: null, terms: {} },
                                        { code: 'SC17342', name: 'การพัฒนาแอปพลิเคชันบนอุปกรณ์เคลื่อนที่ 2', credits: '3(2-2-5)', ca: null, pt: null, avg: null, max: null, terms: {} },
                                        { code: 'SC17351', name: 'การเป็นผู้ประกอบการด้านดิจิทัล', credits: '3(3-0-6)', ca: null, pt: null, avg: null, max: null, terms: { 7: '-- 1/69' } },
                                        { code: 'SC17352', name: 'ระบบสารสนเทศเพื่อการจัดการ', credits: '3(3-0-6)', ca: null, pt: null, avg: null, max: null, terms: {} },
                                        { code: 'SC17353', name: 'ธุรกิจดิจิทัล', credits: '3(3-0-6)', ca: null, pt: null, avg: null, max: null, terms: { 7: '-- 1/69' } },
                                        { code: 'SC17354', name: 'การเขียนโปรแกรมคอมพิวเตอร์ขั้นสูง', credits: '3(2-2-5)', ca: null, pt: null, avg: null, max: null, terms: {} },
                                        { code: 'SC17355', name: 'วิจัยดำเนินงาน', credits: '3(3-0-6)', ca: 3, pt: 10.5, avg: '3.50', max: '3.50', terms: { 5: 'B+ 1/68' } },
                                        { code: 'SC17356', name: 'การค้นคืนสารสนเทศ', credits: '3(3-0-6)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 6: 'A 2/68' } },
                                        { code: 'SC17361', name: 'การประยุกต์ใช้เทคโนโลยีคอมพิวเตอร์ในชีวิตประจำวัน', credits: '3(2-2-5)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 6: 'A 2/68' } },
                                        { code: 'SC17362', name: 'การจัดการเนื้อหาบนสื่อผสม', credits: '3(2-2-5)', ca: null, pt: null, avg: null, max: null, terms: {} },
                                        { code: 'SC17363', name: 'การประยุกต์ใช้แอปพลิเคชันบนอุปกรณ์เคลื่อนที่', credits: '3(2-2-5)', ca: null, pt: null, avg: null, max: null, terms: {} }
                                    ]
                                }
                            ]
                        }
                    ]
                },
                {
                    id: 'sec-2-3',
                    title: '2.3 วิชาพื้นฐานวิชาชีพ',
                    status: 'FAIL', minCr: 7, passCr: 1, gpa: '4.00',
                    groups: [
                        {
                            code: '2.3.1', title: 'แผนฝึกประสบการณ์วิชาชีพ', status: 'FAIL', minCr: null, passCr: 1, gpa: '4.00',
                            courses: [
                                { code: 'SC17401', name: 'โครงงานคอมพิวเตอร์ 1', credits: '1(1-0-2)', ca: 1, pt: 4.0, avg: '4.00', max: '4.00', terms: { 6: 'A 2/68' } },
                                { code: 'SC17402', name: 'โครงงานคอมพิวเตอร์ 2', credits: '2(0-4-2)', ca: null, pt: null, avg: null, max: null, terms: { 7: '-- 1/69' } },
                                { code: 'SC17411', name: 'เตรียมฝึกประสบการณ์วิชาชีพทางวิทยาการคอมพิวเตอร์', credits: '1(0-2-1)', ca: null, pt: null, avg: null, max: null, terms: { 7: '-- 1/69' } },
                                { code: 'SC17412', name: 'ฝึกประสบการณ์วิชาชีพทางวิทยาการคอมพิวเตอร์', credits: '3(450)', ca: null, pt: null, avg: null, max: null, terms: {} }
                            ]
                        },
                        {
                            code: '2.3.2', title: 'แผนสหกิจศึกษา', status: 'PASS', minCr: null, passCr: null, gpa: '0.00',
                            courses: [
                                { code: 'SC17421', name: 'เตรียมสหกิจศึกษาทางวิทยาการคอมพิวเตอร์', credits: '1(0-2-1)', ca: null, pt: null, avg: null, max: null, terms: {} },
                                { code: 'SC17422', name: 'สหกิจศึกษาทางวิทยาการคอมพิวเตอร์', credits: '6(640)', ca: null, pt: null, avg: null, max: null, terms: {} }
                            ]
                        }
                    ]
                }
            ]
        },
        {
            id: 'sec-3',
            title: '3. หมวดวิชาเลือกเสรี',
            status: 'PASS', minCr: 6, passCr: 6, gpa: '4.00',
            groups: [
                {
                    code: '3.', title: 'หมวดวิชาเลือกเสรี', status: 'PASS', minCr: 6, passCr: 6, gpa: '4.00',
                    courses: [
                        { code: '2101207', name: 'สารสนเทศสำหรับเด็กและเยาวชน', credits: '3(3-0-6)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 6: 'A 2/68' } },
                        { code: 'ED16208', name: 'จิตวิทยาสังคม', credits: '3(3-0-6)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 5: 'A 1/68' } }
                    ]
                }
            ]
        },
        {
            id: 'sec-4',
            title: '4. กลุ่มทักษะ',
            status: 'FAIL', minCr: null, passCr: null, gpa: '0.00',
            groups: [
                {
                    code: '4.', title: 'กลุ่มทักษะความรู้ความสามารถ', status: 'FAIL', minCr: null, passCr: null, gpa: '0.00',
                    courses: [
                        { code: 'CEFR111', name: 'การพัฒนาทักษะภาษาอังกฤษ (การวัดสมิทธิภาพทางภาษาอังกฤษ)', credits: '0', ca: null, pt: null, avg: null, max: null, terms: { 6: '-- 2/68' } },
                        { code: 'DL11111', name: 'ทักษะความเข้าใจและใช้เทคโนโลยีดิจิทัล', credits: '0', ca: null, pt: null, avg: null, max: null, terms: {} }
                    ]
                }
            ]
        }
    ]
};

/* ============================================================
   GRADUATION STATE
   ============================================================ */
let graduationAudit = MOCK_GRADUATION_AUDIT;   // null = the backend has no sheet for this student
let graduationAuditLoadedFor = null;
let graduationStudentId = null;                // the logged-in student (the profile mock may be another student)
let currentGradViewMode = 'table';

export function resetGraduationState(studentId) {
    graduationStudentId = studentId;
    graduationAudit = MOCK_GRADUATION_AUDIT;
    graduationAuditLoadedFor = null;
}

export function buildAuditGroupHTML(secId, grp, hideHeader = false) {
    const passBadge = grp.status ? `<span class="audit-badge ${grp.status.toLowerCase()}">${grp.status}</span>` : '';
    const minCrText = grp.minCr !== null && grp.minCr !== undefined ? `MIN ${grp.minCr} CR` : '';
    const passCrText = grp.passCr !== null && grp.passCr !== undefined ? `PASS ${grp.passCr} CR` : '';
    const gpaText = grp.gpa && grp.gpa !== '0.00' ? `GPA ${grp.gpa}` : '';

    let html = '';
    if (!hideHeader) {
        html += `
            <tr class="audit-group-hdr audit-row-${secId}">
                <td colspan="6" style="padding-left:22px">
                    <span style="color:var(--brand-700);font-weight:700">${esc(grp.code || '')}</span> <strong>${esc(grp.title)}</strong>
                </td>
                <td colspan="8" style="text-align:right;padding-right:14px">
                    ${passBadge}
                    ${minCrText ? `<span class="audit-cr-pill">${minCrText}</span>` : ''}
                    ${passCrText ? `<span class="audit-cr-pill">${passCrText}</span>` : ''}
                    ${gpaText ? `<span class="audit-gpa-pill">${gpaText}</span>` : ''}
                </td>
            </tr>
        `;
    }

    grp.courses.forEach(c => {
        const termsCells = [1, 2, 3, 4, 5, 6, 7, 8].map(termNum => {
            const val = c.terms && c.terms[termNum];
            if (!val) return '<td class="term-col" style="color:var(--g-300)">-</td>';
            if (val.startsWith('--')) {
                return `<td class="term-col"><span class="audit-grade-wait">${esc(val)}</span></td>`;
            }
            return `<td class="term-col"><span class="audit-grade-pass">${esc(val)}</span></td>`;
        }).join('');

        html += `
            <tr class="audit-course-row audit-row-${secId}">
                <td style="padding-left:32px">
                    <span class="audit-course-code">${esc(c.code)}:</span>
                    <span class="audit-course-name">${esc(c.name)}</span>
                </td>
                <td class="cr-col" style="color:var(--g-600)">${esc(c.credits || '-')}</td>
                <td class="num-col" style="${c.ca ? 'color:var(--g-800);font-weight:600' : 'color:var(--g-300)'}">${c.ca !== null && c.ca !== undefined ? c.ca : '-'}</td>
                <td class="num-col" style="${c.pt ? 'color:var(--g-800);font-weight:600' : 'color:var(--g-300)'}">${c.pt !== null && c.pt !== undefined ? c.pt.toFixed(1) : '-'}</td>
                <td class="num-col" style="${c.avg ? 'color:var(--g-800);font-weight:600' : 'color:var(--g-300)'}">${c.avg !== null && c.avg !== undefined ? c.avg : '-'}</td>
                <td class="num-col" style="${c.max ? 'color:var(--g-800);font-weight:600' : 'color:var(--g-300)'}">${c.max !== null && c.max !== undefined ? c.max : '-'}</td>
                ${termsCells}
            </tr>
        `;
    });

    return html;
}

export function evaluateSection1_2(subsec) {
    let distinctPassedGroups = [];
    let groupViolations = [];
    let totalCredits = 0;
    let totalPoints = 0;

    subsec.groups.forEach((grp, idx) => {
        const passedCourses = grp.courses.filter(c => c.ca && c.ca > 0);
        if (passedCourses.length > 0) {
            distinctPassedGroups.push({
                index: idx + 1,
                code: grp.code,
                title: grp.title,
                courses: passedCourses
            });
            if (passedCourses.length > 1) {
                groupViolations.push(`${grp.code}: เลือกเรียนซ้ำ ${passedCourses.length} วิชา (เงื่อนไขอนุญาตให้เลือกได้กลุ่มละ 1 วิชาเท่านั้น)`);
            }
            const first = passedCourses[0];
            totalCredits += 3;
            if (first.pt) totalPoints += first.pt;
        }
    });

    const isPassed = distinctPassedGroups.length >= 3 && groupViolations.length === 0;
    const gpa = totalCredits > 0 ? (totalPoints / totalCredits).toFixed(2) : '0.00';
    const earnedCredits = Math.min(distinctPassedGroups.length, 3) * 3;

    return {
        isPassed,
        distinctCount: distinctPassedGroups.length,
        requiredCount: 3,
        passedGroups: distinctPassedGroups,
        violations: groupViolations,
        earnedCredits,
        requiredCredits: 9,
        gpa
    };
}

export function buildGraduationAuditTableRows() {
    let rowsHTML = '';

    graduationAudit.sections.forEach(sec => {
        rowsHTML += `
            <tr class="audit-sec-hdr" data-sec="${sec.id}">
                <td colspan="14" style="padding:9px 14px">
                    <div style="display:flex;align-items:center;justify-content:space-between">
                        <span style="display:flex;align-items:center;gap:8px">
                            <span class="audit-toggle-icon" id="toggle-${sec.id}" style="transition:transform 0.2s">▼</span>
                            <strong>${esc(sec.title)}</strong>
                        </span>
                        <span style="font-size:0.75rem;color:var(--brand-700);font-weight:600">คลิกเพื่อยุบ/ขยาย</span>
                    </div>
                </td>
            </tr>
        `;

        if (sec.subsections) {
            sec.subsections.forEach(subsec => {
                let passBadge = subsec.status ? `<span class="audit-badge ${subsec.status.toLowerCase()}">${subsec.status}</span>` : '';
                let minCrText = subsec.minCr !== null && subsec.minCr !== undefined ? `MIN ${subsec.minCr} CR` : (subsec.status ? 'MIN - CR' : '');
                let passCrText = subsec.passCr !== null && subsec.passCr !== undefined ? `PASS ${subsec.passCr} CR` : (subsec.status ? 'PASS - CR' : '');
                let gpaText = subsec.gpa ? `GPA ${subsec.gpa}` : '';

                // Special evaluation for Section 1.2 (3 of 5 groups rule)
                if (subsec.id === 'sec-1-2') {
                    const eval1_2 = evaluateSection1_2(subsec);
                    const statusClass = eval1_2.isPassed ? 'pass' : 'fail';
                    passBadge = `<span class="audit-badge ${statusClass}">${eval1_2.isPassed ? 'PASS' : 'FAIL'}</span>`;
                    passCrText = `PASS ${eval1_2.earnedCredits} CR (${eval1_2.distinctCount}/3 กลุ่ม)`;
                    gpaText = `GPA ${eval1_2.gpa}`;
                }

                rowsHTML += `
                    <tr class="audit-subsec-hdr audit-row-${sec.id}">
                        <td colspan="6" style="padding:8px 14px">
                            <strong>${esc(subsec.title)}</strong>
                        </td>
                        <td colspan="8" style="text-align:right;padding-right:12px">
                            ${passBadge}
                            ${minCrText ? `<span class="audit-cr-pill">${minCrText}</span>` : ''}
                            ${passCrText ? `<span class="audit-cr-pill">${passCrText}</span>` : ''}
                            ${gpaText ? `<span class="audit-gpa-pill">${gpaText}</span>` : ''}
                        </td>
                    </tr>
                `;

                if (subsec.groups) {
                    const isSingleMatchingGroup = subsec.groups.length === 1 && (
                        subsec.groups[0].title.trim() === subsec.title.trim() ||
                        subsec.title.includes(subsec.groups[0].title.trim()) ||
                        subsec.groups[0].title.includes(subsec.title.trim())
                    );

                    subsec.groups.forEach(grp => {
                        if (subsec.id === 'sec-1-2') {
                            const hasPassedCourse = grp.courses.some(c => c.ca && c.ca > 0);
                            const grpCopy = {
                                ...grp,
                                status: hasPassedCourse ? 'PASS' : null,
                                passCr: hasPassedCourse ? 3 : null
                            };
                            rowsHTML += buildAuditGroupHTML(sec.id, grpCopy, isSingleMatchingGroup);
                        } else {
                            rowsHTML += buildAuditGroupHTML(sec.id, grp, isSingleMatchingGroup);
                        }
                    });
                } else if (subsec.subsections) {
                    subsec.subsections.forEach(subsub => {
                        rowsHTML += `
                            <tr class="audit-subsec-hdr audit-row-${sec.id}" style="background:var(--g-50) !important">
                                <td colspan="6" style="padding-left:24px">
                                    <strong>${esc(subsub.title)}</strong>
                                </td>
                                <td colspan="8" style="text-align:right;padding-right:12px">
                                    ${subsub.status ? `<span class="audit-badge ${subsub.status.toLowerCase()}">${subsub.status}</span>` : ''}
                                    ${subsub.minCr != null ? `<span class="audit-cr-pill">MIN ${subsub.minCr} CR</span>` : ''}
                                    ${subsub.passCr != null ? `<span class="audit-cr-pill">PASS ${subsub.passCr} CR</span>` : ''}
                                </td>
                            </tr>
                        `;
                        if (subsub.groups) {
                            const isSubSingleMatching = subsub.groups.length === 1 && (
                                subsub.groups[0].title.trim() === subsub.title.trim() ||
                                subsub.title.includes(subsub.groups[0].title.trim())
                            );
                            subsub.groups.forEach(grp => {
                                rowsHTML += buildAuditGroupHTML(sec.id, grp, isSubSingleMatching);
                            });
                        }
                    });
                }
            });
        } else if (sec.groups) {
            sec.groups.forEach(grp => {
                rowsHTML += buildAuditGroupHTML(sec.id, grp, false);
            });
        }
    });

    return rowsHTML;
}

export function renderCourseCardItem(c) {
    let termGradeHTML = '<span style="color:var(--g-400);font-size:0.75rem">○ ยังไม่ได้ลงทะเบียน</span>';
    if (c.terms) {
        for (const [termNum, gradeText] of Object.entries(c.terms)) {
            if (gradeText) {
                if (gradeText.startsWith('--')) {
                    termGradeHTML = `<span class="audit-grade-wait">⏳ ${esc(gradeText)}</span>`;
                } else {
                    termGradeHTML = `<span class="audit-grade-pass">🎓 ${esc(gradeText)}</span>`;
                }
                break;
            }
        }
    }

    return `
        <div class="audit-course-card">
            <div class="audit-course-card-top">
                <div>
                    <span class="audit-course-code">${esc(c.code)}:</span>
                    <span class="audit-course-card-title">${esc(c.name)}</span>
                </div>
                <div>${termGradeHTML}</div>
            </div>
            <div class="audit-course-card-meta">
                <span class="audit-course-card-meta-pill">หน่วยกิต: <strong>${esc(c.credits || '-')}</strong></span>
                <span class="audit-course-card-meta-pill">CA: <strong>${c.ca !== null && c.ca !== undefined ? c.ca : '-'}</strong></span>
                <span class="audit-course-card-meta-pill">PT: <strong>${c.pt !== null && c.pt !== undefined ? c.pt.toFixed(1) : '-'}</strong></span>
                <span class="audit-course-card-meta-pill">AVG: <strong>${c.avg !== null && c.avg !== undefined ? c.avg : '-'}</strong></span>
                <span class="audit-course-card-meta-pill">MAX: <strong>${c.max !== null && c.max !== undefined ? c.max : '-'}</strong></span>
            </div>
        </div>
    `;
}

export function buildGraduationCardsHTML() {
    let html = '<div class="audit-cards-container">';
    graduationAudit.sections.forEach(sec => {
        let secContent = '';

        if (sec.subsections) {
            sec.subsections.forEach(subsec => {
                let passBadge = subsec.status ? `<span class="audit-badge ${subsec.status.toLowerCase()}">${subsec.status}</span>` : '';
                let minCrText = subsec.minCr !== null && subsec.minCr !== undefined ? `MIN ${subsec.minCr} CR` : '';
                let passCrText = subsec.passCr !== null && subsec.passCr !== undefined ? `PASS ${subsec.passCr} CR` : '';
                let gpaText = subsec.gpa ? `GPA ${subsec.gpa}` : '';

                if (subsec.id === 'sec-1-2') {
                    const eval1_2 = evaluateSection1_2(subsec);
                    const statusClass = eval1_2.isPassed ? 'pass' : 'fail';
                    passBadge = `<span class="audit-badge ${statusClass}">${eval1_2.isPassed ? 'PASS' : 'FAIL'}</span>`;
                    passCrText = `PASS ${eval1_2.earnedCredits} CR (${eval1_2.distinctCount}/3 กลุ่ม)`;
                    gpaText = `GPA ${eval1_2.gpa}`;
                }

                secContent += `
                    <div class="audit-card-subsec-hdr">
                        <div><strong>${esc(subsec.title)}</strong></div>
                        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                            ${passBadge}
                            ${minCrText ? `<span class="audit-cr-pill">${minCrText}</span>` : ''}
                            ${passCrText ? `<span class="audit-cr-pill">${passCrText}</span>` : ''}
                            ${gpaText ? `<span class="audit-gpa-pill">${gpaText}</span>` : ''}
                        </div>
                    </div>
                `;

                if (subsec.groups) {
                    const isSingle = subsec.groups.length === 1 && (
                        subsec.groups[0].title.trim() === subsec.title.trim() ||
                        subsec.title.includes(subsec.groups[0].title.trim())
                    );

                    subsec.groups.forEach(grp => {
                        if (!isSingle) {
                            let grpBadge = grp.status ? `<span class="audit-badge ${grp.status.toLowerCase()}">${grp.status}</span>` : '';
                            let grpMin = grp.minCr ? `MIN ${grp.minCr} CR` : '';
                            let grpPass = grp.passCr ? `PASS ${grp.passCr} CR` : '';
                            let grpGpa = grp.gpa && grp.gpa !== '0.00' ? `GPA ${grp.gpa}` : '';

                            if (subsec.id === 'sec-1-2') {
                                const hasPassedCourse = grp.courses.some(c => c.ca && c.ca > 0);
                                grpBadge = hasPassedCourse ? '<span class="audit-badge pass">PASS</span>' : '';
                                grpPass = hasPassedCourse ? 'PASS 3 CR' : '';
                            }

                            secContent += `
                                <div class="audit-card-group-hdr">
                                    <span>${esc(grp.code || '')} ${esc(grp.title)}</span>
                                    <div style="display:flex;gap:4px;align-items:center">
                                        ${grpBadge}
                                        ${grpMin ? `<span class="audit-cr-pill">${grpMin}</span>` : ''}
                                        ${grpPass ? `<span class="audit-cr-pill">${grpPass}</span>` : ''}
                                        ${grpGpa ? `<span class="audit-gpa-pill">${grpGpa}</span>` : ''}
                                    </div>
                                </div>
                            `;
                        }

                        grp.courses.forEach(c => {
                            secContent += renderCourseCardItem(c);
                        });
                    });
                } else if (subsec.subsections) {
                    subsec.subsections.forEach(subsub => {
                        secContent += `
                            <div class="audit-card-group-hdr" style="background:var(--g-50)">
                                <span><strong>${esc(subsub.title)}</strong></span>
                            </div>
                        `;
                        if (subsub.groups) {
                            subsub.groups.forEach(grp => {
                                grp.courses.forEach(c => {
                                    secContent += renderCourseCardItem(c);
                                });
                            });
                        }
                    });
                }
            });
        } else if (sec.groups) {
            sec.groups.forEach(grp => {
                grp.courses.forEach(c => {
                    secContent += renderCourseCardItem(c);
                });
            });
        }

        html += `
            <div class="audit-card-section" id="card-sec-${sec.id}">
                <div class="audit-card-sec-hdr" data-card-sec="${sec.id}">
                    <div style="display:flex;align-items:center;gap:8px">
                        <span class="audit-card-toggle-icon" id="card-toggle-${sec.id}" style="transition:transform 0.2s">▼</span>
                        <strong style="color:var(--brand-900);font-size:0.88rem">${esc(sec.title)}</strong>
                    </div>
                    <span style="font-size:0.75rem;color:var(--brand-700);font-weight:600">คลิกเพื่อยุบ/ขยาย</span>
                </div>
                <div class="audit-card-sec-body" id="card-body-${sec.id}">
                    ${secContent}
                </div>
            </div>
        `;
    });

    html += '</div>';
    return html;
}

export function renderGraduation(student) {
    loadGraduationAudit(student);
    if (graduationAudit === null) {
        document.getElementById('graduationContent').innerHTML = `
            <div class="card" style="text-align:center;padding:40px 20px">
                <div style="font-size:2.4rem;margin-bottom:8px">📄</div>
                <div class="card-title" style="justify-content:center">ยังไม่มีข้อมูลใบตรวจสอบจบ</div>
                <p style="color:var(--text-muted);font-size:0.9rem">ผู้ดูแลระบบยังไม่ได้นำเข้าใบตรวจสอบจบของรหัส ${esc(graduationStudentId || '')} กรุณาติดต่อสำนักงานสาขา</p>
            </div>`;
        return;
    }
    const audit = graduationAudit;
    const s = audit.summary;
    const progressPct = Math.round((s.totalEarnedCredits / s.totalRequiredCredits) * 100);

    const pendingListHTML = s.pendingRequirements.map(item => `
        <li style="margin-bottom:6px;display:flex;align-items:flex-start;gap:6px">
            <span style="color:var(--red-500);font-weight:bold">•</span>
            <span>${esc(item)}</span>
        </li>
    `).join('');

    const careerBannerHTML = `
        <!-- Career & Employment Tracking Callout -->
        <div class="card" style="margin-bottom:18px;background:linear-gradient(135deg,rgba(59,130,246,0.06),rgba(99,102,241,0.06));border:1px solid rgba(59,130,246,0.25);border-radius:var(--radius-lg);padding:16px 20px;">
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
                <div style="display:flex;align-items:center;gap:14px;">
                    <div style="width:46px;height:46px;border-radius:12px;background:linear-gradient(135deg,#3b82f6,#6366f1);color:#fff;display:flex;align-items:center;justify-content:center;font-size:1.4rem;box-shadow:0 4px 10px rgba(59,130,246,0.3);flex-shrink:0">
                        💼
                    </div>
                    <div>
                        <div style="font-weight:700;font-size:1rem;color:var(--g-800);display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                            <span>สายอาชีพและภาวะการมีงานทำของบัณฑิต</span>
                            <span class="badge ${student.careerPath ? 'badge-green' : 'badge-amber'}">${student.careerPath ? 'อัปเดตแล้ว' : 'ยังไม่อัปเดต'}</span>
                        </div>
                        <div style="font-size:0.84rem;color:var(--g-600);margin-top:2px">
                            สายอาชีพปัจจุบัน: <strong style="color:var(--primary)">${esc(student.careerPath || 'ยังไม่ได้ระบุ')}</strong>
                            ${student.companyName ? ` • ${esc(student.companyName)}` : ''}
                            ${student.employmentStatus ? ` <span style="color:var(--g-500)">(${esc(student.employmentStatus)})</span>` : ''}
                        </div>
                    </div>
                </div>
                <button class="btn btn-primary btn-sm" id="btnUpdateCareerGrad" style="display:inline-flex;align-items:center;gap:6px">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    <span>อัปเดตสายอาชีพของคุณ</span>
                </button>
            </div>
        </div>
    `;

    document.getElementById('graduationContent').innerHTML = `
        ${careerBannerHTML}
        <!-- Summary Stat Row -->
        <div class="stat-row">
            <div class="stat-card">
                <div class="stat-icon purple">🎓</div>
                <div>
                    <div class="stat-value">${progressPct}%</div>
                    <div class="stat-label">ความคืบหน้ารวม (${s.totalEarnedCredits}/${s.totalRequiredCredits} CR)</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon green">📊</div>
                <div>
                    <div class="stat-value">${Number(s.currentGpa).toFixed(2)}</div>
                    <div class="stat-label">GPA สะสม (เกณฑ์ขั้นต่ำ ≥ ${s.minGpa.toFixed(2)})</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon amber">📚</div>
                <div>
                    <div class="stat-value">${s.passedCategories}/${s.totalCategories}</div>
                    <div class="stat-label">หมวดที่ผ่านเกณฑ์</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon red">⚠️</div>
                <div>
                    <div class="stat-value" style="font-size:1.1rem;color:var(--red-600)">${esc(s.status)}</div>
                    <div class="stat-label">สถานะการสำเร็จการศึกษา</div>
                </div>
            </div>
        </div>

        <!-- Progress Bar & Pending Alert -->
        <div class="card" style="margin-bottom:18px">
            <div class="card-title" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
                <span>📈 สรุปเงื่อนไขการสำเร็จการศึกษา (Graduation Requirements Audit)</span>
            </div>

            <div class="progress-group" style="margin-bottom:16px">
                <div class="progress-label">
                    <strong>หน่วยกิตสะสมตามหลักสูตร</strong>
                    <span>${s.totalEarnedCredits} จาก ${s.totalRequiredCredits} หน่วยกิต (${progressPct}%)</span>
                </div>
                <div class="progress-bar" style="height:10px">
                    <div class="progress-fill green" style="width:${progressPct}%"></div>
                </div>
            </div>

            <div style="padding:12px 16px;background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.2);border-radius:var(--radius-md)">
                <div style="font-weight:700;color:var(--red-600);margin-bottom:6px;display:flex;align-items:center;gap:6px">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    รายการที่ต้องดำเนินการเพิ่มเติมเพื่อสำเร็จการศึกษา:
                </div>
                <ul style="margin:0;padding-left:16px;font-size:0.84rem;color:var(--g-700)">
                    ${pendingListHTML}
                </ul>
            </div>
        </div>

        <!-- View Mode Switcher Toolbar -->
        <div class="audit-view-toolbar">
            <div class="audit-view-btn-group">
                <button class="audit-view-btn ${currentGradViewMode === 'table' ? 'active' : ''}" id="gradViewTableBtn" title="สลับเป็นมุมมองตารางเต็ม">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
                    📊 ตารางเต็ม (Table View)
                </button>
                <button class="audit-view-btn ${currentGradViewMode === 'cards' ? 'active' : ''}" id="gradViewCardsBtn" title="สลับเป็นการ์ดสรุปบนมือถือ">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                    📱 การ์ดสรุป (Mobile Cards)
                </button>
            </div>
            <div style="display:flex;gap:8px">
                <button class="btn btn-sm btn-ghost" id="auditExpandAllBtn">▾ ขยายทุกหมวด</button>
                <button class="btn btn-sm btn-ghost" id="auditCollapseAllBtn">▴ ยุบทุกหมวด</button>
            </div>
        </div>

        <!-- 1. Full Audit Matrix Table View -->
        <div id="gradTableViewContainer" style="${currentGradViewMode === 'table' ? '' : 'display:none'}">
            <div class="card" style="padding:0;overflow:hidden">
                <div class="audit-scroll-hint">
                    <span>👈 เลื่อนตารางแนวนอนเพื่อดูผลเรียนแต่ละเทอม (เทอม 1-8) 👉</span>
                </div>
                <div class="audit-wrap">
                    <table class="audit-table" id="graduationAuditTable">
                        <thead>
                            <tr>
                                <th class="subject-col">รายวิชา</th>
                                <th class="cr-col">หน่วยกิต</th>
                                <th class="num-col">CA</th>
                                <th class="num-col">PT</th>
                                <th class="num-col">AVG</th>
                                <th class="num-col">MAX</th>
                                <th class="term-col">1</th>
                                <th class="term-col">2</th>
                                <th class="term-col">3</th>
                                <th class="term-col">4</th>
                                <th class="term-col">5</th>
                                <th class="term-col">6</th>
                                <th class="term-col">7</th>
                                <th class="term-col">8</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${buildGraduationAuditTableRows()}
                        </tbody>
                    </table>
                </div>

                <!-- Table Legend Footnote -->
                <div style="padding:14px 20px;background:var(--g-50);border-top:1px solid var(--g-300);font-size:0.75rem;color:var(--g-600);line-height:1.6">
                    <strong>หมายเหตุ (Legend):</strong><br>
                    <strong>CA</strong>: จำนวนหน่วยกิตที่ลงทะเบียน · <strong>CS</strong>: จำนวนหน่วยกิตที่ผ่าน · <strong>CW</strong>: จำนวนหน่วยกิตที่รอ · <strong>CG</strong>: จำนวนหน่วยกิตที่คิดเกรด · <strong>PT</strong>: คะแนนรวม · <strong>AVG</strong>: ค่าเฉลี่ย · <strong>MAX</strong>: เกรดสูงสุด
                </div>
            </div>
        </div>

        <!-- 2. Mobile Cards View -->
        <div id="gradCardsViewContainer" style="${currentGradViewMode === 'cards' ? '' : 'display:none'}">
            ${buildGraduationCardsHTML()}
        </div>
    `;

    // ── View Mode Switcher Event Listeners ──
    const tableBtn = document.getElementById('gradViewTableBtn');
    const cardsBtn = document.getElementById('gradViewCardsBtn');
    const tableContainer = document.getElementById('gradTableViewContainer');
    const cardsContainer = document.getElementById('gradCardsViewContainer');

    tableBtn?.addEventListener('click', () => {
        currentGradViewMode = 'table';
        tableBtn.classList.add('active');
        cardsBtn.classList.remove('active');
        if (tableContainer) tableContainer.style.display = '';
        if (cardsContainer) cardsContainer.style.display = 'none';
    });

    cardsBtn?.addEventListener('click', () => {
        currentGradViewMode = 'cards';
        cardsBtn.classList.add('active');
        tableBtn.classList.remove('active');
        if (tableContainer) tableContainer.style.display = 'none';
        if (cardsContainer) cardsContainer.style.display = '';
    });

    // ── Accordion Collapse / Expand Events for Table View ──
    document.querySelectorAll('.audit-sec-hdr').forEach(hdr => {
        hdr.addEventListener('click', () => {
            const secId = hdr.dataset.sec;
            const rows = document.querySelectorAll(`.audit-row-${secId}`);
            const icon = document.getElementById(`toggle-${secId}`);
            const isHidden = rows.length > 0 && rows[0].style.display === 'none';

            rows.forEach(r => {
                r.style.display = isHidden ? '' : 'none';
            });
            if (icon) icon.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(-90deg)';
        });
    });

    // ── Accordion Collapse / Expand Events for Cards View ──
    document.querySelectorAll('.audit-card-sec-hdr').forEach(hdr => {
        hdr.addEventListener('click', () => {
            const secId = hdr.dataset.cardSec;
            const body = document.getElementById(`card-body-${secId}`);
            const icon = document.getElementById(`card-toggle-${secId}`);
            if (body) {
                const isHidden = body.style.display === 'none';
                body.style.display = isHidden ? '' : 'none';
                if (icon) icon.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(-90deg)';
            }
        });
    });

    // ── Expand / Collapse All Buttons for Both Views ──
    document.getElementById('auditExpandAllBtn')?.addEventListener('click', () => {
        graduationAudit.sections.forEach(sec => {
            // Table view rows
            document.querySelectorAll(`.audit-row-${sec.id}`).forEach(r => r.style.display = '');
            const tableIcon = document.getElementById(`toggle-${sec.id}`);
            if (tableIcon) tableIcon.style.transform = 'rotate(0deg)';

            // Cards view bodies
            const cardBody = document.getElementById(`card-body-${sec.id}`);
            const cardIcon = document.getElementById(`card-toggle-${sec.id}`);
            if (cardBody) cardBody.style.display = '';
            if (cardIcon) cardIcon.style.transform = 'rotate(0deg)';
        });
    });

    document.getElementById('auditCollapseAllBtn')?.addEventListener('click', () => {
        graduationAudit.sections.forEach(sec => {
            // Table view rows
            document.querySelectorAll(`.audit-row-${sec.id}`).forEach(r => r.style.display = 'none');
            const tableIcon = document.getElementById(`toggle-${sec.id}`);
            if (tableIcon) tableIcon.style.transform = 'rotate(-90deg)';

            // Cards view bodies
            const cardBody = document.getElementById(`card-body-${sec.id}`);
            const cardIcon = document.getElementById(`card-toggle-${sec.id}`);
            if (cardBody) cardBody.style.display = 'none';
            if (cardIcon) cardIcon.style.transform = 'rotate(-90deg)';
        });
    });

    // ── Career Update Button Listener ──
    document.getElementById('btnUpdateCareerGrad')?.addEventListener('click', () => {
        openStudentCareerModal(student, () => renderGraduation(student));
    });

}

/** Replace the sample with the audit the backend computes for this student (the chatbot reads the same data) */
export function loadGraduationAudit(student) {
    const studentId = graduationStudentId || student?.studentId;
    if (!studentId || graduationAuditLoadedFor === studentId) return;
    graduationAuditLoadedFor = studentId;
    fetchAPI(`/students/${encodeURIComponent(studentId)}/graduation-audit`)
        .then(audit => {
            graduationAudit = audit;
            renderGraduation(student);
        })
        .catch(err => {
            if (/HTTP 404/.test(err.message || '')) {
                graduationAudit = null;
                renderGraduation(student);
            } else {
                console.warn('[Graduation] Backend unavailable, showing sample audit:', err.message);
            }
        });
}
