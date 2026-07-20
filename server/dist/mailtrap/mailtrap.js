import dotenv from "dotenv";
dotenv.config();
import { MailtrapClient } from "mailtrap";
// ===============================
// Environment Variables
// ===============================
const MAILTRAP_API_TOKEN = process.env.MAILTRAP_API_TOKEN;
const MAILTRAP_SENDER_EMAIL = process.env.MAILTRAP_SENDER_EMAIL || "hello@demomailtrap.com";
// ===============================
// Mailtrap Client
// ===============================
let client;
if (!MAILTRAP_API_TOKEN) {
    console.warn("⚠️ MAILTRAP_API_TOKEN is missing. Emails will only be logged to the console.");
    client = {
        send: async (email) => {
            console.log("\n========== EMAIL LOG ==========");
            console.log("To:", email.to?.map((r) => r.email).join(", "));
            console.log("Subject:", email.subject);
            console.log("From:", email.from?.email);
            console.log("================================\n");
            return { success: true };
        },
    };
}
else {
    console.log("✅ Mailtrap client initialized.");
    client = new MailtrapClient({
        token: MAILTRAP_API_TOKEN,
    });
}
export { client };
// ===============================
// Sender
// ===============================
export const sender = {
    email: MAILTRAP_SENDER_EMAIL,
    name: "Suman Food",
};
// ===============================
// Send Email Helper
// ===============================
export const sendEmail = async (email) => {
    try {
        await client.send(email);
        console.log(`✅ Email sent successfully to ${email.to[0].email}`);
        return true;
    }
    catch (error) {
        console.error("\n❌ Mailtrap Email Error");
        console.error("Message:", error.message);
        if (error.status) {
            console.error("Status:", error.status);
        }
        if (error.response?.data) {
            console.error("Response:", error.response.data);
        }
        console.error(error);
        return false;
    }
};
