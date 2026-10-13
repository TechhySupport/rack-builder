export const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

export const formatDate = (value) => (value ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value)) : 'Not yet updated');

// Quotes a CSV cell and defuses spreadsheet formulas.
export const csvCell = (value) => {
  const text = String(value ?? '');
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};

export function toggleInSet(set, value) {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export function readSavedView(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
}

export function writeSavedView(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be full or blocked; the view just will not be remembered.
  }
}

// Keeps only saved values that still exist, so a deleted site cannot hide every row.
export const reviveSet = (saved, isValid) => new Set((Array.isArray(saved) ? saved : []).filter(isValid));
