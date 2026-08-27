# Header / Account Menu — Design Notes

Context for the authenticated header (`client/src/app/app.html` + `app.ts`,
styles in `client/src/styles/layout.css` and `buttons.css`).

## Decisions

- The avatar is an **initials circle** (first letter of the user's email,
  uppercased) — same visual as today. Do not implement image avatars yet;
  `profiles.avatar_url` is unused for now.
- The avatar is a **button**, not decoration. Clicking it navigates to
  `/profile`. No hover preview/tooltip with user info — keep it simple.
- **Sign Out lives on the `/profile` page**, not in the header. The header no
  longer shows "Signed in" / email text or a sign-out icon.
- The `Dashboard / Transactions / Analytics` links move out of the always-visible
  inline nav and into a **hamburger/dropdown menu** in the header, opened by an
  icon button (Lucide `Menu`).
- Dropdown behavior: toggled by a boolean signal, closes on outside click,
  `Escape`, or navigation. Use `role="menu"` / `aria-expanded` /
  `aria-haspopup="menu"` for accessibility.

## Data model (Supabase)

```sql
create table public.profiles (
  id uuid not null,
  full_name text null,
  avatar_url text null,
  constraint profiles_pkey primary key (id),
  constraint profiles_id_fkey foreign key (id) references auth.users (id) on delete cascade
);
```

- `avatar_url` is a plain `text` column — no Storage bucket is wired up yet.
  When avatars are implemented later, prefer storing a Storage **path**
  (not a full URL) and resolving it at read time via
  `supabase.storage.from(bucket).getPublicUrl(path)` (public bucket) or
  `createSignedUrl` (private bucket).
- No `ProfileService` exists yet; `SupabaseService` only wraps `auth.*` calls.
  A profile row lookup (`supabase.from('profiles').select(...).eq('id', userId)`)
  requires an RLS policy allowing the user to read their own row
  (`using (auth.uid() = id)`) — verify this exists in Supabase before relying
  on profile data client-side.

## Routing

- New route: `profile` → `Profile` standalone component, alongside
  `dashboard` / `transactions` / `analytics` in `client/src/app/app.routes.ts`.

## Why this matters for future agents

- Don't reintroduce the inline "Signed in" / email text or a header sign-out
  button — that UI intentionally moved to `/profile`.
- Don't wire up real avatar images without checking back on the storage
  bucket/public-vs-private decision (undecided as of this note).
- Keep the account menu's hamburger dropdown simple: no nested menus, no
  hover-triggered previews.
