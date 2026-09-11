// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      {
        name: "api-dev-server-middleware",
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (req.url && req.url.startsWith("/api/")) {
              try {
                const { default: serverHandler } = await import("./src/server");
                const url = new URL(req.url, `http://${req.headers.host || "localhost:3000"}`);
                const headers = new Headers();
                for (const [k, v] of Object.entries(req.headers)) {
                  if (v) headers.set(k, Array.isArray(v) ? v.join(", ") : v);
                }

                const chunks: Buffer[] = [];
                req.on("data", (chunk: Buffer) => chunks.push(chunk));
                req.on("end", async () => {
                  const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;
                  const webRequest = new Request(url.href, {
                    method: req.method,
                    headers,
                    body: req.method !== "GET" && req.method !== "HEAD" ? body : undefined,
                  });

                  try {
                    const response = await serverHandler.fetch(webRequest, {}, {});
                    res.statusCode = response.status;
                    response.headers.forEach((val, key) => res.setHeader(key, val));
                    const respBuf = await response.arrayBuffer();
                    res.end(Buffer.from(respBuf));
                  } catch (fetchErr) {
                    console.error("[ApiDevMiddleware] Error:", fetchErr);
                    next(fetchErr);
                  }
                });
                return;
              } catch (err) {
                console.error("[ApiDevMiddleware] Setup error:", err);
                next(err);
                return;
              }
            }
            next();
          });
        },
      },
    ],
  },
});
