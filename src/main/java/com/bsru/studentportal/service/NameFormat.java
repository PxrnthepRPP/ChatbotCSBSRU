package com.bsru.studentportal.service;

/**
 * English names are shown in one style whatever case the admin typed:
 * every word starts with a capital, the rest is lower case
 * ("somchai jaidee" / "SOMCHAI JAIDEE" -> "Somchai Jaidee", "mr. o'neil-smith" -> "Mr. O'Neil-Smith").
 * Only A–Z letters change; Thai text and other characters are left as they are.
 * Same rule as PostgreSQL initcap(), used by the migration for older rows.
 */
public final class NameFormat {

    private NameFormat() {
    }

    public static String titleCaseEn(String name) {
        if (name == null) return null;
        StringBuilder out = new StringBuilder(name.length());
        boolean wordStart = true;
        for (char c : name.toCharArray()) {
            boolean english = (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');
            if (english) {
                out.append(wordStart ? Character.toUpperCase(c) : Character.toLowerCase(c));
                wordStart = false;
            } else {
                out.append(c);
                // A new word starts after a space, dot, hyphen, apostrophe ...; not inside Thai or digits
                wordStart = !Character.isLetterOrDigit(c);
            }
        }
        return out.toString();
    }
}
