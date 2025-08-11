import * as http from "@std/http";
import { Eta } from "eta";
import { marked } from "marked";

const eta = new Eta({ views: "public/views", cache: false, autoEscape: false });
const PORT = 5000;
const badrequest = () => {
  return new Response("Bad request", { status: 400 });
};
const notfound = (filenotfound: string) => {
  return new Response(`${filenotfound} not found`, { status: 404 });
};

function getUnitJson(unit: number): any | null {
  const path = `public/units/unit-${unit}.json`;
  try {
    const data = Deno.readFileSync(path);

    const decoder = new TextDecoder("utf-8");
    const str: string = decoder.decode(data);

    return JSON.parse(str);
  } catch (_) {
    return null;
  }
}

function getHandlers(request: Request): Response | Promise<Response> {
  const pathname = new URL(request.url).pathname;
  if (pathname === "/") {
    const unitObj = getUnitJson(0);
    if (!unitObj) {
      return notfound("Unit 0");
    }

    const lessonContent = unitObj.lessons[0].content;
    unitObj.lessons[0].content = marked.parse(lessonContent);

    const pageHTML = eta.render("index.html", {
      unitID: 0,
      lessonID: 0,
      lessonData: unitObj,
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
      return badrequest();
    }

    const jsondata = getUnitJson(unitid);
    if (!jsondata) {
      return notfound(`Unit ${unitid}`);
    }

    if (parts.length > 2) {
      const lessonid: number = parseInt(parts[3]);
      if (isNaN(lessonid)) {
        return notfound(`Lesson ${lessonid}`);
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
async function postHandlers(request: Request): Promise<Response> {
  const pathname = new URL(request.url).pathname;
  console.log(pathname);
  // /checkresponse/<unit>/<lesson>
  if (pathname.startsWith("/checkresult")) {
    const parts = pathname.split("/");
    if (parts.length === 4) {
      const unitid = parseInt(parts[2]);
      if (isNaN(unitid)) {
        return badrequest();
      }

      const unitJson = getUnitJson(unitid);
      if (!unitJson) {
        return notfound(`Unit ${unitid}`);
      }

      const lessonid = parseInt(parts[3]);
      if (isNaN(lessonid)) {
        return badrequest();
      }

      const lesson = unitJson.lessons[lessonid];
      if (!lesson) {
        return notfound(`Lesson ${lessonid}`);
      }

      const body = await request.json();
      if (!body) {
        return badrequest();
      }
      const tocheck = body.result;

      const resultCorrect = tocheck === lesson.expected_result;
      return new Response(`${resultCorrect}`, {
        status: 200,
      });
    }
  }

  return new Response("Redirecting", {
    status: 302,
    headers: { "Location": "/" },
  });
}

function handler(request: Request): Response | Promise<Response> {
  const method = request.method;
  console.log(method);
  if (method === "POST") {
    return postHandlers(request);
  } else {
    return getHandlers(request);
  }
}

Deno.serve({ port: PORT }, handler);
