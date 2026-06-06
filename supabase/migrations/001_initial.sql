create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'staff' check (role in ('admin', 'staff')),
  created_at timestamptz default now()
);

create table sermon_series (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  cover_img_url text,
  started_at date,
  ended_at date,
  created_at timestamptz default now()
);

create table sermons (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  preacher text not null,
  scripture text,
  series_id uuid references sermon_series(id) on delete set null,
  worship_type text not null default '????',
  sermon_date date not null,
  video_url text,
  audio_url text,
  notes_url text,
  thumbnail_url text,
  view_count int not null default 0,
  is_published boolean not null default false,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);

create table posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text,
  category text not null default '??' check (category in ('??', '??', '??', '??')),
  thumbnail_url text,
  attachment_url text,
  is_pinned boolean not null default false,
  is_published boolean not null default false,
  published_at timestamptz,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table app_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  message text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);

alter table profiles enable row level security;
alter table sermons enable row level security;
alter table sermon_series enable row level security;
alter table posts enable row level security;
alter table app_logs enable row level security;

create policy "published sermons are public" on sermons for select using (is_published = true);
create policy "published posts are public" on posts for select using (is_published = true);
create policy "sermon_series are public" on sermon_series for select using (true);

create policy "admin can manage sermons" on sermons for all
  using (exists (select 1 from profiles where id = auth.uid() and role in ('admin','staff')));
create policy "admin can manage posts" on posts for all
  using (exists (select 1 from profiles where id = auth.uid() and role in ('admin','staff')));
create policy "admin can read own profile" on profiles for select
  using (id = auth.uid());
create policy "admin can read logs" on app_logs for select
  using (exists (select 1 from profiles where id = auth.uid() and role in ('admin','staff')));
create policy "admin can write logs" on app_logs for insert
  with check (exists (select 1 from profiles where id = auth.uid() and role in ('admin','staff')));
