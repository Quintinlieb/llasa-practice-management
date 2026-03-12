alter table public.employees
  add column if not exists retirement_age smallint;

alter table public.employees
  alter column retirement_age set default 65;

update public.employees
set retirement_age = 65
where retirement_age is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'employees_retirement_age_check'
      and conrelid = 'public.employees'::regclass
  ) then
    alter table public.employees
      add constraint employees_retirement_age_check
      check (retirement_age in (55, 60, 65, 70));
  end if;
end $$;
