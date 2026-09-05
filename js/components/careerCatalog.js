/* ================================================================
   BSRU Student Portal — Career Catalog & Standards
   ================================================================
   Standardized definitions for Graduate Careers, Employment Statuses,
   and Salary Ranges to ensure clean, consistent data collection.
   ================================================================ */

export const EMPLOYMENT_STATUSES = [
    { id: 'direct_tech', label: 'งานตรงสาย (IT & CS)', badgeClass: 'badge-career' },
    { id: 'business', label: 'ธุรกิจส่วนตัว / อิสระ', badgeClass: 'badge-business' },
    { id: 'other_job', label: 'งานไม่ตรงสาย', badgeClass: 'badge-default' },
    { id: 'further_study', label: 'กำลังศึกษาต่อ', badgeClass: 'badge-default' },
    { id: 'unemployed', label: 'ว่างงาน / กำลังหางาน', badgeClass: 'badge-unemployed' },
];

export const STANDARD_CAREERS = [
    { id: 'Full-Stack Developer', name: 'Full-Stack Developer', icon: '💻', category: 'direct_tech' },
    { id: 'Frontend Developer', name: 'Frontend Developer', icon: '💻', category: 'direct_tech' },
    { id: 'Backend Developer', name: 'Backend Developer', icon: '💻', category: 'direct_tech' },
    { id: 'Mobile Developer', name: 'Mobile Developer', icon: '📱', category: 'direct_tech' },
    { id: 'Data Analyst', name: 'Data Analyst', icon: '📊', category: 'direct_tech' },
    { id: 'AI/ML Engineer', name: 'AI/ML Engineer', icon: '🤖', category: 'direct_tech' },
    { id: 'DevOps Engineer', name: 'DevOps Engineer', icon: '⚙️', category: 'direct_tech' },
    { id: 'Cloud Architect', name: 'Cloud Architect', icon: '☁️', category: 'direct_tech' },
    { id: 'Cybersecurity Analyst', name: 'Cybersecurity Analyst', icon: '🔒', category: 'direct_tech' },
    { id: 'UX/UI Designer', name: 'UX/UI Designer', icon: '🎨', category: 'direct_tech' },
    { id: 'QA Engineer', name: 'QA Engineer', icon: '🧪', category: 'direct_tech' },
    { id: 'Database Administrator', name: 'Database Administrator', icon: '🗄️', category: 'direct_tech' },
    { id: 'System Administrator', name: 'System Administrator', icon: '🖥️', category: 'direct_tech' },
    { id: 'Game Developer', name: 'Game Developer', icon: '🎮', category: 'direct_tech' },
    { id: 'IT Consultant', name: 'IT Consultant', icon: '👔', category: 'direct_tech' },
    { id: 'เจ้าของธุรกิจ', name: 'เจ้าของธุรกิจ / สตาร์ทอัพ', icon: '🏢', category: 'business' },
    { id: 'ฟรีแลนซ์', name: 'ฟรีแลนซ์ / ผู้ประกอบการอิสระ', icon: '💼', category: 'business' },
    { id: 'ว่างงาน', name: 'ว่างงาน / อยู่ระหว่างหางาน', icon: '⚠️', category: 'unemployed' },
    { id: 'ศึกษาต่อ', name: 'ศึกษาต่อระดับบัณฑิตศึกษา', icon: '🎓', category: 'other' },
    { id: 'other', name: 'อื่นๆ (ระบุเอง)', icon: '📝', category: 'other' },
];

export const SALARY_RANGES = [
    '< 20,000 บาท',
    '20,000 - 30,000 บาท',
    '30,000 - 45,000 บาท',
    '45,000 - 60,000 บาท',
    '> 60,000 บาท',
];

/**
 * Categorize a career for styling and grouping.
 * @param {string} career 
 * @param {string} [employmentStatus]
 * @returns {'unemployed' | 'business' | 'direct_tech'}
 */
export function getCareerCategory(career = '', employmentStatus = '') {
    if (employmentStatus) {
        if (employmentStatus.includes('ว่างงาน')) return 'unemployed';
        if (employmentStatus.includes('ธุรกิจ') || employmentStatus.includes('อิสระ')) return 'business';
        if (employmentStatus.includes('ตรงสาย')) return 'direct_tech';
    }

    const c = career.trim();
    if (c.includes('ว่างงาน') || c.includes('หางาน')) return 'unemployed';
    if (c.includes('ธุรกิจ') || c.includes('สตาร์ทอัพ') || c.includes('ฟรีแลนซ์')) return 'business';
    return 'direct_tech';
}
