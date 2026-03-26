Default seeded admin login: admin@ee.com / 1234

# Threforfar

A Vercel-ready multi-user roleplay writing app with the same layout and workflow as the demo, but backed by a real shared Postgres database.

## What this package includes

- login page
- request-access flow
- automatic first-admin bootstrap
- admin approvals
- private chat room creation
- per-room membership control
- saved announcements
- saved messages
- persistent shared data for all users

## Vercel deploy steps

1. Upload this project to a GitHub repository.
2. Import the repository into Vercel.
3. In Vercel, connect a Postgres database through the Marketplace (for example Neon).
4. Add these environment variables in Vercel:

- `DATABASE_URL`
- `SESSION_SECRET`
- `INITIAL_ADMIN_EMAIL`
- `INITIAL_ADMIN_PASSWORD`
- `INITIAL_ADMIN_NAME`

Use `.env.example` as your reference.

5. Deploy.

The build command already runs:

- `prisma generate`
- `prisma db push`
- `next build`

That means the database schema is applied during deployment.

## First login

On the first deploy, the app automatically creates the initial admin account the first time `/login` is loaded.

Use the values from:

- `INITIAL_ADMIN_EMAIL`
- `INITIAL_ADMIN_PASSWORD`

## Notes

- The admin account is created once. After that, normal login is used.
- Passwords are hashed with bcrypt.
- Sessions are stored in an encrypted cookie signed with `SESSION_SECRET`.
- All room access checks happen on the server before messages are written.
