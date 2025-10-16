"use client";

import { use, useState, useEffect } from "react";
import { listUsers, getAssignedBooks, listBooks, getCurrentBookProgress, listLessonsForBook, setAssignedBooks, getUserDeliveryTimes, setUserDeliveryTimes, updateUserTimezone, setUserBookDeliveryTimes } from "@/lib/supabaseDb";
import { formatDeliveryTime, parseTimeToString, ALL_HOURS, MINUTE_OPTIONS, QUICK_SELECT_TIMES } from "@/lib/time";
import { COMMON_TIMEZONES } from "@/lib/timezones";
import type { UUID, User, AssignedBookDetail, Book, UserBook, UserDeliveryTime } from "@/types/domain";

export default function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  // Unwrap the params Promise
  const { id: userId } = use(params);
  
  const [user, setUser] = useState<User | null>(null);
  const [assignedBooks, setAssignedBooksState] = useState<AssignedBookDetail[]>([]);
  const [allBooks, setAllBooks] = useState<Book[]>([]);
  const [currentBook, setCurrentBook] = useState<UserBook | null>(null);
  const [currentLessons, setCurrentLessons] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const [showAssign, setShowAssign] = useState(false);
  const [selected, setSelected] = useState<UUID[]>([]);
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState("");

  // Delivery times state
  const [deliveryTimes, setDeliveryTimes] = useState<UserDeliveryTime[]>([]);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]);
  const [savingTimes, setSavingTimes] = useState(false);
  const [deliveryError, setDeliveryError] = useState("");
  
  // New time input state
  const [newHour, setNewHour] = useState(9);
  const [newMinute, setNewMinute] = useState(0);

  // Timezone editing state
  const [showTimezoneModal, setShowTimezoneModal] = useState(false);
  const [selectedTimezone, setSelectedTimezone] = useState('Europe/London');
  const [savingTimezone, setSavingTimezone] = useState(false);
  const [timezoneError, setTimezoneError] = useState('');

  // Book-specific delivery times state
  const [showBookTimeModal, setShowBookTimeModal] = useState(false);
  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  const [selectedBookTimes, setSelectedBookTimes] = useState<string[]>([]);
  const [savingBookTimes, setSavingBookTimes] = useState(false);
  const [bookTimeError, setBookTimeError] = useState('');

  // Load user data on mount
  useEffect(() => {
    async function loadUserData() {
      try {
        setLoading(true);
        const [users, assignedData, currentBookData, booksData, deliveryData] = await Promise.all([
          listUsers(),
          getAssignedBooks(userId),
          getCurrentBookProgress(userId),
          listBooks(),
          getUserDeliveryTimes(userId)
        ]);
        
        const foundUser = users.find(u => u.id === userId);
        setUser(foundUser || null);
        setAssignedBooksState(assignedData);
        setCurrentBook(currentBookData);
        setAllBooks(booksData);
        setSelected(assignedData.map(a => a.book.id));
        setDeliveryTimes(deliveryData);
        
        // Load lesson count for progress calculation
        if (currentBookData) {
          const lessons = await listLessonsForBook(currentBookData.bookId);
          setCurrentLessons(lessons.length);
        }
      } catch (error) {
        console.error('Failed to load user data:', error);
      } finally {
        setLoading(false);
      }
    }
    loadUserData();
  }, [userId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="opacity-70">Loading user...</div>
      </div>
    );
  }

  if (!user) return <div>User not found.</div>;

  const nextLesson = currentBook ? Math.min(currentBook.lastLessonSent + 1, currentLessons) : 0;

  async function handleSaveAssign() {
    try {
      setAssigning(true);
      setAssignError("");
      await setAssignedBooks(user.id, selected);
      setShowAssign(false);
      
      // Reload user data to show updated assignments
      const [assignedData, currentBookData] = await Promise.all([
        getAssignedBooks(userId),
        getCurrentBookProgress(userId)
      ]);
      setAssignedBooksState(assignedData);
      setCurrentBook(currentBookData);
      setSelected(assignedData.map(a => a.book.id));
      
      // Update lesson count if progress changed
      if (currentBookData) {
        const lessons = await listLessonsForBook(currentBookData.bookId);
        setCurrentLessons(lessons.length);
      }
    } catch (error) {
      console.error('Failed to assign books:', error);
      setAssignError('Failed to assign books. Please try again.');
    } finally {
      setAssigning(false);
    }
  }

  async function handleSaveDeliveryTimes() {
    try {
      setSavingTimes(true);
      setDeliveryError("");
      await setUserDeliveryTimes(user.id, selectedTimes);
      setShowDeliveryModal(false);
      
      // Reload delivery times to show updated list
      const deliveryData = await getUserDeliveryTimes(userId);
      setDeliveryTimes(deliveryData);
    } catch (error) {
      console.error('Failed to save delivery times:', error);
      setDeliveryError('Failed to save delivery times. Please try again.');
    } finally {
      setSavingTimes(false);
    }
  }

  function handleAddTime() {
    const timeString = parseTimeToString(newHour, newMinute);
    if (!selectedTimes.includes(timeString)) {
      setSelectedTimes(prev => [...prev, timeString].sort());
    }
  }

  function handleQuickSelect(timeValue: string) {
    if (!selectedTimes.includes(timeValue)) {
      setSelectedTimes(prev => [...prev, timeValue].sort());
    }
  }

  async function handleSaveTimezone() {
    try {
      setSavingTimezone(true);
      setTimezoneError('');
      await updateUserTimezone(user.id, selectedTimezone);
      setShowTimezoneModal(false);
      
      // Reload user data
      const users = await listUsers();
      const updatedUser = users.find(u => u.id === userId);
      setUser(updatedUser || null);
    } catch (error) {
      console.error('Failed to update timezone:', error);
      setTimezoneError('Failed to update timezone. Please try again.');
    } finally {
      setSavingTimezone(false);
    }
  }

  async function handleSaveBookTimes() {
    if (!editingBookId) return;
    
    try {
      setSavingBookTimes(true);
      setBookTimeError('');
      await setUserBookDeliveryTimes(editingBookId, selectedBookTimes);
      setShowBookTimeModal(false);
      
      // Reload assigned books to show updated times
      const assignedData = await getAssignedBooks(userId);
      setAssignedBooksState(assignedData);
    } catch (error) {
      console.error('Failed to save book delivery times:', error);
      setBookTimeError('Failed to save delivery times. Please try again.');
    } finally {
      setSavingBookTimes(false);
    }
  }

  function toggleBook(id: UUID) {
    setSelected(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  }

  function move(id: UUID, dir: -1 | 1) {
    setSelected(prev => {
      const idx = prev.indexOf(id);
      if (idx === -1) return prev;
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(idx, 1);
      copy.splice(target, 0, item);
      return copy;
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{user.email}</h1>
          <div className="flex items-center gap-2 opacity-80">
            <span>Timezone: {user.timezone || 'Not set'}</span>
            <button 
              className="text-blue-600 underline text-sm" 
              onClick={() => {
                setSelectedTimezone(user.timezone || 'Europe/London');
                setShowTimezoneModal(true);
                setTimezoneError('');
              }}
            >
              Edit
            </button>
          </div>
        </div>
        <button className="px-3 py-2 border rounded" onClick={() => {setShowAssign(true); setAssignError("");}}>Assign Books</button>
      </div>

      <section className="space-y-3">
        <h2 className="font-medium">Assigned Books (in order)</h2>
        {assignedBooks.map((a, index) => (
          <div key={a.userBook.id} className="border rounded p-3 space-y-2">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="font-medium">
                  {index + 1}. {a.book.title}
                </div>
                <div className="text-sm opacity-70">
                  Progress: {a.userBook.lastLessonSent || 0} lessons sent
                </div>
              </div>
              <button
                className="text-blue-600 text-sm underline"
                onClick={() => {
                  setEditingBookId(a.userBook.id);
                  setSelectedBookTimes(a.deliveryTimes || []);
                  setShowBookTimeModal(true);
                  setBookTimeError('');
                }}
              >
                {a.deliveryTimes && a.deliveryTimes.length > 0 ? 'Edit Times' : 'Set Times'}
              </button>
            </div>
            
            {a.deliveryTimes && a.deliveryTimes.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {a.deliveryTimes.map(time => (
                  <span key={time} className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">
                    {formatDeliveryTime(time)}
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-sm opacity-60">No delivery times set</div>
            )}
          </div>
        ))}
        {assignedBooks.length === 0 && (
          <div className="opacity-70">No books assigned.</div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">Progress</h2>
        {currentBook ? (
          <div className="text-sm">
            <div>Current Book: {allBooks.find(b => b.id === currentBook.bookId)?.title}</div>
            <div>Last Lesson Sent: {currentBook.lastLessonSent} / {currentLessons}</div>
            <div>Next Lesson: {nextLesson}</div>
          </div>
        ) : (
          <div className="opacity-70">No progress yet.</div>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Delivery Times</h2>
          <button 
            className="px-3 py-2 border rounded text-sm" 
            onClick={() => {
              setShowDeliveryModal(true); 
              setSelectedTimes(deliveryTimes.map(dt => dt.deliveryTime));
              setDeliveryError("");
            }}
          >
            Edit Times
          </button>
        </div>
        {deliveryTimes.length > 0 ? (
          <ul className="space-y-1">
            {deliveryTimes.map(dt => (
              <li key={dt.id} className="text-sm">
                {formatDeliveryTime(dt.deliveryTime)}
              </li>
            ))}
          </ul>
        ) : (
          <div className="opacity-70 text-sm">No delivery times set. Using default: 9:00 AM daily.</div>
        )}
      </section>

      {showAssign && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-background text-foreground rounded shadow-lg p-4 w-full max-w-lg space-y-3">
            <h3 className="text-lg font-medium">Assign Books</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {allBooks.map(b => {
                const on = selected.includes(b.id);
                return (
                  <label key={b.id} className={`border rounded p-2 cursor-pointer ${on ? "bg-black/[.06] dark:bg-white/[.10]" : ""}`}>
                    <input type="checkbox" className="mr-2" checked={on} onChange={() => toggleBook(b.id)} />
                    {b.title}
                  </label>
                );
              })}
            </div>
            {selected.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium">Order</div>
                <ul className="space-y-1">
                  {selected.map(id => (
                    <li key={id} className="flex items-center justify-between border rounded px-2 py-1">
                      <span>{allBooks.find(b => b.id === id)?.title}</span>
                      <span className="space-x-2">
                        <button className="px-2 py-1 border rounded" onClick={() => move(id, -1)}>↑</button>
                        <button className="px-2 py-1 border rounded" onClick={() => move(id, 1)}>↓</button>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {assignError && (
              <div className="text-red-600 text-sm p-2 bg-red-50 border border-red-200 rounded">
                {assignError}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button className="px-3 py-2 border rounded" onClick={() => setShowAssign(false)} disabled={assigning}>Cancel</button>
              <button 
                className="px-3 py-2 border rounded bg-foreground text-background disabled:opacity-50" 
                onClick={handleSaveAssign}
                disabled={assigning}
              >
                {assigning ? 'Assigning...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showTimezoneModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-background text-foreground rounded shadow-lg p-4 w-full max-w-md space-y-3">
            <h3 className="text-lg font-medium">Edit Timezone</h3>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Timezone:</label>
              <select
                value={selectedTimezone}
                onChange={(e) => setSelectedTimezone(e.target.value)}
                className="w-full border rounded px-3 py-2 bg-white"
              >
                {COMMON_TIMEZONES.map(tz => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>

            {timezoneError && (
              <div className="text-red-600 text-sm p-2 bg-red-50 border border-red-200 rounded">
                {timezoneError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button 
                className="px-3 py-2 border rounded" 
                onClick={() => setShowTimezoneModal(false)}
                disabled={savingTimezone}
              >
                Cancel
              </button>
              <button 
                className="px-3 py-2 border rounded bg-foreground text-background disabled:opacity-50" 
                onClick={handleSaveTimezone}
                disabled={savingTimezone}
              >
                {savingTimezone ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeliveryModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-background text-foreground rounded shadow-lg p-4 w-full max-w-lg space-y-3">
            <h3 className="text-lg font-medium">Edit Delivery Times</h3>
            
            <div className="space-y-4">
              {/* Time Input Section */}
              <div className="border rounded p-3 bg-gray-50">
                <div className="text-sm font-medium mb-2">Add New Time:</div>
                <div className="flex items-center gap-2">
                  <select 
                    value={newHour} 
                    onChange={e => setNewHour(Number(e.target.value))}
                    className="border rounded px-2 py-1 bg-white"
                  >
                    {ALL_HOURS.map(hour => (
                      <option key={hour.value} value={hour.value}>{hour.label}</option>
                    ))}
                  </select>
                  <span>:</span>
                  <select 
                    value={newMinute} 
                    onChange={e => setNewMinute(Number(e.target.value))}
                    className="border rounded px-2 py-1 bg-white"
                  >
                    {MINUTE_OPTIONS.map(min => (
                      <option key={min.value} value={min.value}>{min.label}</option>
                    ))}
                  </select>
                  <button 
                    onClick={handleAddTime}
                    className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                    disabled={selectedTimes.includes(parseTimeToString(newHour, newMinute))}
                  >
                    Add Time
                  </button>
                </div>
              </div>

              {/* Quick Select Section */}
              <div>
                <div className="text-sm font-medium mb-2">Quick Select:</div>
                <div className="flex flex-wrap gap-2">
                  {QUICK_SELECT_TIMES.map(time => (
                    <button
                      key={time.value}
                      onClick={() => handleQuickSelect(time.value)}
                      className="px-3 py-1 border rounded text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={selectedTimes.includes(time.value)}
                    >
                      {time.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Selected Times Section */}
              {selectedTimes.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">Selected Times:</div>
                  <div className="flex flex-wrap gap-2">
                    {selectedTimes.sort().map(time => (
                      <span 
                        key={time} 
                        className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs flex items-center gap-1"
                      >
                        {formatDeliveryTime(time)}
                        <button
                          onClick={() => setSelectedTimes(prev => prev.filter(t => t !== time))}
                          className="ml-1 text-blue-600 hover:text-blue-800"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {deliveryError && (
              <div className="text-red-600 text-sm p-2 bg-red-50 border border-red-200 rounded">
                {deliveryError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button 
                className="px-3 py-2 border rounded" 
                onClick={() => setShowDeliveryModal(false)}
                disabled={savingTimes}
              >
                Cancel
              </button>
              <button 
                className="px-3 py-2 border rounded bg-foreground text-background disabled:opacity-50" 
                onClick={handleSaveDeliveryTimes}
                disabled={savingTimes}
              >
                {savingTimes ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showBookTimeModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-background text-foreground rounded shadow-lg p-4 w-full max-w-lg space-y-3">
            <h3 className="text-lg font-medium">
              Edit Delivery Times - {assignedBooks.find(a => a.userBook.id === editingBookId)?.book.title}
            </h3>
            
            <div className="space-y-4">
              {/* Time Input Section */}
              <div className="border rounded p-3 bg-gray-50">
                <div className="text-sm font-medium mb-2">Add New Time:</div>
                <div className="flex items-center gap-2">
                  <select 
                    value={newHour} 
                    onChange={e => setNewHour(Number(e.target.value))}
                    className="border rounded px-2 py-1 bg-white"
                  >
                    {ALL_HOURS.map(hour => (
                      <option key={hour.value} value={hour.value}>{hour.label}</option>
                    ))}
                  </select>
                  <span>:</span>
                  <select 
                    value={newMinute} 
                    onChange={e => setNewMinute(Number(e.target.value))}
                    className="border rounded px-2 py-1 bg-white"
                  >
                    {MINUTE_OPTIONS.map(min => (
                      <option key={min.value} value={min.value}>{min.label}</option>
                    ))}
                  </select>
                  <button 
                    onClick={() => {
                      const timeString = parseTimeToString(newHour, newMinute);
                      if (!selectedBookTimes.includes(timeString)) {
                        setSelectedBookTimes(prev => [...prev, timeString].sort());
                      }
                    }}
                    className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                    disabled={selectedBookTimes.includes(parseTimeToString(newHour, newMinute))}
                  >
                    Add Time
                  </button>
                </div>
              </div>

              {/* Quick Select Section */}
              <div>
                <div className="text-sm font-medium mb-2">Quick Select:</div>
                <div className="flex flex-wrap gap-2">
                  {QUICK_SELECT_TIMES.map(time => (
                    <button
                      key={time.value}
                      onClick={() => {
                        if (!selectedBookTimes.includes(time.value)) {
                          setSelectedBookTimes(prev => [...prev, time.value].sort());
                        }
                      }}
                      className="px-3 py-1 border rounded text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={selectedBookTimes.includes(time.value)}
                    >
                      {time.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Selected Times Section */}
              {selectedBookTimes.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">Selected Times:</div>
                  <div className="flex flex-wrap gap-2">
                    {selectedBookTimes.sort().map(time => (
                      <span 
                        key={time} 
                        className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs flex items-center gap-1"
                      >
                        {formatDeliveryTime(time)}
                        <button
                          onClick={() => setSelectedBookTimes(prev => prev.filter(t => t !== time))}
                          className="ml-1 text-blue-600 hover:text-blue-800"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {bookTimeError && (
              <div className="text-red-600 text-sm p-2 bg-red-50 border border-red-200 rounded">
                {bookTimeError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button 
                className="px-3 py-2 border rounded" 
                onClick={() => setShowBookTimeModal(false)}
                disabled={savingBookTimes}
              >
                Cancel
              </button>
              <button 
                className="px-3 py-2 border rounded bg-foreground text-background disabled:opacity-50" 
                onClick={handleSaveBookTimes}
                disabled={savingBookTimes}
              >
                {savingBookTimes ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


