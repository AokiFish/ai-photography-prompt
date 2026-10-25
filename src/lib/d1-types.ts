// 最小化的 D1 类型声明，避免强依赖 @cloudflare/workers-types 也能通过 tsc。
export interface D1Result {
  results: unknown[];
  success: boolean;
  meta?: unknown;
}
export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(col?: string): Promise<T | null>;
  all<T = unknown>(): Promise<{ results: T[] }>;
  run(): Promise<D1Result>;
}
export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  exec(query: string): Promise<D1Result>;
  batch(stmts: D1PreparedStatement[]): Promise<D1Result[]>;
}
