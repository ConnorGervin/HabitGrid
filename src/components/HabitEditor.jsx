import { useState } from 'react';
import Dialog from './Dialog';
import { addHabit, updateHabit, deleteHabit } from '../lib/store';

export const PALETTE = ['#16a34a', '#0ea5e9', '#6366f1', '#a855f7', '#ec4899', '#f97316', '#eab308', '#64748b'];

// Create or edit one habit, including its reminder.
export default function HabitEditor({ habit, onClose }) {
  const [name, setName] = useState(habit?.name ?? '');
  const [color, setColor] = useState(habit?.color ?? PALETTE[0]);
  const [remind, setRemind] = useState(habit?.reminder?.enabled ?? false);
  const [time, setTime] = useState(habit?.reminder?.time ?? '08:00');

  const save = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    const reminder = { enabled: remind, time };
    if (habit) updateHabit(habit.id, { name: name.trim(), color, reminder });
    else addHabit({ name, color, reminder });
    onClose();
  };

  const remove = () => {
    if (window.confirm(`Delete "${habit.name}"? It will be removed on all devices.`)) {
      deleteHabit(habit.id);
      onClose();
    }
  };

  return (
    <Dialog title={habit ? 'Edit habit' : 'New habit'} onClose={onClose}>
      <form onSubmit={save} className="space-y-5">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Name</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            placeholder="e.g. Read 20 pages"
            className="w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 outline-none focus:border-emerald-500 dark:border-slate-700"
          />
        </label>

        <fieldset>
          <legend className="mb-2 text-sm font-medium">Colour</legend>
          <div className="flex flex-wrap gap-2">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Colour ${c}`}
                aria-pressed={color === c}
                className={`h-8 w-8 rounded-full ring-offset-2 ring-offset-white dark:ring-offset-slate-900 ${color === c ? 'ring-2 ring-slate-700 dark:ring-slate-200' : ''}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </fieldset>

        <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <label className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">Remind me</span>
            <input type="checkbox" checked={remind} onChange={(e) => setRemind(e.target.checked)} className="h-5 w-5 accent-emerald-600" />
          </label>
          {remind && (
            <label className="mt-3 flex items-center justify-between gap-3">
              <span className="text-sm text-slate-600 dark:text-slate-400">Every day at</span>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="rounded-md border border-slate-300 bg-transparent px-2 py-1 dark:border-slate-700" />
            </label>
          )}
          <p className="mt-2 text-xs text-slate-500">Reminders arrive as notifications once you turn them on in Settings. Nothing is sent for habits you've already ticked that day.</p>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          {habit ? (
            <button type="button" onClick={remove} className="rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950">
              Delete
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800">Cancel</button>
            <button type="submit" disabled={!name.trim()} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
              Save
            </button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
