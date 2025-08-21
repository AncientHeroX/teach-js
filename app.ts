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
async function updateCompleted(
  unitid: number,
  lessonid: number,
  completed: boolean,
) {
  const unitJson = await getUnitJson(unitid);
  unitJson.lessons[lessonid].completed = completed;

  const jsonString = JSON.stringify(unitJson, null, 2);
  const jsonPath = `public/units/unit-${unitid}.json`;
  await Deno.writeTextFile(jsonPath, jsonString);
}

async function getPrev(
  currUnitID: number,
  currLessonID: number,
): Promise<number[] | null> {
  const currUnit = await getUnitJson(currUnitID);
  if (!currUnit) {
    console.warn(`Invalid Unit "${currUnitID}" provided.`);
    return null;
  }

  let prevUnitID = currUnitID;
  let prevLessonID = currLessonID - 1;

  let prevLesson = currUnit.lessons[prevLessonID];
  if (!prevLesson) {
    prevUnitID--;

    const prevUnit = await getUnitJson(prevUnitID);
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
async function getNext(
  currUnitID: number,
  currLessonID: number,
): Promise<number[] | null> {
  const currUnit = await getUnitJson(currUnitID);
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

    const nextUnit = await getUnitJson(nextUnitID);
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

async function decryptJson(jsonStr: string): Promise<string> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const rawKey = encoder.encode("qd!H%~0R3uvuKE2j96z2Q!d/ET<J#2Ya");
  const key = await crypto.subtle.importKey(
    "raw",
    rawKey,
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );
  const iv = encoder.encode("8p0=oO@KQ4aS");

  const cipherBytes = Uint8Array.from(atob(jsonStr), (c) => c.charCodeAt(0));
  const decryptBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    cipherBytes,
  );
  return decoder.decode(decryptBuffer);
}

async function getUnitJson(unit: number): Promise<any | null> {
  const path = `public/units/unit-${unit}.json`;
  try {
    const data = Deno.readFileSync(path);

    const decoder = new TextDecoder("utf-8");
    const str: string = decoder.decode(data);
    const decrypted = await decryptJson(str);

    return JSON.parse(decrypted);
  } catch (e) {
    console.warn(e);
    return null;
  }
}

async function getHandlers(request: Request): Promise<Response> {
  const pathname = new URL(request.url).pathname;
  if (pathname === "/") {
    const units = [];

    let i = 0;
    let currUnit;
    while (currUnit = await getUnitJson(i++)) {
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

    const jsondata = await getUnitJson(unitid);
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

    const nextArr: number[] | null = await getNext(unitid, lessonid);

    let nextStr = "-1";
    if (nextArr) {
      nextStr = nextArr.join(",");
    }

    const prevArr: number[] | null = await getPrev(unitid, lessonid);
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

    const jsondata = await getUnitJson(unitid);
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

      const unitJson = await getUnitJson(unitid);
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
      updateCompleted(unitid, lessonid, resultCorrect);

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
