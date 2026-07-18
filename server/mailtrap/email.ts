import {
  generatePasswordResetEmailHtml,
  generateResetSuccessEmailHtml,
  generateVerificationEmailHtml,
  generateWelcomeEmailHtml,
} from "./htmlEmail.ts";
import { client, sender } from "./mailtrap.ts";

export const sendVerificationEmail = async (
  email: string,
  verificationToken: string,
) => {
  if (!client) {
    console.warn("⚠️ Mailtrap not configured — verification email not sent");
    return;
  }

  const recipient = [{ email }];
  try {
    await client.send({
      from: sender,
      to: recipient,
      subject: "Verify your email",
      html: generateVerificationEmailHtml(verificationToken),
      category: "Email Verification",
    });
    console.log(`✅ Verification email sent to ${email}`);
  } catch (error) {
    console.error("❌ Failed to send verification email:", error);
    // Don't throw — email failure shouldn't break auth flow
  }
};

export const sendWelcomeEmail = async (email: string, name: string) => {
  if (!client) {
    console.warn("⚠️ Mailtrap not configured — welcome email not sent");
    return;
  }

  const recipient = [{ email }];
  const htmlContent = generateWelcomeEmailHtml(name);
  try {
    await client.send({
      from: sender,
      to: recipient,
      subject: "Welcome to Suman Food",
      html: htmlContent,
      template_variables: {
        company_info_name: "Suman Food",
        name: name,
      },
    });
    console.log(`✅ Welcome email sent to ${email}`);
  } catch (error) {
    console.error("❌ Failed to send welcome email:", error);
    // Don't throw
  }
};

export const sendPasswordResetEmail = async (
  email: string,
  resetURL: string,
) => {
  if (!client) {
    console.warn("⚠️ Mailtrap not configured — password reset email not sent");
    return;
  }

  const recipient = [{ email }];
  const htmlContent = generatePasswordResetEmailHtml(resetURL);
  try {
    await client.send({
      from: sender,
      to: recipient,
      subject: "Reset your password",
      html: htmlContent,
      category: "Reset Password",
    });
    console.log(`✅ Password reset email sent to ${email}`);
  } catch (error) {
    console.error("❌ Failed to send password reset email:", error);
    // Don't throw
  }
};

export const sendResetSuccessEmail = async (email: string) => {
  if (!client) {
    console.warn("⚠️ Mailtrap not configured — reset success email not sent");
    return;
  }

  const recipient = [{ email }];
  const htmlContent = generateResetSuccessEmailHtml();
  try {
    await client.send({
      from: sender,
      to: recipient,
      subject: "Password Reset Successfully",
      html: htmlContent,
      category: "Password Reset",
    });
    console.log(`✅ Reset success email sent to ${email}`);
  } catch (error) {
    console.error("❌ Failed to send reset success email:", error);
    // Don't throw
  }
};
