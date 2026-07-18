import { MailtrapClient } from "mailtrap";
declare let client: MailtrapClient;
export { client };
export declare const sender: {
    email: string;
    name: string;
};
interface EmailPayload {
    from: {
        email: string;
        name: string;
    };
    to: {
        email: string;
    }[];
    subject: string;
    html: string;
    category?: string;
}
export declare const sendEmail: (email: EmailPayload) => Promise<void>;
//# sourceMappingURL=mailtrap.d.ts.map