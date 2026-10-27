import type { AddressInfo } from "node:net";
import { createServer, type Server } from "node:http";
import { after, before } from "node:test";
import { createApp } from "../../src/app.js";

export interface TestResponse<T = unknown> {
  status: number;
  body: T;
}

export interface TestClient {
  request<T = unknown>(
    method: string,
    path: string,
    options?: { body?: unknown; rawBody?: string; token?: string },
  ): Promise<TestResponse<T>>;
}

/** Serve the real Express app on an ephemeral port for the whole test file. */
export function useTestServer(): TestClient {
  let server: Server;
  let baseUrl = "";

  before(async () => {
    server = createServer(createApp());
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  return {
    async request(method, path, options = {}) {
      const headers: Record<string, string> = {};
      let body: string | undefined;
      if (options.rawBody !== undefined || options.body !== undefined) {
        headers["Content-Type"] = "application/json";
        body = options.rawBody ?? JSON.stringify(options.body);
      }
      if (options.token) {
        headers.Authorization = `Bearer ${options.token}`;
      }

      const response = await fetch(`${baseUrl}${path}`, { method, headers, body });
      const text = await response.text();
      return {
        status: response.status,
        body: text ? JSON.parse(text) : undefined,
      } as TestResponse<never>;
    },
  };
}
