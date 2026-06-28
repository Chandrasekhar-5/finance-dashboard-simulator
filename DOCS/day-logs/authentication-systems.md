
To support production authentication workflows, an email service layer was introduced.

Installed:

```bash
npm install resend passport passport-google-oauth20

npm install -D \
@types/passport \
@types/passport-google-oauth20
```

---

# Environment Configuration

Updated:

```txt
src/config/env.ts
```

Added support for:

- Resend API Key
- Sender Email Address
- Google Client ID
- Google Client Secret
- Google OAuth Callback URL

Purpose:

Provide strongly validated configuration for external authentication services.

---

# Email Service Layer

Created:

```txt
src/services/email.service.ts
```

Purpose:

Centralize all outbound email functionality.

This prevents authentication logic from directly interacting with email providers.

---

# Email Responsibilities

Implemented:

## sendVerificationEmail()

Sends email verification links.

---

## sendPasswordResetEmail()

Sends password recovery links.

---

## sendWelcomeEmail()

Sends onboarding email after successful registration.

---

# Why a Separate Email Service?

Separating email delivery from authentication provides:

- cleaner architecture
- easier testing
- provider independence
- future support for multiple providers

Authentication only requests an email to be sent.

The Email Service decides how.

---

# OAuth Database Design

Authentication was extended to support external identity providers.

Created:

```txt
OAuthAccount
```

model.

Purpose:

Store linked third-party login providers separately from the User model.

---

# User Model Updates

Updated:

```txt
User
```

model.

Changes:

- password became optional
- linked OAuth accounts relationship added

Purpose:

Support users authenticated exclusively through OAuth providers.

---

# Why Separate OAuth Accounts?

Instead of storing Google information directly inside the User table:

```txt
User

↓

OAuthAccount(s)
```

allows:

- Google

- GitHub

- Microsoft

- Apple

- future providers

to be linked to the same user account.

---

# Google OAuth Strategy

Implemented Passport Google Strategy.

Configured using:

- Client ID
- Client Secret
- Callback URL

obtained from Google Cloud.

---

# OAuth Authentication Flow

When Google authenticates a user, Passport receives:

```txt
accessToken

refreshToken

profile
```

The profile contains:

- email
- name
- avatar
- Google account identifier

---

# Email Validation

The first verified email is extracted from the Google profile.

If no email exists:

```txt
Authentication Fails
```

Reason:

The application requires a verified email for identity management.

---

# Existing OAuth Account

Flow:

```txt
Google Login

↓

Find OAuth Account

↓

Exists

↓

Update Profile Information

↓

Login User
```

Profile information such as avatar or display name can be synchronized during login.

---

# Existing User Without Google Link

Flow:

```txt
Google Login

↓

Find User By Email

↓

User Exists

↓

No Google Link

↓

Create OAuth Account

↓

Login User
```

Purpose:

Allow existing password users to link Google authentication without creating duplicate accounts.

---

# New User Registration

Flow:

```txt
Google Login

↓

No User Found

↓

Create User

↓

Mark Email Verified

↓

Create OAuth Account

↓

Login
```

Since Google already verifies email ownership:

```txt
emailVerified = true
```

is set immediately.

No additional verification email is required.

---

# Session Serialization

Implemented:

```txt
serializeUser()
```

Purpose:

Store only the user ID inside the Passport session.

Benefits:

- reduced session size
- improved performance
- minimal stored data

---

# Session Deserialization

Implemented:

```txt
deserializeUser()
```

Purpose:

Retrieve the complete user record for authenticated requests.

Flow:

```txt
Session

↓

User ID

↓

Database Lookup

↓

User Object
```

---

# OAuth Decision Flow

Current Google login flow:

```txt
Google Login

│

├── Find OAuth Account

│

├── Exists?

│   ├── Update Profile Information

│   └── Login User

│

└── Not Found

    │

    ├── Find User By Email

    │

    ├── User Exists?

    │   ├── Link Google Account

    │   └── Login User

    │

    └── Create User

        ├── Mark Email Verified

        ├── Create OAuth Account

        └── Login User
```

---

# Security Improvements

OAuth integration provides:

✓ Verified Google identities

✓ Secure account linking

✓ Prevention of duplicate accounts

✓ Multiple authentication methods per user

✓ Automatic email verification

---

# Identity System Status

Authentication now supports:

✓ Email Registration

✓ Password Authentication

✓ Refresh Tokens

✓ Session Storage

✓ Password Recovery

✓ Email Verification

✓ Protected Routes

✓ Rate Limiting

✓ Google OAuth

✓ OAuth Account Linking

✓ Multi-Provider Identity Support

---

# Architecture Achieved

Current identity architecture:

```txt
                 User
                  │
      ┌───────────┴───────────┐
      │                       │
 Password Login        OAuth Accounts
      │                       │
      │              ┌────────┴────────┐
      │              │                 │
 Refresh Tokens    Google         Future Providers
      │
 Email Verification
      │
 Password Recovery
```

---

# Learnings

Today's work reinforced:

- OAuth authentication

- account linking strategies

- provider abstraction

- email service separation

- production identity architecture

- third-party authentication integration

---

# Authentication Module Status

The authentication module has evolved from a simple login system into a production-oriented identity platform.

Current capabilities include:

- Credential-based authentication
- OAuth authentication
- Session management
- Email verification
- Password recovery
- Secure token lifecycle management
- Route protection
- API documentation
- Security hardening

The remaining work before considering this module production-ready is focused on operational concerns such as audit logging, multi-factor authentication, and monitoring rather than core authentication functionality.
