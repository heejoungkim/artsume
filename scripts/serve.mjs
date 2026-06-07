import http from "node:http";
import path from "node:path";
import { readFile, stat } from "node:fs/promises";
import { distDir } from "./lib/content.mjs";

const port = Number(process.argv[2] || process.env.PORT || 4173);

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".svg": "image/svg+xml"
};

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://localhost:${port}`);
    const safePath = path.normalize(url.pathname).replace(/^(\.\.[/\\])+/, "");
    let filePath = path.join(distDir, safePath);
    const info = await stat(filePath).catch(() => null);
    if (info?.isDirectory()) filePath = path.join(filePath, "index.html");
    if (!info && !path.extname(filePath)) filePath = path.join(filePath, "index.html");

    const body = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": mime[path.extname(filePath)] || "application/octet-stream"
    });
    response.end(body);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

server.listen(port, () => {
  console.log(`Serving dist at http://localhost:${port}`);
});
