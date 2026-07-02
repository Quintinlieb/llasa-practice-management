create or replace function public.is_main_profile_user()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
       or p.auth_user_id = auth.uid()
  );
$$;

create table if not exists public.activity_score_rules (
  activity_key text primary key,
  activity_group text not null,
  activity_label text not null,
  points numeric(8,2) not null default 1 check (points >= 0),
  is_productive boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid,
  actor_name text not null default 'Unknown User',
  actor_role text,
  actor_source text not null default 'unknown',
  activity_key text not null references public.activity_score_rules(activity_key),
  activity_group text not null,
  activity_label text not null,
  action_sentence text not null,
  points numeric(8,2) not null default 0 check (points >= 0),
  source_table text,
  source_record_id uuid,
  parent_table text,
  parent_id uuid,
  client_id uuid,
  client_name text,
  matter_id uuid,
  matter_file_number text,
  matter_type text,
  document_type text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  activity_date date not null default current_date,
  created_at timestamptz not null default now()
);

grant usage on schema public to authenticated;
grant execute on function public.is_main_profile_user() to authenticated;
grant select, update, references on public.activity_score_rules to authenticated;
grant select, insert on public.activity_logs to authenticated;

alter table public.activity_score_rules
  alter column points type numeric(8,2) using points::numeric(8,2),
  alter column points set default 1;

alter table public.activity_logs
  alter column points type numeric(8,2) using points::numeric(8,2),
  alter column points set default 0;

create unique index if not exists activity_logs_source_activity_unique
  on public.activity_logs (source_table, source_record_id, activity_key)
  where source_table is not null and source_record_id is not null;

create index if not exists activity_logs_activity_date_idx on public.activity_logs (activity_date desc);
create index if not exists activity_logs_actor_idx on public.activity_logs (actor_user_id, activity_date desc);
create index if not exists activity_logs_activity_key_idx on public.activity_logs (activity_key);
create index if not exists activity_logs_group_idx on public.activity_logs (activity_group);

create or replace function public.set_activity_score_rules_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_activity_score_rules_updated_at on public.activity_score_rules;
create trigger trg_activity_score_rules_updated_at
before update on public.activity_score_rules
for each row
execute function public.set_activity_score_rules_updated_at();

grant execute on function public.set_activity_score_rules_updated_at() to authenticated;

alter table public.activity_score_rules enable row level security;
alter table public.activity_logs enable row level security;

drop policy if exists activity_score_rules_select_authenticated on public.activity_score_rules;
create policy activity_score_rules_select_authenticated
on public.activity_score_rules for select to authenticated using (true);

drop policy if exists activity_score_rules_main_update on public.activity_score_rules;
create policy activity_score_rules_main_update
on public.activity_score_rules for update to authenticated
using (public.is_main_profile_user())
with check (public.is_main_profile_user());

drop policy if exists activity_logs_insert_authenticated on public.activity_logs;
create policy activity_logs_insert_authenticated
on public.activity_logs for insert to authenticated with check (true);

drop policy if exists activity_logs_select_main_only on public.activity_logs;
create policy activity_logs_select_main_only
on public.activity_logs for select to authenticated using (public.is_main_profile_user());

insert into public.activity_score_rules (activity_key, activity_group, activity_label, points)
values
  ('client_note_email_sent', 'Client File', 'Email sent', 1),
  ('client_note_email_received', 'Client File', 'Email received', 1),
  ('client_note_whatsapp', 'Client File', 'WhatsApp note', 1),
  ('client_note_call', 'Client File', 'Call note', 1),
  ('client_note_consultation', 'Client File', 'Consultation note', 2),
  ('client_note_chairing', 'Client File', 'Chairing note', 3),
  ('client_note_basic', 'Client File', 'Client file note', 1),
  ('task_created', 'Tasks', 'Task created', 0.5),
  ('matter_created', 'Matters', 'Matter created', 2),
  ('matter_note_created', 'Matters', 'Matter note created', 1),
  ('matter_document_uploaded', 'Matters', 'Matter document uploaded', 2),
  ('matter_outcome_saved', 'Matters', 'Matter outcome saved', 3),
  ('matter_closed', 'Matters', 'Matter closed', 1),
  ('document_warning', 'Documents', 'Warning generated', 1),
  ('document_outcome_hearing', 'Documents', 'Outcome of Hearing generated', 3),
  ('document_basic', 'Documents', 'Document generated', 1)
on conflict (activity_key) do update
set activity_group = excluded.activity_group,
    activity_label = excluded.activity_label,
    points = excluded.points;

alter table public.documents
  add column if not exists created_by uuid,
  add column if not exists created_by_name text;

insert into public.activity_logs (
  actor_user_id,
  actor_name,
  actor_source,
  activity_key,
  activity_group,
  activity_label,
  action_sentence,
  points,
  source_table,
  source_record_id,
  client_id,
  client_name,
  document_type,
  occurred_at,
  activity_date,
  metadata
)
select
  d.created_by,
  coalesce(nullif(btrim(d.created_by_name), ''), 'Unknown User'),
  case when d.created_by is null then 'name_only' else 'auth' end,
  case
    when lower(coalesce(d.document_name, '') || ' ' || coalesce(d.document_type, '')) like '%outcome%hearing%' then 'document_outcome_hearing'
    when lower(coalesce(d.document_name, '') || ' ' || coalesce(d.document_type, '')) like '%warning%' then 'document_warning'
    else 'document_basic'
  end,
  sr.activity_group,
  sr.activity_label,
  coalesce(nullif(btrim(d.created_by_name), ''), 'Unknown User') || ' generated ' || coalesce(nullif(btrim(d.document_name), ''), 'a document') || ' on ' || to_char(coalesce(d.created_at, now())::date, 'DD Mon YYYY'),
  sr.points,
  'documents',
  d.id,
  d.client_id,
  d.client_name,
  d.document_type,
  coalesce(d.created_at, now()),
  coalesce(d.created_at, now())::date,
  jsonb_build_object('backfilled', true, 'document_name', d.document_name)
from public.documents d
join public.activity_score_rules sr
  on sr.activity_key = case
    when lower(coalesce(d.document_name, '') || ' ' || coalesce(d.document_type, '')) like '%outcome%hearing%' then 'document_outcome_hearing'
    when lower(coalesce(d.document_name, '') || ' ' || coalesce(d.document_type, '')) like '%warning%' then 'document_warning'
    else 'document_basic'
  end
on conflict do nothing;

insert into public.activity_logs (
  actor_name,
  actor_source,
  activity_key,
  activity_group,
  activity_label,
  action_sentence,
  points,
  source_table,
  source_record_id,
  parent_table,
  parent_id,
  client_id,
  client_name,
  occurred_at,
  activity_date,
  metadata
)
select
  coalesce(nullif(btrim(n.note_user_name), ''), 'Unknown User'),
  'name_only',
  case
    when lower(coalesce(n.note_type, '')) = 'email sent' then 'client_note_email_sent'
    when lower(coalesce(n.note_type, '')) = 'email received' then 'client_note_email_received'
    when lower(coalesce(n.note_type, '')) like 'whatsapp%' then 'client_note_whatsapp'
    when lower(coalesce(n.note_type, '')) like '%call%' then 'client_note_call'
    when lower(coalesce(n.note_type, '')) = 'consultation' then 'client_note_consultation'
    when lower(coalesce(n.note_type, '')) = 'chairing' then 'client_note_chairing'
    else 'client_note_basic'
  end,
  sr.activity_group,
  sr.activity_label,
  coalesce(nullif(btrim(n.note_user_name), ''), 'Unknown User') || ' made a client file note on ' || to_char(coalesce(n.file_note_date, n.note_date, n.created_at::date, current_date), 'DD Mon YYYY'),
  sr.points,
  'client_file_notes',
  n.id,
  'clients',
  n.client_id,
  n.client_id,
  coalesce(c.trading_as, c.registered_name),
  coalesce(n.created_at, now()),
  coalesce(n.file_note_date, n.note_date, n.created_at::date, current_date),
  jsonb_build_object('backfilled', true, 'note_type', n.note_type)
from public.client_file_notes n
left join public.clients c on c.id = n.client_id
join public.activity_score_rules sr
  on sr.activity_key = case
    when lower(coalesce(n.note_type, '')) = 'email sent' then 'client_note_email_sent'
    when lower(coalesce(n.note_type, '')) = 'email received' then 'client_note_email_received'
    when lower(coalesce(n.note_type, '')) like 'whatsapp%' then 'client_note_whatsapp'
    when lower(coalesce(n.note_type, '')) like '%call%' then 'client_note_call'
    when lower(coalesce(n.note_type, '')) = 'consultation' then 'client_note_consultation'
    when lower(coalesce(n.note_type, '')) = 'chairing' then 'client_note_chairing'
    else 'client_note_basic'
  end
on conflict do nothing;

insert into public.activity_logs (
  actor_user_id,
  actor_name,
  actor_source,
  activity_key,
  activity_group,
  activity_label,
  action_sentence,
  points,
  source_table,
  source_record_id,
  parent_table,
  parent_id,
  client_id,
  client_name,
  matter_id,
  document_type,
  occurred_at,
  activity_date,
  metadata
)
select
  dt.created_by,
  coalesce(nullif(btrim(dt.created_by_name), ''), nullif(btrim(dt.assigned_to_name), ''), 'Unknown User'),
  case when dt.created_by is null then 'name_only' else 'auth' end,
  'task_created',
  sr.activity_group,
  sr.activity_label,
  coalesce(nullif(btrim(dt.created_by_name), ''), nullif(btrim(dt.assigned_to_name), ''), 'Unknown User') || ' created a task on ' || to_char(coalesce(dt.created_at, now())::date, 'DD Mon YYYY'),
  sr.points,
  'diary_tasks',
  dt.id,
  case when dt.related_matter_id is null then 'clients' else 'case_files' end,
  coalesce(dt.related_matter_id, dt.client_id),
  dt.client_id,
  coalesce(c.trading_as, c.registered_name),
  dt.related_matter_id,
  dt.task_type,
  coalesce(dt.created_at, now()),
  coalesce(dt.created_at, now())::date,
  jsonb_build_object('backfilled', true, 'task_type', dt.task_type, 'diary_date', dt.diary_date, 'assigned_to', dt.assigned_to_name)
from public.diary_tasks dt
left join public.clients c on c.id = dt.client_id
join public.activity_score_rules sr on sr.activity_key = 'task_created'
on conflict do nothing;

create or replace function public.log_diary_task_created_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  task_actor_name text;
  task_client_name text;
  task_created_at timestamptz;
begin
  task_actor_name := coalesce(nullif(btrim(new.created_by_name), ''), nullif(btrim(new.assigned_to_name), ''), 'Unknown User');
  task_created_at := coalesce(new.created_at, now());

  select coalesce(c.trading_as, c.registered_name)
    into task_client_name
  from public.clients c
  where c.id = new.client_id;

  insert into public.activity_logs (
    actor_user_id,
    actor_name,
    actor_source,
    activity_key,
    activity_group,
    activity_label,
    action_sentence,
    points,
    source_table,
    source_record_id,
    parent_table,
    parent_id,
    client_id,
    client_name,
    matter_id,
    document_type,
    occurred_at,
    activity_date,
    metadata
  )
  values (
    new.created_by,
    task_actor_name,
    case when new.created_by is null then 'name_only' else 'auth' end,
    'task_created',
    'Tasks',
    'Task created',
    task_actor_name || ' created a task on ' || to_char(task_created_at::date, 'DD Mon YYYY'),
    0.5,
    'diary_tasks',
    new.id,
    case when new.related_matter_id is null then 'clients' else 'case_files' end,
    coalesce(new.related_matter_id, new.client_id),
    new.client_id,
    task_client_name,
    new.related_matter_id,
    new.task_type,
    task_created_at,
    task_created_at::date,
    jsonb_build_object('task_type', new.task_type, 'diary_date', new.diary_date, 'assigned_to', new.assigned_to_name)
  )
  on conflict do nothing;

  return new;
end;
$$;

grant execute on function public.log_diary_task_created_activity() to authenticated;

drop trigger if exists trg_log_diary_task_created_activity on public.diary_tasks;
create trigger trg_log_diary_task_created_activity
after insert on public.diary_tasks
for each row
execute function public.log_diary_task_created_activity();

insert into public.activity_logs (
  actor_user_id,
  actor_name,
  actor_source,
  activity_key,
  activity_group,
  activity_label,
  action_sentence,
  points,
  source_table,
  source_record_id,
  parent_table,
  parent_id,
  client_id,
  client_name,
  matter_id,
  matter_file_number,
  matter_type,
  occurred_at,
  activity_date,
  metadata
)
select
  cf.user_id,
  coalesce(nullif(btrim(cf.consultant), ''), 'Unknown User'),
  'name_only',
  'matter_created',
  sr.activity_group,
  sr.activity_label,
  coalesce(nullif(btrim(cf.consultant), ''), 'Unknown User') || ' created matter ' || coalesce(nullif(btrim(cf.file_number), ''), cf.id::text) || ' on ' || to_char(coalesce(cf.created_at, now())::date, 'DD Mon YYYY'),
  sr.points,
  'case_files',
  cf.id,
  'case_files',
  cf.id,
  cf.client_id,
  cf.client_name,
  cf.id,
  cf.file_number,
  concat_ws(' - ', nullif(cf.case_type, ''), nullif(cf.case_subtype, '')),
  coalesce(cf.created_at, now()),
  coalesce(cf.created_at, now())::date,
  jsonb_build_object('backfilled', true)
from public.case_files cf
join public.activity_score_rules sr on sr.activity_key = 'matter_created'
on conflict do nothing;

insert into public.activity_logs (
  actor_name,
  actor_source,
  activity_key,
  activity_group,
  activity_label,
  action_sentence,
  points,
  source_table,
  source_record_id,
  parent_table,
  parent_id,
  client_id,
  client_name,
  matter_id,
  matter_file_number,
  matter_type,
  occurred_at,
  activity_date,
  metadata
)
select
  coalesce(nullif(btrim(n.note_user_name), ''), 'Unknown User'),
  'name_only',
  'matter_note_created',
  sr.activity_group,
  sr.activity_label,
  coalesce(nullif(btrim(n.note_user_name), ''), 'Unknown User') || ' made a matter note on ' || to_char(coalesce(n.note_date, n.created_at::date, current_date), 'DD Mon YYYY'),
  sr.points,
  'case_notes',
  n.id,
  'case_files',
  n.case_file_id,
  cf.client_id,
  cf.client_name,
  cf.id,
  cf.file_number,
  concat_ws(' - ', nullif(cf.case_type, ''), nullif(cf.case_subtype, '')),
  coalesce(n.created_at, now()),
  coalesce(n.note_date, n.created_at::date, current_date),
  jsonb_build_object('backfilled', true)
from public.case_notes n
left join public.case_files cf on cf.id = n.case_file_id
join public.activity_score_rules sr on sr.activity_key = 'matter_note_created'
on conflict do nothing;

insert into public.activity_logs (
  actor_name,
  actor_source,
  activity_key,
  activity_group,
  activity_label,
  action_sentence,
  points,
  source_table,
  source_record_id,
  parent_table,
  parent_id,
  client_id,
  client_name,
  matter_id,
  matter_file_number,
  matter_type,
  occurred_at,
  activity_date,
  metadata
)
select
  coalesce(nullif(btrim(cd.uploaded_by), ''), 'Unknown User'),
  'name_only',
  'matter_document_uploaded',
  sr.activity_group,
  sr.activity_label,
  coalesce(nullif(btrim(cd.uploaded_by), ''), 'Unknown User') || ' uploaded a matter document on ' || to_char(coalesce(cd.created_at, now())::date, 'DD Mon YYYY'),
  sr.points,
  'case_documents',
  cd.id,
  'case_files',
  cd.case_file_id,
  cf.client_id,
  cf.client_name,
  cf.id,
  cf.file_number,
  concat_ws(' - ', nullif(cf.case_type, ''), nullif(cf.case_subtype, '')),
  coalesce(cd.created_at, now()),
  coalesce(cd.created_at, now())::date,
  jsonb_build_object('backfilled', true, 'document_name', cd.document_name, 'description', cd.description)
from public.case_documents cd
left join public.case_files cf on cf.id = cd.case_file_id
join public.activity_score_rules sr on sr.activity_key = 'matter_document_uploaded'
on conflict do nothing;

insert into public.activity_logs (
  actor_name,
  actor_source,
  activity_key,
  activity_group,
  activity_label,
  action_sentence,
  points,
  source_table,
  source_record_id,
  parent_table,
  parent_id,
  client_id,
  client_name,
  matter_id,
  matter_file_number,
  matter_type,
  occurred_at,
  activity_date,
  metadata
)
select
  coalesce(nullif(btrim(co.closed_by), ''), nullif(btrim(cf.consultant), ''), 'Unknown User'),
  'name_only',
  'matter_outcome_saved',
  sr.activity_group,
  sr.activity_label,
  coalesce(nullif(btrim(co.closed_by), ''), nullif(btrim(cf.consultant), ''), 'Unknown User') || ' saved a matter outcome on ' || to_char(coalesce(co.outcome_date, co.created_at::date, current_date), 'DD Mon YYYY'),
  sr.points,
  'case_outcomes',
  co.id,
  'case_files',
  co.case_file_id,
  cf.client_id,
  cf.client_name,
  cf.id,
  cf.file_number,
  concat_ws(' - ', nullif(cf.case_type, ''), nullif(cf.case_subtype, '')),
  coalesce(co.created_at, now()),
  coalesce(co.outcome_date, co.created_at::date, current_date),
  jsonb_build_object('backfilled', true, 'outcome_type', co.outcome_type)
from public.case_outcomes co
left join public.case_files cf on cf.id = co.case_file_id
join public.activity_score_rules sr on sr.activity_key = 'matter_outcome_saved'
on conflict do nothing;

insert into public.activity_logs (
  actor_user_id,
  actor_name,
  actor_source,
  activity_key,
  activity_group,
  activity_label,
  action_sentence,
  points,
  source_table,
  source_record_id,
  parent_table,
  parent_id,
  client_id,
  client_name,
  matter_id,
  matter_file_number,
  matter_type,
  occurred_at,
  activity_date,
  metadata
)
select
  cf.user_id,
  coalesce(nullif(btrim(co.closed_by), ''), nullif(btrim(cf.consultant), ''), 'Unknown User'),
  'name_only',
  'matter_closed',
  sr.activity_group,
  sr.activity_label,
  coalesce(nullif(btrim(co.closed_by), ''), nullif(btrim(cf.consultant), ''), 'Unknown User') || ' closed matter ' || coalesce(nullif(btrim(cf.file_number), ''), cf.id::text) || ' on ' || to_char(coalesce(cf.updated_at, cf.last_updated, cf.created_at, now())::date, 'DD Mon YYYY'),
  sr.points,
  'case_files',
  cf.id,
  'case_files',
  cf.id,
  cf.client_id,
  cf.client_name,
  cf.id,
  cf.file_number,
  concat_ws(' - ', nullif(cf.case_type, ''), nullif(cf.case_subtype, '')),
  coalesce(cf.updated_at, cf.last_updated, cf.created_at, now()),
  coalesce(cf.updated_at, cf.last_updated, cf.created_at, now())::date,
  jsonb_build_object('backfilled', true, 'status', cf.status, 'current_stage', cf.current_stage)
from public.case_files cf
left join public.case_outcomes co on co.case_file_id = cf.id
join public.activity_score_rules sr on sr.activity_key = 'matter_closed'
where lower(coalesce(cf.status, '')) = 'inactive'
on conflict do nothing;
