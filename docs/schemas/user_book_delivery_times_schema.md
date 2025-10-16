# User Book Delivery Times Table Schema

Database schema for storing book-specific email delivery times in BookMail's Supabase database. This table enables per-book scheduling, allowing each book assignment to have its own delivery schedule.

## Core Identification Fields

**id (uuid)**: Primary key. Unique identifier for each delivery time entry.

**user_book_id (uuid)**: Foreign key reference to user_books.id. Links delivery time to a specific book assignment.

**created_at (timestamptz)**: Timestamp when the delivery time was created.

## Scheduling Fields

**delivery_time (time)**: The time of day for lesson delivery in HH:MM:SS format (e.g., '08:00:00', '17:30:00'). Uses PostgreSQL's native time type for proper validation and sorting.

## Purpose & Use Cases

This table powers **book-based scheduling**, which is different from the global `user_delivery_times` table:

### **Global Delivery Times (`user_delivery_times`)**
- One set of times applies to all of a user's books
- Example: User gets emails at 9 AM daily, regardless of which book

### **Book-Specific Delivery Times (`user_book_delivery_times`)**
- Each book assignment can have its own delivery schedule
- Example: User reads Book A at 8 AM, Book B at 6 PM → 2 emails/day
- Enables multi-book reading with different schedules per book

## Scheduling Examples

### Example 1: Multi-Book Reader
```
User: john@example.com
├── Book Assignment 1: "Atomic Habits"
│   └── Delivery Times: [08:00:00]
└── Book Assignment 2: "Deep Work"
    └── Delivery Times: [18:00:00]

Result: 2 emails per day (8 AM and 6 PM)
```

### Example 2: Intensive Reading
```
User: jane@example.com
└── Book Assignment: "The Shenzhen Experiment"
    └── Delivery Times: [09:00:00, 21:00:00]

Result: 2 lessons per day from the same book (faster completion)
```

### Example 3: Power Reader (4 books simultaneously)
```
User: alex@example.com
├── Book 1 → [08:00:00]
├── Book 2 → [12:00:00]
├── Book 3 → [16:00:00]
└── Book 4 → [20:00:00]

Result: 4 emails per day (one from each book)
```

## Constraints & Validation

- **Foreign key cascade**: ON DELETE CASCADE removes delivery times when book assignment is deleted
- **Time format**: PostgreSQL time type automatically validates HH:MM:SS format
- **Multiple times per book**: A book can have multiple delivery times (for multiple lessons per day)

## Relationships

- **References**: user_books.id (many-to-one: each delivery time belongs to one book assignment)
- **Referenced by**: None (leaf table)

## Admin UI Integration

The admin dashboard (`/users/[id]` page) provides UI for:
- Viewing delivery times per book (shown as blue pills)
- Setting delivery times when assigning a book
- Editing delivery times for existing book assignments
- Using time picker or quick select buttons

## Row Level Security

RLS is enabled. Access is controlled via service role for backend operations and admin dashboard.

## Migration Notes

This table was introduced as part of the migration from user-based to book-based scheduling:
- **Before**: One set of delivery times per user (all books use same times)
- **After**: Individual delivery times per book assignment (fine-grained control)

The old `user_delivery_times` table still exists for backward compatibility but is deprecated in favor of this book-specific approach.

## Performance Considerations

- **Index needed**: B-tree index on `(user_book_id, delivery_time)` for efficient lookups
- **Scalability**: Supports thousands of book assignments with different schedules

## Related Documentation

For details on how the scheduler uses this table, see:
- [Scheduler Book Delivery Integration](../scheduler_book_delivery_integration.md) - How the scheduler queries and processes book-specific delivery times

