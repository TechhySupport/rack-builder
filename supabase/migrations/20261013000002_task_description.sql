-- Optional instructions shown with a task (for example "check battery life").
alter table public.tasks add column if not exists description text
  check (description is null or char_length(description) <= 2000);
