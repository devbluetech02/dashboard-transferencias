type OutFormat = "OBJECT" | "ARRAY";

interface GatewayOptions {
  outFormat?: OutFormat;
  autoCommit?: boolean;
}

interface GatewayResponse<T> {
  rows: T[];
  rowsAffected?: number;
  lastRowid?: string;
}

interface GatewayError {
  message?: string;
  code?: string;
  errorNum?: number;
  error?: string;
}

const DEFAULT_TIMEOUT_MS = 25_000;

export async function gatewayQuery<T = Record<string, unknown>>(
  query: string,
  params: Record<string, unknown> = {},
  options: GatewayOptions = {},
): Promise<GatewayResponse<T>> {
  const url = process.env.WINTHOR_API_URL;
  const apiKey = process.env.WINTHOR_API_KEY;
  if (!url || !apiKey) {
    throw new Error("WINTHOR_API_URL / WINTHOR_API_KEY missing in env");
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(`${url}/api/gateway/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Key": apiKey,
      },
      body: JSON.stringify({
        query,
        params,
        options: {
          outFormat: options.outFormat ?? "OBJECT",
          autoCommit: options.autoCommit ?? false,
        },
      }),
      signal: ctrl.signal,
      cache: "no-store",
    });

    const text = await res.text();
    let body: GatewayResponse<T> | GatewayError;
    try {
      body = text ? JSON.parse(text) : ({ rows: [] } as GatewayResponse<T>);
    } catch {
      throw new Error(`Winthor gateway non-JSON response (HTTP ${res.status}): ${text.slice(0, 200)}`);
    }

    if (!res.ok) {
      const err = body as GatewayError;
      const msg = err.message || err.error || `HTTP ${res.status}`;
      const code = err.code ? ` [${err.code}]` : "";
      throw new Error(`Winthor gateway error${code}: ${msg}`);
    }

    return body as GatewayResponse<T>;
  } finally {
    clearTimeout(timer);
  }
}
