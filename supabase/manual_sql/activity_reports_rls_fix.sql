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

insert into public.activity_score_rules (activity_key, activity_group, activity_label, points)
values ('task_created', 'Tasks', 'Task created', 0.5)
on conflict (activity_key) do update
set activity_group = 'Tasks',
    activity_label = 'Task created',
    points = 0.5;

update public.activity_logs
set activity_group = 'Tasks',
    activity_label = 'Task created',
    points = 0.5,
    occurred_at = coalesce(dt.created_at, activity_logs.occurred_at),
    activity_date = coalesce(dt.created_at, activity_logs.occurred_at)::date,
    metadata = coalesce(activity_logs.metadata, '{}'::jsonb) || jsonb_build_object('diary_date', dt.diary_date)
from public.diary_tasks dt
where activity_logs.activity_key = 'task_created'
  and activity_logs.source_table = 'diary_tasks'
  and activity_logs.source_record_id = dt.id;

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
  'Tasks',
  'Task created',
  coalesce(nullif(btrim(dt.created_by_name), ''), nullif(btrim(dt.assigned_to_name), ''), 'Unknown User') || ' created a task on ' || to_char(coalesce(dt.created_at, now())::date, 'DD Mon YYYY'),
  0.5,
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

drop policy if exists activity_score_rules_main_update on public.activity_score_rules;
create policy activity_score_rules_main_update
on public.activity_score_rules for update to authenticated
using (public.is_main_profile_user())
with check (public.is_main_profile_user());

drop policy if exists activity_logs_select_main_only on public.activity_logs;
create policy activity_logs_select_main_only
on public.activity_logs for select to authenticated using (public.is_main_profile_user());
