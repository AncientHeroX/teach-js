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

function getPrev(currUnitID: number, currLessonID: number): number[] | null {
  const currUnit = getUnitJson(currUnitID);
  if (!currUnit) {
    console.warn(`Invalid Unit "${currUnitID}" provided.`);
    return null;
  }

  let prevUnitID = currUnitID;
  let prevLessonID = currLessonID - 1;

  let prevLesson = currUnit.lessons[prevLessonID];
  if (!prevLesson) {
    prevUnitID--;

    const prevUnit = getUnitJson(prevUnitID);
    if (!prevUnit) {
      return null;
    }

    prevLessonID = prevUnit.lessons.length - 1;
    prevLesson = prevUnit.lessons[prevLessonID];
    if (!prevLesson) {
      return null;
    }
  }
  return [prevUnitID, prevLessonID];
}
function getNext(currUnitID: number, currLessonID: number): number[] | null {
  const currUnit = getUnitJson(currUnitID);
  if (!currUnit) {
    console.warn("Invalid Unit", currUnitID, "provided.");
    return null;
  }

  let nextUnitID = currUnitID;
  let nextLessonID = currLessonID + 1;

  let nextLesson = currUnit.lessons[nextLessonID];
  if (!nextLesson) {
    nextLessonID = 0;
    nextUnitID++;

    const nextUnit = getUnitJson(nextUnitID);
    if (!nextUnit) {
      return null;
    }
    nextLesson = nextUnit.lessons[nextLessonID];
    if (!nextLesson) {
      return null;
    }
  }
  return [nextUnitID, nextLessonID];
}

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
    const units = [];

    let i = 0;
    let currUnit;
    while (currUnit = getUnitJson(i++)) {
      units.push(currUnit);
    }

    const pageHTML = eta.render("index.html", {
      units: units,
    });

    return new Response(pageHTML, {
      headers: {
        "content-type": "document",
      },
    });
  }
  /*
   * getlesson/[unitid]/[lessonid]
   */
  if (pathname.startsWith("/lesson")) {
    const parts = pathname.split("/");
    if (parts.length !== 4) {
      return badrequest();
    }
    const unitid: number = parseInt(parts[2]);
    if (isNaN(unitid)) {
      return badrequest();
    }

    const jsondata = getUnitJson(unitid);
    if (!jsondata) {
      return notfound(`Unit ${unitid}`);
    }

    const lessonid: number = parseInt(parts[3]);
    if (isNaN(lessonid)) {
      return badrequest();
    }

    const lesson = jsondata.lessons[lessonid];
    if (!lesson) {
      return notfound(`Lesson ${lessonid}`);
    }
    const lessonContent = lesson.content;

    jsondata.lessons[lessonid].content = marked.parse(lessonContent);

    const nextArr: number[] | null = getNext(unitid, lessonid);

    let nextStr = "-1";
    if (nextArr) {
      nextStr = nextArr.join(",");
    }

    const prevArr: number[] | null = getPrev(unitid, lessonid);
    let prevStr = "-1";
    if (prevArr) {
      prevStr = prevArr.join(",");
    }

    const pageHTML = eta.render("lesson.html", {
      unitID: unitid,
      lessonID: lessonid,
      lessonData: jsondata,
      next: nextStr,
      prev: prevStr,
    });

    return new Response(pageHTML, {
      headers: {
        "content-type": "document",
      },
    });
  }

  /*
   * getjson/[unitid]/<lessonid>
   */
  if (pathname.startsWith("/getjson")) {
    const parts = pathname.split("/");
    if (parts.length < 3 && parts.length > 4) {
      return badrequest();
    }
    const unitid: number = parseInt(parts[2]);
    if (isNaN(unitid)) {
      return badrequest();
    }

    const jsondata = getUnitJson(unitid);
    if (!jsondata) {
      return notfound(`Unit ${unitid}`);
    }

    if (parts.length === 4) {
      const lessonid = parseInt(parts[3]);
      if (isNaN(lessonid)) {
        return badrequest();
      }

      return new Response(JSON.stringify(jsondata.lessons[lessonid]), {
        "status": 200,
        "headers": {
          "content-type": "application/json",
        },
      });
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
      if (unitJson === null) {
        return notfound(`Unit ${unitid}`);
      }

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

  if (method === "POST") {
    return postHandlers(request);
  } else {
    return getHandlers(request);
  }
}

Deno.serve({ port: PORT }, handler);
