var __defProp = Object.defineProperty;
var __markAsModule = (target) => __defProp(target, "__esModule", {value: true});
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {get: all[name], enumerable: true});
};
var __publicField = (obj, key2, value) => {
  if (typeof key2 !== "symbol")
    key2 += "";
  if (key2 in obj)
    return __defProp(obj, key2, {enumerable: true, configurable: true, writable: true, value});
  return obj[key2] = value;
};

// packages/morph/builds/module.js
__markAsModule(exports);
__export(exports, {
  default: () => module_default,
  morph: () => morph
});

// packages/morph/src/morph.js
var resolveStep = () => {
};
var logger = () => {
};
var fromEl;
var toEl;
function breakpoint(message) {
  if (!debug)
    return;
  logger((message || "").replace("\n", "\\n"), fromEl, toEl);
  return new Promise((resolve) => resolveStep = () => resolve());
}
async function morph(from, toHtml, options) {
  assignOptions(options);
  fromEl = from;
  toEl = createElement(toHtml);
  if (window.Alpine && !from._x_dataStack) {
    toEl._x_dataStack = window.Alpine.closestDataStack(from);
    toEl._x_dataStack && window.Alpine.clone(from, toEl);
  }
  await breakpoint();
  await patch(from, toEl);
  fromEl = void 0;
  toEl = void 0;
  return from;
}
morph.step = () => resolveStep();
morph.log = (theLogger) => {
  logger = theLogger;
};
var key;
var lookahead;
var updating;
var updated;
var removing;
var removed;
var adding;
var added;
var debug;
var noop = () => {
};
function assignOptions(options = {}) {
  let defaultGetKey = (el) => el.getAttribute("key");
  updating = options.updating || noop;
  updated = options.updated || noop;
  removing = options.removing || noop;
  removed = options.removed || noop;
  adding = options.adding || noop;
  added = options.added || noop;
  key = options.key || defaultGetKey;
  lookahead = options.lookahead || false;
  debug = options.debug || false;
}
function createElement(html) {
  return document.createRange().createContextualFragment(html).firstElementChild;
}
async function patch(from, to) {
  if (differentElementNamesTypesOrKeys(from, to)) {
    let result = patchElement(from, to);
    await breakpoint("Swap elements");
    return result;
  }
  let updateChildrenOnly = false;
  if (shouldSkip(updating, from, to, () => updateChildrenOnly = true))
    return;
  window.Alpine && initializeAlpineOnTo(from, to, () => updateChildrenOnly = true);
  if (textOrComment(to)) {
    await patchNodeValue(from, to);
    updated(from, to);
    return;
  }
  if (!updateChildrenOnly) {
    await patchAttributes(from, to);
  }
  updated(from, to);
  await patchChildren(from, to);
}
function differentElementNamesTypesOrKeys(from, to) {
  return from.nodeType != to.nodeType || from.nodeName != to.nodeName || getKey(from) != getKey(to);
}
function textOrComment(el) {
  return el.nodeType === 3 || el.nodeType === 8;
}
function patchElement(from, to) {
  if (shouldSkip(removing, from))
    return;
  let toCloned = to.cloneNode(true);
  if (shouldSkip(adding, toCloned))
    return;
  dom(from).replace(toCloned);
  removed(from);
  added(toCloned);
}
async function patchNodeValue(from, to) {
  let value = to.nodeValue;
  if (from.nodeValue !== value) {
    from.nodeValue = value;
    await breakpoint("Change text node to: " + value);
  }
}
async function patchAttributes(from, to) {
  if (from._x_isShown && !to._x_isShown) {
    return;
  }
  if (!from._x_isShown && to._x_isShown) {
    return;
  }
  let domAttributes = Array.from(from.attributes);
  let toAttributes = Array.from(to.attributes);
  for (let i = domAttributes.length - 1; i >= 0; i--) {
    let name = domAttributes[i].name;
    if (!to.hasAttribute(name)) {
      from.removeAttribute(name);
      await breakpoint("Remove attribute");
    }
  }
  for (let i = toAttributes.length - 1; i >= 0; i--) {
    let name = toAttributes[i].name;
    let value = toAttributes[i].value;
    if (from.getAttribute(name) !== value) {
      from.setAttribute(name, value);
      await breakpoint(`Set [${name}] attribute to: "${value}"`);
    }
  }
}
async function patchChildren(from, to) {
  let domChildren = from.childNodes;
  let toChildren = to.childNodes;
  let toKeyToNodeMap = keyToMap(toChildren);
  let domKeyDomNodeMap = keyToMap(domChildren);
  let currentTo = dom(to).nodes().first();
  let currentFrom = dom(from).nodes().first();
  let domKeyHoldovers = {};
  while (currentTo) {
    let toKey = getKey(currentTo);
    let domKey = getKey(currentFrom);
    if (!currentFrom) {
      if (toKey && domKeyHoldovers[toKey]) {
        let holdover = domKeyHoldovers[toKey];
        dom(from).append(holdover);
        currentFrom = holdover;
        await breakpoint("Add element (from key)");
      } else {
        let added2 = addNodeTo(currentTo, from) || {};
        await breakpoint("Add element: " + added2.outerHTML || added2.nodeValue);
        currentTo = dom(currentTo).nodes().next();
        continue;
      }
    }
    if (lookahead) {
      let nextToElementSibling = dom(currentTo).next();
      let found = false;
      while (!found && nextToElementSibling) {
        if (currentFrom.isEqualNode(nextToElementSibling)) {
          found = true;
          currentFrom = addNodeBefore(currentTo, currentFrom);
          domKey = getKey(currentFrom);
          await breakpoint("Move element (lookahead)");
        }
        nextToElementSibling = dom(nextToElementSibling).next();
      }
    }
    if (toKey !== domKey) {
      if (!toKey && domKey) {
        domKeyHoldovers[domKey] = currentFrom;
        currentFrom = addNodeBefore(currentTo, currentFrom);
        domKeyHoldovers[domKey].remove();
        currentFrom = dom(currentFrom).nodes().next();
        currentTo = dom(currentTo).nodes().next();
        await breakpoint('No "to" key');
        continue;
      }
      if (toKey && !domKey) {
        if (domKeyDomNodeMap[toKey]) {
          currentFrom = dom(currentFrom).replace(domKeyDomNodeMap[toKey]);
          await breakpoint('No "from" key');
        }
      }
      if (toKey && domKey) {
        domKeyHoldovers[domKey] = currentFrom;
        let domKeyNode = domKeyDomNodeMap[toKey];
        if (domKeyNode) {
          currentFrom = dom(currentFrom).replace(domKeyNode);
          await breakpoint('Move "from" key');
        } else {
          domKeyHoldovers[domKey] = currentFrom;
          currentFrom = addNodeBefore(currentTo, currentFrom);
          domKeyHoldovers[domKey].remove();
          currentFrom = dom(currentFrom).next();
          currentTo = dom(currentTo).next();
          await breakpoint("I dont even know what this does");
          continue;
        }
      }
    }
    await patch(currentFrom, currentTo);
    currentTo = currentTo && dom(currentTo).nodes().next();
    currentFrom = currentFrom && dom(currentFrom).nodes().next();
  }
  let removals = [];
  while (currentFrom) {
    if (!shouldSkip(removing, currentFrom))
      removals.push(currentFrom);
    currentFrom = dom(currentFrom).nodes().next();
  }
  while (removals.length) {
    let domForRemoval = removals.pop();
    domForRemoval.remove();
    await breakpoint("remove el");
    removed(domForRemoval);
  }
}
function getKey(el) {
  return el && el.nodeType === 1 && key(el);
}
function keyToMap(els) {
  let map = {};
  els.forEach((el) => {
    let theKey = getKey(el);
    if (theKey) {
      map[theKey] = el;
    }
  });
  return map;
}
function shouldSkip(hook, ...args) {
  let skip = false;
  hook(...args, () => skip = true);
  return skip;
}
function addNodeTo(node, parent) {
  if (!shouldSkip(adding, node)) {
    let clone = node.cloneNode(true);
    dom(parent).append(clone);
    added(clone);
    return clone;
  }
  return null;
}
function addNodeBefore(node, beforeMe) {
  if (!shouldSkip(adding, node)) {
    let clone = node.cloneNode(true);
    dom(beforeMe).before(clone);
    added(clone);
    return clone;
  }
  return beforeMe;
}
function initializeAlpineOnTo(from, to, childrenOnly) {
  if (from.nodeType !== 1)
    return;
  if (from._x_dataStack) {
    window.Alpine.clone(from, to);
  }
}
function dom(el) {
  return new DomManager(el);
}
var DomManager = class {
  constructor(el) {
    __publicField(this, "el");
    __publicField(this, "traversals", {
      first: "firstElementChild",
      next: "nextElementSibling",
      parent: "parentElement"
    });
    this.el = el;
  }
  nodes() {
    this.traversals = {
      first: "firstChild",
      next: "nextSibling",
      parent: "parentNode"
    };
    return this;
  }
  first() {
    return this.teleportTo(this.el[this.traversals["first"]]);
  }
  next() {
    return this.teleportTo(this.teleportBack(this.el[this.traversals["next"]]));
  }
  before(insertee) {
    this.el[this.traversals["parent"]].insertBefore(insertee, this.el);
    return insertee;
  }
  replace(replacement) {
    this.el[this.traversals["parent"]].replaceChild(replacement, this.el);
    return replacement;
  }
  append(appendee) {
    this.el.appendChild(appendee);
    return appendee;
  }
  teleportTo(el) {
    if (!el)
      return el;
    if (el._x_teleport)
      return el._x_teleport;
    return el;
  }
  teleportBack(el) {
    if (!el)
      return el;
    if (el._x_teleportBack)
      return el._x_teleportBack;
    return el;
  }
};

// packages/morph/src/index.js
function src_default(Alpine) {
  Alpine.morph = morph;
}

// packages/morph/builds/module.js
var module_default = src_default;
