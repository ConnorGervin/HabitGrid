// All dates are local calendar dates written as YYYY-MM-DD (no time zones in the data).
export const toISO = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const todayISO = () => toISO(new Date());

export const parseISO = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

// Weeks run Monday to Sunday.
export const mondayOf = (d) => {
  const diff = (d.getDay() + 6) % 7;
  return addDays(d, -diff);
};

export const weekDates = (monday) => Array.from({ length: 7 }, (_, i) => addDays(monday, i));

export const weekdayShort = (d) => d.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2);

// e.g. "Nov 23 – Nov 29, 2026". Built from explicit parts so every locale renders the same shape.
export const formatWeekRange = (monday) => {
  const sunday = addDays(monday, 6);
  const fmt = (d, withYear) => {
    const md = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return withYear ? `${md}, ${d.getFullYear()}` : md;
  };
  return `${fmt(monday, false)} – ${fmt(sunday, true)}`;
};
