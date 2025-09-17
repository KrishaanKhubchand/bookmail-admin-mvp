1. Overview

BookMail Admin MVP is an admin-driven email drip system.

Admins can create users and assign them one or more books in a defined sequence.

Each book has lessons, which are pre-created and stored in the database.

The system automatically sends one lesson per day, at a fixed time in the user’s local timezone.

Emails are sent using Resend API, with lesson content retrieved from Supabase.

The purpose of the MVP is to validate whether the concept of daily book-based lessons delivered via email resonates with users.

2. Goals & Non-Goals

Goals (MVP scope):

Admin can:

Create a user with email + timezone.

Assign one or more books in a specific order.

System automatically:

Sends one lesson per day.

Advances lesson tracking until all assigned books are completed.

Email delivery powered by Resend, using HTML content stored in Supabase.

Non-Goals (out of scope for MVP):

User-facing signup flows.

Self-service dashboards.

Variable delivery frequency (only daily).

Payments, subscriptions, or trials.

Analytics beyond basic logging of sends.

3. Data Model
users

Stores user identity and timezone.

users (
  id uuid primary key,
  email text unique not null,
  timezone text not null,         -- e.g. "America/New_York"
  created_at timestamp default now()
);

books

Catalog of available books.

books (
  id uuid primary key,
  title text not null,
  description text
);

lessons

Pre-created lessons for each book, in sequence.

lessons (
  id uuid primary key,
  book_id uuid references books(id),
  day_number int not null,        -- lesson order within book
  subject text,                   -- email subject
  body_html text,                 -- email HTML body
  created_at timestamp default now()
);

user_books

Assignments of books to users, in a specific sequence.

user_books (
  id uuid primary key,
  user_id uuid references users(id),
  book_id uuid references books(id),
  order_index int not null        -- 1, 2, 3... sequence of books for this user
);

user_progress

Tracks user’s progress through lessons.

user_progress (
  id uuid primary key,
  user_id uuid references users(id),
  book_id uuid references books(id),
  last_lesson_sent int default 0, -- 0 = none yet
  updated_at timestamp default now()
);

4. Workflow
Admin Actions

Create User

Input: email, timezone.

Insert into users.

Assign Books

Select one or more books.

Insert into user_books with order_index.

Initialize user_progress for the first book (last_lesson_sent = 0).