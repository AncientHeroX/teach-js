var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// ts/external/codejar/codejar.ts
function CodeJar(editor, highlight, opt = {}) {
  const options = {
    tab: "	",
    indentOn: /[({\[]$/,
    moveToNewLine: /^[)}\]]/,
    spellcheck: false,
    catchTab: true,
    preserveIdent: true,
    addClosing: true,
    history: true,
    window: globalWindow,
    autoclose: {
      open: `([{'"`,
      close: `)]}'"`
    },
    ...opt
  };
  const window1 = options.window;
  const document2 = window1.document;
  const listeners = [];
  const history = [];
  let at = -1;
  let focus = false;
  let onUpdate = () => void 0;
  let prev;
  editor.setAttribute("contenteditable", "plaintext-only");
  editor.setAttribute("spellcheck", options.spellcheck ? "true" : "false");
  editor.style.outline = "none";
  editor.style.overflowWrap = "break-word";
  editor.style.overflowY = "auto";
  editor.style.whiteSpace = "pre-wrap";
  const doHighlight = (editor2, pos) => {
    highlight(editor2, pos);
  };
  const matchFirefoxVersion = window1.navigator.userAgent.match(/Firefox\/([0-9]+)\./);
  const firefoxVersion = matchFirefoxVersion ? parseInt(matchFirefoxVersion[1]) : 0;
  let isLegacy = false;
  if (editor.contentEditable !== "plaintext-only" || firefoxVersion >= 136) isLegacy = true;
  if (isLegacy) editor.setAttribute("contenteditable", "true");
  const debounceHighlight = debounce(() => {
    const pos = save();
    doHighlight(editor, pos);
    restore(pos);
  }, 30);
  let recording = false;
  const shouldRecord = (event) => {
    return !isUndo(event) && !isRedo(event) && event.key !== "Meta" && event.key !== "Control" && event.key !== "Alt" && !event.key.startsWith("Arrow");
  };
  const debounceRecordHistory = debounce((event) => {
    if (shouldRecord(event)) {
      recordHistory();
      recording = false;
    }
  }, 300);
  const on = (type, fn) => {
    listeners.push([
      type,
      fn
    ]);
    editor.addEventListener(type, fn);
  };
  on("keydown", (event) => {
    if (event.defaultPrevented) return;
    prev = toString();
    if (options.preserveIdent) handleNewLine(event);
    else legacyNewLineFix(event);
    if (options.catchTab) handleTabCharacters(event);
    if (options.addClosing) handleSelfClosingCharacters(event);
    if (options.history) {
      handleUndoRedo(event);
      if (shouldRecord(event) && !recording) {
        recordHistory();
        recording = true;
      }
    }
    if (isLegacy && !isCopy(event)) restore(save());
  });
  on("keyup", (event) => {
    if (event.defaultPrevented) return;
    if (event.isComposing) return;
    if (prev !== toString()) debounceHighlight();
    debounceRecordHistory(event);
    onUpdate(toString());
  });
  on("focus", (_event) => {
    focus = true;
  });
  on("blur", (_event) => {
    focus = false;
  });
  on("paste", (event) => {
    recordHistory();
    handlePaste(event);
    recordHistory();
    onUpdate(toString());
  });
  on("cut", (event) => {
    recordHistory();
    handleCut(event);
    recordHistory();
    onUpdate(toString());
  });
  function save() {
    const s = getSelection();
    const pos = {
      start: 0,
      end: 0,
      dir: void 0
    };
    let { anchorNode, anchorOffset, focusNode, focusOffset } = s;
    if (!anchorNode || !focusNode) throw "error1";
    if (anchorNode === editor && focusNode === editor) {
      pos.start = anchorOffset > 0 && editor.textContent ? editor.textContent.length : 0;
      pos.end = focusOffset > 0 && editor.textContent ? editor.textContent.length : 0;
      pos.dir = focusOffset >= anchorOffset ? "->" : "<-";
      return pos;
    }
    if (anchorNode.nodeType === Node.ELEMENT_NODE) {
      const node = document2.createTextNode("");
      anchorNode.insertBefore(node, anchorNode.childNodes[anchorOffset]);
      anchorNode = node;
      anchorOffset = 0;
    }
    if (focusNode.nodeType === Node.ELEMENT_NODE) {
      const node = document2.createTextNode("");
      focusNode.insertBefore(node, focusNode.childNodes[focusOffset]);
      focusNode = node;
      focusOffset = 0;
    }
    visit(editor, (el) => {
      if (el === anchorNode && el === focusNode) {
        pos.start += anchorOffset;
        pos.end += focusOffset;
        pos.dir = anchorOffset <= focusOffset ? "->" : "<-";
        return "stop";
      }
      if (el === anchorNode) {
        pos.start += anchorOffset;
        if (!pos.dir) {
          pos.dir = "->";
        } else {
          return "stop";
        }
      } else if (el === focusNode) {
        pos.end += focusOffset;
        if (!pos.dir) {
          pos.dir = "<-";
        } else {
          return "stop";
        }
      }
      if (el.nodeType === Node.TEXT_NODE) {
        if (pos.dir != "->") pos.start += el.nodeValue.length;
        if (pos.dir != "<-") pos.end += el.nodeValue.length;
      }
    });
    editor.normalize();
    return pos;
  }
  function restore(pos) {
    const s = getSelection();
    let startNode, startOffset = 0;
    let endNode, endOffset = 0;
    if (!pos.dir) pos.dir = "->";
    if (pos.start < 0) pos.start = 0;
    if (pos.end < 0) pos.end = 0;
    if (pos.dir == "<-") {
      const { start, end } = pos;
      pos.start = end;
      pos.end = start;
    }
    let current = 0;
    visit(editor, (el) => {
      if (el.nodeType !== Node.TEXT_NODE) return;
      const len = (el.nodeValue || "").length;
      if (current + len > pos.start) {
        if (!startNode) {
          startNode = el;
          startOffset = pos.start - current;
        }
        if (current + len > pos.end) {
          endNode = el;
          endOffset = pos.end - current;
          return "stop";
        }
      }
      current += len;
    });
    if (!startNode) startNode = editor, startOffset = editor.childNodes.length;
    if (!endNode) endNode = editor, endOffset = editor.childNodes.length;
    if (pos.dir == "<-") {
      [startNode, startOffset, endNode, endOffset] = [
        endNode,
        endOffset,
        startNode,
        startOffset
      ];
    }
    {
      const startEl = uneditable(startNode);
      if (startEl) {
        const node = document2.createTextNode("");
        startEl.parentNode?.insertBefore(node, startEl);
        startNode = node;
        startOffset = 0;
      }
      const endEl = uneditable(endNode);
      if (endEl) {
        const node = document2.createTextNode("");
        endEl.parentNode?.insertBefore(node, endEl);
        endNode = node;
        endOffset = 0;
      }
    }
    s.setBaseAndExtent(startNode, startOffset, endNode, endOffset);
    editor.normalize();
  }
  function uneditable(node) {
    while (node && node !== editor) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node;
        if (el.getAttribute("contenteditable") == "false") {
          return el;
        }
      }
      node = node.parentNode;
    }
  }
  function beforeCursor() {
    const s = getSelection();
    const r0 = s.getRangeAt(0);
    const r = document2.createRange();
    r.selectNodeContents(editor);
    r.setEnd(r0.startContainer, r0.startOffset);
    return r.toString();
  }
  function afterCursor() {
    const s = getSelection();
    const r0 = s.getRangeAt(0);
    const r = document2.createRange();
    r.selectNodeContents(editor);
    r.setStart(r0.endContainer, r0.endOffset);
    return r.toString();
  }
  function handleNewLine(event) {
    if (event.key === "Enter") {
      const before = beforeCursor();
      const after = afterCursor();
      let [padding] = findPadding(before);
      let newLinePadding = padding;
      if (options.indentOn.test(before)) {
        newLinePadding += options.tab;
      }
      if (newLinePadding.length > 0) {
        preventDefault(event);
        event.stopPropagation();
        insert("\n" + newLinePadding);
      } else {
        legacyNewLineFix(event);
      }
      if (newLinePadding !== padding && options.moveToNewLine.test(after)) {
        const pos = save();
        insert("\n" + padding);
        restore(pos);
      }
    }
  }
  function legacyNewLineFix(event) {
    if (isLegacy && event.key === "Enter") {
      preventDefault(event);
      event.stopPropagation();
      if (afterCursor() == "") {
        insert("\n ");
        const pos = save();
        pos.start = --pos.end;
        restore(pos);
      } else {
        insert("\n");
      }
    }
  }
  function handleSelfClosingCharacters(event) {
    const open = options.autoclose.open;
    const close = options.autoclose.close;
    if (open.includes(event.key)) {
      preventDefault(event);
      const pos = save();
      const wrapText = pos.start == pos.end ? "" : getSelection().toString();
      const text = event.key + wrapText + (close[open.indexOf(event.key)] ?? "");
      insert(text);
      pos.start++;
      pos.end++;
      restore(pos);
    }
  }
  function handleTabCharacters(event) {
    if (event.key === "Tab") {
      preventDefault(event);
      if (event.shiftKey) {
        const before = beforeCursor();
        let [padding, start] = findPadding(before);
        if (padding.length > 0) {
          const pos = save();
          const len = Math.min(options.tab.length, padding.length);
          restore({
            start,
            end: start + len
          });
          document2.execCommand("delete");
          pos.start -= len;
          pos.end -= len;
          restore(pos);
        }
      } else {
        insert(options.tab);
      }
    }
  }
  function handleUndoRedo(event) {
    if (isUndo(event)) {
      preventDefault(event);
      at--;
      const record = history[at];
      if (record) {
        editor.innerHTML = record.html;
        restore(record.pos);
      }
      if (at < 0) at = 0;
    }
    if (isRedo(event)) {
      preventDefault(event);
      at++;
      const record = history[at];
      if (record) {
        editor.innerHTML = record.html;
        restore(record.pos);
      }
      if (at >= history.length) at--;
    }
  }
  function recordHistory() {
    if (!focus) return;
    const html = editor.innerHTML;
    const pos = save();
    const lastRecord = history[at];
    if (lastRecord) {
      if (lastRecord.html === html && lastRecord.pos.start === pos.start && lastRecord.pos.end === pos.end) return;
    }
    at++;
    history[at] = {
      html,
      pos
    };
    history.splice(at + 1);
    const maxHistory = 300;
    if (at > maxHistory) {
      at = maxHistory;
      history.splice(0, 1);
    }
  }
  function handlePaste(event) {
    if (event.defaultPrevented) return;
    preventDefault(event);
    const originalEvent = event.originalEvent ?? event;
    const text = originalEvent.clipboardData.getData("text/plain").replace(/\r\n?/g, "\n");
    const pos = save();
    insert(text);
    doHighlight(editor);
    restore({
      start: Math.min(pos.start, pos.end) + text.length,
      end: Math.min(pos.start, pos.end) + text.length,
      dir: "<-"
    });
  }
  function handleCut(event) {
    const pos = save();
    const selection = getSelection();
    const originalEvent = event.originalEvent ?? event;
    originalEvent.clipboardData.setData("text/plain", selection.toString());
    document2.execCommand("delete");
    doHighlight(editor);
    restore({
      start: Math.min(pos.start, pos.end),
      end: Math.min(pos.start, pos.end),
      dir: "<-"
    });
    preventDefault(event);
  }
  function visit(editor2, visitor) {
    const queue = [];
    if (editor2.firstChild) queue.push(editor2.firstChild);
    let el = queue.pop();
    while (el) {
      if (visitor(el) === "stop") break;
      if (el.nextSibling) queue.push(el.nextSibling);
      if (el.firstChild) queue.push(el.firstChild);
      el = queue.pop();
    }
  }
  function isCtrl(event) {
    return event.metaKey || event.ctrlKey;
  }
  function isUndo(event) {
    return isCtrl(event) && !event.shiftKey && getKeyCode(event) === "Z";
  }
  function isRedo(event) {
    return isCtrl(event) && event.shiftKey && getKeyCode(event) === "Z";
  }
  function isCopy(event) {
    return isCtrl(event) && getKeyCode(event) === "C";
  }
  function getKeyCode(event) {
    let key = event.key || event.keyCode || event.which;
    if (!key) return void 0;
    return (typeof key === "string" ? key : String.fromCharCode(key)).toUpperCase();
  }
  function insert(text) {
    text = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    document2.execCommand("insertHTML", false, text);
  }
  function debounce(cb, wait) {
    let timeout = 0;
    return (...args) => {
      clearTimeout(timeout);
      timeout = window1.setTimeout(() => cb(...args), wait);
    };
  }
  function findPadding(text) {
    let i = text.length - 1;
    while (i >= 0 && text[i] !== "\n") i--;
    i++;
    let j = i;
    while (j < text.length && /[ \t]/.test(text[j])) j++;
    return [
      text.substring(i, j) || "",
      i,
      j
    ];
  }
  function toString() {
    return editor.textContent || "";
  }
  function preventDefault(event) {
    event.preventDefault();
  }
  function getSelection() {
    return editor.getRootNode().getSelection();
  }
  return {
    updateOptions(newOptions) {
      Object.assign(options, newOptions);
    },
    updateCode(code, callOnUpdate = true) {
      editor.textContent = code;
      doHighlight(editor);
      callOnUpdate && onUpdate(code);
    },
    onUpdate(callback) {
      onUpdate = callback;
    },
    toString,
    save,
    restore,
    recordHistory,
    destroy() {
      for (let [type, fn] of listeners) {
        editor.removeEventListener(type, fn);
      }
    }
  };
}
var globalWindow;
var init_codejar = __esm({
  "ts/external/codejar/codejar.ts"() {
    globalWindow = window;
  }
});

// ts/external/codejar/codejar-linenumbers.ts
function withLineNumbers(highlight, options = {}) {
  const opts = {
    class: "codejar-linenumbers",
    wrapClass: "codejar-wrap",
    width: "35px",
    backgroundColor: "rgba(128, 128, 128, 0.15)",
    color: "",
    ...options
  };
  let lineNumbers;
  return function(editor) {
    highlight(editor);
    if (!lineNumbers) {
      lineNumbers = init(editor, opts);
      editor.addEventListener("scroll", () => lineNumbers.style.top = `-${editor.scrollTop}px`);
    }
    const code = editor.textContent || "";
    const linesCount = code.replace(/\n$/g, "").split("\n").length;
    let text = "";
    for (let i = 0; i < linesCount; i++) {
      text += `${i + 1}
`;
    }
    lineNumbers.innerText = text;
  };
}
function init(editor, opts) {
  const css = getComputedStyle(editor);
  const wrap = document.createElement("div");
  wrap.className = opts.wrapClass;
  wrap.style.position = "relative";
  const innerWrap = document.createElement("div");
  innerWrap.className = "codejar-linenumbers-inner-wrap";
  innerWrap.style.background = css.background;
  innerWrap.style.marginTop = css.borderTopWidth;
  innerWrap.style.marginBottom = css.borderBottomWidth;
  innerWrap.style.marginLeft = css.borderLeftWidth;
  innerWrap.style.borderTopLeftRadius = css.borderTopLeftRadius;
  innerWrap.style.borderBottomLeftRadius = css.borderBottomLeftRadius;
  const gutter = document.createElement("div");
  gutter.className = opts.class;
  innerWrap.appendChild(gutter);
  wrap.appendChild(innerWrap);
  gutter.style.width = opts.width;
  gutter.style.overflow = "hidden";
  gutter.style.backgroundColor = opts.backgroundColor;
  gutter.style.fontFamily = css.fontFamily;
  gutter.style.fontSize = css.fontSize;
  gutter.style.lineHeight = css.lineHeight;
  gutter.style.paddingTop = `calc(${css.paddingTop})`;
  gutter.style.paddingLeft = css.paddingLeft;
  gutter.style.borderTopLeftRadius = css.borderTopLeftRadius;
  gutter.style.borderBottomLeftRadius = css.borderBottomLeftRadius;
  const lineNumbers = document.createElement("div");
  lineNumbers.setAttribute("class", "codejar-linenumber");
  lineNumbers.style.color = opts.color || css.color;
  lineNumbers.style.setProperty("mix-blend-mode", "unset");
  gutter.appendChild(lineNumbers);
  editor.style.paddingLeft = `calc(${opts.width} + ${gutter.style.paddingLeft} + 5px)`;
  editor.style.whiteSpace = "pre";
  editor.parentNode.insertBefore(wrap, editor);
  wrap.appendChild(editor);
  return lineNumbers;
}
var init_codejar_linenumbers = __esm({
  "ts/external/codejar/codejar-linenumbers.ts"() {
  }
});

// ts/external/prism.js
var require_prism = __commonJS({
  "ts/external/prism.js"(exports, module) {
    var _self = "undefined" != typeof window ? window : "undefined" != typeof WorkerGlobalScope && self instanceof WorkerGlobalScope ? self : {};
    var Prism = function(e) {
      var n = /(?:^|\s)lang(?:uage)?-([\w-]+)(?=\s|$)/i, t = 0, r = {}, a = {
        manual: e.Prism && e.Prism.manual,
        disableWorkerMessageHandler: e.Prism && e.Prism.disableWorkerMessageHandler,
        util: {
          encode: function e2(n2) {
            return n2 instanceof i ? new i(n2.type, e2(n2.content), n2.alias) : Array.isArray(n2) ? n2.map(e2) : n2.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\u00a0/g, " ");
          },
          type: function(e2) {
            return Object.prototype.toString.call(e2).slice(8, -1);
          },
          objId: function(e2) {
            return e2.__id || Object.defineProperty(e2, "__id", {
              value: ++t
            }), e2.__id;
          },
          clone: function e2(n2, t2) {
            var r2, i2;
            switch (t2 = t2 || {}, a.util.type(n2)) {
              case "Object":
                if (i2 = a.util.objId(n2), t2[i2]) return t2[i2];
                for (var l2 in r2 = {}, t2[i2] = r2, n2) n2.hasOwnProperty(l2) && (r2[l2] = e2(n2[l2], t2));
                return r2;
              case "Array":
                return i2 = a.util.objId(n2), t2[i2] ? t2[i2] : (r2 = [], t2[i2] = r2, n2.forEach(function(n3, a2) {
                  r2[a2] = e2(n3, t2);
                }), r2);
              default:
                return n2;
            }
          },
          getLanguage: function(e2) {
            for (; e2; ) {
              var t2 = n.exec(e2.className);
              if (t2) return t2[1].toLowerCase();
              e2 = e2.parentElement;
            }
            return "none";
          },
          setLanguage: function(e2, t2) {
            e2.className = e2.className.replace(RegExp(n, "gi"), ""), e2.classList.add("language-" + t2);
          },
          currentScript: function() {
            if ("undefined" == typeof document) return null;
            if (document.currentScript && "SCRIPT" === document.currentScript.tagName) return document.currentScript;
            try {
              throw new Error();
            } catch (r2) {
              var e2 = (/at [^(\r\n]*\((.*):[^:]+:[^:]+\)$/i.exec(r2.stack) || [])[1];
              if (e2) {
                var n2 = document.getElementsByTagName("script");
                for (var t2 in n2) if (n2[t2].src == e2) return n2[t2];
              }
              return null;
            }
          },
          isActive: function(e2, n2, t2) {
            for (var r2 = "no-" + n2; e2; ) {
              var a2 = e2.classList;
              if (a2.contains(n2)) return true;
              if (a2.contains(r2)) return false;
              e2 = e2.parentElement;
            }
            return !!t2;
          }
        },
        languages: {
          plain: r,
          plaintext: r,
          text: r,
          txt: r,
          extend: function(e2, n2) {
            var t2 = a.util.clone(a.languages[e2]);
            for (var r2 in n2) t2[r2] = n2[r2];
            return t2;
          },
          insertBefore: function(e2, n2, t2, r2) {
            var i2 = (r2 = r2 || a.languages)[e2], l2 = {};
            for (var o2 in i2) if (i2.hasOwnProperty(o2)) {
              if (o2 == n2) for (var s2 in t2) t2.hasOwnProperty(s2) && (l2[s2] = t2[s2]);
              t2.hasOwnProperty(o2) || (l2[o2] = i2[o2]);
            }
            var u2 = r2[e2];
            return r2[e2] = l2, a.languages.DFS(a.languages, function(n3, t3) {
              t3 === u2 && n3 != e2 && (this[n3] = l2);
            }), l2;
          },
          DFS: function e2(n2, t2, r2, i2) {
            i2 = i2 || {};
            var l2 = a.util.objId;
            for (var o2 in n2) if (n2.hasOwnProperty(o2)) {
              t2.call(n2, o2, n2[o2], r2 || o2);
              var s2 = n2[o2], u2 = a.util.type(s2);
              "Object" !== u2 || i2[l2(s2)] ? "Array" !== u2 || i2[l2(s2)] || (i2[l2(s2)] = true, e2(s2, t2, o2, i2)) : (i2[l2(s2)] = true, e2(s2, t2, null, i2));
            }
          }
        },
        plugins: {},
        highlightAll: function(e2, n2) {
          a.highlightAllUnder(document, e2, n2);
        },
        highlightAllUnder: function(e2, n2, t2) {
          var r2 = {
            callback: t2,
            container: e2,
            selector: 'code[class*="language-"], [class*="language-"] code, code[class*="lang-"], [class*="lang-"] code'
          };
          a.hooks.run("before-highlightall", r2), r2.elements = Array.prototype.slice.apply(r2.container.querySelectorAll(r2.selector)), a.hooks.run("before-all-elements-highlight", r2);
          for (var i2, l2 = 0; i2 = r2.elements[l2++]; ) a.highlightElement(i2, true === n2, r2.callback);
        },
        highlightElement: function(n2, t2, r2) {
          var i2 = a.util.getLanguage(n2), l2 = a.languages[i2];
          a.util.setLanguage(n2, i2);
          var o2 = n2.parentElement;
          o2 && "pre" === o2.nodeName.toLowerCase() && a.util.setLanguage(o2, i2);
          var s2 = {
            element: n2,
            language: i2,
            grammar: l2,
            code: n2.textContent
          };
          function u2(e2) {
            s2.highlightedCode = e2, a.hooks.run("before-insert", s2), s2.element.innerHTML = s2.highlightedCode, a.hooks.run("after-highlight", s2), a.hooks.run("complete", s2), r2 && r2.call(s2.element);
          }
          if (a.hooks.run("before-sanity-check", s2), (o2 = s2.element.parentElement) && "pre" === o2.nodeName.toLowerCase() && !o2.hasAttribute("tabindex") && o2.setAttribute("tabindex", "0"), !s2.code) return a.hooks.run("complete", s2), void (r2 && r2.call(s2.element));
          if (a.hooks.run("before-highlight", s2), s2.grammar) if (t2 && e.Worker) {
            var c2 = new Worker(a.filename);
            c2.onmessage = function(e2) {
              u2(e2.data);
            }, c2.postMessage(JSON.stringify({
              language: s2.language,
              code: s2.code,
              immediateClose: true
            }));
          } else u2(a.highlight(s2.code, s2.grammar, s2.language));
          else u2(a.util.encode(s2.code));
        },
        highlight: function(e2, n2, t2) {
          var r2 = {
            code: e2,
            grammar: n2,
            language: t2
          };
          if (a.hooks.run("before-tokenize", r2), !r2.grammar) throw new Error('The language "' + r2.language + '" has no grammar.');
          return r2.tokens = a.tokenize(r2.code, r2.grammar), a.hooks.run("after-tokenize", r2), i.stringify(a.util.encode(r2.tokens), r2.language);
        },
        tokenize: function(e2, n2) {
          var t2 = n2.rest;
          if (t2) {
            for (var r2 in t2) n2[r2] = t2[r2];
            delete n2.rest;
          }
          var a2 = new s();
          return u(a2, a2.head, e2), o(e2, a2, n2, a2.head, 0), function(e3) {
            for (var n3 = [], t3 = e3.head.next; t3 !== e3.tail; ) n3.push(t3.value), t3 = t3.next;
            return n3;
          }(a2);
        },
        hooks: {
          all: {},
          add: function(e2, n2) {
            var t2 = a.hooks.all;
            t2[e2] = t2[e2] || [], t2[e2].push(n2);
          },
          run: function(e2, n2) {
            var t2 = a.hooks.all[e2];
            if (t2 && t2.length) for (var r2, i2 = 0; r2 = t2[i2++]; ) r2(n2);
          }
        },
        Token: i
      };
      function i(e2, n2, t2, r2) {
        this.type = e2, this.content = n2, this.alias = t2, this.length = 0 | (r2 || "").length;
      }
      function l(e2, n2, t2, r2) {
        e2.lastIndex = n2;
        var a2 = e2.exec(t2);
        if (a2 && r2 && a2[1]) {
          var i2 = a2[1].length;
          a2.index += i2, a2[0] = a2[0].slice(i2);
        }
        return a2;
      }
      function o(e2, n2, t2, r2, s2, g2) {
        for (var f2 in t2) if (t2.hasOwnProperty(f2) && t2[f2]) {
          var h2 = t2[f2];
          h2 = Array.isArray(h2) ? h2 : [
            h2
          ];
          for (var d = 0; d < h2.length; ++d) {
            if (g2 && g2.cause == f2 + "," + d) return;
            var v = h2[d], p = v.inside, m = !!v.lookbehind, y = !!v.greedy, k = v.alias;
            if (y && !v.pattern.global) {
              var x = v.pattern.toString().match(/[imsuy]*$/)[0];
              v.pattern = RegExp(v.pattern.source, x + "g");
            }
            for (var b = v.pattern || v, w = r2.next, A = s2; w !== n2.tail && !(g2 && A >= g2.reach); A += w.value.length, w = w.next) {
              var P = w.value;
              if (n2.length > e2.length) return;
              if (!(P instanceof i)) {
                var E, S = 1;
                if (y) {
                  if (!(E = l(b, A, e2, m)) || E.index >= e2.length) break;
                  var L = E.index, O = E.index + E[0].length, C = A;
                  for (C += w.value.length; L >= C; ) C += (w = w.next).value.length;
                  if (A = C -= w.value.length, w.value instanceof i) continue;
                  for (var j = w; j !== n2.tail && (C < O || "string" == typeof j.value); j = j.next) S++, C += j.value.length;
                  S--, P = e2.slice(A, C), E.index -= A;
                } else if (!(E = l(b, 0, P, m))) continue;
                L = E.index;
                var N = E[0], _ = P.slice(0, L), M = P.slice(L + N.length), W = A + P.length;
                g2 && W > g2.reach && (g2.reach = W);
                var I = w.prev;
                if (_ && (I = u(n2, I, _), A += _.length), c(n2, I, S), w = u(n2, I, new i(f2, p ? a.tokenize(N, p) : N, k, N)), M && u(n2, w, M), S > 1) {
                  var T = {
                    cause: f2 + "," + d,
                    reach: W
                  };
                  o(e2, n2, t2, w.prev, A, T), g2 && T.reach > g2.reach && (g2.reach = T.reach);
                }
              }
            }
          }
        }
      }
      function s() {
        var e2 = {
          value: null,
          prev: null,
          next: null
        }, n2 = {
          value: null,
          prev: e2,
          next: null
        };
        e2.next = n2, this.head = e2, this.tail = n2, this.length = 0;
      }
      function u(e2, n2, t2) {
        var r2 = n2.next, a2 = {
          value: t2,
          prev: n2,
          next: r2
        };
        return n2.next = a2, r2.prev = a2, e2.length++, a2;
      }
      function c(e2, n2, t2) {
        for (var r2 = n2.next, a2 = 0; a2 < t2 && r2 !== e2.tail; a2++) r2 = r2.next;
        n2.next = r2, r2.prev = n2, e2.length -= a2;
      }
      if (e.Prism = a, i.stringify = function e2(n2, t2) {
        if ("string" == typeof n2) return n2;
        if (Array.isArray(n2)) {
          var r2 = "";
          return n2.forEach(function(n3) {
            r2 += e2(n3, t2);
          }), r2;
        }
        var i2 = {
          type: n2.type,
          content: e2(n2.content, t2),
          tag: "span",
          classes: [
            "token",
            n2.type
          ],
          attributes: {},
          language: t2
        }, l2 = n2.alias;
        l2 && (Array.isArray(l2) ? Array.prototype.push.apply(i2.classes, l2) : i2.classes.push(l2)), a.hooks.run("wrap", i2);
        var o2 = "";
        for (var s2 in i2.attributes) o2 += " " + s2 + '="' + (i2.attributes[s2] || "").replace(/"/g, "&quot;") + '"';
        return "<" + i2.tag + ' class="' + i2.classes.join(" ") + '"' + o2 + ">" + i2.content + "</" + i2.tag + ">";
      }, !e.document) return e.addEventListener ? (a.disableWorkerMessageHandler || e.addEventListener("message", function(n2) {
        var t2 = JSON.parse(n2.data), r2 = t2.language, i2 = t2.code, l2 = t2.immediateClose;
        e.postMessage(a.highlight(i2, a.languages[r2], r2)), l2 && e.close();
      }, false), a) : a;
      var g = a.util.currentScript();
      function f() {
        a.manual || a.highlightAll();
      }
      if (g && (a.filename = g.src, g.hasAttribute("data-manual") && (a.manual = true)), !a.manual) {
        var h = document.readyState;
        "loading" === h || "interactive" === h && g && g.defer ? document.addEventListener("DOMContentLoaded", f) : window.requestAnimationFrame ? window.requestAnimationFrame(f) : window.setTimeout(f, 16);
      }
      return a;
    }(_self);
    "undefined" != typeof module && module.exports && (module.exports = Prism), "undefined" != typeof global && (global.Prism = Prism);
    Prism.languages.clike = {
      comment: [
        {
          pattern: /(^|[^\\])\/\*[\s\S]*?(?:\*\/|$)/,
          lookbehind: true,
          greedy: true
        },
        {
          pattern: /(^|[^\\:])\/\/.*/,
          lookbehind: true,
          greedy: true
        }
      ],
      string: {
        pattern: /(["'])(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
        greedy: true
      },
      "class-name": {
        pattern: /(\b(?:class|extends|implements|instanceof|interface|new|trait)\s+|\bcatch\s+\()[\w.\\]+/i,
        lookbehind: true,
        inside: {
          punctuation: /[.\\]/
        }
      },
      keyword: /\b(?:break|catch|continue|do|else|finally|for|function|if|in|instanceof|new|null|return|throw|try|while)\b/,
      boolean: /\b(?:false|true)\b/,
      function: /\b\w+(?=\()/,
      number: /\b0x[\da-f]+\b|(?:\b\d+(?:\.\d*)?|\B\.\d+)(?:e[+-]?\d+)?/i,
      operator: /[<>]=?|[!=]=?=?|--?|\+\+?|&&?|\|\|?|[?*/~^%]/,
      punctuation: /[{}[\];(),.:]/
    };
    Prism.languages.javascript = Prism.languages.extend("clike", {
      "class-name": [
        Prism.languages.clike["class-name"],
        {
          pattern: /(^|[^$\w\xA0-\uFFFF])(?!\s)[_$A-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\.(?:constructor|prototype))/,
          lookbehind: true
        }
      ],
      keyword: [
        {
          pattern: /((?:^|\})\s*)catch\b/,
          lookbehind: true
        },
        {
          pattern: /(^|[^.]|\.\.\.\s*)\b(?:as|assert(?=\s*\{)|async(?=\s*(?:function\b|\(|[$\w\xA0-\uFFFF]|$))|await|break|case|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally(?=\s*(?:\{|$))|for|from(?=\s*(?:['"]|$))|function|(?:get|set)(?=\s*(?:[#\[$\w\xA0-\uFFFF]|$))|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|static|super|switch|this|throw|try|typeof|undefined|var|void|while|with|yield)\b/,
          lookbehind: true
        }
      ],
      function: /#?(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*(?:\.\s*(?:apply|bind|call)\s*)?\()/,
      number: {
        pattern: RegExp("(^|[^\\w$])(?:NaN|Infinity|0[bB][01]+(?:_[01]+)*n?|0[oO][0-7]+(?:_[0-7]+)*n?|0[xX][\\dA-Fa-f]+(?:_[\\dA-Fa-f]+)*n?|\\d+(?:_\\d+)*n|(?:\\d+(?:_\\d+)*(?:\\.(?:\\d+(?:_\\d+)*)?)?|\\.\\d+(?:_\\d+)*)(?:[Ee][+-]?\\d+(?:_\\d+)*)?)(?![\\w$])"),
        lookbehind: true
      },
      operator: /--|\+\+|\*\*=?|=>|&&=?|\|\|=?|[!=]==|<<=?|>>>?=?|[-+*/%&|^!=<>]=?|\.{3}|\?\?=?|\?\.?|[~:]/
    }), Prism.languages.javascript["class-name"][0].pattern = /(\b(?:class|extends|implements|instanceof|interface|new)\s+)[\w.\\]+/, Prism.languages.insertBefore("javascript", "keyword", {
      regex: {
        pattern: RegExp(`((?:^|[^$\\w\\xA0-\\uFFFF."'\\])\\s]|\\b(?:return|yield))\\s*)/(?:(?:\\[(?:[^\\]\\\\\r
]|\\\\.)*\\]|\\\\.|[^/\\\\\\[\r
])+/[dgimyus]{0,7}|(?:\\[(?:[^[\\]\\\\\r
]|\\\\.|\\[(?:[^[\\]\\\\\r
]|\\\\.|\\[(?:[^[\\]\\\\\r
]|\\\\.)*\\])*\\])*\\]|\\\\.|[^/\\\\\\[\r
])+/[dgimyus]{0,7}v[dgimyus]{0,7})(?=(?:\\s|/\\*(?:[^*]|\\*(?!/))*\\*/)*(?:$|[\r
,.;:})\\]]|//))`),
        lookbehind: true,
        greedy: true,
        inside: {
          "regex-source": {
            pattern: /^(\/)[\s\S]+(?=\/[a-z]*$)/,
            lookbehind: true,
            alias: "language-regex",
            inside: Prism.languages.regex
          },
          "regex-delimiter": /^\/|\/$/,
          "regex-flags": /^[a-z]+$/
        }
      },
      "function-variable": {
        pattern: /#?(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*[=:]\s*(?:async\s*)?(?:\bfunction\b|(?:\((?:[^()]|\([^()]*\))*\)|(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*)\s*=>))/,
        alias: "function"
      },
      parameter: [
        {
          pattern: /(function(?:\s+(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*)?\s*\(\s*)(?!\s)(?:[^()\s]|\s+(?![\s)])|\([^()]*\))+(?=\s*\))/,
          lookbehind: true,
          inside: Prism.languages.javascript
        },
        {
          pattern: /(^|[^$\w\xA0-\uFFFF])(?!\s)[_$a-z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*=>)/i,
          lookbehind: true,
          inside: Prism.languages.javascript
        },
        {
          pattern: /(\(\s*)(?!\s)(?:[^()\s]|\s+(?![\s)])|\([^()]*\))+(?=\s*\)\s*=>)/,
          lookbehind: true,
          inside: Prism.languages.javascript
        },
        {
          pattern: /((?:\b|\s|^)(?!(?:as|async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally|for|from|function|get|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|set|static|super|switch|this|throw|try|typeof|undefined|var|void|while|with|yield)(?![$\w\xA0-\uFFFF]))(?:(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*\s*)\(\s*|\]\s*\(\s*)(?!\s)(?:[^()\s]|\s+(?![\s)])|\([^()]*\))+(?=\s*\)\s*\{)/,
          lookbehind: true,
          inside: Prism.languages.javascript
        }
      ],
      constant: /\b[A-Z](?:[A-Z_]|\dx?)*\b/
    }), Prism.languages.insertBefore("javascript", "string", {
      hashbang: {
        pattern: /^#!.*/,
        greedy: true,
        alias: "comment"
      },
      "template-string": {
        pattern: /`(?:\\[\s\S]|\$\{(?:[^{}]|\{(?:[^{}]|\{[^}]*\})*\})+\}|(?!\$\{)[^\\`])*`/,
        greedy: true,
        inside: {
          "template-punctuation": {
            pattern: /^`|`$/,
            alias: "string"
          },
          interpolation: {
            pattern: /((?:^|[^\\])(?:\\{2})*)\$\{(?:[^{}]|\{(?:[^{}]|\{[^}]*\})*\})+\}/,
            lookbehind: true,
            inside: {
              "interpolation-punctuation": {
                pattern: /^\$\{|\}$/,
                alias: "punctuation"
              },
              rest: Prism.languages.javascript
            }
          },
          string: /[\s\S]+/
        }
      },
      "string-property": {
        pattern: /((?:^|[,{])[ \t]*)(["'])(?:\\(?:\r\n|[\s\S])|(?!\2)[^\\\r\n])*\2(?=\s*:)/m,
        lookbehind: true,
        greedy: true,
        alias: "property"
      }
    }), Prism.languages.insertBefore("javascript", "operator", {
      "literal-property": {
        pattern: /((?:^|[,{])[ \t]*)(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*:)/m,
        lookbehind: true,
        alias: "property"
      }
    }), Prism.languages.markup && (Prism.languages.markup.tag.addInlined("script", "javascript"), Prism.languages.markup.tag.addAttribute("on(?:abort|blur|change|click|composition(?:end|start|update)|dblclick|error|focus(?:in|out)?|key(?:down|up)|load|mouse(?:down|enter|leave|move|out|over|up)|reset|resize|scroll|select|slotchange|submit|unload|wheel)", "javascript")), Prism.languages.js = Prism.languages.javascript;
    !function(a) {
      function e(a2, e2) {
        return RegExp(a2.replace(/<ID>/g, function() {
          return "(?!\\s)[_$a-zA-Z\\xA0-\\uFFFF](?:(?!\\s)[$\\w\\xA0-\\uFFFF])*";
        }), e2);
      }
      a.languages.insertBefore("javascript", "function-variable", {
        "method-variable": {
          pattern: RegExp("(\\.\\s*)" + a.languages.javascript["function-variable"].pattern.source),
          lookbehind: true,
          alias: [
            "function-variable",
            "method",
            "function",
            "property-access"
          ]
        }
      }), a.languages.insertBefore("javascript", "function", {
        method: {
          pattern: RegExp("(\\.\\s*)" + a.languages.javascript.function.source),
          lookbehind: true,
          alias: [
            "function",
            "property-access"
          ]
        }
      }), a.languages.insertBefore("javascript", "constant", {
        "known-class-name": [
          {
            pattern: /\b(?:(?:Float(?:32|64)|(?:Int|Uint)(?:8|16|32)|Uint8Clamped)?Array|ArrayBuffer|BigInt|Boolean|DataView|Date|Error|Function|Intl|JSON|(?:Weak)?(?:Map|Set)|Math|Number|Object|Promise|Proxy|Reflect|RegExp|String|Symbol|WebAssembly)\b/,
            alias: "class-name"
          },
          {
            pattern: /\b(?:[A-Z]\w*)Error\b/,
            alias: "class-name"
          }
        ]
      }), a.languages.insertBefore("javascript", "keyword", {
        imports: {
          pattern: e("(\\bimport\\b\\s*)(?:<ID>(?:\\s*,\\s*(?:\\*\\s*as\\s+<ID>|\\{[^{}]*\\}))?|\\*\\s*as\\s+<ID>|\\{[^{}]*\\})(?=\\s*\\bfrom\\b)"),
          lookbehind: true,
          inside: a.languages.javascript
        },
        exports: {
          pattern: e("(\\bexport\\b\\s*)(?:\\*(?:\\s*as\\s+<ID>)?(?=\\s*\\bfrom\\b)|\\{[^{}]*\\})"),
          lookbehind: true,
          inside: a.languages.javascript
        }
      }), a.languages.javascript.keyword.unshift({
        pattern: /\b(?:as|default|export|from|import)\b/,
        alias: "module"
      }, {
        pattern: /\b(?:await|break|catch|continue|do|else|finally|for|if|return|switch|throw|try|while|yield)\b/,
        alias: "control-flow"
      }, {
        pattern: /\bnull\b/,
        alias: [
          "null",
          "nil"
        ]
      }, {
        pattern: /\bundefined\b/,
        alias: "nil"
      }), a.languages.insertBefore("javascript", "operator", {
        spread: {
          pattern: /\.{3}/,
          alias: "operator"
        },
        arrow: {
          pattern: /=>/,
          alias: "operator"
        }
      }), a.languages.insertBefore("javascript", "punctuation", {
        "property-access": {
          pattern: e("(\\.\\s*)#?<ID>"),
          lookbehind: true
        },
        "maybe-class-name": {
          pattern: /(^|[^$\w\xA0-\uFFFF])[A-Z][$\w\xA0-\uFFFF]+/,
          lookbehind: true
        },
        dom: {
          pattern: /\b(?:document|(?:local|session)Storage|location|navigator|performance|window)\b/,
          alias: "variable"
        },
        console: {
          pattern: /\bconsole(?=\s*\.)/,
          alias: "class-name"
        }
      });
      for (var t = [
        "function",
        "function-variable",
        "method",
        "method-variable",
        "property-access"
      ], r = 0; r < t.length; r++) {
        var n = t[r], s = a.languages.javascript[n];
        "RegExp" === a.util.type(s) && (s = a.languages.javascript[n] = {
          pattern: s
        });
        var o = s.inside || {};
        s.inside = o, o["maybe-class-name"] = /^[A-Z][\s\S]*/;
      }
    }(Prism);
    !function() {
      if ("undefined" != typeof Prism && "undefined" != typeof document && document.querySelector) {
        var e, t = "line-numbers", i = "linkable-line-numbers", n = /\n(?!$)/g, r = true;
        Prism.plugins.lineHighlight = {
          highlightLines: function(o2, u2, c2) {
            var h = (u2 = "string" == typeof u2 ? u2 : o2.getAttribute("data-line") || "").replace(/\s+/g, "").split(",").filter(Boolean), d = +o2.getAttribute("data-line-offset") || 0, f = (function() {
              if (void 0 === e) {
                var t2 = document.createElement("div");
                t2.style.fontSize = "13px", t2.style.lineHeight = "1.5", t2.style.padding = "0", t2.style.border = "0", t2.innerHTML = "&nbsp;<br />&nbsp;", document.body.appendChild(t2), e = 38 === t2.offsetHeight, document.body.removeChild(t2);
              }
              return e;
            }() ? parseInt : parseFloat)(getComputedStyle(o2).lineHeight), p = Prism.util.isActive(o2, t), g = o2.querySelector("code"), m = p ? o2 : g || o2, v = [], y = g.textContent.match(n), b = y ? y.length + 1 : 1, A = g && m != g ? function(e2, t2) {
              var i2 = getComputedStyle(e2), n2 = getComputedStyle(t2);
              function r2(e3) {
                return +e3.substr(0, e3.length - 2);
              }
              return t2.offsetTop + r2(n2.borderTopWidth) + r2(n2.paddingTop) - r2(i2.paddingTop);
            }(o2, g) : 0;
            h.forEach(function(e2) {
              var t2 = e2.split("-"), i2 = +t2[0], n2 = +t2[1] || i2;
              if (!((n2 = Math.min(b + d, n2)) < i2)) {
                var r2 = o2.querySelector('.line-highlight[data-range="' + e2 + '"]') || document.createElement("div");
                if (v.push(function() {
                  r2.setAttribute("aria-hidden", "true"), r2.setAttribute("data-range", e2), r2.className = (c2 || "") + " line-highlight";
                }), p && Prism.plugins.lineNumbers) {
                  var s2 = Prism.plugins.lineNumbers.getLine(o2, i2), l2 = Prism.plugins.lineNumbers.getLine(o2, n2);
                  if (s2) {
                    var a2 = s2.offsetTop + A + "px";
                    v.push(function() {
                      r2.style.top = a2;
                    });
                  }
                  if (l2) {
                    var u3 = l2.offsetTop - s2.offsetTop + l2.offsetHeight + "px";
                    v.push(function() {
                      r2.style.height = u3;
                    });
                  }
                } else v.push(function() {
                  r2.setAttribute("data-start", String(i2)), n2 > i2 && r2.setAttribute("data-end", String(n2)), r2.style.top = (i2 - d - 1) * f + A + "px", r2.textContent = new Array(n2 - i2 + 2).join(" \n");
                });
                v.push(function() {
                  r2.style.width = o2.scrollWidth + "px";
                }), v.push(function() {
                  m.appendChild(r2);
                });
              }
            });
            var P = o2.id;
            if (p && Prism.util.isActive(o2, i) && P) {
              l(o2, i) || v.push(function() {
                o2.classList.add(i);
              });
              var E = parseInt(o2.getAttribute("data-start") || "1");
              s(".line-numbers-rows > span", o2).forEach(function(e2, t2) {
                var i2 = t2 + E;
                e2.onclick = function() {
                  var e3 = P + "." + i2;
                  r = false, location.hash = e3, setTimeout(function() {
                    r = true;
                  }, 1);
                };
              });
            }
            return function() {
              v.forEach(a);
            };
          }
        };
        var o = 0;
        Prism.hooks.add("before-sanity-check", function(e2) {
          var t2 = e2.element.parentElement;
          if (u(t2)) {
            var i2 = 0;
            s(".line-highlight", t2).forEach(function(e3) {
              i2 += e3.textContent.length, e3.parentNode.removeChild(e3);
            }), i2 && /^(?: \n)+$/.test(e2.code.slice(-i2)) && (e2.code = e2.code.slice(0, -i2));
          }
        }), Prism.hooks.add("complete", function e2(i2) {
          var n2 = i2.element.parentElement;
          if (u(n2)) {
            clearTimeout(o);
            var r2 = Prism.plugins.lineNumbers, s2 = i2.plugins && i2.plugins.lineNumbers;
            l(n2, t) && r2 && !s2 ? Prism.hooks.add("line-numbers", e2) : (Prism.plugins.lineHighlight.highlightLines(n2)(), o = setTimeout(c, 1));
          }
        }), window.addEventListener("hashchange", c), window.addEventListener("resize", function() {
          s("pre").filter(u).map(function(e2) {
            return Prism.plugins.lineHighlight.highlightLines(e2);
          }).forEach(a);
        });
      }
      function s(e2, t2) {
        return Array.prototype.slice.call((t2 || document).querySelectorAll(e2));
      }
      function l(e2, t2) {
        return e2.classList.contains(t2);
      }
      function a(e2) {
        e2();
      }
      function u(e2) {
        return !!(e2 && /pre/i.test(e2.nodeName) && (e2.hasAttribute("data-line") || e2.id && Prism.util.isActive(e2, i)));
      }
      function c() {
        var e2 = location.hash.slice(1);
        s(".temporary.line-highlight").forEach(function(e3) {
          e3.parentNode.removeChild(e3);
        });
        var t2 = (e2.match(/\.([\d,-]+)$/) || [
          ,
          ""
        ])[1];
        if (t2 && !document.getElementById(e2)) {
          var i2 = e2.slice(0, e2.lastIndexOf(".")), n2 = document.getElementById(i2);
          n2 && (n2.hasAttribute("data-line") || n2.setAttribute("data-line", ""), Prism.plugins.lineHighlight.highlightLines(n2, t2, "temporary ")(), r && document.querySelector(".temporary.line-highlight").scrollIntoView());
        }
      }
    }();
    !function() {
      if ("undefined" != typeof Prism && "undefined" != typeof document) {
        var e = "line-numbers", n = /\n(?!$)/g, t = Prism.plugins.lineNumbers = {
          getLine: function(n2, t2) {
            if ("PRE" === n2.tagName && n2.classList.contains(e)) {
              var i2 = n2.querySelector(".line-numbers-rows");
              if (i2) {
                var r2 = parseInt(n2.getAttribute("data-start"), 10) || 1, s = r2 + (i2.children.length - 1);
                t2 < r2 && (t2 = r2), t2 > s && (t2 = s);
                var l = t2 - r2;
                return i2.children[l];
              }
            }
          },
          resize: function(e2) {
            r([
              e2
            ]);
          },
          assumeViewportIndependence: true
        }, i = void 0;
        window.addEventListener("resize", function() {
          t.assumeViewportIndependence && i === window.innerWidth || (i = window.innerWidth, r(Array.prototype.slice.call(document.querySelectorAll("pre.line-numbers"))));
        }), Prism.hooks.add("complete", function(t2) {
          if (t2.code) {
            var i2 = t2.element, s = i2.parentNode;
            if (s && /pre/i.test(s.nodeName) && !i2.querySelector(".line-numbers-rows") && Prism.util.isActive(i2, e)) {
              i2.classList.remove(e), s.classList.add(e);
              var l, o = t2.code.match(n), a = o ? o.length + 1 : 1, u = new Array(a + 1).join("<span></span>");
              (l = document.createElement("span")).setAttribute("aria-hidden", "true"), l.className = "line-numbers-rows", l.innerHTML = u, s.hasAttribute("data-start") && (s.style.counterReset = "linenumber " + (parseInt(s.getAttribute("data-start"), 10) - 1)), t2.element.appendChild(l), r([
                s
              ]), Prism.hooks.run("line-numbers", t2);
            }
          }
        }), Prism.hooks.add("line-numbers", function(e2) {
          e2.plugins = e2.plugins || {}, e2.plugins.lineNumbers = true;
        });
      }
      function r(e2) {
        if (0 != (e2 = e2.filter(function(e3) {
          var n2, t3 = (n2 = e3, n2 ? window.getComputedStyle ? getComputedStyle(n2) : n2.currentStyle || null : null)["white-space"];
          return "pre-wrap" === t3 || "pre-line" === t3;
        })).length) {
          var t2 = e2.map(function(e3) {
            var t3 = e3.querySelector("code"), i2 = e3.querySelector(".line-numbers-rows");
            if (t3 && i2) {
              var r2 = e3.querySelector(".line-numbers-sizer"), s = t3.textContent.split(n);
              r2 || ((r2 = document.createElement("span")).className = "line-numbers-sizer", t3.appendChild(r2)), r2.innerHTML = "0", r2.style.display = "block";
              var l = r2.getBoundingClientRect().height;
              return r2.innerHTML = "", {
                element: e3,
                lines: s,
                lineHeights: [],
                oneLinerHeight: l,
                sizer: r2
              };
            }
          }).filter(Boolean);
          t2.forEach(function(e3) {
            var n2 = e3.sizer, t3 = e3.lines, i2 = e3.lineHeights, r2 = e3.oneLinerHeight;
            i2[t3.length - 1] = void 0, t3.forEach(function(e4, t4) {
              if (e4 && e4.length > 1) {
                var s = n2.appendChild(document.createElement("span"));
                s.style.display = "block", s.textContent = e4;
              } else i2[t4] = r2;
            });
          }), t2.forEach(function(e3) {
            for (var n2 = e3.sizer, t3 = e3.lineHeights, i2 = 0, r2 = 0; r2 < t3.length; r2++) void 0 === t3[r2] && (t3[r2] = n2.children[i2++].getBoundingClientRect().height);
          }), t2.forEach(function(e3) {
            var n2 = e3.sizer, t3 = e3.element.querySelector(".line-numbers-rows");
            n2.style.display = "none", n2.innerHTML = "", e3.lineHeights.forEach(function(e4, n3) {
              t3.children[n3].style.height = e4 + "px";
            });
          });
        }
      }
    }();
    !function() {
      if ("undefined" != typeof Prism && "undefined" != typeof document) {
        var e = [], t = {}, n = function() {
        };
        Prism.plugins.toolbar = {};
        var a = Prism.plugins.toolbar.registerButton = function(n2, a2) {
          var r2;
          r2 = "function" == typeof a2 ? a2 : function(e2) {
            var t2;
            return "function" == typeof a2.onClick ? ((t2 = document.createElement("button")).type = "button", t2.addEventListener("click", function() {
              a2.onClick.call(this, e2);
            })) : "string" == typeof a2.url ? (t2 = document.createElement("a")).href = a2.url : t2 = document.createElement("span"), a2.className && t2.classList.add(a2.className), t2.textContent = a2.text, t2;
          }, n2 in t ? console.warn('There is a button with the key "' + n2 + '" registered already.') : e.push(t[n2] = r2);
        }, r = Prism.plugins.toolbar.hook = function(a2) {
          var r2 = a2.element.parentNode;
          if (r2 && /pre/i.test(r2.nodeName) && !r2.parentNode.classList.contains("code-toolbar")) {
            var o = document.createElement("div");
            o.classList.add("code-toolbar"), r2.parentNode.insertBefore(o, r2), o.appendChild(r2);
            var i = document.createElement("div");
            i.classList.add("toolbar");
            var l = e, d = function(e2) {
              for (; e2; ) {
                var t2 = e2.getAttribute("data-toolbar-order");
                if (null != t2) return (t2 = t2.trim()).length ? t2.split(/\s*,\s*/g) : [];
                e2 = e2.parentElement;
              }
            }(a2.element);
            d && (l = d.map(function(e2) {
              return t[e2] || n;
            })), l.forEach(function(e2) {
              var t2 = e2(a2);
              if (t2) {
                var n2 = document.createElement("div");
                n2.classList.add("toolbar-item"), n2.appendChild(t2), i.appendChild(n2);
              }
            }), o.appendChild(i);
          }
        };
        a("label", function(e2) {
          var t2 = e2.element.parentNode;
          if (t2 && /pre/i.test(t2.nodeName) && t2.hasAttribute("data-label")) {
            var n2, a2, r2 = t2.getAttribute("data-label");
            try {
              a2 = document.querySelector("template#" + r2);
            } catch (e3) {
            }
            return a2 ? n2 = a2.content : (t2.hasAttribute("data-url") ? (n2 = document.createElement("a")).href = t2.getAttribute("data-url") : n2 = document.createElement("span"), n2.textContent = r2), n2;
          }
        }), Prism.hooks.add("complete", r);
      }
    }();
    !function() {
      function t(t2) {
        var e = document.createElement("textarea");
        e.value = t2.getText(), e.style.top = "0", e.style.left = "0", e.style.position = "fixed", document.body.appendChild(e), e.focus(), e.select();
        try {
          var o = document.execCommand("copy");
          setTimeout(function() {
            o ? t2.success() : t2.error();
          }, 1);
        } catch (e2) {
          setTimeout(function() {
            t2.error(e2);
          }, 1);
        }
        document.body.removeChild(e);
      }
      "undefined" != typeof Prism && "undefined" != typeof document && (Prism.plugins.toolbar ? Prism.plugins.toolbar.registerButton("copy-to-clipboard", function(e) {
        var o = e.element, n = function(t2) {
          var e2 = {
            copy: "Copy",
            "copy-error": "Press Ctrl+C to copy",
            "copy-success": "Copied!",
            "copy-timeout": 5e3
          };
          for (var o2 in e2) {
            for (var n2 = "data-prismjs-" + o2, c2 = t2; c2 && !c2.hasAttribute(n2); ) c2 = c2.parentElement;
            c2 && (e2[o2] = c2.getAttribute(n2));
          }
          return e2;
        }(o), c = document.createElement("button");
        c.className = "copy-to-clipboard-button", c.setAttribute("type", "button");
        var r = document.createElement("span");
        return c.appendChild(r), u("copy"), function(e2, o2) {
          e2.addEventListener("click", function() {
            !function(e3) {
              navigator.clipboard ? navigator.clipboard.writeText(e3.getText()).then(e3.success, function() {
                t(e3);
              }) : t(e3);
            }(o2);
          });
        }(c, {
          getText: function() {
            return o.textContent;
          },
          success: function() {
            u("copy-success"), i();
          },
          error: function() {
            u("copy-error"), setTimeout(function() {
              !function(t2) {
                window.getSelection().selectAllChildren(t2);
              }(o);
            }, 1), i();
          }
        }), c;
        function i() {
          setTimeout(function() {
            u("copy");
          }, n["copy-timeout"]);
        }
        function u(t2) {
          r.textContent = n[t2], c.setAttribute("data-copy-state", t2);
        }
      }) : console.warn("Copy to Clipboard plugin loaded before Toolbar plugin."));
    }();
  }
});

// ts/main.ts
var require_main = __commonJS({
  "ts/main.ts"(exports, module) {
    init_codejar();
    init_codejar_linenumbers();
    var import_prism = __toESM(require_prism());
    var assert = (condition, message) => {
      if (!condition) {
        throw new Error(message || "assertion failed");
      }
    };
    var options = {
      tab: "  "
    };
    var highlight = (editor) => {
      const code = editor.textContent;
      const highlighted = import_prism.default.highlight(
        code,
        // @ts-ignore: it does
        import_prism.default.languages.javascript,
        "javascript"
      );
      editor.innerHTML = highlighted;
    };
    var RunCode = (jarObj, output) => {
      const writtenCode = jarObj.toString();
      const logs = [];
      const originalConsoleLog = console.log;
      console.log = (...args) => {
        logs.push(args.join(" "));
      };
      try {
        eval(writtenCode);
        output.innerText = logs.join("\n");
        output.scrollTop = output.scrollHeight;
      } catch (err) {
        output.innerHTML = `<span class="console-error">${err}</span>`;
      }
      console.log = originalConsoleLog;
    };
    async function getCodeForLesson(unitid, lessonid) {
      const res = await fetch(`/getunit/${unitid}/${lessonid}`);
      const unitdata = await res.json();
      const code = unitdata.lessons[lessonid].code;
      return code;
    }
    async function setCode(jar, unitid, lessonid) {
      const code = await getCodeForLesson(unitid, lessonid);
      if (code === void 0) {
        console.warn("No initial code in json");
        return;
      }
      console.log("initial code", code);
      jar.updateCode(code);
    }
    document.addEventListener("DOMContentLoaded", () => {
      const editor = document.querySelector("#editor");
      const jar = CodeJar(editor, withLineNumbers(highlight), options);
      const buttons = document.querySelector(".buttons");
      const outConsole = document.querySelector("#console .text");
      const lessoninfo = document.querySelector("#lessoninfo")?.getAttribute("data-lesson-id")?.split(",");
      if (lessoninfo === void 0) {
        throw new Error("No current lesson info");
      }
      const unitid = parseInt(lessoninfo[1]);
      const lessonid = parseInt(lessoninfo[1]);
      assert(!isNaN(unitid) && !isNaN(lessonid), "Unit ID or Lesson ID not a number");
      setCode(jar, unitid, lessonid);
      buttons.addEventListener("click", (e) => {
        const target = e.target;
        if (target.classList.contains("button")) {
          const action = target.dataset.action;
          if (action) {
            switch (action) {
              case "run":
                RunCode(jar, outConsole);
                break;
            }
          }
        }
      });
    });
  }
});
export default require_main();
