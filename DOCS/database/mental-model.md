# Database Mental Model

## Core Domain Entities

The banking backend currently revolves around four primary entities:

- User
- Account
- Transaction
- Beneficiary

---

# High-Level Mental Model

```txt
User
 ├── Accounts
 │     ├── Sent Transactions
 │     └── Received Transactions
 │
 └── Beneficiaries
```

---

# Entity Ownership

## User

The user is the top-level owner.

A user can:
- own multiple accounts
- save multiple beneficiaries

---

## Account

Accounts belong to users.

Accounts are responsible for:
- storing balance
- sending money
- receiving money

---

## Transaction

Transactions connect two accounts:
- sender account
- receiver account

Each transaction stores:
- amount
- sender
- receiver
- timestamps
- status

---

## Beneficiary

Beneficiaries are saved contacts used for faster transfers.

Beneficiaries belong to users instead of accounts because:
- users may own multiple accounts
- beneficiary reuse is easier at user level

---