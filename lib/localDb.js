import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const DATA_DIR = join(process.cwd(), '.data');
const DATA_FILE = join(DATA_DIR, 'shifts.json');

function load() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(DATA_FILE)) writeFileSync(DATA_FILE, '[]', 'utf8');
  return JSON.parse(readFileSync(DATA_FILE, 'utf8'));
}

function save(rows) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(DATA_FILE, JSON.stringify(rows, null, 2), 'utf8');
}

export function isLocalDevMode() {
  const url = process.env.SUPABASE_URL || '';
  return process.env.LOCAL_DEV === 'true' || !url || url.includes('YOUR-PROJECT');
}

export function getLocalDb() {
  return {
    from() {
      return createQuery();
    },
  };
}

function createQuery() {
  const state = {
    type: 'select',
    filters: [],
    orderField: null,
    orderAsc: true,
    limitN: null,
    payload: null,
  };

  const q = {
    select() {
      // keep insert/update type if already set; otherwise select
      if (state.type !== 'insert' && state.type !== 'update') state.type = 'select';
      return q;
    },
    insert(row) {
      state.type = 'insert';
      state.payload = row;
      return q;
    },
    update(row) {
      state.type = 'update';
      state.payload = row;
      return q;
    },
    eq(field, value) {
      state.filters.push((r) => r[field] === value);
      return q;
    },
    is(field, value) {
      state.filters.push((r) => (value === null ? r[field] == null : r[field] === value));
      return q;
    },
    gte(field, value) {
      state.filters.push((r) => r[field] >= value);
      return q;
    },
    lt(field, value) {
      state.filters.push((r) => r[field] < value);
      return q;
    },
    order(field, opts = {}) {
      state.orderField = field;
      state.orderAsc = opts.ascending !== false;
      return q;
    },
    limit(n) {
      state.limitN = n;
      return q;
    },
    then(resolve, reject) {
      return Promise.resolve()
        .then(() => run(state))
        .then(resolve, reject);
    },
  };

  return q;
}

function run(state) {
  try {
    let rows = load();

    if (state.type === 'insert') {
      const row = {
        id: Date.now(),
        created_at: new Date().toISOString(),
        clock_out: null,
        ...state.payload,
      };
      rows.unshift(row);
      save(rows);
      return { data: [row], error: null };
    }

    if (state.type === 'update') {
      const next = rows.map((r) =>
        state.filters.every((f) => f(r)) ? { ...r, ...state.payload } : r
      );
      save(next);
      const updated = next.filter((r) => state.filters.every((f) => f(r)));
      return { data: updated, error: null };
    }

    let out = rows.filter((r) => state.filters.every((f) => f(r)));
    if (state.orderField) {
      const field = state.orderField;
      out.sort((a, b) => {
        if (a[field] < b[field]) return state.orderAsc ? -1 : 1;
        if (a[field] > b[field]) return state.orderAsc ? 1 : -1;
        return 0;
      });
    }
    if (state.limitN != null) out = out.slice(0, state.limitN);
    return { data: out, error: null };
  } catch (e) {
    return { data: null, error: { message: e.message } };
  }
}
