import Link from "next/link";
import "@/app/globals.css";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid grid-cols-[220px_1fr]">
      <aside className="border-r border-black/[.08] dark:border-white/[.145] p-4 space-y-4">
        <div className="text-lg font-semibold">BookMail Admin MVP</div>
        <nav className="flex flex-col gap-2">
          <Link href="/users" className="hover:underline">Users</Link>
          <Link href="/books" className="hover:underline">Books</Link>
          <Link href="/test" className="hover:underline">Test</Link>
          <div className="border-t pt-2 mt-4">
            <div className="text-sm text-gray-600 mb-2">Debug</div>
            <div className="flex flex-col gap-1">
              <Link href="/debug/email" className="hover:underline text-sm">✉️ Email (Resend)</Link>
              <Link href="/debug/logs" className="hover:underline text-sm">📊 Email Logs</Link>
              <Link href="/debug/scheduled-email-timeline" className="hover:underline text-sm">📅 Email Timeline</Link>
              <Link href="/debug/scheduling-simulations" className="hover:underline text-sm">🧪 Scheduler Testing</Link>
            </div>
          </div>
        </nav>
      </aside>
      <main className="p-6">{children}</main>
    </div>
  );
}


