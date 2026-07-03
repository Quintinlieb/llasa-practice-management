create or replace function public.get_dashboard_productivity_share()
returns table (
  actor_name text,
  points numeric,
  activities bigint,
  percentage numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_reached_matter_date_activities();

  return query
  with month_activity as (
    select
      coalesce(nullif(btrim(al.actor_name), ''), 'Unknown User') as person_name,
      coalesce(sr.points, al.points, 0)::numeric as activity_points
    from public.activity_logs al
    left join public.activity_score_rules sr on sr.activity_key = al.activity_key
    where al.activity_date >= date_trunc('month', current_date)::date
      and al.activity_date <= current_date
  ),
  user_totals as (
    select
      ma.person_name,
      round(sum(ma.activity_points), 2) as user_points,
      count(*)::bigint as user_activities
    from month_activity ma
    group by ma.person_name
  ),
  firm_total as (
    select coalesce(sum(ut.user_points), 0)::numeric as total_points
    from user_totals ut
  )
  select
    ut.person_name as actor_name,
    ut.user_points as points,
    ut.user_activities as activities,
    case
      when ft.total_points > 0 then round((ut.user_points / ft.total_points) * 100, 1)
      else 0::numeric
    end as percentage
  from user_totals ut
  cross join firm_total ft
  order by ut.user_points desc, ut.person_name asc;
end;
$$;

grant execute on function public.get_dashboard_productivity_share() to authenticated;
