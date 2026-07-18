import crypto from "crypto";

/**
 * Generates a random numeric verification code (e.g. for email verification,
 * OTP, password reset). Uses crypto.randomInt instead of Math.random for a
 * cryptographically secure random source — appropriate since this gates
 * account verification / password reset flows.
 */
export const generateVerificationCode = (length = 6): string => {
  // Validate length
  if (length < 4 || length > 8) {
    throw new Error("Verification code length must be between 4 and 8 digits");
  }

  const characters = "0123456789";
  let verificationCode = "";

  for (let i = 0; i < length; i++) {
    const randomIndex = crypto.randomInt(0, characters.length);
    verificationCode += characters[randomIndex];
  }

  return verificationCode;
};

/**
 * Generates a secure random token for password reset links.
 * Uses crypto.randomBytes for URL-safe token generation.
 */
export const generateResetToken = (length = 32): string => {
  return crypto.randomBytes(length).toString("hex");
};

/**
 * Generates a hash of the reset token for secure storage in DB.
 * Prevents attackers from using the token even if DB is compromised.
 */
export const hashToken = (token: string): string => {
  return crypto.createHash("sha256").update(token).digest("hex");
};
