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

<br>

# Day 03 — Error Handling & Infrastructure Setup 

# Centralized Environment Validation

Created:

```txt
src/config/env.ts
```

Purpose:

- validate required environment variables
- fail fast on invalid configuration
- expose typed configuration object

---

# Validation Flow

```txt
.env

↓

dotenv.config()

↓

process.env

↓

zod validation

↓

validated configuration
```

Used:

```ts
safeParse()
```

instead of throwing parsers because validation errors can be handled more safely.

---

# Centralized Error Handling

Created:

```txt
src/middleware/errorHandler.ts
```

Purpose:

- eliminate repetitive try/catch blocks
- centralize API error responses
- simplify controller logic

The backend uses:

```ts
express-async-errors
```

which automatically forwards async thrown errors into the centralized handler.

---

# Error Handler Responsibilities

The error handler:

- extracts status codes
- extracts error messages
- logs stack traces
- returns standardized responses

Response shape:

```json
{
   "success": false,
   "message": "Error Message",
   "stack": "development only"
}
```

Stack traces are exposed only during development.

---

# Express Application Setup

Created:

```txt
src/app.ts
```

Configured middleware:

## Helmet

Used for security headers.

## CORS

Used for frontend/backend communication.

## JSON Parser

Used for request body parsing.

---

# Health Check Endpoint

Created:

```txt
GET /check
```

Returns:

- status
- timestamp

Used for:

- deployment verification
- server monitoring
- infrastructure testing

---

# Server Initialization

Created:

```txt
src/server.ts
```

Responsibilities:

- initialize server
- initialize database layer
- handle process lifecycle
- register shutdown handlers

---

# Graceful Shutdown Implementation

Implemented shutdown handlers for:

- SIGINT
- SIGTERM

---

# Shutdown Process

Graceful shutdown performs:

1. Stop accepting new requests

2. Finish active requests

3. Close database safely

4. Exit process cleanly

---

# Why Graceful Shutdown Matters

Without graceful shutdown:

- requests may terminate midway
- database connections may leak
- deployments become unsafe
- inconsistent state becomes possible

---

# Problem 1 — Prisma Client Import Failure

Encountered:

```ts
import { PrismaClient } from '@prisma/client'
```

Error:

```txt
Module '"@prisma/client"' has no exported member 'PrismaClient'
```

---

# Investigation

Attempted:

```bash
rm -rf node_modules

npm install

rm -rf prisma/generated

npx prisma generate
```

Eventually regenerated Prisma artifacts and resolved dependency inconsistency.

---

# Problem 2 — Incorrect Server Execution

Attempted:

```bash
nodemon --exec ts-node src/server.js
```

This crashed.

Reason:

The backend is TypeScript-based and should execute:

```bash
nodemon --exec ts-node src/server.ts
```

Using `.js` created runtime issues.

---

# Problem 3 — PrismaClientInitializationError

Server crashed during startup:

```txt
PrismaClientInitializationError
```

Spent significant time debugging.

Initially assumed:

- invalid database URL
- broken schema
- failed migration
- corrupted client generation

None solved the issue.

---

# Root Cause Discovery

After research and documentation review, discovered the issue was caused by architectural changes introduced in Prisma 7.

---

## Why It Happened

### Strict Constructor Requirements

Prisma 7 no longer allows:

```ts
new PrismaClient()
```

without explicitly defining runtime configuration.

---

### Missing Runtime Context

The project uses:

```txt
postgresql://...
```

direct PostgreSQL connections.

Prisma 7 now requires a driver adapter layer between Prisma Client and PostgreSQL.

Without this adapter:

Prisma cannot initialize.

---

# Required Dependencies

Installed:

```bash
npm install pg @prisma/adapter-pg

npm install -D @types/pg
```

---

# Refactoring Prisma Setup

Updated:

```txt
src/lib/prisma.ts
```

Implemented:

- PostgreSQL connection pool
- PrismaPg adapter
- adapter injection into Prisma Client

---

# Synchronised Prisma Artifacts

Regenerated Prisma artifacts:

```bash
npx prisma generate
```

---

# Result

Backend startup finally succeeded.

---

# Learnings

Today's work reinforced:

- centralized backend architecture
- middleware design
- server lifecycle management
- graceful shutdown patterns
- debugging infrastructure failures
- Prisma runtime architecture
- adapting to breaking library changes

---

# Current Backend Status

Current backend includes:

✓ Environment Validation

✓ Express Setup

✓ Security Middleware

✓ Error Handling

✓ Health Check Route

✓ Graceful Shutdown

✓ Prisma Initialization

✓ Database Connectivity

---

# Next Steps

- Configure TypeScript project properly
- Create module structure
- Setup route architecture
- Create service layer
- Begin authentication module