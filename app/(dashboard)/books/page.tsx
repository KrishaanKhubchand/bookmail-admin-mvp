"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { listBooks } from "@/lib/supabaseDb";
import type { Book } from "@/types/domain";

export default function BooksPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadBooks() {
      try {
        setLoading(true);
        const booksList = await listBooks();
        setBooks(booksList);
      } catch (error) {
        console.error('Failed to load books:', error);
      } finally {
        setLoading(false);
      }
    }
    loadBooks();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold">Books</h1>
        <div className="opacity-70">Loading books...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Books</h1>
      {books.length === 0 ? (
        <div className="opacity-70">No books available.</div>
      ) : (
        <ul className="space-y-2">
          {books.map(b => (
            <li key={b.id} className="border rounded p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{b.title}</div>
                  <div className="text-xs opacity-60">by {b.author}</div>
                  {b.description && <div className="text-sm opacity-80">{b.description}</div>}
                </div>
                <Link href={`/books/${b.id}`} className="underline">View</Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


