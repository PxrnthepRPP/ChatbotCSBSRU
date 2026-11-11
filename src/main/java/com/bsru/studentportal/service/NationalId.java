package com.bsru.studentportal.service;

/**
 * Thai national ID numbers (เลขประจำตัวประชาชน 13 หลัก): normalising what an admin typed or a CSV
 * held, checking the check digit, and the masked form shown everywhere except the admin's own view.
 */
public final class NationalId {

    private NationalId() {
    }

    /** Digits only ("1-1017-00203-45-1" or "1 1017 ..." -> "1101700203450"); null stays null */
    public static String normalize(String raw) {
        return raw == null ? null : raw.replaceAll("[\\s-]", "");
    }

    /** 13 digits and the last one is the check digit: (11 - sum(d[i] * (13 - i)) mod 11) mod 10 */
    public static boolean isValid(String id) {
        if (id == null || !id.matches("\\d{13}")) return false;
        int sum = 0;
        for (int i = 0; i < 12; i++) {
            sum += (id.charAt(i) - '0') * (13 - i);
        }
        return (11 - sum % 11) % 10 == id.charAt(12) - '0';
    }

    /** Problem with the value for the admin form / CSV row, or null when it is fine */
    public static String problem(String normalized) {
        if (normalized == null || normalized.isEmpty()) return "กรุณากรอกเลขบัตรประชาชน 13 หลัก";
        if (!normalized.matches("\\d{13}")) return "เลขบัตรประชาชนต้องเป็นตัวเลข 13 หลัก";
        if (!isValid(normalized)) return "เลขบัตรประชาชนไม่ถูกต้อง (ตัวเลขหลักสุดท้ายไม่ตรงกับเลขตรวจสอบ) กรุณาตรวจสอบอีกครั้ง";
        return null;
    }

    /** "1101700203450" -> "x-xxxx-xxxxx-45-0"; null when there is no number */
    public static String mask(String id) {
        if (id == null || id.length() != 13) return null;
        return "x-xxxx-xxxxx-" + id.substring(10, 12) + "-" + id.charAt(12);
    }
}
