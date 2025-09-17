🎯 Goal

Define and create the Supabase database schema using Supabase MCP (migrations). This sets the foundation for the app to connect to real data in later phases.



-- Users
create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  timezone text not null,         -- e.g. "America/New_York"
  created_at timestamp default now()
);

-- Books
create table books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text
);

-- Lessons
create table lessons (
  id uuid primary key default gen_random_uuid(),
  book_id uuid references books(id) on delete cascade,
  day_number int not null,        -- lesson order
  subject text not null,
  body_html text not null,
  created_at timestamp default now()
);

-- User ↔ Books (assignments)
create table user_books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  book_id uuid references books(id) on delete cascade,
  order_index int not null        -- sequence for this user
);

-- Progress tracking
create table user_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  book_id uuid references books(id) on delete cascade,
  last_lesson_sent int default 0,
  updated_at timestamp default now()
);
