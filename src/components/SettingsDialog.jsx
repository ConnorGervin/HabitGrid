import { useEffect, useRef, useState } from 'react';
import Dialog from './Dialog';
import { exportText, importJson } from '../lib/store';
import { getSettings, saveSettings, syncNow } from '../lib/sync';
import { pushSupported, enableReminders, disableReminders, getSubscription } from '../lib/push';

export default function SettingsDialog({ onClose }) {
  const [token, setToken] = useState(getSettings().token);
  const [message, setMessage] = useState('');
  const [reminders, setReminders] = useState(null); // null = checking
  const fileRef = useRef(null);
  const hasVapid = Boolean(import.meta.env.VITE_VAPID_PUBLIC_KEY);

  useEffect(() => {
    if (!pushSupported()) return;
    getSubscription().then((s) => setReminders(Boolean(s))).catch(() => setReminders(false));
  }, []);

  const saveToken = () => {
    saveSettings({ token: token.trim() });
    setMessage('Saved. Syncing…');
    syncNow();
  };

  const toggleReminders = async () => {
    setMessage('');
    try {
      if (reminders) {
        await disableReminders();
        setReminders(false);
        setMessage('Reminders turned off on this device.');
      } else {
        await enableReminders();
        setReminders(true);
        setMessage('Reminders on. You will get a notification at each habit’s time.');
      }
    } catch (err) {
      setMessage(err.message);
    }
  };

  const download = () => {
    const blob = new Blob([exportText()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `habitgrid-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      importJson(await file.text());
      setMessage('Imported. Existing habits were merged, not replaced.');
    } catch (err) {
      setMessage(err.message || 'Could not read that file.');
    }
    e.target.value = '';
  };

  return (
    <Dialog title="Settings" onClose={onClose}>
      <div className="space-y-6 text-sm">
        <section className="space-y-2">
          <h3 className="font-semibold">Sync between devices</h3>
          <p className="text-slate-600 dark:text-slate-400">
            Paste the sync token you set on the server (SYNC_TOKEN). Use the same token on every device. Leave empty to keep data on this device only.
          </p>
          <div className="flex gap-2">
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Sync token"
              autoComplete="off"
              className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-transparent px-3 py-2 dark:border-slate-700"
            />
            <button onClick={saveToken} className="rounded-lg bg-emerald-600 px-3 py-2 font-medium text-white hover:bg-emerald-700">Save</button>
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="font-semibold">Reminders</h3>
          {!pushSupported() ? (
            <p className="text-slate-600 dark:text-slate-400">Notifications are not supported in this browser. On Android, use Chrome.</p>
          ) : !hasVapid ? (
            <p className="text-slate-600 dark:text-slate-400">Reminders are not configured on this deployment yet.</p>
          ) : (
            <button
              onClick={toggleReminders}
              disabled={reminders === null}
              className="rounded-lg border border-slate-300 px-3 py-2 font-medium hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              {reminders ? 'Turn off reminders on this device' : 'Turn on reminders on this device'}
            </button>
          )}
        </section>

        <section className="space-y-2">
          <h3 className="font-semibold">Your data</h3>
          <p className="text-slate-600 dark:text-slate-400">
            Everything is one plain JSON file. Download it as a backup, or import one from another device or an older backup.
          </p>
          <div className="flex flex-wrap gap-2">
            <button onClick={download} className="rounded-lg border border-slate-300 px-3 py-2 font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">Download JSON</button>
            <button onClick={() => fileRef.current?.click()} className="rounded-lg border border-slate-300 px-3 py-2 font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">Import JSON</button>
            <input ref={fileRef} type="file" accept="application/json,.json" onChange={importFile} className="hidden" />
          </div>
        </section>

        {message && <p role="status" className="rounded-lg bg-slate-100 p-3 dark:bg-slate-800">{message}</p>}
      </div>
    </Dialog>
  );
}
