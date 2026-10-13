-- Notes on a task, visible to everyone in the task's organisation.
create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists task_comments_task_id_idx on public.task_comments (task_id, created_at);
create index if not exists task_comments_organisation_id_idx on public.task_comments (organisation_id);

alter table public.task_comments enable row level security;

create policy "task_comments: members read"
  on public.task_comments for select
  using (public.my_org_role(organisation_id) is not null);

-- Editors and above, or the person the task is assigned to, can add notes.
create policy "task_comments: assignee or editor write"
  on public.task_comments for insert
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.tasks t
      where t.id = task_id
        and t.organisation_id = task_comments.organisation_id
        and (
          t.assignee_id = auth.uid()
          or public.my_org_role(t.organisation_id) in ('owner', 'admin', 'editor')
        )
    )
  );

create policy "task_comments: author or admin delete"
  on public.task_comments for delete
  using (author_id = auth.uid() or public.my_org_role(organisation_id) in ('owner', 'admin'));
