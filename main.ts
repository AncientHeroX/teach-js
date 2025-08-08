const PORT = 5000;

function handler(request: Request): Response | Promise<Response> {
  console.log(request);
  return new Response("Hello, world");
}

Deno.serve({ port: PORT }, handler);
