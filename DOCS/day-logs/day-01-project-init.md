# Day 01 — Backend Initialization & Database Design

## Work Completed

Today focused on initializing the backend project and starting the database design process.

---

## Project Initialization

### npm initialization

```bash
npm init -y
```

---

### Installed Dependencies

#### Prisma

```bash
npm install prisma @prisma/client
```

#### TypeScript Tooling

```bash
npm install -D typescript ts-node @types/node
```

#### dotenv

```bash
npm install dotenv
```

---

## Prisma Initialization

Executed:

```bash
npx prisma init
```

Generated files:
- `.env`
- `.gitignore`
- `prisma/schema.prisma`
- `prisma.config.ts`

---

## Database Design Progress

The following core entities were planned:

- User
- Account
- Transaction
- Beneficiary

Enums and relationships were also started.

---

## Initial Relationship Thinking

### User → Accounts

A user can own multiple bank accounts.

---

### Account → Transactions

An account can:
- send transactions
- receive transactions

Each transaction references:
- `fromAccount`
- `toAccount`

---

### User → Beneficiaries

Beneficiaries are saved per user.

Example:
- Mom
- Friend
- Landlord

---

## Initial Mental Model

```txt
User
 ├── Accounts
 │     ├── Sent Transactions
 │     └── Received Transactions
 │
 └── Beneficiaries
```

---

## Important Design Understanding

Transactions belong to accounts, not directly to users.

Users access transactions through their accounts.

---

## Learnings

Today helped establish:
- domain modeling understanding
- relationship thinking
- backend entity planning
- schema-first backend design

---

## Next Steps

- Finalize Prisma schema
- Add constraints and indexes
- Setup PostgreSQL database
- Run initial migration
- Generate Prisma client

---