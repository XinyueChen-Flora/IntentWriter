import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

type SendInviteEmailParams = {
  to: string;
  inviterName: string;
  documentTitle: string;
  inviteUrl: string;
  isExistingUser: boolean;
};

export async function sendInviteEmail({
  to,
  inviterName,
  documentTitle,
  inviteUrl,
  isExistingUser,
}: SendInviteEmailParams) {
  const subject = isExistingUser
    ? `${inviterName} added you to "${documentTitle}"`
    : `${inviterName} invited you to collaborate on "${documentTitle}"`;

  const html = isExistingUser
    ? `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>You've been added to a document</h2>
        <p><strong>${inviterName}</strong> has added you as a collaborator on <strong>"${documentTitle}"</strong>.</p>
        <p>Click the button below to open the document:</p>
        <a href="${inviteUrl}" style="display: inline-block; background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 8px;">Open Document</a>
        <p style="color: #666; font-size: 14px; margin-top: 24px;">If the button doesn't work, copy and paste this URL into your browser: ${inviteUrl}</p>
      </div>
    `
    : `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>You've been invited to collaborate</h2>
        <p><strong>${inviterName}</strong> has invited you to collaborate on <strong>"${documentTitle}"</strong> using Intent Writer.</p>
        <p>Click the button below to accept the invitation and join:</p>
        <a href="${inviteUrl}" style="display: inline-block; background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 8px;">Accept Invitation</a>
        <p style="color: #666; font-size: 14px; margin-top: 24px;">This invitation expires in 7 days.</p>
        <p style="color: #666; font-size: 14px;">If the button doesn't work, copy and paste this URL into your browser: ${inviteUrl}</p>
      </div>
    `;

  await resend.emails.send({
    from: 'Intent Writer <noreply@resend.dev>',
    to,
    subject,
    html,
  });
}
