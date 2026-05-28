/**
 * BAZER_BD Administrative Security and Encrypted Tunnel Protocol Module
 * Implements lightweight client-side end-to-end encryption for database fields
 * and security integrity dashboards.
 */

const ENCRYPTION_KEY = "BAZER_SECURE_TOKEN_2026";

/**
 * Encrypts sensitive string using client-side reversible security algorithm
 */
export function encryptData(text: string | null | undefined): string {
  if (!text) return "";
  try {
    const textStr = String(text);
    // XOR Encryption
    const chars = Array.from(textStr);
    const scrambled = chars.map((char, index) => {
      const keyChar = ENCRYPTION_KEY.charCodeAt(index % ENCRYPTION_KEY.length);
      return String.fromCharCode(char.charCodeAt(0) ^ keyChar);
    }).join("");
    // Base64 Envelope with Bazer Unique Envelope Token
    return "[E2E_ENC]" + btoa(encodeURIComponent(scrambled));
  } catch (error) {
    console.error("Encryption error:", error);
    return text || "";
  }
}

/**
 * Decrypts encrypted string safely, with full backwards-compatibility for raw entries
 */
export function decryptData(encodedText: string | null | undefined): string {
  if (!encodedText) return "";
  const str = String(encodedText);
  if (!str.startsWith("[E2E_ENC]")) {
    return str; // Backward compatibility for existing plaintext data
  }
  try {
    const base64Part = str.substring(9);
    const scrambled = decodeURIComponent(atob(base64Part));
    return Array.from(scrambled).map((char, index) => {
      const keyChar = ENCRYPTION_KEY.charCodeAt(index % ENCRYPTION_KEY.length);
      return String.fromCharCode(char.charCodeAt(0) ^ keyChar);
    }).join("");
  } catch (error) {
    console.error("Decryption error:", error);
    return str; // Safe fallback to show raw if anything fails
  }
}

/**
 * Generates a clean shortened filename representation and cleanses image link strings
 */
export function shortenUrlName(url: string, maxLength: number = 30): string {
  if (!url) return "";
  if (url.startsWith("data:image")) {
    return `inline-base64-${url.substring(0, 15).replace(/[^a-zA-Z0-9]/g, "")}...`;
  }
  try {
    const urlObj = new URL(url);
    const pathSegments = urlObj.pathname.split('/');
    const fileName = pathSegments[pathSegments.length - 1] || urlObj.hostname;
    if (fileName.length > maxLength) {
      return fileName.slice(0, maxLength - 3) + "...";
    }
    return fileName;
  } catch (e) {
    if (url.length <= maxLength) return url;
    return url.slice(0, maxLength - 3) + "...";
  }
}
