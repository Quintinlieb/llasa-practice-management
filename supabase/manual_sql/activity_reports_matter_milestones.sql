alter table public.activity_score_rules
  alter column points type numeric(8,2) using points::numeric(8,2),
  alter column points set default 1;

alter table public.activity_logs
  alter column points type numeric(8,2) using points::numeric(8,2),
  alter column points set default 0;

insert into public.activity_score_rules (activity_key, activity_group, activity_label, points)
values
  ('matter_closed', 'Matters', 'Matter closed', 1),
  ('matter_arbitration_reached', 'Matters', 'Arbitration date reached', 10),
  ('hearing_conducted', 'Matters', 'Hearing conducted', 5)
on conflict (activity_key) do update
set activity_group = excluded.activity_group,
    activity_label = excluded.activity_label,
    points = excluded.points;

update public.activity_logs
set activity_group = 'Matters',
    activity_label = 'Matter closed',
    points = 1
where activity_key = 'matter_closed';

create or replace function public.sync_reached_matter_date_activities()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.activity_logs al
  using public.case_files cf
  where al.activity_key in ('matter_arbitration_reached', 'hearing_conducted')
    and al.matter_id = cf.id
    and lower(coalesce(cf.status, '')) <> 'inactive';

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
    coalesce(nullif(btrim(cd.created_by_name), ''), nullif(btrim(cf.consultant), ''), 'Unknown User'),
    'name_only',
    'matter_arbitration_reached',
    'Matters',
    'Arbitration date reached',
    coalesce(nullif(btrim(cd.created_by_name), ''), nullif(btrim(cf.consultant), ''), 'Unknown User') ||
      ' reached arbitration date for matter ' || coalesce(nullif(btrim(cf.file_number), ''), cf.id::text) ||
      ' on ' || to_char(cd.date_value, 'DD Mon YYYY'),
    10,
    'case_dates',
    cd.id,
    'case_files',
    cf.id,
    cf.client_id,
    cf.client_name,
    cf.id,
    cf.file_number,
    concat_ws(' - ', nullif(cf.case_type, ''), nullif(cf.case_subtype, '')),
    cd.date_value::timestamptz,
    cd.date_value,
    jsonb_build_object(
      'synced_from', 'case_dates',
      'date_type', cd.date_type,
      'event_label', cd.event_label,
      'case_type', cf.case_type,
      'case_subtype', cf.case_subtype
    )
  from public.case_dates cd
  join public.case_files cf on cf.id = cd.case_file_id
  where cd.date_value <= current_date
    and lower(coalesce(cf.status, '')) = 'inactive'
    and cf.case_type in ('CCMA', 'Bargaining Council')
    and lower(coalesce(cd.event_label, '') || ' ' || coalesce(cd.date_type, '')) like '%arbitration%'
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
    coalesce(nullif(btrim(cd.created_by_name), ''), nullif(btrim(cf.consultant), ''), 'Unknown User'),
    'name_only',
    'hearing_conducted',
    'Matters',
    'Hearing conducted',
    coalesce(nullif(btrim(cd.created_by_name), ''), nullif(btrim(cf.consultant), ''), 'Unknown User') ||
      ' conducted hearing for matter ' || coalesce(nullif(btrim(cf.file_number), ''), cf.id::text) ||
      ' on ' || to_char(cd.date_value, 'DD Mon YYYY'),
    5,
    'case_dates',
    cd.id,
    'case_files',
    cf.id,
    cf.client_id,
    cf.client_name,
    cf.id,
    cf.file_number,
    concat_ws(' - ', nullif(cf.case_type, ''), nullif(cf.case_subtype, '')),
    cd.date_value::timestamptz,
    cd.date_value,
    jsonb_build_object(
      'synced_from', 'case_dates',
      'date_type', cd.date_type,
      'event_label', cd.event_label,
      'case_type', cf.case_type,
      'case_subtype', cf.case_subtype
    )
  from public.case_dates cd
  join public.case_files cf on cf.id = cd.case_file_id
  where cd.date_value <= current_date
    and lower(coalesce(cf.status, '')) = 'inactive'
    and cf.case_type = 'Hearing'
    and lower(coalesce(cd.event_label, '') || ' ' || coalesce(cd.date_type, '')) like '%hearing%'
  on conflict do nothing;

  update public.activity_logs al
  set activity_group = sr.activity_group,
      activity_label = sr.activity_label,
      points = sr.points
  from public.activity_score_rules sr
  where al.activity_key = sr.activity_key
    and al.activity_key in ('matter_arbitration_reached', 'hearing_conducted');
end;
$$;

grant execute on function public.sync_reached_matter_date_activities() to authenticated;

select public.sync_reached_matter_date_activities();
