import dotenv from "dotenv";
dotenv.config();
import { MailtrapClient } from "mailtrap";
const isProduction = process.env.NODE_ENV === "production";
// Check if MAILTRAP_API_TOKEN is available
const hasMailtrapToken = !!process.env.MAILTRAP_API_TOKEN;
let client;
if (!hasMailtrapToken) {
    console.log("[Mailtrap] MAILTRAP_API_TOKEN not set — emails will be logged to console.");
    // Create a dummy client that logs emails instead of sending
    client = {
        send: async (email) => {
            console.log(`\n========== EMAIL LOG ==========`);
            console.log(`To: ${email.to?.[0]?.email}`);
            console.log(`Subject: ${email.subject}`);
            console.log(`From: ${email.from?.email} (${email.from?.name})`);
            console.log(`================================\n`);
            return { success: true };
        },
    };
}
else {
    console.log("[Mailtrap] Using real Mailtrap client.");
    client = isProduction
        ? new MailtrapClient({
            token: process.env.MAILTRAP_API_TOKEN,
        })
        : new MailtrapClient({
            token: process.env.MAILTRAP_API_TOKEN,
            // @ts-ignore — sandbox is valid at runtime
            sandbox: true,
            testInboxId: Number(process.env.MAILTRAP_TEST_INBOX_ID) || undefined,
        });
}
export { client };
export const sender = {
    email: process.env.MAILTRAP_SENDER_EMAIL || "mailtrap@demomailtrap.com",
    name: "Suman Food",
};
// Helper to send email with error handling
export const sendEmail = async (email) => {
    try {
        await client.send(email);
        if (hasMailtrapToken) {
            console.log(`✅ Email sent to ${email.to[0].email}`);
        }
    }
    catch (error) {
        console.error("❌ Failed to send email:", error.message || error);
    }
};
