"use client";

import { use, useState, useEffect } from "react";
import { getBook, listLessonsForBook } from "@/lib/supabaseDb";
import type { Book, Lesson } from "@/types/domain";

export default function BookDetailPage({ params }: { params: Promise<{ id: string }> }) {
  // Unwrap the params Promise
  const { id } = use(params);
  
  const [book, setBook] = useState<Book | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadBookData() {
      try {
        setLoading(true);
        const [bookData, lessonsData] = await Promise.all([
          getBook(id),
          listLessonsForBook(id)
        ]);
        setBook(bookData);
        setLessons(lessonsData);
      } catch (error) {
        console.error('Failed to load book data:', error);
      } finally {
        setLoading(false);
      }
    }
    loadBookData();
  }, [id]);

  if (loading) return <div>Loading book...</div>;
  if (!book) return <div>Book not found.</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{book.title}</h1>
        <div className="text-sm opacity-60">by {book.author}</div>
        {book.description && <p className="opacity-80">{book.description}</p>}
      </div>
      {lessons.length === 0 ? (
        <div className="opacity-70">No lessons for this book.</div>
      ) : (
        <div className="space-y-3">
          {lessons.map(lesson => (
            <div key={lesson.id} className="border rounded p-3">
              <div className="font-medium">Day {lesson.dayNumber}{lesson.subject ? ` — ${lesson.subject}` : ""}</div>
              <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: lesson.bodyHtml }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


