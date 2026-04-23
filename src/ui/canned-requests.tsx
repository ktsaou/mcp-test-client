/**
 * Per-tool canned requests: save the current form value under a name,
 * load a previously saved entry to refill the form.
 *
 * Storage key: `mcptc:canned.<server-id>.<tool-name>` → array of
 * `{ name, args, savedAt }`.
 */

import { useEffect, useMemo, useState } from 'react';

import { useServers } from '../state/servers.tsx';
import { appStore } from '../state/store-instance.ts';
import { cannedKey } from '../persistence/schema.ts';
import type { Selection } from './inspector.tsx';

interface CannedEntry {
  name: string;
  args: unknown;
  savedAt: number;
}

interface Props {
  selection: Selection | null;
  formValue: unknown;
  onLoad: (args: unknown) => void;
}

export function CannedRequests({ selection, formValue, onLoad }: Props) {
  const { active } = useServers();
  const storeKey = useMemo(() => {
    if (!active || !selection || selection.kind !== 'tools') return null;
    return cannedKey(active.id, selection.name);
  }, [active, selection]);

  const [entries, setEntries] = useState<CannedEntry[]>([]);

  useEffect(() => {
    if (!storeKey) {
      setEntries([]);
      return;
    }
    const saved = appStore.read<CannedEntry[]>(storeKey.replace(/^mcptc:/, ''));
    setEntries(Array.isArray(saved) ? saved : []);
  }, [storeKey]);

  function persist(next: CannedEntry[]) {
    if (!storeKey) return;
    appStore.write(storeKey.replace(/^mcptc:/, ''), next);
    setEntries(next);
  }

  function handleSave() {
    if (!storeKey) return;
    const name = window.prompt('Name this request:');
    if (!name || !name.trim()) return;
    const trimmed = name.trim();
    const entry: CannedEntry = { name: trimmed, args: formValue, savedAt: Date.now() };
    const existing = entries.filter((e) => e.name !== trimmed);
    persist([entry, ...existing].slice(0, 50));
  }

  function handleLoad(e: React.ChangeEvent<HTMLSelectElement>) {
    const idx = Number(e.target.value);
    e.target.value = '';
    const entry = entries[idx];
    if (entry) onLoad(entry.args);
  }

  function handleDelete(name: string) {
    persist(entries.filter((e) => e.name !== name));
  }

  if (!storeKey) return null;

  return (
    <div className="row row--tight">
      <button
        className="btn btn--ghost"
        type="button"
        onClick={handleSave}
        title="Save the current arguments as a canned request"
        disabled={!formValue}
      >
        Save as…
      </button>
      {entries.length > 0 ? (
        <select
          className="select"
          value=""
          onChange={handleLoad}
          style={{ width: 'auto' }}
          aria-label="Load a saved request"
        >
          <option value="" disabled>
            Load saved ({entries.length})
          </option>
          {entries.map((e, i) => (
            <option key={e.name} value={i}>
              {e.name}
            </option>
          ))}
        </select>
      ) : null}
      {entries.length > 0 ? (
        <button
          className="btn btn--ghost"
          type="button"
          onClick={() => {
            const name = window.prompt(
              `Delete which saved request? (${entries.map((e) => e.name).join(', ')})`,
            );
            if (name) handleDelete(name.trim());
          }}
          title="Delete a saved request"
        >
          ✕
        </button>
      ) : null}
    </div>
  );
}
