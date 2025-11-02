import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmailOtp(email, otp) {
    const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:auto;padding:20px;border-radius:8px;background:#ffffff;color:#111;">
    <h2 style="margin:0 0 10px;font-size:20px;">🔐 Shinra Deskware Verification</h2>
    <p style="font-size:14px;margin:0 0 15px;">Your One-Time Password (OTP) is below:</p>
    
    <div style="font-size:32px;font-weight:bold;text-align:center;padding:14px 0;border:1px solid #ddd;border-radius:6px;background:#f8f8f8;margin-bottom:15px;">
      ${otp}
    </div>

    <p style="font-size:13px;margin:0 0 12px;color:#555;">This OTP is valid for <b>5 minutes</b>.</p>
    <p style="font-size:12px;margin:0;color:#777;">If you did not request this, you can safely ignore this email.</p>

    <hr style="margin:20px 0;border:none;border-top:1px solid #eee;" />

    <p style="font-size:12px;color:#aaa;text-align:center;">© ${new Date().getFullYear()} Shinra Deskware. All rights reserved.</p>
  </div>
  `;

    return await resend.emails.send({
        from: "Shinra Deskware <no-reply@shinra-deskware.com>",
        to: email,
        subject: "Shinra Deskware: Your Secure Verification Code",
        html
    });
}
