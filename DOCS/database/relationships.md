# Database Relationships

# User → Account

Relationship:
- One-to-Many

Meaning:
- One user can own multiple accounts.

---

# Account → Transaction

Relationship:
- One-to-Many

Meaning:
- One account can send many transactions.
- One account can receive many transactions.

---

# Transaction → Account

Each transaction references:
- `fromAccount`
- `toAccount`

This creates two relations:
- sender relation
- receiver relation

---

# User → Beneficiary

Relationship:
- One-to-Many

Meaning:
- A user can save multiple beneficiaries.

Examples:
- Mom
- Friend
- Landlord

---

# Why Beneficiaries Belong to Users

Beneficiaries are linked to users instead of accounts because:
- a user may own multiple accounts
- beneficiary reuse becomes easier
- avoids duplicate beneficiary records

---