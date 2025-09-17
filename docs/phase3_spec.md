🎯 Goal

Connect the BookMail frontend (Next.js/React) to the Supabase database.

Replace dummy data with live queries.

Ensure admin can create users, assign books, and view progress in real-time.

Keep scope focused on data flow (no emails yet).

🔑 Deliverables

Supabase client initialized inside the web app.

Queries in place for all 5 tables (users, books, lessons, user_books, user_progress).

UI actions (add user, assign book, view lessons, view progress) update/read from Supabase directly.

Loading states + error handling where queries are made.

📂 Tasks
1. Supabase Client Setup

Add environment variables (SUPABASE_URL, SUPABASE_ANON_KEY) to project.

Create a client instance that can be imported across components.

2. Users

Replace dummy users list with Supabase query from users table.

Update “Add User” form to insert a row into users.

Verify new users appear in list immediately.

3. Books & Lessons

Fetch book list from books table instead of dummy JSON.

On book detail view, fetch lessons from lessons table.

Display lessons ordered by day_number.

4. Assigning Books to Users

Update the “Assign Books” flow to insert into user_books.

Ensure order_index is stored correctly to reflect sequence.

On first book assignment, insert into user_progress with last_lesson_sent = 0.

5. Progress Tracking

Fetch user’s progress from user_progress table.

Display current lesson/day in the user detail page.

Show which book they’re on (based on user_books.order_index).

6. Error & Loading States

Add spinners or placeholders while queries run.

Display basic error messages if inserts or queries fail.