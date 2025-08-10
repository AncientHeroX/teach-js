import * as http from "@std/http";
import { Eta } from "eta";

const eta = new Eta({ views: "public/views", cache: false });
const PORT = 5000;
const badrequest = () => {
  return new Response("Bad request", { status: 400 });
};

function decodeJson(path: string): any {
  const data = Deno.readFileSync(path);

  const decoder = new TextDecoder("utf-8");
  const str: string = decoder.decode(data);

  return JSON.parse(str);
}
function handler(request: Request): Response | Promise<Response> {
  const pathname = new URL(request.url).pathname;

  if (pathname === "/") {
    const lessonObj = decodeJson("public/units/unit-0.json");
    const pageHTML = eta.render("index.html", {
      unitID: 0,
      lessonID: 0,
      lessonData: lessonObj,
    });

    return new Response(pageHTML, {
      headers: {
        "content-type": "document",
      },
    });
  }

  /*
   * optional <lessonid>
   * getunit/[unitid]/<lessonid>
   */
  if (pathname.startsWith("/getunit")) {
    console.log("requesting unit", pathname);
    const parts = pathname.split("/");
    const unitid: number = parseInt(parts[2]);
    if (isNaN(unitid)) {
      console.error("bad unit");
      return badrequest();
    }

    const unitpath = `public/units/unit-${unitid}.json`;
    const jsondata = decodeJson(unitpath);

    if (parts.length > 2) {
      const lessonid: number = parseInt(parts[3]);
      if (isNaN(lessonid)) {
        console.error("bad lesson");
        return badrequest();
      }
    }

    return new Response(JSON.stringify(jsondata), {
      "status": 200,
      "headers": {
        "content-type": "application/json",
      },
    });
  }

  if (pathname.startsWith("/static")) {
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
