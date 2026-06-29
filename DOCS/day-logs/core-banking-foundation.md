# Core Banking Logic: Account Foundation

## Phase Transition

Today marks the transition from the authentication module to the core banking domain.

Previous work focused on:

- identity management
- authentication
- authorization
- session management
- security

The focus now shifts toward banking operations and financial data.

---

# Transactional User Registration

One important architectural improvement was made before starting banking features.

Previously, user registration and account creation were separate operations.

This introduced a potential inconsistency:

```txt
User Created

↓

Database Failure

↓

No Default Account
```

The result would be an invalid banking state where a registered user owns no account.

---

# ACID Transactions

To solve this, user registration now uses a database transaction.

Both:

- user creation
- default checking account creation

execute as one atomic unit.

If either operation fails:

```txt
Everything Rolls Back
```

No partial data is committed.

---

# Why Transactions Matter

Using database transactions guarantees the ACID properties.

## Atomicity

Either every operation succeeds or nothing is saved.

---

## Consistency

The database never enters an invalid state.

Every registered user always owns a valid account.

---

## Isolation

Concurrent registrations cannot interfere with one another.

---

## Durability

Once committed, data survives crashes and restarts.

---

# Account Number Generation

Created:

```txt
src/utils/generateAccountNumber.ts
```

Purpose:

Generate unique bank account numbers.

---

# Generation Rules

Current implementation generates:

- 10 digits
- first digit is never zero

Purpose:

Avoid invalid account numbers while keeping identifiers consistent.

---

# Registration Flow Update

Updated:

```txt
AuthService.register()
```

Flow now performs:

1. Create user

2. Generate account number

3. Create default checking account

4. Commit transaction

---

# Transaction Flow

```txt
Register User

↓

Begin Database Transaction

↓

Create User

↓

Generate Account Number

↓

Create Checking Account

↓

Commit

↓

Success
```

If any step fails:

```txt
Rollback Transaction
```

---

# Default Checking Account

Every newly registered user now automatically receives:

```txt
Checking Account
```

Purpose:

Allow immediate access to banking features.

---

# Accounts Module

Created:

```txt
src/modules/accounts/
```

This becomes the first module of the core banking domain.

---

# Account Service

Created:

```txt
account.service.ts
```

Purpose:

Centralize account-related business logic.

---

# Implemented Services

## getUserAccounts()

Returns every account owned by the authenticated user.

Accounts are ordered consistently for predictable frontend rendering.

---

## getAccountById()

Returns detailed information for a specific account.

Additional security check:

The account must belong to the authenticated user.

Otherwise:

```txt
404 Not Found
```

is returned.

This prevents users from accessing accounts they do not own.

---

# Account Controller

Created:

```txt
account.controller.ts
```

Responsibilities:

- receive HTTP requests
- invoke service layer
- return API responses

---

# Controller Methods

Implemented:

## getAccounts()

Returns all user accounts.

---

## getAccountDetails()

Returns a specific account.

Account ID is obtained from:

```txt
req.params
```

---

# Account Routes

Created protected routes for the accounts module.

Applied:

```txt
requireAuth
```

globally using:

```ts
router.use(requireAuth)
```

Reason:

Every account endpoint requires authentication.

---

# Routes Added

```txt
GET /accounts

GET /accounts/:accountId
```

---

# App Integration

Registered the accounts module inside:

```txt
app.ts
```

making the endpoints available through the application.

---

# Current Banking Architecture

The backend now follows a layered module structure:

```txt
Request

↓

Authentication

↓

Controller

↓

Service

↓

Prisma

↓

Database
```

Each banking feature will follow the same pattern.

---

# Core Banking Status

Completed:

✓ Automatic Account Creation

✓ Transactional Registration

✓ Account Number Generation

✓ Accounts Module

✓ Account Retrieval

✓ Account Details

✓ Protected Account APIs

---

# Security Considerations

Account access is protected through:

- authentication
- ownership validation

A user can only retrieve accounts that belong to them.

---

# Learnings

Today's work reinforced:

- database transactions

- ACID principles

- atomic operations

- banking domain modeling

- service-oriented module architecture

- secure resource ownership

---

# Current Project Status

## Phase 1

✓ Domain Modeling

---

## Phase 2

✓ Backend Foundations

---

## Phase 3

✓ Authentication & Identity Management

---

## Phase 4

🚧 Core Banking Logic

Current progress:

✓ Account Creation

✓ Account Retrieval

⬜ Beneficiaries

⬜ Transactions

⬜ Money Transfers

⬜ Account Statements

⬜ Banking Operations

---

# Next Steps

- Beneficiary management

- Internal transfers

- Transaction engine

- Balance updates

- Transaction history

- Banking business rules
