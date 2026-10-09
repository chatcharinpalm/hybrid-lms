import { randomInt } from "node:crypto";

/** No 0/O, 1/I/L: the code is read off a paper slip and typed in by hand. */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const ACCESS_CODE_LENGTH = 6;

export function generateAccessCode(): string {
  let code = "";
  for (let i = 0; i < ACCESS_CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

/** "68-020416-1001-0", "6802041610010" and "68 020416 1001 0" are the same student. */
export const studentCodeDigits = (code: string) => code.replace(/\D/g, "");

/** Roster students have no real e-mail; the account's login key is derived from the student code. */
export const rosterEmail = (studentCode: string) => `${studentCodeDigits(studentCode)}@student.local`;

const thai = new Intl.Collator("th");

/**
 * Class-list order: ก–ฮ by first name, then surname (Thai collation skips the
 * leading vowels เ แ โ ใ ไ, like a Thai dictionary). Seat numbers ("เลขที่")
 * on the sign-in sheet and on the exam paper both come from this order.
 */
export function byThaiName<T extends { firstName: string; lastName: string }>(a: T, b: T) {
  return thai.compare(a.firstName, b.firstName) || thai.compare(a.lastName, b.lastName);
}
