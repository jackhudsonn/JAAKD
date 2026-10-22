# Cognito Demo Setup

This is the AWS-side setup for `IDENTITY_PROVIDER=cognito`. It uses Cognito's
built-in email sender, so no SES production-access request is needed.

The pool uses an opaque UUID username and the email address as a verified alias.
Cognito cannot change the sign-in identifier after pool creation, so use the
console flow below rather than converting an existing email-username pool.

## 1. Create the user pool

1. Open **Amazon Cognito → User pools → Create user pool**.
2. Choose **Traditional web application**.
3. Name the application `jaakd-demo-v2`.
4. Under **Configure options → Options for sign-in identifiers**, select both:
   - **Username**
   - **Email**
5. Leave **Email** selected under **Required attributes for sign-up**.
6. Leave **Add a return URL** blank. JAAKD does not use the hosted login page.
7. Create the pool.

Selecting both Username and Email produces alias attributes. Selecting Email
alone produces an email-as-username pool, which cannot allow a second person to
claim an unconfirmed address.

Record the pool ID from **Overview** or **General settings**.

Production should use a stronger password policy; the application only enforces
Cognito's minimum, so the pool is the authority.

## 2. Configure the app client

The quick-create flow creates an app client with the pool. If it did not create
a secret, create a new client under **Applications → App clients → Create app
client** using **Traditional web application**.

Open the client and edit:

- **Authentication flows**
  - Enable **Username and password**
  - Enable **Get user tokens from existing authenticated sessions**
  - Enable **Choice-based sign-in**
- **Advanced authentication settings**
  - Enable **Token revocation**
  - Enable **Prevent user existence errors**
- **Authentication flow session duration**
  - Set it to **15 minutes** so there is enough time to enter the emailed code.

Record the client ID and secret from **Applications → App clients →** the
client → **Client secret → Show**.

The frontend never receives either value. The backend uses the secret for
`SECRET_HASH` on `SignUp`, `ConfirmSignUp`, `ResendConfirmationCode`, and
`InitiateAuth`, and for `RevokeToken`.

## 3. Configure the pool

Under **Authentication → Authentication methods**:

- Password minimum length: **6**
- All complexity requirements: **off**
- MFA: **No MFA / Off**

Under **Authentication → Sign-in**:

- **Options for choice-based sign-in** → enable **Email message one-time password**

This is required for automatic sign-in after confirmation.

Under **Authentication → Sign-up**:

- Self-service sign-up: **enabled**
- Attribute verification and user account confirmation: allow Cognito to send
  verification messages and verify **email**

Under **Settings → User pool security**:

- Confirm **Deletion protection** is active.

Under **Messaging** or **Branding → Message templates**:

- Leave the default Cognito email sender and verification code template.

There are no callback or logout URLs, and no hosted UI. The browser only talks
to the backend.

## 4. Configure the backend

Add to `.env` for local work, or to the deployment's secret configuration:

```env
IDENTITY_PROVIDER=cognito
COGNITO_REGION=us-east-1
COGNITO_USER_POOL_ID=<pool id>
COGNITO_CLIENT_ID=<client id>
COGNITO_CLIENT_SECRET=<client secret>
COGNITO_RETRY_ATTEMPTS=2
```

Do not commit the client secret. Use a secret manager or file-based secret in a
deployed environment.

If you are reusing a database that still points at an old pool, clear the link
rows once:

```bash
docker compose exec -T jaakd-postgres psql -U postgres -d jaakd \
  -c 'TRUNCATE TABLE cognito_users;'
```

## 5. Verify

1. Start the backend with `IDENTITY_PROVIDER=cognito`.
2. Register from the frontend. Cognito sends a verification code from its
   default sender.
3. Enter the code on `/auth/confirm`. The app exchanges the Cognito confirmation
   session for tokens and loads the dashboard without asking for the password
   again.
4. If automatic sign-in is unavailable, confirmation still succeeds and the app
   routes to the sign-in page with the email prefilled.
5. Sign out; confirm the session ends and only that session is revoked.
6. Register again with the same unconfirmed email. A new registration is
   allowed; confirming it transfers the email alias to the new account.
7. Register with an already-confirmed email; confirm the API returns `409`.

Cognito's default email quota is 50 messages per day per pool. Test delivery to
the demo recipients before relying on it; the default sender can land in spam.

## Pool recreation

`sub` is stable only within a pool. If the demo pool is deleted and recreated,
it gets a new pool ID, client ID, and `sub` values. Existing `cognito_users`
rows then point at identities that no longer exist.

For a demo reset:

1. Select the pool → **Settings → User pool security** → deactivate deletion
   protection.
2. Delete and recreate the pool with the console flow above.
3. Update the `COGNITO_*` values.
4. Clear `cognito_users` and, if desired, reset the application database.
5. Re-register demo users.

Do not do this to a pool holding real users. For a real migration, use a user
migration Lambda, a `custom:userId` hint, or verified-email relinking; see
`prototypes/Kyle/docs/07-cognito-identity-provider-notes.md`.
