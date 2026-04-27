# Contributing to Sandcastle Resort

## Branch naming

Branch from `dev`. Use these prefixes:

| Prefix | When to use |
|--------|-------------|
| `feature/` | New functionality |
| `bugfix/`  | Bug fixes |
| `chore/`   | Refactoring, config, tooling |
| `docs/`    | Documentation only |

Example: `feature/forgot-password`, `bugfix/calendar-overlap`

## Commit messages

```
<type>: short description
```

Types: `feat`, `fix`, `chore`, `refactor`, `docs`, `test`

Examples:
```
feat: add email verification on registration
fix: prevent double-booking across month boundary
chore: split services.js into individual modules
docs: add API endpoint table to README
```

## Pull request workflow

1. Branch from `dev`
2. Open a PR targeting `dev`
3. Get at least 1 teammate review before merging
4. Squash merge

Direct pushes to `main` and `dev` are not allowed.

## Local setup

```bash
git clone <repo-url>
cd sandcastle-resort
npm install
cp .env.example .env
# Fill in DB credentials in .env
# Import schema and seed data:
mysql -uroot -p < schema.sql
mysql -uroot -p sandcastle_resort < seed.sql
npm run dev
```

## Running the app

```bash
npm run dev       # development (auto-restarts on file change)
npm start         # production
npm run db:reset  # drop and recreate schema (destructive!)
npm run db:seed   # load demo accounts
```