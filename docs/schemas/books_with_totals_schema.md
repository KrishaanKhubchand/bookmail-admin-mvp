# books_with_totals View Schema

This is the schema context for the `books_with_totals` view, which exposes `books` with an aggregated `total_lessons` count.

## Fields

**id (uuid)**: From `books.id`.

**title (text)**: From `books.title`.

**author (text)**: From `books.author`.

**description (text)**: From `books.description`.

**created_at (timestamptz)**: From `books.created_at`.

**total_lessons (int)**: Computed count of rows in `lessons` where `lessons.book_id = books.id`.

## Relationships

- **Sources**: `books`, `lessons`

## Row Level Security

The view reflects underlying table access; reads are permitted where selects on `books`/`lessons` are allowed.
