# Supabase migration notes

## Project status

The one-time default-privileges SQL for Supabase's explicit-grant model was
already run manually in the live Supabase project on May 27, 2026.

That means:

- existing table/function grants were not changed by that manual step
- future `public` tables, functions, and sequences are no longer auto-exposed
  to the Data API
- all future `public` objects that should be reachable via PostgREST,
  GraphQL, or `supabase-js` must include explicit `grant` statements in their
  migrations

Future chats working in this repo should treat the explicit-grant model as the
current standard for all new `public` schema objects.

## Explicit Data API grants for new `public` objects

Supabase changed the default exposure model for new projects on May 30, 2026.
New tables and functions created in the `public` schema should now opt in to
PostgREST, GraphQL, and `supabase-js` access with explicit `grant` statements.

This repo includes a one-time migration:

- `supabase/migrations/20260527120000_opt_in_public_api_grants.sql`

That migration changes default privileges for future objects created in
`public`. It does not modify grants on existing tables, sequences, or
functions.

## Template for a new `public` table migration

```sql
create table if not exists public.example_items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete cascade,
  name text not null
);

alter table public.example_items enable row level security;

grant select on table public.example_items to authenticated;
grant insert, update, delete on table public.example_items to authenticated;
grant select, insert, update, delete on table public.example_items to service_role;

drop policy if exists example_items_select_own on public.example_items;
create policy example_items_select_own
  on public.example_items
  for select
  to authenticated
  using (created_by = auth.uid());

drop policy if exists example_items_insert_own on public.example_items;
create policy example_items_insert_own
  on public.example_items
  for insert
  to authenticated
  with check (created_by = auth.uid());

drop policy if exists example_items_update_own on public.example_items;
create policy example_items_update_own
  on public.example_items
  for update
  to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

drop policy if exists example_items_delete_own on public.example_items;
create policy example_items_delete_own
  on public.example_items
  for delete
  to authenticated
  using (created_by = auth.uid());
```

If the table uses `generated ... as identity` or `serial`, also grant the
backing sequence:

```sql
grant usage, select on sequence public.example_items_id_seq to authenticated, service_role;
```

Add `anon` only if the table must be reachable from unauthenticated clients.

## Template for a new exposed function

```sql
create or replace function public.example_ping()
returns text
language sql
stable
as $$
  select 'ok';
$$;

revoke all on function public.example_ping() from public;
grant execute on function public.example_ping() to authenticated;
grant execute on function public.example_ping() to service_role;
```

Add `anon` only if the RPC must be callable without authentication.
