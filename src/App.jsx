import { useEffect, useState, useSyncExternalStore } from 'react';
import { getDoc, subscribe, activeHabits } from './lib/store';
import { startSync, subscribeStatus, getStatus, syncNow, getSettings } from './lib/sync';
import { refreshReminderDevice } from './lib/push';
import { mondayOf, addDays, todayISO, formatWeekRange } from './lib/dates';
import WeekGrid from './components/WeekGrid';
import HabitEditor from './components/HabitEditor';
import SettingsDialog from './components/SettingsDialog';

const STATUS_LABEL = {
  off: 'Local only',
  idle: '',
  syncing: 'Syncing…',
  synced: 'Synced',
  offline: 'Offline',
  error: 'Sync error',
};

export default function App() {
  const doc = useSyncExternalStore(subscribe, getDoc);
  const status = useSyncExternalStore(subscribeStatus, getStatus);
  const [monday, setMonday] = useState(() => mondayOf(new Date()));
  const [editing, setEditing] = useState(null); // null | { habit? } – habit undefined means "new"
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    startSync();
    refreshReminderDevice();
  }, []);

  const thisWeek = monday.getTime() === mondayOf(new Date()).getTime();
  const shift = (weeks) => setMonday((m) => addDays(m, weeks * 7));
  const hasSync = Boolean(getSettings().token);

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
      <header className="flex items-center justify-between gap-3 py-3">
        <div className="flex items-baseline gap-2">
          <h1 className="text-xl font-bold tracking-tight">HabitGrid</h1>
          <button
            onClick={syncNow}
            disabled={!hasSync}
            title={status.message || STATUS_LABEL[status.state]}
            className="text-xs text-slate-500 hover:underline disabled:no-underline"
          >
            {status.state === 'error' ? '⚠ ' : ''}
            {STATUS_LABEL[status.state]}
          </button>
        </div>
        <button onClick={() => setSettingsOpen(true)} className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-800" aria-label="Settings">
          Settings
        </button>
      </header>

      {status.state === 'error' && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{status.message}</p>}

      <nav className="mb-4 flex items-center justify-between gap-2" aria-label="Week">
        <button onClick={() => shift(-1)} className="rounded-lg px-3 py-2 hover:bg-slate-200/60 dark:hover:bg-slate-800" aria-label="Previous week">‹</button>
        <div className="text-center">
          <div className="font-semibold tabular-nums">{formatWeekRange(monday)}</div>
          {!thisWeek && (
            <button onClick={() => setMonday(mondayOf(new Date()))} className="text-xs text-emerald-600 hover:underline dark:text-emerald-400">
              Back to this week
            </button>
          )}
        </div>
        <button onClick={() => shift(1)} disabled={thisWeek} className="rounded-lg px-3 py-2 hover:bg-slate-200/60 disabled:opacity-30 dark:hover:bg-slate-800" aria-label="Next week">›</button>
      </nav>

      <main className="flex-1">
        <WeekGrid doc={doc} monday={monday} onEdit={(habit) => setEditing({ habit })} />
        {activeHabits(doc).length === 0 && (
          <p className="py-10 text-center text-slate-500">No habits yet. Add one to start your grid.</p>
        )}
      </main>

      <footer className="mt-6">
        <button onClick={() => setEditing({})} className="w-full rounded-xl bg-emerald-600 py-3 font-medium text-white shadow-sm hover:bg-emerald-700">
          + New habit
        </button>
        <p className="mt-3 text-center text-xs text-slate-500">Today: {todayISO()}</p>
      </footer>

      {editing && <HabitEditor habit={editing.habit} onClose={() => setEditing(null)} />}
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
