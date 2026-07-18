export const generateVerificationEmailHtml = (verificationToken) => {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verification</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                background-color: #f4f4f4;
                margin: 0;
                padding: 0;
            }
            .container {
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                background-color: #ffffff;
                border-radius: 10px;
                box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
            }
            .header {
                text-align: center;
                padding: 20px 0;
            }
            .header h1 {
                margin: 0;
                color: #e11d48;
            }
            .content {
                padding: 20px;
                text-align: center;
            }
            .content h2 {
                color: #333333;
            }
            .content p {
                color: #666666;
                font-size: 16px;
                line-height: 1.5;
            }
            .content .code {
                font-size: 32px;
                font-weight: bold;
                color: #e11d48;
                margin: 20px 0;
                padding: 15px;
                border: 2px dashed #e11d48;
                border-radius: 8px;
                background-color: #fff1f2;
                letter-spacing: 4px;
            }
            .footer {
                text-align: center;
                padding: 20px;
                font-size: 14px;
                color: #999999;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🔐 Verify Your Email</h1>
            </div>
            <div class="content">
                <h2>Hello,</h2>
                <p>Thank you for registering with Suman Food. To complete your registration, please verify your email address by entering the following verification code:</p>
                <div class="code">${verificationToken}</div>
                <p>This code will expire in 24 hours.</p>
                <p>If you did not request this verification, please ignore this email.</p>
            </div>
            <div class="footer">
                <p>&copy; ${new Date().getFullYear()} Suman Food. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    `;
};
export const generateWelcomeEmailHtml = (name) => {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome</title>
        <style>
            .email-container {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                padding: 20px;
                background-color: #f4f4f4;
                border-radius: 10px;
                max-width: 600px;
                margin: auto;
            }
            .email-header {
                background-color: #e11d48;
                color: white;
                padding: 10px;
                text-align: center;
                border-radius: 10px 10px 0 0;
            }
            .email-body {
                padding: 20px;
                background-color: white;
                border-radius: 0 0 10px 10px;
            }
            .email-footer {
                text-align: center;
                padding: 10px;
                font-size: 12px;
                color: #777;
            }
        </style>
    </head>
    <body>
        <div class="email-container">
            <div class="email-header">
                <h1>🍕 Welcome to Suman Food!</h1>
            </div>
            <div class="email-body">
                <p>Hi ${name},</p>
                <p>Congratulations! Your email has been successfully verified.</p>
                <p>We are excited to have you on board at Suman Food. Explore our platform and enjoy delicious food from the best restaurants.</p>
                <p>If you have any questions or need assistance, feel free to reach out to us.</p>
                <p>Best Regards,<br/>The Suman Food Team</p>
            </div>
            <div class="email-footer">
                <p>&copy; ${new Date().getFullYear()} Suman Food. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    `;
};
export const generatePasswordResetEmailHtml = (resetURL) => {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Password</title>
        <style>
            .email-container {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                padding: 20px;
                background-color: #f4f4f4;
                border-radius: 10px;
                max-width: 600px;
                margin: auto;
            }
            .email-header {
                background-color: #d9534f;
                color: white;
                padding: 10px;
                text-align: center;
                border-radius: 10px 10px 0 0;
            }
            .email-body {
                padding: 20px;
                background-color: white;
                border-radius: 0 0 10px 10px;
            }
            .email-footer {
                text-align: center;
                padding: 10px;
                font-size: 12px;
                color: #777;
            }
            .button {
                display: inline-block;
                padding: 12px 24px;
                margin: 20px 0;
                font-size: 16px;
                color: white;
                background-color: #d9534f;
                text-decoration: none;
                border-radius: 6px;
            }
            .button:hover {
                background-color: #c9302c;
            }
        </style>
    </head>
    <body>
        <div class="email-container">
            <div class="email-header">
                <h1>🔑 Reset Your Password</h1>
            </div>
            <div class="email-body">
                <p>Hi,</p>
                <p>We received a request to reset your password. Click the button below to reset it.</p>
                <a href="${resetURL}" class="button">Reset Password</a>
                <p>Or copy and paste this link:</p>
                <p style="word-break: break-all; color: #e11d48;">${resetURL}</p>
                <p>This link will expire in 1 hour.</p>
                <p>If you didn't request a password reset, please ignore this email.</p>
                <p>Thank you,<br/>The Suman Food Team</p>
            </div>
            <div class="email-footer">
                <p>&copy; ${new Date().getFullYear()} Suman Food. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    `;
};
export const generateResetSuccessEmailHtml = () => {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset Successful</title>
        <style>
            .email-container {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                padding: 20px;
                background-color: #f4f4f4;
                border-radius: 10px;
                max-width: 600px;
                margin: auto;
            }
            .email-header {
                background-color: #22c55e;
                color: white;
                padding: 10px;
                text-align: center;
                border-radius: 10px 10px 0 0;
            }
            .email-body {
                padding: 20px;
                background-color: white;
                border-radius: 0 0 10px 10px;
            }
            .email-footer {
                text-align: center;
                padding: 10px;
                font-size: 12px;
                color: #777;
            }
        </style>
    </head>
    <body>
        <div class="email-container">
            <div class="email-header">
                <h1>✅ Password Reset Successful</h1>
            </div>
            <div class="email-body">
                <p>Hi,</p>
                <p>Your password has been successfully reset. You can now log in with your new password.</p>
                <p>If you did not request this change, please contact our support team immediately.</p>
                <p>Thank you,<br/>The Suman Food Team</p>
            </div>
            <div class="email-footer">
                <p>&copy; ${new Date().getFullYear()} Suman Food. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    `;
};
//# sourceMappingURL=htmlEmail.js.map