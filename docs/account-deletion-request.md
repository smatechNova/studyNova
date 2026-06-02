# StudyNova Account Deletion Request

Last updated: June 1, 2026

StudyNova lets signed-in students and parents request account deletion from inside the app. Open the student or parent dashboard, go to the privacy/account deletion section, enter a contact method, type `DELETE`, and submit the request.

If you cannot access the app, use the public StudyNova account deletion page:

Production URL to configure before Play submission:

`https://YOUR-STUDYNOVA-WEB-HOST/delete-account`

The page submits a support-reviewed deletion request without requiring sign-in.

If the public page is unavailable, send an account deletion request to:

StudyNova Support  
Email: support@example.com

Replace this email with the final support contact before Play Store submission.

## What To Include

The public page asks for:

- Whether the account is a student account or parent/guardian account.
- The login ID, phone number, or email used for the account.
- A contact email or phone number where support can reach you.
- The student name or parent/guardian name on the account.
- The word `DELETE`.

## What Happens Next

StudyNova support reviews deletion requests before completion. This protects students and families because parent accounts may be linked to more than one student, and student accounts may have study plans, progress records, and guardian links.

After support verifies the request, StudyNova will complete the deletion process or contact you if more verification is needed. Completing a student request removes that student account, study plans, study proof, reminders, check-ins, invite codes, and parent links for that student. Completing a parent request removes that parent account and parent-student monitoring links without deleting the student accounts.

The deletion request record may be retained for support tracking. Some records may also be retained only where required for safety, legal, dispute, or operational reasons.

## Closed-Test Note

During closed testing, the request workflow records and tracks deletion requests for admin review and scoped backend cleanup. Public production release must use a final support address, hosted privacy policy URL, and hosted account deletion URL using the `/delete-account` route.
