# Day 02 — Backend Foundations Setup

## Work Completed

Today focused on starting the backend application setup and establishing foundational backend architecture.

---

# Backend Initialization

Created backend application directory:

```bash
mkdir banking-backend
cd banking-backend
```

Initialized npm:

```bash
npm init -y
```

---

# Installed Runtime Dependencies

```bash
npm install express cors dotenv zod helmet express-async-errors @prisma/client
```

---

# Installed Development Dependencies

```bash
npm install -D typescript ts-node nodemon prisma @types/node @types/express @types/cors
```

---

# Why These Packages Were Chosen

## express

Used as the primary backend HTTP server framework.

---

## cors

Enables controlled cross-origin requests between frontend and backend.

---

## dotenv

Used for environment variable management.

---

## zod

Used for:
- runtime validation
- schema validation
- type-safe environment parsing

---

## helmet

Adds basic HTTP security headers.

---

## express-async-errors

Simplifies async error handling in Express routes.

---

# Environment Variable Validation

Created:

```txt
src/env.ts
```

Purpose:
- validate all required environment variables during startup
- fail fast if configuration is invalid
- provide type-safe access to validated environment variables

---

# Validation Flow

## Step 1 — Load Environment Variables

```ts
import dotenv from "dotenv";

dotenv.config();
```

---

## Step 2 — Define Validation Schema

```ts
const envSchema = z.object({
  ...
});
```

All required environment variables are defined inside the schema.

---

## Step 3 — Validate Environment Variables

```ts
const parsed = envSchema.safeParse(process.env);
```

`safeParse()` returns:

### Success

```ts
{
  success: true,
  data: ...
}
```

### Failure

```ts
{
  success: false,
  error: ...
}
```

---

# Fail-Fast Startup Strategy

If validation fails:
- errors are logged
- application startup is terminated immediately

This prevents:
- invalid runtime configuration
- silent environment issues
- production misconfiguration bugs

---

# Current Backend Status

Backend currently includes:
- dependency setup
- TypeScript tooling
- Express setup preparation
- environment validation architecture

---

# Learnings

Today reinforced understanding of:
- backend initialization
- runtime configuration validation
- fail-fast architecture
- production-safe environment management
- TypeScript backend tooling

---

# Next Steps

- Setup TypeScript configuration
- Create Express server
- Add middleware configuration
- Setup centralized error handling
- Configure Prisma client
- Setup PostgreSQL connection

---