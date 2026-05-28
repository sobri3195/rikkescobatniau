import { generateId, getDb, getLocalSession, saveDb } from "@/lib/localDb";

const noop = async () => ({ data: null, error: null });

type Filter = (row: any) => boolean;
type Mutation = "insert" | "update" | "delete" | "upsert" | null;

function queryBuilder(table: string) {
  let mutation: Mutation = null;
  let payload: any;
  const filters: Filter[] = [];
  let orderBy: { column: string; ascending: boolean } | null = null;
  let limitCount: number | null = null;
  let rangeWindow: { from: number; to: number } | null = null;

  const getRows = () => {
    const db: any = getDb();
    if (!Array.isArray(db[table])) db[table] = [];
    return { db, rows: db[table] as any[] };
  };

  const matches = (row: any) => filters.every((filter) => filter(row));

  const selectRows = () => {
    const { rows } = getRows();
    let result = rows.filter(matches);
    if (orderBy) {
      result = [...result].sort((a, b) => {
        const av = a?.[orderBy.column];
        const bv = b?.[orderBy.column];
        if (av == null && bv == null) return 0;
        if (av == null) return orderBy.ascending ? -1 : 1;
        if (bv == null) return orderBy.ascending ? 1 : -1;
        return (
          String(av).localeCompare(String(bv), "id", { numeric: true }) *
          (orderBy.ascending ? 1 : -1)
        );
      });
    }
    if (rangeWindow) result = result.slice(rangeWindow.from, rangeWindow.to + 1);
    if (limitCount != null) result = result.slice(0, limitCount);
    return result;
  };

  const normalizeNewRow = (row: any) => {
    const now = new Date().toISOString();
    return {
      id: row?.id ?? generateId(String(table).replace(/[^a-z0-9]+/gi, "_") || "row"),
      created_at: row?.created_at ?? now,
      updated_at: row?.updated_at ?? now,
      ...row,
    };
  };

  const execute = async () => {
    if (!mutation) return { data: selectRows(), error: null };

    const { db, rows } = getRows();
    let data: any[] = [];

    if (mutation === "insert") {
      data = (Array.isArray(payload) ? payload : [payload]).map(normalizeNewRow);
      rows.push(...data);
    } else if (mutation === "update") {
      data = rows
        .filter(matches)
        .map((row) => Object.assign(row, payload, { updated_at: new Date().toISOString() }));
    } else if (mutation === "delete") {
      data = rows.filter(matches);
      db[table] = rows.filter((row) => !matches(row));
    } else if (mutation === "upsert") {
      const incoming = (Array.isArray(payload) ? payload : [payload]).map(normalizeNewRow);
      for (const row of incoming) {
        const existing = rows.find((candidate) => candidate.id === row.id);
        if (existing)
          data.push(Object.assign(existing, row, { updated_at: new Date().toISOString() }));
        else {
          rows.push(row);
          data.push(row);
        }
      }
    }

    saveDb(db);
    return { data, error: null };
  };

  const chain: any = {
    select: () => chain,
    insert: (value: any) => {
      mutation = "insert";
      payload = value;
      return chain;
    },
    update: (value: any) => {
      mutation = "update";
      payload = value;
      return chain;
    },
    delete: () => {
      mutation = "delete";
      return chain;
    },
    upsert: (value: any) => {
      mutation = "upsert";
      payload = value;
      return chain;
    },
    eq: (column: string, value: any) => {
      filters.push((row) => row?.[column] === value);
      return chain;
    },
    neq: (column: string, value: any) => {
      filters.push((row) => row?.[column] !== value);
      return chain;
    },
    in: (column: string, values: any[]) => {
      filters.push((row) => values.includes(row?.[column]));
      return chain;
    },
    is: (column: string, value: any) => {
      filters.push((row) => row?.[column] === value);
      return chain;
    },
    not: (column: string, operator: string, value: any) => {
      if (operator === "is") filters.push((row) => row?.[column] !== value);
      return chain;
    },
    gte: (column: string, value: any) => {
      filters.push((row) => row?.[column] >= value);
      return chain;
    },
    lte: (column: string, value: any) => {
      filters.push((row) => row?.[column] <= value);
      return chain;
    },
    lt: (column: string, value: any) => {
      filters.push((row) => row?.[column] < value);
      return chain;
    },
    or: () => chain,
    order: (column: string, options?: { ascending?: boolean }) => {
      orderBy = { column, ascending: options?.ascending ?? true };
      return chain;
    },
    limit: (count: number) => {
      limitCount = count;
      return chain;
    },
    range: (from: number, to: number) => {
      rangeWindow = { from, to };
      return chain;
    },
    maybeSingle: async () => {
      const { data, error } = await execute();
      return { data: Array.isArray(data) ? (data[0] ?? null) : data, error };
    },
    single: async () => {
      const { data, error } = await execute();
      return { data: Array.isArray(data) ? (data[0] ?? null) : data, error };
    },
    then: (resolve: any, reject: any) => execute().then(resolve, reject),
  };
  return chain;
}

export const localDataApi: any = {
  auth: {
    getSession: async () => ({ data: { session: getLocalSession() }, error: null }),
    getUser: async () => ({
      data: { user: getDb().users.find((u: any) => u.id === getLocalSession()?.user_id) ?? null },
      error: null,
    }),
  },
  from: (table: string) => queryBuilder(table),
  rpc: noop,
  channel: () => ({
    on() {
      return this;
    },
    subscribe() {
      return this;
    },
  }),
  removeChannel: () => {},
  storage: {
    from: () => ({
      createSignedUrl: async () => ({ data: null, error: null }),
      upload: async () => ({ data: null, error: null }),
      getPublicUrl: () => ({ data: { publicUrl: "" } }),
      download: async () => ({ data: null, error: null }),
    }),
  },
};
