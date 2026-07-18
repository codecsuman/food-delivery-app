/**
 * Generates a random numeric verification code (e.g. for email verification,
 * OTP, password reset). Uses crypto.randomInt instead of Math.random for a
 * cryptographically secure random source — appropriate since this gates
 * account verification / password reset flows.
 */
export declare const generateVerificationCode: (length?: number) => string;
/**
 * Generates a secure random token for password reset links.
 * Uses crypto.randomBytes for URL-safe token generation.
 */
export declare const generateResetToken: (length?: number) => string;
/**
 * Generates a hash of the reset token for secure storage in DB.
 * Prevents attackers from using the token even if DB is compromised.
 */
export declare const hashToken: (token: string) => string;
//# sourceMappingURL=generateVerificationCode.d.ts.map