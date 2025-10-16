"use client";

import { useState, useEffect } from "react";
import { listUsers, createUser, getAssignedBooks, computeProgressPercent } from "@/lib/supabaseDb";
import { formatNextSendAt } from "@/lib/time";
import { COMMON_TIMEZONES } from "@/lib/timezones";
import Link from "next/link";
import type { User } from "@/types/domain";

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [userProgresses, setUserProgresses] = useState<Record<string, number>>({});
  const [userAssignments, setUserAssignments] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [email, setEmail] = useState("");
  const [timezone, setTimezone] = useState(COMMON_TIMEZONES[0].value);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  // Add state to track if component is mounted (client-side)
  const [isMounted, setIsMounted] = useState(false);

  // Load users on mount
  useEffect(() => {
    loadUsers();
    setIsMounted(true); // Mark as mounted after first render
  }, []);

  async function loadUsers() {
    try {
      setLoading(true);
      const usersList = await listUsers();
      setUsers(usersList);
      
      // Load progress and assignments for all users
      const progressMap: Record<string, number> = {};
      const assignmentMap: Record<string, string> = {};
      
      for (const user of usersList) {
        try {
          progressMap[user.id] = await computeProgressPercent(user.id);
        } catch (error) {
          console.error(`Failed to load progress for user ${user.id}:`, error);
          progressMap[user.id] = 0;
        }
        
        try {
          const assigned = await getAssignedBooks(user.id);
          assignmentMap[user.id] = assigned.map(a => a.book.title).join(", ");
        } catch (error) {
          console.error(`Failed to load assignments for user ${user.id}:`, error);
          assignmentMap[user.id] = "";
        }
      }
      
      setUserProgresses(progressMap);
      setUserAssignments(assignmentMap);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddUser() {
    if (!email || !timezone || creating) return;
    
    try {
      setCreating(true);
      setCreateError("");
      await createUser(email, timezone);
      setEmail("");
      setTimezone(COMMON_TIMEZONES[0].value);
      setShowModal(false);
      // Reload users to show the new one
      await loadUsers();
    } catch (error) {
      console.error('Failed to create user:', error);
      setCreateError('Failed to create user. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold">Users</h1>
        <div className="opacity-70">Loading users...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Users</h1>
        <button className="px-3 py-2 border rounded" onClick={() => {setShowModal(true); setCreateError("");}}>Add User</button>
      </div>

      {users.length === 0 ? (
        <div className="opacity-70">No users yet. Click "Add User" to create one.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">Timezone</th>
                <th className="py-2 pr-4">Assigned Books</th>
                <th className="py-2 pr-4">Progress</th>
                <th className="py-2 pr-4">Next Send</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const progress = userProgresses[u.id] || 0;
                // Only calculate nextSend after component is mounted on client
                const nextSend = isMounted ? formatNextSendAt(u.timezone) : "—";
                return (
                  <tr key={u.id} className="border-b hover:bg-black/[.03] dark:hover:bg-white/[.04]">
                    <td className="py-2 pr-4">
                      <Link href={`/users/${u.id}`} className="underline">
                        {u.email}
                      </Link>
                    </td>
                    <td className="py-2 pr-4">{u.timezone}</td>
                    <td className="py-2 pr-4">{userAssignments[u.id] || "—"}</td>
                    <td className="py-2 pr-4">
                      <div className="w-40 h-2 bg-black/[.06] dark:bg-white/[.12] rounded">
                        <div className="h-2 bg-foreground rounded" style={{ width: `${progress}%` }} />
                      </div>
                      <span className="text-xs ml-2 align-middle">{progress}%</span>
                    </td>
                    <td className="py-2 pr-4">{nextSend}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-background text-foreground rounded shadow-lg p-4 w-full max-w-md space-y-3">
            <h2 className="text-lg font-medium">Add User</h2>
            <label className="block text-sm">
              Email
              <input className="mt-1 w-full border rounded px-2 py-1 bg-transparent" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" />
            </label>
            <label className="block text-sm">
              Timezone
              <select 
                className="mt-1 w-full border rounded px-2 py-1 bg-transparent" 
                value={timezone} 
                onChange={e => setTimezone(e.target.value)}
              >
                {COMMON_TIMEZONES.map(tz => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </label>
            {createError && (
              <div className="text-red-600 text-sm p-2 bg-red-50 border border-red-200 rounded">
                {createError}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button className="px-3 py-2 border rounded" onClick={() => setShowModal(false)}>Cancel</button>
              <button 
                className="px-3 py-2 border rounded bg-foreground text-background disabled:opacity-50" 
                onClick={handleAddUser}
                disabled={creating}
              >
                {creating ? 'Creating...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


