# Project Setup

## Initial Project Initialization

The backend project was initialized from scratch using npm.

### Step 1 — Initialize npm

```bash
npm init -y
```

---

### Step 2 — Install Prisma

```bash
npm install prisma @prisma/client
```

Prisma was selected because:
- Strong TypeScript support
- Schema-driven development
- Migration support
- Excellent developer experience
- Type-safe database access

---

### Step 3 — Install TypeScript Tooling

```bash
npm install -D typescript ts-node @types/node
```

---

### Step 4 — Install dotenv

```bash
npm install dotenv
```

dotenv is used for environment variable management.

---

### Step 5 — Initialize Prisma

```bash
npx prisma init
```

This created:
- `.env`
- `.gitignore`
- `prisma/schema.prisma`
- `prisma.config.ts`

---

## Current Status

The initial Prisma schema has been designed with:
- Enums
- User model
- Account model
- Transaction model
- Beneficiary model

The database design phase is currently in progress.

---