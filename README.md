# DesignFlow

Every project. Every task. Every deadline. Every creative win, in one place.

A work-tracking workspace for designers: dashboard, projects, tasks with a Kanban board, calendar,
clients, time tracking, insights, a portfolio archive, team roles and designer profiles.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # production build in dist/
npm run build:single # one self-contained HTML file in dist-single/
```

## Going live (GitHub Pages + Supabase)

The app is static, so GitHub Pages hosts it for free. Supabase stores the data, handles sign-in and syncs
changes live between teammates.

1. **Create the database.** Supabase → SQL Editor → New query → paste all of `supabase/schema.sql` → Run.
2. **Allow sign-in links back to the site.** Supabase → Authentication → URL Configuration: set
   *Site URL* to `https://<github-user>.github.io/<repo>/` and add the same address under *Redirect URLs*.
3. **Turn on Pages.** GitHub repo → Settings → Pages → Source: **GitHub Actions**.
4. Push to `main`. The workflow in `.github/workflows/deploy.yml` builds and publishes the site.

`.env.production` holds the Supabase URL and the *publishable* key. Both are meant to be public: what each
person can read or change is enforced by the row-level security rules in `schema.sql`. Never commit the secret
key or the database password.

Without those two values (for example `npm run dev` with no `.env.local`) the app runs in local mode and saves
in the browser, exactly like the demo.

### How the data is stored

- `workspaces`: one row per studio.
- `workspace_members`: who can open a studio and their role. Inviting someone adds their email here with a secret
  invite code. They join by opening their personal Share invite link (which carries the code), or by signing in
  from the Email invite link. Signing up with a matching email alone is not enough, because email confirmation
  may be off.
- `records`: every project, task, client, time entry, status and profile is one JSON row, so two people editing
  different things never overwrite each other. Changes are pushed within half a second and arrive on teammates'
  screens through Supabase Realtime. If the connection drops, edits are kept and retried.
- Roles are enforced by the database: Viewers can read only, and people outside a studio see nothing.
- Signed-out visitors can't read any table. Only a teammate's role can be edited, never whose row it is.
- The built page carries a Content Security Policy that only allows its own scripts and its own Supabase project.

## Stack

React 19, TypeScript, Tailwind CSS v4, Zustand, Supabase (auth, Postgres, Realtime), date-fns, lucide-react.
In local mode realistic demo data loads on first run and everything is saved in the browser; Settings → General
can restore the demo or start empty. In cloud mode each new studio can start with the same example projects.

## Structure

- `src/lib` data model (`types.ts`), store and UI state (`store.ts`), demo data (`demo.ts`),
  Quick add sentence parser (`parse.ts`), selectors, smart filters and role permissions (`selectors.ts`)
- `src/components` app shell, UI kit, charts, Kanban, forms, Quick add, search, notifications
- `src/pages` one file per section

## Keyboard

`⌘K` search · `N` quick add · `P` new project · `T` start/stop timer · `G` then `D/P/T/C/L/M/I/A/S` to navigate ·
`.` toggle theme · `?` all shortcuts. On a Kanban board, focus a card and use ← / → to move it.
