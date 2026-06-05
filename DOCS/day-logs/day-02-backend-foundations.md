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

---

# Day 04 — Authentication System Implementation

## Work Completed

Today's focus was implementing the authentication system architecture and establishing proper separation between validation, business logic, and HTTP handling.

---

# Installed Authentication Dependencies

Installed:

```bash
npm install bcrypt jsonwebtoken cookie-parser
```

Installed types:

```bash
npm install -D \
@types/bcrypt \
@types/jsonwebtoken \
@types/cookie-parser
```

Purpose:

- bcrypt → password hashing
- jsonwebtoken → authentication tokens
- cookie-parser → cookie handling

---

# Custom Error Architecture

Created:

```txt
src/utils/AppError.ts
```

Purpose:

- standardized application errors
- centralized status codes
- consistent error handling

---

# AppError Design

Created a custom class extending:

```ts
Error
```

Included:

- message
- statusCode

Also used:

```ts
Error.captureStackTrace()
```

Purpose:

- cleaner debugging
- preserve stack trace integrity

---

# Request Validation Middleware

Created:

```txt
src/middleware/validate.ts
```

Purpose:

- validate requests before reaching controllers
- reject invalid payloads automatically
- centralize request validation

---

# Validation Flow

Incoming Request

↓

Validation Middleware

↓

Zod Schema Check

↓

Valid Request → Continue

OR

↓

Invalid Request → Return 400

---

# Validation Strategy

The middleware validates:

```ts
req.body

req.query

req.params
```

using:

```ts
schema.parseAsync()
```

---

# Validation Failure Response

Invalid requests return:

```json
{
   "success": false,
   "message": "Validation Error",
   "details": [...]
}
```

Validation details include:

- field path
- failure message

---

# Authentication Module Structure

Created:

```txt
src/modules/auth/
```

Goal:

Separate:

- schemas
- business logic
- HTTP handling

This improves:

- maintainability
- testing
- scalability

---

# Authentication Schemas

Created:

```txt
auth.schema.ts
```

Implemented:

## Register Schema

Fields:

- firstName
- lastName
- email
- password

---

## Login Schema

Fields:

- email
- password

---

# Authentication Service Layer

Created:

```txt
auth.service.ts
```

Purpose:

Contains business logic only.

Controllers should not contain business rules.

---

# Register Flow

Registration performs:

1. Check existing user

2. Throw error if exists

3. Hash password

4. Create user

5. Generate tokens

6. Return tokens

---

# Login Flow

Login performs:

1. Find user

2. Validate existence

3. Compare password

4. Generate tokens

5. Return tokens

---

# Password Security

Used:

```ts
bcrypt.hash()
```

and:

```ts
bcrypt.compare()
```

Passwords are never stored directly.

---

# Token Generation

Authentication generates:

## Access Token

Used for:

- authenticated requests

---

## Refresh Token

Used for:

- session renewal

---

# Authentication Controller Layer

Created:

```txt
auth.controller.ts
```

Responsibilities:

- receive requests
- call services
- return responses

Controllers remain thin.

---

# Cookie Handling

Refresh token is stored inside:

```txt
HTTP Cookies
```

This allows:

- persistent sessions
- refresh token separation

---

# Logout Flow

Logout performs:

1. Clear refresh token cookie

2. Return success response

---

# Authentication Routes

Created routes:

```txt
POST /register

POST /login

POST /logout
```

---

# Route Validation

Routes use:

```ts
validate(schema)
```

before controllers.

This ensures invalid requests never reach business logic.

---

# App Integration

Updated:

```txt
src/app.ts
```

Added:

```ts
cookieParser()
```

Mounted:

```ts
/api/v1/auth
```

---

# Testing

Authentication system was tested using multiple scenarios.

Tested:

- valid requests
- invalid payloads
- duplicate users
- login failures
- logout behavior

---

# Architecture Achieved

Current auth architecture:

```txt
Request

↓

Routes

↓

Validation Middleware

↓

Controller

↓

Service Layer

↓

Database
```

---

# Learnings

Today's work reinforced:

- layered backend architecture

- request validation patterns

- authentication design

- service layer separation

- token-based authentication

- centralized error management

---

# Current Authentication Status

✓ Register

✓ Login

✓ Logout

✓ Validation Middleware

✓ Password Hashing

✓ JWT Generation

✓ Cookie Handling

✓ Service Layer Separation

---

# Next Steps

- Refresh token flow

- Authentication middleware

- Protected routes

- Role handling

- Session security improvements

---

# API Documentation Setup

Implemented Swagger documentation support.

Installed:

```bash
npm install swagger-ui-express

npm install swagger-jsdoc
```

Installed development types:

```bash
npm install -D @types/swagger-ui-express

npm install -D @types/swagger-jsdoc
```

---

# Purpose of Swagger Integration

Swagger was added to provide:

- API documentation
- endpoint discoverability
- easier frontend/backend collaboration
- simplified testing
- interactive API exploration

---

# Swagger Configuration

Created:

```txt
src/swagger.ts
```

Configured:

## OpenAPI Version

```txt
openapi
```

Defines API specification version.

---

## Information Block

Configured:

- title
- version
- description

Purpose:

Provide metadata about the backend API.

---

## Servers Configuration

Defined:

- URL
- Description

Purpose:

Allows API consumers to understand available environments.

---

## API Scanning

Configured:

```txt
apis
```

Used for automatic route documentation discovery.

---

# Generated Swagger Specification

Created:

```ts
swaggerSpec
```

which exports generated OpenAPI specifications.

---

# App Integration

Updated:

```txt
src/app.ts
```

Added:

```ts
app.use(
   "/api-docs",
   swaggerUi.serve,
   swaggerUi.setup(swaggerSpec)
)
```

---

# Documentation Endpoint

Swagger UI is now available at:

```txt
/api-docs
```

Purpose:

- inspect APIs visually
- test endpoints directly
- verify request/response formats

---

# Current Backend Capabilities

Current backend now includes:

✓ Authentication

✓ Validation Middleware

✓ JWT Handling

✓ Error Handling

✓ Swagger Documentation

✓ Interactive API Testing

✓ Health Check Route

---

# Learnings

Today's Swagger integration reinforced:

- API-first development

- OpenAPI specifications

- backend documentation workflows

- frontend/backend collaboration practices

---

# Why Documentation Early Matters

Adding documentation early prevents:

- undocumented endpoints

- frontend confusion

- inconsistent request structures

- API maintenance problems

Swagger becomes more valuable as modules increase.

---


---


# Swagger Documentation Architecture Improvements

Created:

```txt
src/docs/components/
```

Purpose:

Create reusable documentation components rather than repeating schemas and responses across routes.

---

# Reusable Responses

Created:

```txt
src/docs/components/responses.ts
```

Contains reusable response definitions.

Examples:

- InternalServerError (500)
- Unauthorized (401)
- Forbidden (403)
- BadRequest (400)
- NotFound (404)
- Conflict (409)

Purpose:

- reduce duplication
- standardize API documentation
- simplify maintenance

---

# Reusable Schemas

Created:

```txt
src/docs/components/schemas.ts
```

Contains reusable response schemas.

Examples:

- AuthResponse
- UserResponse
- TransactionResponse
- AccountResponse

Purpose:

- centralize schema definitions
- reuse response structures
- maintain consistency

---

# Swagger Refactoring

Updated:

```txt
src/swagger.ts
```

Added:

```txt
components
```

which now includes:

- reusable schemas
- reusable responses

This improves long-term maintainability as modules increase.

---

# Authentication Documentation Improvements

Added API documentation to:

## Register

Added:

- 201 responses
- error responses

---

## Login

Added:

- 200 responses
- error responses

---

## Logout

Added:

- reusable error responses

---

# Extending Express Request Type

Problem:

Express Request does not know custom properties.

Needed:

```ts
req.user
```

Created:

```txt
src/types/express.d.ts
```

Extended:

```ts
Express.Request
```

Added:

```ts
user
```

property.

---

# TypeScript Configuration Update

Updated:

```txt
tsconfig.json
```

Added:

```txt
typeRoots
```

Purpose:

Allow TypeScript to discover custom declaration files.

---

# Authentication Middleware

Created:

```txt
src/middleware/requireAuth.ts
```

Purpose:

Protect authenticated routes.

---

# Authentication Flow

Request

↓

Authorization Header

↓

Extract Bearer Token

↓

Verify JWT

↓

Attach User Context

↓

Continue Request

---

# Token Validation Logic

Checks:

## Missing Authorization Header

Returns:

```txt
401 Unauthorized
```

---

## Invalid Token Format

Returns:

```txt
401 Unauthorized
```

---

## Expired Token

Returns:

```txt
401 Unauthorized
```

---

## Invalid Payload

Returns:

```txt
401 Unauthorized
```

---

# JWT Payload Challenges

Problem:

```ts
jwt.verify()
```

returns:

```ts
string | JwtPayload
```

This means:

TypeScript cannot guarantee:

```ts
decoded.userId
```

exists.

---

# Solution

Created:

```ts
interface CustomJwtPayload
```

Extended:

```ts
JwtPayload
```

Added:

```ts
userId
```

Performed runtime validation before usage.

---

# Important Learning

The problem was not direct casting itself.

The larger issue was:

```ts
token
```

and:

```ts
decoded.userId
```

both require runtime guarantees.

Type safety alone cannot solve runtime uncertainty.

---

# Refresh Token Flow

Implemented:

```txt
AuthService.refreshToken()
```

---

# Refresh Process

1. Verify refresh token

2. Extract user ID

3. Find user

4. Generate new tokens

5. Return tokens

---

# Refresh Controller

Created:

```txt
POST /refresh
```

Flow:

- read refresh cookie
- validate token
- generate new tokens
- update refresh cookie
- return new access token

---

# Protected User Profile Endpoint

Implemented:

```txt
GET /me
```

Purpose:

Return authenticated user information.

---

# Request User Context

Because:

```ts
requireAuth
```

runs first,

usage becomes:

```ts
req.user!.id
```

The non-null assertion is safe here.

---

# /me Response

Returns:

- id
- email
- firstName
- lastName

---

# Protected Routes Added

Added:

```txt
POST /refresh

GET /me
```

---

# Authentication System Status

Current auth system supports:

✓ Register

✓ Login

✓ Logout

✓ Refresh Tokens

✓ Protected Routes

✓ User Context Injection

✓ Profile Retrieval

✓ Request Validation

✓ Swagger Documentation

✓ Typed Request Extensions

---

# Testing

Tested:

- refresh flow

- protected routes

- expired tokens

- invalid tokens

- missing tokens

- authenticated user retrieval

---

# Architecture Achieved

Current flow:

```txt
Request

↓

Validation Middleware

↓

Authentication Middleware

↓

Controller

↓

Service Layer

↓

Database

↓

Response
```

---

# Learnings

Today's work reinforced:

- JWT authentication patterns

- refresh token architecture

- TypeScript runtime safety

- middleware chaining

- request augmentation

- reusable API documentation

- protected route design

---

# Current Project Status

Phase 1 — Domain Modeling ✓

Phase 2 — Backend Foundations ✓

Phase 3 — Authentication System ✓

Authentication module is now largely complete.

---

# Next Steps

- Authorization layer

- Accounts module

- Beneficiary module

- Transaction engine

- Banking workflows
