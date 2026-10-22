# Cognito Demo Setup

This is the AWS-side setup for `IDENTITY_PROVIDER=cognito`. It uses Cognito's
built-in email sender, so no SES production-access request is needed.

All commands use the AWS CLI. Set the region first:

```bash
AWS_REGION=eu-west-2
```

## 1. Create the user pool

```bash
aws cognito-idp create-user-pool \
  --region "$AWS_REGION" \
  --pool-name jaakd-demo \
  --username-attributes email \
  --auto-verified-attributes email \
  --mfa-configuration OFF \
  --deletion-protection ACTIVE \
  --admin-create-user-config '{"AllowAdminCreateUserOnly":false}' \
  --policies '{"PasswordPolicy":{"MinimumLength":6,"RequireUppercase":false,"RequireLowercase":false,"RequireNumbers":false,"RequireSymbols":false},"SignInPolicy":{"AllowedFirstAuthFactors":["PASSWORD","EMAIL_OTP"]}}' \
  --email-configuration '{"EmailSendingAccount":"COGNITO_DEFAULT"}'
```

Record the returned `UserPool.Id`. Production should use a stronger password
policy; the application only enforces Cognito's minimum, so the pool is the
authority.

## 2. Create the backend app client

```bash
POOL_ID=eu-west-2_example

aws cognito-idp create-user-pool-client \
  --region "$AWS_REGION" \
  --user-pool-id "$POOL_ID" \
  --client-name jaakd-backend \
  --generate-secret \
  --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH ALLOW_USER_AUTH \
  --enable-token-revocation \
  --prevent-user-existence-errors ENABLED
```

Record `ClientId` and `ClientSecret`. The frontend never receives either; the
backend uses the secret for `SECRET_HASH` on `SignUp`, `ConfirmSignUp`,
`ResendConfirmationCode`, and `InitiateAuth`, and for `RevokeToken`.

`ALLOW_USER_AUTH` and the `EMAIL_OTP` sign-in factor are required for automatic
sign-in after confirmation. For an existing pool, add **Email message one-time
password** under **Authentication > Sign-in**, and select **Choice-based
sign-in** on the app client. Give the app client an authentication flow session
duration long enough for the user to fetch and enter the code; the default can be
as short as three minutes.

There are no callback or logout URLs, and no hosted UI. The browser only talks
to the backend.

## 3. Configure the backend

Add to `.env` for local work, or to the deployment's secret configuration:

```env
IDENTITY_PROVIDER=cognito
COGNITO_REGION=eu-west-2
COGNITO_USER_POOL_ID=eu-west-2_example
COGNITO_CLIENT_ID=exampleclientid
COGNITO_CLIENT_SECRET=exampleclientsecret
```

Do not commit the client secret. Use a secret manager or file-based secret in a
deployed environment.

## 4. Verify

1. Start the backend with `IDENTITY_PROVIDER=cognito`.
2. Register from the frontend. Cognito sends a verification code from its
   default sender.
3. Enter the code on `/auth/confirm`. The app should exchange the Cognito
   confirmation session for tokens and load the dashboard without asking for the
   password again.
4. If automatic sign-in is unavailable, confirmation still succeeds and the app
   routes to the sign-in page with the email prefilled.
5. Sign out; confirm the session ends and only that session is revoked.
6. Register again with the same unconfirmed email; confirm the app routes to the
   confirmation page rather than treating it as a confirmed account.

Cognito's default email quota is 50 messages per day per pool. Test delivery to
the demo recipients before relying on it; the default sender can land in spam.

## Pool recreation

`sub` is stable only within a pool. If the demo pool is deleted and recreated,
it gets a new pool ID, client ID, and `sub` values. Existing `cognito_users`
rows then point at identities that no longer exist.

For a demo reset:

1. Disable deletion protection if needed:
   `aws cognito-idp update-user-pool --user-pool-id "$POOL_ID" --deletion-protection INACTIVE`
2. Delete and recreate the pool, then create a new app client.
3. Update `COGNITO_*` values.
4. Clear `cognito_users` and, if desired, reset the application database.
5. Re-register demo users.

Do not do this to a pool holding real users. For a real migration, use a user
migration Lambda, a `custom:userId` hint, or verified-email relinking; see
`prototypes/Kyle/docs/07-cognito-identity-provider-notes.md`.
