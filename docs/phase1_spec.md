🎯 Goal

Build a frontend-only admin dashboard that mimics the final app but uses dummy data (local state or mock JSON).

Purpose: validate flows like creating users, assigning books, viewing progress.

No backend/API integration yet.

🔑 Features (Phase 1)

User Management (Admin Only)

View a list of users.

Add a new user (email, timezone).

Dummy progress bar for lessons.

Book Assignment

Select books from a mock “library”.

Assign 1+ books to a user in sequence.

Drag-and-drop ordering (optional for polish).

Lesson Preview

Show a preview of lessons for an assigned book.

“Next Lesson” indicator for each user.

Dashboard

Summary list:

User email

Assigned books (in sequence)

Current lesson/day (dummy value)

Next scheduled send time (dummy, based on timezone).

🖼️ UI Screens (Prototype)

Users Page

Table of users:
| Email | Timezone | Assigned Books | Progress |

Button: Add User → modal with form (email, timezone).

User Detail Page

Header: User info.

Section: Assigned Books (list in order).

Button: Assign Books → modal with multi-select + ordering.

Section: Progress (dummy progress bar).

Books Page (Library)

Table/list of available books (title, description).

Click → view lessons (lesson #, subject, short preview).

---
