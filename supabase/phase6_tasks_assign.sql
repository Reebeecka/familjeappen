alter table tasks
  add column if not exists assigned_to uuid references auth.users (id) on delete set null;
