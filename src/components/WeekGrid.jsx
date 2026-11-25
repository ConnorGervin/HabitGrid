import { activeHabits, toggleCheck } from '../lib/store';
import { isDone } from '../../shared/doc.js';
import { weekDates, weekdayShort, toISO, todayISO, parseISO } from '../lib/dates';

// Habits are rows, days are columns.
// Phone: each habit's name sits above its seven tick boxes (full width).
// Desktop (sm+): name on the left, seven boxes on the right.
export default function WeekGrid({ doc, monday, onEdit }) {
  const days = weekDates(monday);
  const today = todayISO();
  const habits = activeHabits(doc);

  return (
    <div className="grid grid-cols-7 gap-x-1.5 gap-y-2 sm:grid-cols-[minmax(0,15rem)_repeat(7,minmax(0,3.25rem))] sm:gap-x-2">
      <div className="hidden sm:block" />
      {days.map((d) => (
        <div key={toISO(d)} className={`text-center text-xs ${toISO(d) === today ? 'font-semibold text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>
          <div>{weekdayShort(d)}</div>
          <div className="tabular-nums">{d.getDate()}</div>
        </div>
      ))}

      {habits.map((habit) => {
        const count = days.filter((d) => isDone(doc, habit.id, toISO(d))).length;
        return (
          <HabitRow
            key={habit.id}
            habit={habit}
            days={days}
            count={count}
            today={today}
            doc={doc}
            onEdit={onEdit}
          />
        );
      })}
    </div>
  );
}

function HabitRow({ habit, days, count, today, doc, onEdit }) {
  return (
    <>
      <button
        onClick={() => onEdit(habit)}
        className="col-span-7 flex items-center justify-between gap-2 truncate pt-2 text-left text-sm font-medium hover:underline sm:col-span-1 sm:pt-0"
        title="Edit habit"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: habit.color }} />
          <span className="truncate">{habit.name}</span>
        </span>
        <span className="shrink-0 text-xs tabular-nums text-slate-500">{count}/7</span>
      </button>

      {days.map((d) => {
        const iso = toISO(d);
        const done = isDone(doc, habit.id, iso);
        const future = iso > today;
        return (
          <button
            key={iso}
            onClick={() => toggleCheck(habit.id, iso)}
            disabled={future}
            aria-pressed={done}
            aria-label={`${habit.name}, ${parseISO(iso).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}`}
            style={done ? { backgroundColor: habit.color, borderColor: habit.color } : undefined}
            className={[
              'h-12 w-full rounded-lg border transition-colors sm:h-10',
              done ? 'text-white' : 'border-slate-200 bg-white hover:border-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-600',
              iso === today && !done ? 'ring-2 ring-emerald-500/60 ring-offset-1 ring-offset-slate-50 dark:ring-offset-slate-950' : '',
              future ? 'cursor-not-allowed opacity-40' : 'active:scale-95',
            ].join(' ')}
          >
            <span className="sr-only">{done ? 'done' : 'not done'}</span>
            {done && <span aria-hidden="true" className="text-lg font-bold">✓</span>}
          </button>
        );
      })}
    </>
  );
}
