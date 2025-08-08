import * as http from "@std/http";

const PORT = 5000;

function handler(request: Request): Response | Promise<Response> {
  const pathname = new URL(request.url).pathname;

  console.log(pathname);
  if (pathname === "/") {
    return http.serveFile(request, "public/views/index.html");
  }

  if (pathname.startsWith("/static/css")) {
    return http.serveDir(request, {
      fsRoot: "public",
      urlRoot: "static",
    });
  }

  return new Response("404: Not Found", {
    status: 302,
    headers: { "Location": "/" },
  });
}

Deno.serve({ port: PORT }, handler);
