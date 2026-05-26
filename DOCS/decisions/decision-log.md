# Engineering Decision Log

---

# Decision #1 — Prisma ORM

## Choice

Prisma ORM was selected for database access and schema management.

---

## Reasons

- Excellent TypeScript support
- Schema-driven workflow
- Migration system
- Strong developer experience
- Auto-generated type safety

---

## Tradeoffs

### Pros
- Faster development
- Easier schema maintenance
- Cleaner database access

### Cons
- Less SQL flexibility compared to lower-level ORMs
- Some advanced queries may require raw SQL

---

# Decision #2 — Schema-First Development

## Choice

The backend will follow a schema-first approach before implementing APIs.

---

## Reasons

- Stable domain modeling
- Better relationship understanding
- Easier backend scaling later
- Prevents poor database structure

---

## Notes

The current focus is:
- database design
- entity relationships
- domain understanding

before moving into route implementation.

---