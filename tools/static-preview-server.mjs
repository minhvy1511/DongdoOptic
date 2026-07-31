import http from "node:http";
import { createReadStream, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(process.argv[2] || path.dirname(fileURLToPath(import.meta.url)));
const port = Number(process.argv[3] || 5173);

const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
  ".task": "application/octet-stream"
};

function send(res, status, text) {
  res.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
  res.end(text);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://127.0.0.1:${port}`);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname.endsWith("/")) pathname += "index.html";
  const target = path.resolve(root, `.${pathname}`);
  if (!target.startsWith(root)) {
    send(res, 403, "Forbidden");
    return;
  }
  try {
    const stats = statSync(target);
    if (!stats.isFile()) {
      send(res, 404, "Not found");
      return;
    }
    res.writeHead(200, {
      "content-type": types[path.extname(target).toLowerCase()] || "application/octet-stream",
      "cache-control": "no-store"
    });
    createReadStream(target).pipe(res);
  } catch {
    send(res, 404, "Not found");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Serving ${root} at http://127.0.0.1:${port}/`);
});
