import { aP as generateCspDigest, af as spreadAttributes, bk as unescapeHTML, a9 as renderTemplate, bl as removeBase, bm as isRemotePath, b9 as unflatten, bn as object, bo as date, bp as array, k as AstroError, bq as UnknownContentCollectionError, br as string, bs as strictObject, bt as AstroUserError, n as defineMiddleware, ax as sequence } from './chunks/params-and-props_Bt8tuwJz.mjs';
import { c as createComponent, V as VALID_INPUT_FORMATS } from './chunks/consts_Ci_4uCWA.mjs';

var e=e=>Object.prototype.toString.call(e),t=e=>ArrayBuffer.isView(e)&&!(e instanceof DataView),o=t=>"[object Date]"===e(t),n=t=>"[object RegExp]"===e(t),r=t=>"[object Error]"===e(t),s=t=>"[object Boolean]"===e(t),l=t=>"[object Number]"===e(t),i=t=>"[object String]"===e(t),c=Array.isArray,u=Object.getOwnPropertyDescriptor,a=Object.prototype.propertyIsEnumerable,f=Object.getOwnPropertySymbols,p=Object.prototype.hasOwnProperty,h=Object.keys;function d(e){const t=h(e),o=f(e);for(let n=0;n<o.length;n++)a.call(e,o[n])&&t.push(o[n]);return t}function b(e,t){return !u(e,t)?.writable}function y(e,u){if("object"==typeof e&&null!==e){let a;if(c(e))a=[];else if(o(e))a=new Date(e.getTime?e.getTime():e);else if(n(e))a=new RegExp(e);else if(r(e))a={message:e.message};else if(s(e)||l(e)||i(e))a=Object(e);else {if(t(e))return e.slice();a=Object.create(Object.getPrototypeOf(e));}const f=u.includeSymbols?d:h;for(const t of f(e))a[t]=e[t];return a}return e}var g={includeSymbols:false,immutable:false};function m(e,t,o=g){const n=[],r=[];let s=true;const l=o.includeSymbols?d:h,i=!!o.immutable;return function e(u){const a=i?y(u,o):u,f={};let h=true;const d={node:a,node_:u,path:[].concat(n),parent:r[r.length-1],parents:r,key:n[n.length-1],isRoot:0===n.length,level:n.length,circular:void 0,isLeaf:false,notLeaf:true,notRoot:true,isFirst:false,isLast:false,update:function(e,t=false){d.isRoot||(d.parent.node[d.key]=e),d.node=e,t&&(h=false);},delete:function(e){delete d.parent.node[d.key],e&&(h=false);},remove:function(e){c(d.parent.node)?d.parent.node.splice(d.key,1):delete d.parent.node[d.key],e&&(h=false);},keys:null,before:function(e){f.before=e;},after:function(e){f.after=e;},pre:function(e){f.pre=e;},post:function(e){f.post=e;},stop:function(){s=false;},block:function(){h=false;}};if(!s)return d;function g(){if("object"==typeof d.node&&null!==d.node){d.keys&&d.node_===d.node||(d.keys=l(d.node)),d.isLeaf=0===d.keys.length;for(let e=0;e<r.length;e++)if(r[e].node_===u){d.circular=r[e];break}}else d.isLeaf=true,d.keys=null;d.notLeaf=!d.isLeaf,d.notRoot=!d.isRoot;}g();const m=t(d,d.node);if(void 0!==m&&d.update&&d.update(m),f.before&&f.before(d,d.node),!h)return d;if("object"==typeof d.node&&null!==d.node&&!d.circular){r.push(d),g();for(const[t,o]of Object.entries(d.keys??[])){n.push(o),f.pre&&f.pre(d,d.node[o],o);const r=e(d.node[o]);i&&p.call(d.node,o)&&!b(d.node,o)&&(d.node[o]=r.node),r.isLast=!!d.keys?.length&&+t==d.keys.length-1,r.isFirst=0==+t,f.post&&f.post(d,r),n.pop();}r.pop();}return f.after&&f.after(d,d.node),d}(e).node}var j=class{#e;#t;constructor(e,t=g){this.#e=e,this.#t=t;}get(e){let t=this.#e;for(let o=0;t&&o<e.length;o++){const n=e[o];if(!p.call(t,n)||!this.#t.includeSymbols&&"symbol"==typeof n)return;t=t[n];}return t}has(e){let t=this.#e;for(let o=0;t&&o<e.length;o++){const n=e[o];if(!p.call(t,n)||!this.#t.includeSymbols&&"symbol"==typeof n)return  false;t=t[n];}return  true}set(e,t){let o=this.#e,n=0;for(n=0;n<e.length-1;n++){const t=e[n];p.call(o,t)||(o[t]={}),o=o[t];}return o[e[n]]=t,t}map(e){return m(this.#e,e,{immutable:true,includeSymbols:!!this.#t.includeSymbols})}forEach(e){return this.#e=m(this.#e,e,this.#t),this.#e}reduce(e,t){const o=1===arguments.length;let n=o?this.#e:t;return this.forEach(((t,r)=>{t.isRoot&&o||(n=e(t,n,r));})),n}paths(){const e=[];return this.forEach((t=>{e.push(t.path);})),e}nodes(){const e=[];return this.forEach((t=>{e.push(t.node);})),e}clone(){const e=[],o=[],n=this.#t;return t(this.#e)?this.#e.slice():function t(r){for(let t=0;t<e.length;t++)if(e[t]===r)return o[t];if("object"==typeof r&&null!==r){const s=y(r,n);e.push(r),o.push(s);const l=n.includeSymbols?d:h;for(const e of l(r))s[e]=t(r[e]);return e.pop(),o.pop(),s}return r}(this.#e)}};

function createSvgComponent({ meta, attributes, children, styles }) {
  const hasStyles = styles.length > 0;
  const Component = createComponent({
    async factory(result, props) {
      const normalizedProps = normalizeProps(attributes, props);
      if (hasStyles && result.cspDestination) {
        for (const style of styles) {
          const hash = await generateCspDigest(style, result.cspAlgorithm);
          result._metadata.extraStyleHashes.push(hash);
        }
      }
      return renderTemplate`<svg${spreadAttributes(normalizedProps)}>${unescapeHTML(children)}</svg>`;
    },
    propagation: hasStyles ? "self" : "none"
  });
  Object.defineProperty(Component, "toJSON", {
    value: () => meta,
    enumerable: false
  });
  return Object.assign(Component, meta);
}
const ATTRS_TO_DROP = ["xmlns", "xmlns:xlink", "version"];
const DEFAULT_ATTRS = {};
function dropAttributes(attributes) {
  for (const attr of ATTRS_TO_DROP) {
    delete attributes[attr];
  }
  return attributes;
}
function normalizeProps(attributes, props) {
  return dropAttributes({ ...DEFAULT_ATTRS, ...attributes, ...props });
}

const CONTENT_IMAGE_FLAG = "astroContentImageFlag";
const IMAGE_IMPORT_PREFIX = "__ASTRO_IMAGE_";

function imageSrcToImportId(imageSrc, filePath) {
  imageSrc = removeBase(imageSrc, IMAGE_IMPORT_PREFIX);
  if (isRemotePath(imageSrc)) {
    return;
  }
  const ext = imageSrc.split(".").at(-1)?.toLowerCase();
  if (!ext || !VALID_INPUT_FORMATS.includes(ext)) {
    return;
  }
  const params = new URLSearchParams(CONTENT_IMAGE_FLAG);
  if (filePath) {
    params.set("importer", filePath);
  }
  return `${imageSrc}?${params.toString()}`;
}

class ImmutableDataStore {
  _collections = /* @__PURE__ */ new Map();
  constructor() {
    this._collections = /* @__PURE__ */ new Map();
  }
  get(collectionName, key) {
    return this._collections.get(collectionName)?.get(String(key));
  }
  entries(collectionName) {
    const collection = this._collections.get(collectionName) ?? /* @__PURE__ */ new Map();
    return [...collection.entries()];
  }
  values(collectionName) {
    const collection = this._collections.get(collectionName) ?? /* @__PURE__ */ new Map();
    return [...collection.values()];
  }
  keys(collectionName) {
    const collection = this._collections.get(collectionName) ?? /* @__PURE__ */ new Map();
    return [...collection.keys()];
  }
  has(collectionName, key) {
    const collection = this._collections.get(collectionName);
    if (collection) {
      return collection.has(String(key));
    }
    return false;
  }
  hasCollection(collectionName) {
    return this._collections.has(collectionName);
  }
  collections() {
    return this._collections;
  }
  /**
   * Attempts to load a DataStore from the virtual module.
   * This only works in Vite.
   */
  static async fromModule() {
    try {
      const data = await import('./chunks/_astro_data-layer-content_Cpye4NUb.mjs');
      if (data.default instanceof Map) {
        return ImmutableDataStore.fromMap(data.default);
      }
      const map = unflatten(data.default);
      return ImmutableDataStore.fromMap(map);
    } catch {
    }
    return new ImmutableDataStore();
  }
  static async fromMap(data) {
    const store = new ImmutableDataStore();
    store._collections = data;
    return store;
  }
}
function dataStoreSingleton() {
  let instance = void 0;
  return {
    get: async () => {
      if (!instance) {
        instance = ImmutableDataStore.fromModule();
      }
      return instance;
    },
    set: (store) => {
      instance = store;
    }
  };
}
const globalDataStore = dataStoreSingleton();

object({
  tags: array(string()).optional(),
  lastModified: date().optional()
});
function createGetCollection({
  liveCollections
}) {
  return async function getCollection(collection, filter) {
    if (collection in liveCollections) {
      throw new AstroError({
        ...UnknownContentCollectionError,
        message: `Collection "${collection}" is a live collection. Use getLiveCollection() instead of getCollection().`
      });
    }
    const hasFilter = typeof filter === "function";
    const store = await globalDataStore.get();
    if (store.hasCollection(collection)) {
      const { default: imageAssetMap } = await import('./chunks/content-assets_DleWbedO.mjs');
      const result = [];
      for (const rawEntry of store.values(collection)) {
        const data = updateImageReferencesInData(rawEntry.data, rawEntry.filePath, imageAssetMap);
        let entry = {
          ...rawEntry,
          data,
          collection
        };
        if (hasFilter && !filter(entry)) {
          continue;
        }
        result.push(entry);
      }
      return result;
    } else {
      console.warn(
        `The collection ${JSON.stringify(
          collection
        )} does not exist or is empty. Please check your content config file for errors.`
      );
      return [];
    }
  };
}
function updateImageReferencesInData(data, fileName, imageAssetMap) {
  const copy = structuredClone(data);
  new j(copy).forEach(function(ctx, val) {
    if (typeof val === "string" && val.startsWith(IMAGE_IMPORT_PREFIX)) {
      const src = val.replace(IMAGE_IMPORT_PREFIX, "");
      const id = imageSrcToImportId(src, fileName);
      if (!id) {
        ctx.update(src);
        return;
      }
      const imported = imageAssetMap?.get(id);
      if (imported) {
        if (imported.__svgData) {
          const { __svgData: svgData, ...meta } = imported;
          ctx.update(createSvgComponent({ meta, ...svgData }));
        } else {
          ctx.update(imported);
        }
      } else {
        ctx.update(src);
      }
    }
  });
  return copy;
}

// astro-head-inject

const liveCollections = {};

const getCollection = createGetCollection({
	liveCollections,
});

const starlightConfig = {"defaultLocale":{"label":"English","lang":"en","dir":"ltr"}};

const project = {"root":"file:///vercel/sandbox/primary/docs/","srcDir":"file:///vercel/sandbox/primary/docs/src/"};

const pluginTranslations = {};

const isString = obj => typeof obj === 'string';
const defer = () => {
  let res;
  let rej;
  const promise = new Promise((resolve, reject) => {
    res = resolve;
    rej = reject;
  });
  promise.resolve = res;
  promise.reject = rej;
  return promise;
};
const makeString = object => {
  if (object == null) return '';
  return String(object);
};
const copy = (a, s, t) => {
  a.forEach(m => {
    if (s[m]) t[m] = s[m];
  });
};
const lastOfPathSeparatorRegExp = /###/g;
const cleanKey = key => key && key.includes('###') ? key.replace(lastOfPathSeparatorRegExp, '.') : key;
const canNotTraverseDeeper = object => !object || isString(object);
const getLastOfPath = (object, path, Empty) => {
  const stack = !isString(path) ? path : path.split('.');
  let stackIndex = 0;
  while (stackIndex < stack.length - 1) {
    if (canNotTraverseDeeper(object)) return {};
    const key = cleanKey(stack[stackIndex]);
    if (!object[key] && Empty) object[key] = new Empty();
    if (Object.prototype.hasOwnProperty.call(object, key)) {
      object = object[key];
    } else {
      object = {};
    }
    ++stackIndex;
  }
  if (canNotTraverseDeeper(object)) return {};
  return {
    obj: object,
    k: cleanKey(stack[stackIndex])
  };
};
const setPath = (object, path, newValue) => {
  const {
    obj,
    k
  } = getLastOfPath(object, path, Object);
  if (obj !== undefined || path.length === 1) {
    obj[k] = newValue;
    return;
  }
  let e = path[path.length - 1];
  let p = path.slice(0, path.length - 1);
  let last = getLastOfPath(object, p, Object);
  while (last.obj === undefined && p.length) {
    e = `${p[p.length - 1]}.${e}`;
    p = p.slice(0, p.length - 1);
    last = getLastOfPath(object, p, Object);
    if (last?.obj && typeof last.obj[`${last.k}.${e}`] !== 'undefined') {
      last.obj = undefined;
    }
  }
  last.obj[`${last.k}.${e}`] = newValue;
};
const pushPath = (object, path, newValue, concat) => {
  const {
    obj,
    k
  } = getLastOfPath(object, path, Object);
  obj[k] = obj[k] || [];
  obj[k].push(newValue);
};
const getPath = (object, path) => {
  const {
    obj,
    k
  } = getLastOfPath(object, path);
  if (!obj) return undefined;
  if (!Object.prototype.hasOwnProperty.call(obj, k)) return undefined;
  return obj[k];
};
const getPathWithDefaults = (data, defaultData, key) => {
  const value = getPath(data, key);
  if (value !== undefined) {
    return value;
  }
  return getPath(defaultData, key);
};
const deepExtend = (target, source, overwrite) => {
  for (const prop in source) {
    if (prop !== '__proto__' && prop !== 'constructor') {
      if (prop in target) {
        if (isString(target[prop]) || target[prop] instanceof String || isString(source[prop]) || source[prop] instanceof String) {
          if (overwrite) target[prop] = source[prop];
        } else {
          deepExtend(target[prop], source[prop], overwrite);
        }
      } else {
        target[prop] = source[prop];
      }
    }
  }
  return target;
};
const regexEscape = str => str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&');
const _entityMap = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '/': '&#x2F;'
};
const escape = data => {
  if (isString(data)) {
    return data.replace(/[&<>"'\/]/g, s => _entityMap[s]);
  }
  return data;
};
class RegExpCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.regExpMap = new Map();
    this.regExpQueue = [];
  }
  getRegExp(pattern) {
    const regExpFromCache = this.regExpMap.get(pattern);
    if (regExpFromCache !== undefined) {
      return regExpFromCache;
    }
    const regExpNew = new RegExp(pattern);
    if (this.regExpQueue.length === this.capacity) {
      this.regExpMap.delete(this.regExpQueue.shift());
    }
    this.regExpMap.set(pattern, regExpNew);
    this.regExpQueue.push(pattern);
    return regExpNew;
  }
}
const chars = [' ', ',', '?', '!', ';'];
const looksLikeObjectPathRegExpCache = new RegExpCache(20);
const looksLikeObjectPath = (key, nsSeparator, keySeparator) => {
  nsSeparator = nsSeparator || '';
  keySeparator = keySeparator || '';
  const possibleChars = chars.filter(c => !nsSeparator.includes(c) && !keySeparator.includes(c));
  if (possibleChars.length === 0) return true;
  const r = looksLikeObjectPathRegExpCache.getRegExp(`(${possibleChars.map(c => c === '?' ? '\\?' : c).join('|')})`);
  let matched = !r.test(key);
  if (!matched) {
    const ki = key.indexOf(keySeparator);
    if (ki > 0 && !r.test(key.substring(0, ki))) {
      matched = true;
    }
  }
  return matched;
};
const deepFind = (obj, path, keySeparator = '.') => {
  if (!obj) return undefined;
  if (obj[path]) {
    if (!Object.prototype.hasOwnProperty.call(obj, path)) return undefined;
    return obj[path];
  }
  const tokens = path.split(keySeparator);
  let current = obj;
  for (let i = 0; i < tokens.length;) {
    if (!current || typeof current !== 'object') {
      return undefined;
    }
    let next;
    let nextPath = '';
    for (let j = i; j < tokens.length; ++j) {
      if (j !== i) {
        nextPath += keySeparator;
      }
      nextPath += tokens[j];
      next = current[nextPath];
      if (next !== undefined) {
        if (['string', 'number', 'boolean'].includes(typeof next) && j < tokens.length - 1) {
          continue;
        }
        i += j - i + 1;
        break;
      }
    }
    current = next;
  }
  return current;
};
const getCleanedCode = code => code?.replace(/_/g, '-');

const consoleLogger = {
  type: 'logger',
  log(args) {
    this.output('log', args);
  },
  warn(args) {
    this.output('warn', args);
  },
  error(args) {
    this.output('error', args);
  },
  output(type, args) {
    console?.[type]?.apply?.(console, args);
  }
};
class Logger {
  constructor(concreteLogger, options = {}) {
    this.init(concreteLogger, options);
  }
  init(concreteLogger, options = {}) {
    this.prefix = options.prefix || 'i18next:';
    this.logger = concreteLogger || consoleLogger;
    this.options = options;
    this.debug = options.debug;
  }
  log(...args) {
    return this.forward(args, 'log', '', true);
  }
  warn(...args) {
    return this.forward(args, 'warn', '', true);
  }
  error(...args) {
    return this.forward(args, 'error', '');
  }
  deprecate(...args) {
    return this.forward(args, 'warn', 'WARNING DEPRECATED: ', true);
  }
  forward(args, lvl, prefix, debugOnly) {
    if (debugOnly && !this.debug) return null;
    args = args.map(a => isString(a) ? a.replace(/[\r\n\x00-\x1F\x7F]/g, ' ') : a);
    if (isString(args[0])) args[0] = `${prefix}${this.prefix} ${args[0]}`;
    return this.logger[lvl](args);
  }
  create(moduleName) {
    return new Logger(this.logger, {
      ...{
        prefix: `${this.prefix}:${moduleName}:`
      },
      ...this.options
    });
  }
  clone(options) {
    options = options || this.options;
    options.prefix = options.prefix || this.prefix;
    return new Logger(this.logger, options);
  }
}
var baseLogger = new Logger();

class EventEmitter {
  constructor() {
    this.observers = {};
  }
  on(events, listener) {
    events.split(' ').forEach(event => {
      if (!this.observers[event]) this.observers[event] = new Map();
      const numListeners = this.observers[event].get(listener) || 0;
      this.observers[event].set(listener, numListeners + 1);
    });
    return this;
  }
  off(event, listener) {
    if (!this.observers[event]) return;
    if (!listener) {
      delete this.observers[event];
      return;
    }
    this.observers[event].delete(listener);
  }
  once(event, listener) {
    const wrapper = (...args) => {
      listener(...args);
      this.off(event, wrapper);
    };
    this.on(event, wrapper);
    return this;
  }
  emit(event, ...args) {
    if (this.observers[event]) {
      const cloned = Array.from(this.observers[event].entries());
      cloned.forEach(([observer, numTimesAdded]) => {
        for (let i = 0; i < numTimesAdded; i++) {
          observer(...args);
        }
      });
    }
    if (this.observers['*']) {
      const cloned = Array.from(this.observers['*'].entries());
      cloned.forEach(([observer, numTimesAdded]) => {
        for (let i = 0; i < numTimesAdded; i++) {
          observer(event, ...args);
        }
      });
    }
  }
}

class ResourceStore extends EventEmitter {
  constructor(data, options = {
    ns: ['translation'],
    defaultNS: 'translation'
  }) {
    super();
    this.data = data || {};
    this.options = options;
    if (this.options.keySeparator === undefined) {
      this.options.keySeparator = '.';
    }
    if (this.options.ignoreJSONStructure === undefined) {
      this.options.ignoreJSONStructure = true;
    }
  }
  addNamespaces(ns) {
    if (!this.options.ns.includes(ns)) {
      this.options.ns.push(ns);
    }
  }
  removeNamespaces(ns) {
    const index = this.options.ns.indexOf(ns);
    if (index > -1) {
      this.options.ns.splice(index, 1);
    }
  }
  getResource(lng, ns, key, options = {}) {
    const keySeparator = options.keySeparator !== undefined ? options.keySeparator : this.options.keySeparator;
    const ignoreJSONStructure = options.ignoreJSONStructure !== undefined ? options.ignoreJSONStructure : this.options.ignoreJSONStructure;
    let path;
    if (lng.includes('.')) {
      path = lng.split('.');
    } else {
      path = [lng, ns];
      if (key) {
        if (Array.isArray(key)) {
          path.push(...key);
        } else if (isString(key) && keySeparator) {
          path.push(...key.split(keySeparator));
        } else {
          path.push(key);
        }
      }
    }
    const result = getPath(this.data, path);
    if (!result && !ns && !key && lng.includes('.')) {
      lng = path[0];
      ns = path[1];
      key = path.slice(2).join('.');
    }
    if (result || !ignoreJSONStructure || !isString(key)) return result;
    return deepFind(this.data?.[lng]?.[ns], key, keySeparator);
  }
  addResource(lng, ns, key, value, options = {
    silent: false
  }) {
    const keySeparator = options.keySeparator !== undefined ? options.keySeparator : this.options.keySeparator;
    let path = [lng, ns];
    if (key) path = path.concat(keySeparator ? key.split(keySeparator) : key);
    if (lng.includes('.')) {
      path = lng.split('.');
      value = ns;
      ns = path[1];
    }
    this.addNamespaces(ns);
    setPath(this.data, path, value);
    if (!options.silent) this.emit('added', lng, ns, key, value);
  }
  addResources(lng, ns, resources, options = {
    silent: false
  }) {
    for (const m in resources) {
      if (isString(resources[m]) || Array.isArray(resources[m])) this.addResource(lng, ns, m, resources[m], {
        silent: true
      });
    }
    if (!options.silent) this.emit('added', lng, ns, resources);
  }
  addResourceBundle(lng, ns, resources, deep, overwrite, options = {
    silent: false,
    skipCopy: false
  }) {
    let path = [lng, ns];
    if (lng.includes('.')) {
      path = lng.split('.');
      deep = resources;
      resources = ns;
      ns = path[1];
    }
    this.addNamespaces(ns);
    let pack = getPath(this.data, path) || {};
    if (!options.skipCopy) resources = JSON.parse(JSON.stringify(resources));
    if (deep) {
      deepExtend(pack, resources, overwrite);
    } else {
      pack = {
        ...pack,
        ...resources
      };
    }
    setPath(this.data, path, pack);
    if (!options.silent) this.emit('added', lng, ns, resources);
  }
  removeResourceBundle(lng, ns) {
    if (this.hasResourceBundle(lng, ns)) {
      delete this.data[lng][ns];
    }
    this.removeNamespaces(ns);
    this.emit('removed', lng, ns);
  }
  hasResourceBundle(lng, ns) {
    return this.getResource(lng, ns) !== undefined;
  }
  getResourceBundle(lng, ns) {
    if (!ns) ns = this.options.defaultNS;
    return this.getResource(lng, ns);
  }
  getDataByLanguage(lng) {
    return this.data[lng];
  }
  hasLanguageSomeTranslations(lng) {
    const data = this.getDataByLanguage(lng);
    const n = data && Object.keys(data) || [];
    return !!n.find(v => data[v] && Object.keys(data[v]).length > 0);
  }
  toJSON() {
    return this.data;
  }
}

var postProcessor = {
  processors: {},
  addPostProcessor(module) {
    this.processors[module.name] = module;
  },
  handle(processors, value, key, options, translator) {
    processors.forEach(processor => {
      value = this.processors[processor]?.process(value, key, options, translator) ?? value;
    });
    return value;
  }
};

const PATH_KEY = Symbol('i18next/PATH_KEY');
function createProxy() {
  const state = [];
  const handler = Object.create(null);
  let proxy;
  handler.get = (target, key) => {
    proxy?.revoke?.();
    if (key === PATH_KEY) return state;
    state.push(key);
    proxy = Proxy.revocable(target, handler);
    return proxy.proxy;
  };
  return Proxy.revocable(Object.create(null), handler).proxy;
}
function keysFromSelector(selector, opts) {
  const {
    [PATH_KEY]: path
  } = selector(createProxy());
  const keySeparator = opts?.keySeparator ?? '.';
  const nsSeparator = opts?.nsSeparator ?? ':';
  const strict = opts?.enableSelector === 'strict';
  if (path.length > 1 && nsSeparator) {
    const ns = opts?.ns;
    const nsList = strict ? Array.isArray(ns) ? ns : ns ? [ns] : null : Array.isArray(ns) ? ns : null;
    if (nsList) {
      const candidates = strict ? nsList : nsList.length > 1 ? nsList.slice(1) : [];
      if (candidates.includes(path[0])) {
        return `${path[0]}${nsSeparator}${path.slice(1).join(keySeparator)}`;
      }
    }
  }
  return path.join(keySeparator);
}

const shouldHandleAsObject = res => !isString(res) && typeof res !== 'boolean' && typeof res !== 'number';
class Translator extends EventEmitter {
  constructor(services, options = {}) {
    super();
    copy(['resourceStore', 'languageUtils', 'pluralResolver', 'interpolator', 'backendConnector', 'i18nFormat', 'utils'], services, this);
    this.options = options;
    if (this.options.keySeparator === undefined) {
      this.options.keySeparator = '.';
    }
    this.logger = baseLogger.create('translator');
    this.checkedLoadedFor = {};
  }
  changeLanguage(lng) {
    if (lng) this.language = lng;
  }
  exists(key, o = {
    interpolation: {}
  }) {
    const opt = {
      ...o
    };
    if (key == null) return false;
    const resolved = this.resolve(key, opt);
    if (resolved?.res === undefined) return false;
    const isObject = shouldHandleAsObject(resolved.res);
    if (opt.returnObjects === false && isObject) {
      return false;
    }
    return true;
  }
  extractFromKey(key, opt) {
    let nsSeparator = opt.nsSeparator !== undefined ? opt.nsSeparator : this.options.nsSeparator;
    if (nsSeparator === undefined) nsSeparator = ':';
    const keySeparator = opt.keySeparator !== undefined ? opt.keySeparator : this.options.keySeparator;
    let namespaces = opt.ns || this.options.defaultNS || [];
    const wouldCheckForNsInKey = nsSeparator && key.includes(nsSeparator);
    const seemsNaturalLanguage = !this.options.userDefinedKeySeparator && !opt.keySeparator && !this.options.userDefinedNsSeparator && !opt.nsSeparator && !looksLikeObjectPath(key, nsSeparator, keySeparator);
    if (wouldCheckForNsInKey && !seemsNaturalLanguage) {
      const m = key.match(this.interpolator.nestingRegexp);
      if (m && m.length > 0) {
        return {
          key,
          namespaces: isString(namespaces) ? [namespaces] : namespaces
        };
      }
      const parts = key.split(nsSeparator);
      if (nsSeparator !== keySeparator || nsSeparator === keySeparator && this.options.ns.includes(parts[0])) namespaces = parts.shift();
      key = parts.join(keySeparator);
    }
    return {
      key,
      namespaces: isString(namespaces) ? [namespaces] : namespaces
    };
  }
  translate(keys, o, lastKey) {
    let opt = typeof o === 'object' ? {
      ...o
    } : o;
    if (typeof opt !== 'object' && this.options.overloadTranslationOptionHandler) {
      opt = this.options.overloadTranslationOptionHandler(arguments);
    }
    if (typeof opt === 'object') opt = {
      ...opt
    };
    if (!opt) opt = {};
    if (keys == null) return '';
    if (typeof keys === 'function') keys = keysFromSelector(keys, {
      ...this.options,
      ...opt
    });
    if (!Array.isArray(keys)) keys = [String(keys)];
    keys = keys.map(k => typeof k === 'function' ? keysFromSelector(k, {
      ...this.options,
      ...opt
    }) : String(k));
    const returnDetails = opt.returnDetails !== undefined ? opt.returnDetails : this.options.returnDetails;
    const keySeparator = opt.keySeparator !== undefined ? opt.keySeparator : this.options.keySeparator;
    const {
      key,
      namespaces
    } = this.extractFromKey(keys[keys.length - 1], opt);
    const namespace = namespaces[namespaces.length - 1];
    let nsSeparator = opt.nsSeparator !== undefined ? opt.nsSeparator : this.options.nsSeparator;
    if (nsSeparator === undefined) nsSeparator = ':';
    const lng = opt.lng || this.language;
    const appendNamespaceToCIMode = opt.appendNamespaceToCIMode || this.options.appendNamespaceToCIMode;
    if (lng?.toLowerCase() === 'cimode') {
      if (appendNamespaceToCIMode) {
        if (returnDetails) {
          return {
            res: `${namespace}${nsSeparator}${key}`,
            usedKey: key,
            exactUsedKey: key,
            usedLng: lng,
            usedNS: namespace,
            usedParams: this.getUsedParamsDetails(opt)
          };
        }
        return `${namespace}${nsSeparator}${key}`;
      }
      if (returnDetails) {
        return {
          res: key,
          usedKey: key,
          exactUsedKey: key,
          usedLng: lng,
          usedNS: namespace,
          usedParams: this.getUsedParamsDetails(opt)
        };
      }
      return key;
    }
    const resolved = this.resolve(keys, opt);
    let res = resolved?.res;
    const resUsedKey = resolved?.usedKey || key;
    const resExactUsedKey = resolved?.exactUsedKey || key;
    const noObject = ['[object Number]', '[object Function]', '[object RegExp]'];
    const joinArrays = opt.joinArrays !== undefined ? opt.joinArrays : this.options.joinArrays;
    const handleAsObjectInI18nFormat = !this.i18nFormat || this.i18nFormat.handleAsObject;
    const needsPluralHandling = opt.count !== undefined && !isString(opt.count);
    const hasDefaultValue = Translator.hasDefaultValue(opt);
    const defaultValueSuffix = needsPluralHandling ? this.pluralResolver.getSuffix(lng, opt.count, opt) : '';
    const defaultValueSuffixOrdinalFallback = opt.ordinal && needsPluralHandling ? this.pluralResolver.getSuffix(lng, opt.count, {
      ordinal: false
    }) : '';
    const needsZeroSuffixLookup = needsPluralHandling && !opt.ordinal && opt.count === 0;
    const defaultValue = needsZeroSuffixLookup && opt[`defaultValue${this.options.pluralSeparator}zero`] || opt[`defaultValue${defaultValueSuffix}`] || opt[`defaultValue${defaultValueSuffixOrdinalFallback}`] || opt.defaultValue;
    let resForObjHndl = res;
    if (handleAsObjectInI18nFormat && !res && hasDefaultValue) {
      resForObjHndl = defaultValue;
    }
    const handleAsObject = shouldHandleAsObject(resForObjHndl);
    const resType = Object.prototype.toString.apply(resForObjHndl);
    if (handleAsObjectInI18nFormat && resForObjHndl && handleAsObject && !noObject.includes(resType) && !(isString(joinArrays) && Array.isArray(resForObjHndl))) {
      if (!opt.returnObjects && !this.options.returnObjects) {
        if (!this.options.returnedObjectHandler) {
          this.logger.warn('accessing an object - but returnObjects options is not enabled!');
        }
        const r = this.options.returnedObjectHandler ? this.options.returnedObjectHandler(resUsedKey, resForObjHndl, {
          ...opt,
          ns: namespaces
        }) : `key '${key} (${this.language})' returned an object instead of string.`;
        if (returnDetails) {
          resolved.res = r;
          resolved.usedParams = this.getUsedParamsDetails(opt);
          return resolved;
        }
        return r;
      }
      if (keySeparator) {
        const resTypeIsArray = Array.isArray(resForObjHndl);
        const copy = resTypeIsArray ? [] : {};
        const newKeyToUse = resTypeIsArray ? resExactUsedKey : resUsedKey;
        for (const m in resForObjHndl) {
          if (Object.prototype.hasOwnProperty.call(resForObjHndl, m)) {
            const deepKey = `${newKeyToUse}${keySeparator}${m}`;
            if (hasDefaultValue && !res) {
              copy[m] = this.translate(deepKey, {
                ...opt,
                defaultValue: shouldHandleAsObject(defaultValue) ? defaultValue[m] : undefined,
                ...{
                  joinArrays: false,
                  ns: namespaces
                }
              });
            } else {
              copy[m] = this.translate(deepKey, {
                ...opt,
                ...{
                  joinArrays: false,
                  ns: namespaces
                }
              });
            }
            if (copy[m] === deepKey) copy[m] = resForObjHndl[m];
          }
        }
        res = copy;
      }
    } else if (handleAsObjectInI18nFormat && isString(joinArrays) && Array.isArray(res)) {
      res = res.join(joinArrays);
      if (res) res = this.extendTranslation(res, keys, opt, lastKey);
    } else {
      let usedDefault = false;
      let usedKey = false;
      if (!this.isValidLookup(res) && hasDefaultValue) {
        usedDefault = true;
        res = defaultValue;
      }
      if (!this.isValidLookup(res)) {
        usedKey = true;
        res = key;
      }
      const missingKeyNoValueFallbackToKey = opt.missingKeyNoValueFallbackToKey || this.options.missingKeyNoValueFallbackToKey;
      const resForMissing = missingKeyNoValueFallbackToKey && usedKey ? undefined : res;
      const updateMissing = hasDefaultValue && defaultValue !== res && this.options.updateMissing;
      if (usedKey || usedDefault || updateMissing) {
        this.logger.log(updateMissing ? 'updateKey' : 'missingKey', lng, namespace, needsPluralHandling && !updateMissing ? `${key}${this.pluralResolver.getSuffix(lng, opt.count, opt)}` : key, updateMissing ? defaultValue : res);
        if (keySeparator) {
          const fk = this.resolve(key, {
            ...opt,
            keySeparator: false
          });
          if (fk && fk.res) this.logger.warn('Seems the loaded translations were in flat JSON format instead of nested. Either set keySeparator: false on init or make sure your translations are published in nested format.');
        }
        let lngs = [];
        const fallbackLngs = this.languageUtils.getFallbackCodes(this.options.fallbackLng, opt.lng || this.language);
        if (this.options.saveMissingTo === 'fallback' && fallbackLngs && fallbackLngs[0]) {
          for (let i = 0; i < fallbackLngs.length; i++) {
            lngs.push(fallbackLngs[i]);
          }
        } else if (this.options.saveMissingTo === 'all') {
          lngs = this.languageUtils.toResolveHierarchy(opt.lng || this.language);
        } else {
          lngs.push(opt.lng || this.language);
        }
        const send = (l, k, specificDefaultValue) => {
          const defaultForMissing = hasDefaultValue && specificDefaultValue !== res ? specificDefaultValue : resForMissing;
          if (this.options.missingKeyHandler) {
            this.options.missingKeyHandler(l, namespace, k, defaultForMissing, updateMissing, opt);
          } else if (this.backendConnector?.saveMissing) {
            this.backendConnector.saveMissing(l, namespace, k, defaultForMissing, updateMissing, opt);
          }
          this.emit('missingKey', l, namespace, k, res);
        };
        if (this.options.saveMissing) {
          if (this.options.saveMissingPlurals && needsPluralHandling) {
            lngs.forEach(language => {
              const suffixes = this.pluralResolver.getSuffixes(language, opt);
              if (needsZeroSuffixLookup && opt[`defaultValue${this.options.pluralSeparator}zero`] && !suffixes.includes(`${this.options.pluralSeparator}zero`)) {
                suffixes.push(`${this.options.pluralSeparator}zero`);
              }
              suffixes.forEach(suffix => {
                send([language], key + suffix, opt[`defaultValue${suffix}`] || defaultValue);
              });
            });
          } else {
            send(lngs, key, defaultValue);
          }
        }
      }
      res = this.extendTranslation(res, keys, opt, resolved, lastKey);
      if (usedKey && res === key && this.options.appendNamespaceToMissingKey) {
        res = `${namespace}${nsSeparator}${key}`;
      }
      if ((usedKey || usedDefault) && this.options.parseMissingKeyHandler) {
        res = this.options.parseMissingKeyHandler(this.options.appendNamespaceToMissingKey ? `${namespace}${nsSeparator}${key}` : key, usedDefault ? res : undefined, opt);
      }
    }
    if (returnDetails) {
      resolved.res = res;
      resolved.usedParams = this.getUsedParamsDetails(opt);
      return resolved;
    }
    return res;
  }
  extendTranslation(res, key, opt, resolved, lastKey) {
    if (this.i18nFormat?.parse) {
      res = this.i18nFormat.parse(res, {
        ...this.options.interpolation.defaultVariables,
        ...opt
      }, opt.lng || this.language || resolved.usedLng, resolved.usedNS, resolved.usedKey, {
        resolved
      });
    } else if (!opt.skipInterpolation) {
      if (opt.interpolation) this.interpolator.init({
        ...opt,
        ...{
          interpolation: {
            ...this.options.interpolation,
            ...opt.interpolation
          }
        }
      });
      const skipOnVariables = isString(res) && (opt?.interpolation?.skipOnVariables !== undefined ? opt.interpolation.skipOnVariables : this.options.interpolation.skipOnVariables);
      let nestBef;
      if (skipOnVariables) {
        const nb = res.match(this.interpolator.nestingRegexp);
        nestBef = nb && nb.length;
      }
      let data = opt.replace && !isString(opt.replace) ? opt.replace : opt;
      if (this.options.interpolation.defaultVariables) data = {
        ...this.options.interpolation.defaultVariables,
        ...data
      };
      res = this.interpolator.interpolate(res, data, opt.lng || this.language || resolved.usedLng, opt);
      if (skipOnVariables) {
        const na = res.match(this.interpolator.nestingRegexp);
        const nestAft = na && na.length;
        if (nestBef < nestAft) opt.nest = false;
      }
      if (!opt.lng && resolved && resolved.res) opt.lng = this.language || resolved.usedLng;
      if (opt.nest !== false) res = this.interpolator.nest(res, (...args) => {
        if (lastKey?.[0] === args[0] && !opt.context) {
          this.logger.warn(`It seems you are nesting recursively key: ${args[0]} in key: ${key[0]}`);
          return null;
        }
        return this.translate(...args, key);
      }, opt);
      if (opt.interpolation) this.interpolator.reset();
    }
    const postProcess = opt.postProcess || this.options.postProcess;
    const postProcessorNames = isString(postProcess) ? [postProcess] : postProcess;
    if (res != null && postProcessorNames?.length && opt.applyPostProcessor !== false) {
      res = postProcessor.handle(postProcessorNames, res, key, this.options && this.options.postProcessPassResolved ? {
        i18nResolved: {
          ...resolved,
          usedParams: this.getUsedParamsDetails(opt)
        },
        ...opt
      } : opt, this);
    }
    return res;
  }
  resolve(keys, opt = {}) {
    let found;
    let usedKey;
    let exactUsedKey;
    let usedLng;
    let usedNS;
    if (isString(keys)) keys = [keys];
    if (Array.isArray(keys)) keys = keys.map(k => typeof k === 'function' ? keysFromSelector(k, {
      ...this.options,
      ...opt
    }) : k);
    keys.forEach(k => {
      if (this.isValidLookup(found)) return;
      const extracted = this.extractFromKey(k, opt);
      const key = extracted.key;
      usedKey = key;
      let namespaces = extracted.namespaces;
      if (this.options.fallbackNS) namespaces = namespaces.concat(this.options.fallbackNS);
      const needsPluralHandling = opt.count !== undefined && !isString(opt.count);
      const needsZeroSuffixLookup = needsPluralHandling && !opt.ordinal && opt.count === 0;
      const needsContextHandling = opt.context !== undefined && (isString(opt.context) || typeof opt.context === 'number') && opt.context !== '';
      const codes = opt.lngs ? opt.lngs : this.languageUtils.toResolveHierarchy(opt.lng || this.language, opt.fallbackLng);
      namespaces.forEach(ns => {
        if (this.isValidLookup(found)) return;
        usedNS = ns;
        if (!this.checkedLoadedFor[`${codes[0]}-${ns}`] && this.utils?.hasLoadedNamespace && !this.utils?.hasLoadedNamespace(usedNS)) {
          this.checkedLoadedFor[`${codes[0]}-${ns}`] = true;
          this.logger.warn(`key "${usedKey}" for languages "${codes.join(', ')}" won't get resolved as namespace "${usedNS}" was not yet loaded`, 'This means something IS WRONG in your setup. You access the t function before i18next.init / i18next.loadNamespace / i18next.changeLanguage was done. Wait for the callback or Promise to resolve before accessing it!!!');
        }
        codes.forEach(code => {
          if (this.isValidLookup(found)) return;
          usedLng = code;
          const finalKeys = [key];
          if (this.i18nFormat?.addLookupKeys) {
            this.i18nFormat.addLookupKeys(finalKeys, key, code, ns, opt);
          } else {
            let pluralSuffix;
            if (needsPluralHandling) pluralSuffix = this.pluralResolver.getSuffix(code, opt.count, opt);
            const zeroSuffix = `${this.options.pluralSeparator}zero`;
            const ordinalPrefix = `${this.options.pluralSeparator}ordinal${this.options.pluralSeparator}`;
            if (needsPluralHandling) {
              if (opt.ordinal && pluralSuffix.startsWith(ordinalPrefix)) {
                finalKeys.push(key + pluralSuffix.replace(ordinalPrefix, this.options.pluralSeparator));
              }
              finalKeys.push(key + pluralSuffix);
              if (needsZeroSuffixLookup) {
                finalKeys.push(key + zeroSuffix);
              }
            }
            if (needsContextHandling) {
              const contextKey = `${key}${this.options.contextSeparator || '_'}${opt.context}`;
              finalKeys.push(contextKey);
              if (needsPluralHandling) {
                if (opt.ordinal && pluralSuffix.startsWith(ordinalPrefix)) {
                  finalKeys.push(contextKey + pluralSuffix.replace(ordinalPrefix, this.options.pluralSeparator));
                }
                finalKeys.push(contextKey + pluralSuffix);
                if (needsZeroSuffixLookup) {
                  finalKeys.push(contextKey + zeroSuffix);
                }
              }
            }
          }
          let possibleKey;
          while (possibleKey = finalKeys.pop()) {
            if (!this.isValidLookup(found)) {
              exactUsedKey = possibleKey;
              found = this.getResource(code, ns, possibleKey, opt);
            }
          }
        });
      });
    });
    return {
      res: found,
      usedKey,
      exactUsedKey,
      usedLng,
      usedNS
    };
  }
  isValidLookup(res) {
    return res !== undefined && !(!this.options.returnNull && res === null) && !(!this.options.returnEmptyString && res === '');
  }
  getResource(code, ns, key, options = {}) {
    if (this.i18nFormat?.getResource) return this.i18nFormat.getResource(code, ns, key, options);
    return this.resourceStore.getResource(code, ns, key, options);
  }
  getUsedParamsDetails(options = {}) {
    const optionsKeys = ['defaultValue', 'ordinal', 'context', 'replace', 'lng', 'lngs', 'fallbackLng', 'ns', 'keySeparator', 'nsSeparator', 'returnObjects', 'returnDetails', 'joinArrays', 'postProcess', 'interpolation'];
    const useOptionsReplaceForData = options.replace && !isString(options.replace);
    let data = useOptionsReplaceForData ? options.replace : options;
    if (useOptionsReplaceForData && typeof options.count !== 'undefined') {
      data.count = options.count;
    }
    if (this.options.interpolation.defaultVariables) {
      data = {
        ...this.options.interpolation.defaultVariables,
        ...data
      };
    }
    if (!useOptionsReplaceForData) {
      data = {
        ...data
      };
      for (const key of optionsKeys) {
        delete data[key];
      }
    }
    return data;
  }
  static hasDefaultValue(options) {
    const prefix = 'defaultValue';
    for (const option in options) {
      if (Object.prototype.hasOwnProperty.call(options, option) && option.startsWith(prefix) && undefined !== options[option]) {
        return true;
      }
    }
    return false;
  }
}

class LanguageUtil {
  constructor(options) {
    this.options = options;
    this.supportedLngs = this.options.supportedLngs || false;
    this.logger = baseLogger.create('languageUtils');
  }
  getScriptPartFromCode(code) {
    code = getCleanedCode(code);
    if (!code || !code.includes('-')) return null;
    const p = code.split('-');
    if (p.length === 2) return null;
    p.pop();
    if (p[p.length - 1].toLowerCase() === 'x') return null;
    return this.formatLanguageCode(p.join('-'));
  }
  getLanguagePartFromCode(code) {
    code = getCleanedCode(code);
    if (!code || !code.includes('-')) return code;
    const p = code.split('-');
    return this.formatLanguageCode(p[0]);
  }
  formatLanguageCode(code) {
    if (isString(code) && code.includes('-')) {
      let formattedCode;
      try {
        formattedCode = Intl.getCanonicalLocales(code)[0];
      } catch (e) {}
      if (formattedCode && this.options.lowerCaseLng) {
        formattedCode = formattedCode.toLowerCase();
      }
      if (formattedCode) return formattedCode;
      if (this.options.lowerCaseLng) {
        return code.toLowerCase();
      }
      return code;
    }
    return this.options.cleanCode || this.options.lowerCaseLng ? code.toLowerCase() : code;
  }
  isSupportedCode(code) {
    if (this.options.load === 'languageOnly' || this.options.nonExplicitSupportedLngs) {
      code = this.getLanguagePartFromCode(code);
    }
    return !this.supportedLngs || !this.supportedLngs.length || this.supportedLngs.includes(code);
  }
  getBestMatchFromCodes(codes) {
    if (!codes) return null;
    let found;
    codes.forEach(code => {
      if (found) return;
      const cleanedLng = this.formatLanguageCode(code);
      if (!this.options.supportedLngs || this.isSupportedCode(cleanedLng)) found = cleanedLng;
    });
    if (!found && this.options.supportedLngs) {
      codes.forEach(code => {
        if (found) return;
        const lngScOnly = this.getScriptPartFromCode(code);
        if (this.isSupportedCode(lngScOnly)) return found = lngScOnly;
        const lngOnly = this.getLanguagePartFromCode(code);
        if (this.isSupportedCode(lngOnly)) return found = lngOnly;
        found = this.options.supportedLngs.find(supportedLng => {
          if (supportedLng === lngOnly) return true;
          if (!supportedLng.includes('-') && !lngOnly.includes('-')) return false;
          if (supportedLng.includes('-') && !lngOnly.includes('-') && supportedLng.slice(0, supportedLng.indexOf('-')) === lngOnly) return true;
          if (supportedLng.startsWith(lngOnly) && lngOnly.length > 1) return true;
          return false;
        });
      });
    }
    if (!found) found = this.getFallbackCodes(this.options.fallbackLng)[0];
    return found;
  }
  getFallbackCodes(fallbacks, code) {
    if (!fallbacks) return [];
    if (typeof fallbacks === 'function') fallbacks = fallbacks(code);
    if (isString(fallbacks)) fallbacks = [fallbacks];
    if (Array.isArray(fallbacks)) return fallbacks;
    if (!code) return fallbacks.default || [];
    let found = fallbacks[code];
    if (!found) found = fallbacks[this.getScriptPartFromCode(code)];
    if (!found) found = fallbacks[this.formatLanguageCode(code)];
    if (!found) found = fallbacks[this.getLanguagePartFromCode(code)];
    if (!found) found = fallbacks.default;
    return found || [];
  }
  toResolveHierarchy(code, fallbackCode) {
    const fallbackCodes = this.getFallbackCodes((fallbackCode === false ? [] : fallbackCode) || this.options.fallbackLng || [], code);
    const codes = [];
    const addCode = c => {
      if (!c) return;
      if (this.isSupportedCode(c)) {
        codes.push(c);
      } else {
        this.logger.warn(`rejecting language code not found in supportedLngs: ${c}`);
      }
    };
    if (isString(code) && (code.includes('-') || code.includes('_'))) {
      if (this.options.load !== 'languageOnly') addCode(this.formatLanguageCode(code));
      if (this.options.load !== 'languageOnly' && this.options.load !== 'currentOnly') addCode(this.getScriptPartFromCode(code));
      if (this.options.load !== 'currentOnly') addCode(this.getLanguagePartFromCode(code));
    } else if (isString(code)) {
      addCode(this.formatLanguageCode(code));
    }
    fallbackCodes.forEach(fc => {
      if (!codes.includes(fc)) addCode(this.formatLanguageCode(fc));
    });
    return codes;
  }
}

const suffixesOrder = {
  zero: 0,
  one: 1,
  two: 2,
  few: 3,
  many: 4,
  other: 5
};
const dummyRule = {
  select: count => count === 1 ? 'one' : 'other',
  resolvedOptions: () => ({
    pluralCategories: ['one', 'other']
  })
};
class PluralResolver {
  constructor(languageUtils, options = {}) {
    this.languageUtils = languageUtils;
    this.options = options;
    this.logger = baseLogger.create('pluralResolver');
    this.pluralRulesCache = {};
  }
  clearCache() {
    this.pluralRulesCache = {};
  }
  getRule(code, options = {}) {
    const cleanedCode = getCleanedCode(code === 'dev' ? 'en' : code);
    const type = options.ordinal ? 'ordinal' : 'cardinal';
    const cacheKey = JSON.stringify({
      cleanedCode,
      type
    });
    if (cacheKey in this.pluralRulesCache) {
      return this.pluralRulesCache[cacheKey];
    }
    let rule;
    try {
      rule = new Intl.PluralRules(cleanedCode, {
        type
      });
    } catch (err) {
      if (typeof Intl === 'undefined') {
        this.logger.error('No Intl support, please use an Intl polyfill!');
        return dummyRule;
      }
      if (!code.match(/-|_/)) return dummyRule;
      const lngPart = this.languageUtils.getLanguagePartFromCode(code);
      rule = this.getRule(lngPart, options);
    }
    this.pluralRulesCache[cacheKey] = rule;
    return rule;
  }
  needsPlural(code, options = {}) {
    let rule = this.getRule(code, options);
    if (!rule) rule = this.getRule('dev', options);
    return rule?.resolvedOptions().pluralCategories.length > 1;
  }
  getPluralFormsOfKey(code, key, options = {}) {
    return this.getSuffixes(code, options).map(suffix => `${key}${suffix}`);
  }
  getSuffixes(code, options = {}) {
    let rule = this.getRule(code, options);
    if (!rule) rule = this.getRule('dev', options);
    if (!rule) return [];
    return rule.resolvedOptions().pluralCategories.sort((pluralCategory1, pluralCategory2) => suffixesOrder[pluralCategory1] - suffixesOrder[pluralCategory2]).map(pluralCategory => `${this.options.prepend}${options.ordinal ? `ordinal${this.options.prepend}` : ''}${pluralCategory}`);
  }
  getSuffix(code, count, options = {}) {
    const rule = this.getRule(code, options);
    if (rule) {
      return `${this.options.prepend}${options.ordinal ? `ordinal${this.options.prepend}` : ''}${rule.select(count)}`;
    }
    this.logger.warn(`no plural rule found for: ${code}`);
    return this.getSuffix('dev', count, options);
  }
}

const deepFindWithDefaults = (data, defaultData, key, keySeparator = '.', ignoreJSONStructure = true) => {
  let path = getPathWithDefaults(data, defaultData, key);
  if (!path && ignoreJSONStructure && isString(key)) {
    path = deepFind(data, key, keySeparator);
    if (path === undefined) path = deepFind(defaultData, key, keySeparator);
  }
  return path;
};
const regexSafe = val => val.replace(/\$/g, '$$$$');
class Interpolator {
  constructor(options = {}) {
    this.logger = baseLogger.create('interpolator');
    this.options = options;
    this.format = options?.interpolation?.format || (value => value);
    this.init(options);
  }
  init(options = {}) {
    if (!options.interpolation) options.interpolation = {
      escapeValue: true
    };
    const {
      escape: escape$1,
      escapeValue,
      useRawValueToEscape,
      prefix,
      prefixEscaped,
      suffix,
      suffixEscaped,
      formatSeparator,
      unescapeSuffix,
      unescapePrefix,
      nestingPrefix,
      nestingPrefixEscaped,
      nestingSuffix,
      nestingSuffixEscaped,
      nestingOptionsSeparator,
      maxReplaces,
      alwaysFormat
    } = options.interpolation;
    this.escape = escape$1 !== undefined ? escape$1 : escape;
    this.escapeValue = escapeValue !== undefined ? escapeValue : true;
    this.useRawValueToEscape = useRawValueToEscape !== undefined ? useRawValueToEscape : false;
    this.prefix = prefix ? regexEscape(prefix) : prefixEscaped || '{{';
    this.suffix = suffix ? regexEscape(suffix) : suffixEscaped || '}}';
    this.formatSeparator = formatSeparator || ',';
    this.unescapePrefix = unescapeSuffix ? '' : unescapePrefix ? regexEscape(unescapePrefix) : '-';
    this.unescapeSuffix = this.unescapePrefix ? '' : unescapeSuffix ? regexEscape(unescapeSuffix) : '';
    this.nestingPrefix = nestingPrefix ? regexEscape(nestingPrefix) : nestingPrefixEscaped || regexEscape('$t(');
    this.nestingSuffix = nestingSuffix ? regexEscape(nestingSuffix) : nestingSuffixEscaped || regexEscape(')');
    this.nestingOptionsSeparator = nestingOptionsSeparator || ',';
    this.maxReplaces = maxReplaces || 1000;
    this.alwaysFormat = alwaysFormat !== undefined ? alwaysFormat : false;
    this.resetRegExp();
  }
  reset() {
    if (this.options) this.init(this.options);
  }
  resetRegExp() {
    const getOrResetRegExp = (existingRegExp, pattern) => {
      if (existingRegExp?.source === pattern) {
        existingRegExp.lastIndex = 0;
        return existingRegExp;
      }
      return new RegExp(pattern, 'g');
    };
    this.regexp = getOrResetRegExp(this.regexp, `${this.prefix}(.+?)${this.suffix}`);
    this.regexpUnescape = getOrResetRegExp(this.regexpUnescape, `${this.prefix}${this.unescapePrefix}(.+?)${this.unescapeSuffix}${this.suffix}`);
    this.nestingRegexp = getOrResetRegExp(this.nestingRegexp, `${this.nestingPrefix}((?:[^()"']+|"[^"]*"|'[^']*'|\\((?:[^()]|"[^"]*"|'[^']*')*\\))*?)${this.nestingSuffix}`);
  }
  interpolate(str, data, lng, options) {
    let match;
    let value;
    let replaces;
    const defaultData = this.options && this.options.interpolation && this.options.interpolation.defaultVariables || {};
    const handleFormat = key => {
      if (!key.includes(this.formatSeparator)) {
        const path = deepFindWithDefaults(data, defaultData, key, this.options.keySeparator, this.options.ignoreJSONStructure);
        return this.alwaysFormat ? this.format(path, undefined, lng, {
          ...options,
          ...data,
          interpolationkey: key
        }) : path;
      }
      const p = key.split(this.formatSeparator);
      const k = p.shift().trim();
      const f = p.join(this.formatSeparator).trim();
      return this.format(deepFindWithDefaults(data, defaultData, k, this.options.keySeparator, this.options.ignoreJSONStructure), f, lng, {
        ...options,
        ...data,
        interpolationkey: k
      });
    };
    this.resetRegExp();
    if (!this.escapeValue && typeof str === 'string' && /\$t\([^)]*\{[^}]*\{\{/.test(str)) {
      this.logger.warn('nesting options string contains interpolated variables with escapeValue: false — ' + 'if any of those values are attacker-controlled they can inject additional ' + 'nesting options (e.g. redirect lng/ns). Sanitise untrusted input before passing ' + 'it to t(), or keep escapeValue: true.');
    }
    const missingInterpolationHandler = options?.missingInterpolationHandler || this.options.missingInterpolationHandler;
    const skipOnVariables = options?.interpolation?.skipOnVariables !== undefined ? options.interpolation.skipOnVariables : this.options.interpolation.skipOnVariables;
    const todos = [{
      regex: this.regexpUnescape,
      safeValue: val => regexSafe(val)
    }, {
      regex: this.regexp,
      safeValue: val => this.escapeValue ? regexSafe(this.escape(val)) : regexSafe(val)
    }];
    todos.forEach(todo => {
      replaces = 0;
      while (match = todo.regex.exec(str)) {
        const matchedVar = match[1].trim();
        value = handleFormat(matchedVar);
        if (value === undefined) {
          if (typeof missingInterpolationHandler === 'function') {
            const temp = missingInterpolationHandler(str, match, options);
            value = isString(temp) ? temp : '';
          } else if (options && Object.prototype.hasOwnProperty.call(options, matchedVar)) {
            value = '';
          } else if (skipOnVariables) {
            value = match[0];
            continue;
          } else {
            this.logger.warn(`missed to pass in variable ${matchedVar} for interpolating ${str}`);
            value = '';
          }
        } else if (!isString(value) && !this.useRawValueToEscape) {
          value = makeString(value);
        }
        const safeValue = todo.safeValue(value);
        str = str.replace(match[0], safeValue);
        if (skipOnVariables) {
          todo.regex.lastIndex += value.length;
          todo.regex.lastIndex -= match[0].length;
        } else {
          todo.regex.lastIndex = 0;
        }
        replaces++;
        if (replaces >= this.maxReplaces) {
          break;
        }
      }
    });
    return str;
  }
  nest(str, fc, options = {}) {
    let match;
    let value;
    let clonedOptions;
    const handleHasOptions = (key, inheritedOptions) => {
      const sep = this.nestingOptionsSeparator;
      if (!key.includes(sep)) return key;
      const c = key.split(new RegExp(`${regexEscape(sep)}[ ]*{`));
      let optionsString = `{${c[1]}`;
      key = c[0];
      optionsString = this.interpolate(optionsString, clonedOptions);
      const matchedSingleQuotes = optionsString.match(/'/g);
      const matchedDoubleQuotes = optionsString.match(/"/g);
      if ((matchedSingleQuotes?.length ?? 0) % 2 === 0 && !matchedDoubleQuotes || (matchedDoubleQuotes?.length ?? 0) % 2 !== 0) {
        optionsString = optionsString.replace(/'/g, '"');
      }
      try {
        clonedOptions = JSON.parse(optionsString);
        if (inheritedOptions) clonedOptions = {
          ...inheritedOptions,
          ...clonedOptions
        };
      } catch (e) {
        this.logger.warn(`failed parsing options string in nesting for key ${key}`, e);
        return `${key}${sep}${optionsString}`;
      }
      if (clonedOptions.defaultValue && clonedOptions.defaultValue.includes(this.prefix)) delete clonedOptions.defaultValue;
      return key;
    };
    while (match = this.nestingRegexp.exec(str)) {
      let formatters = [];
      clonedOptions = {
        ...options
      };
      clonedOptions = clonedOptions.replace && !isString(clonedOptions.replace) ? clonedOptions.replace : clonedOptions;
      clonedOptions.applyPostProcessor = false;
      delete clonedOptions.defaultValue;
      const keyEndIndex = /{.*}/.test(match[1]) ? match[1].lastIndexOf('}') + 1 : match[1].indexOf(this.formatSeparator);
      if (keyEndIndex !== -1) {
        formatters = match[1].slice(keyEndIndex).split(this.formatSeparator).map(elem => elem.trim()).filter(Boolean);
        match[1] = match[1].slice(0, keyEndIndex);
      }
      value = fc(handleHasOptions.call(this, match[1].trim(), clonedOptions), clonedOptions);
      if (value && match[0] === str && !isString(value)) return value;
      if (!isString(value)) value = makeString(value);
      if (!value) {
        this.logger.warn(`missed to resolve ${match[1]} for nesting ${str}`);
        value = '';
      }
      if (formatters.length) {
        value = formatters.reduce((v, f) => this.format(v, f, options.lng, {
          ...options,
          interpolationkey: match[1].trim()
        }), value.trim());
      }
      str = str.replace(match[0], value);
      this.regexp.lastIndex = 0;
    }
    return str;
  }
}

const parseFormatStr = formatStr => {
  let formatName = formatStr.toLowerCase().trim();
  const formatOptions = {};
  if (formatStr.includes('(')) {
    const p = formatStr.split('(');
    formatName = p[0].toLowerCase().trim();
    const optStr = p[1].slice(0, -1);
    if (formatName === 'currency' && !optStr.includes(':')) {
      if (!formatOptions.currency) formatOptions.currency = optStr.trim();
    } else if (formatName === 'relativetime' && !optStr.includes(':')) {
      if (!formatOptions.range) formatOptions.range = optStr.trim();
    } else {
      const opts = optStr.split(';');
      opts.forEach(opt => {
        if (opt) {
          const [key, ...rest] = opt.split(':');
          const val = rest.join(':').trim().replace(/^'+|'+$/g, '');
          const trimmedKey = key.trim();
          if (!formatOptions[trimmedKey]) formatOptions[trimmedKey] = val;
          if (val === 'false') formatOptions[trimmedKey] = false;
          if (val === 'true') formatOptions[trimmedKey] = true;
          if (!isNaN(val)) formatOptions[trimmedKey] = parseInt(val, 10);
        }
      });
    }
  }
  return {
    formatName,
    formatOptions
  };
};
const createCachedFormatter = fn => {
  const cache = {};
  return (v, l, o) => {
    let optForCache = o;
    if (o && o.interpolationkey && o.formatParams && o.formatParams[o.interpolationkey] && o[o.interpolationkey]) {
      optForCache = {
        ...optForCache,
        [o.interpolationkey]: undefined
      };
    }
    const key = l + JSON.stringify(optForCache);
    let frm = cache[key];
    if (!frm) {
      frm = fn(getCleanedCode(l), o);
      cache[key] = frm;
    }
    return frm(v);
  };
};
const createNonCachedFormatter = fn => (v, l, o) => fn(getCleanedCode(l), o)(v);
class Formatter {
  constructor(options = {}) {
    this.logger = baseLogger.create('formatter');
    this.options = options;
    this.init(options);
  }
  init(services, options = {
    interpolation: {}
  }) {
    this.formatSeparator = options.interpolation.formatSeparator || ',';
    const cf = options.cacheInBuiltFormats ? createCachedFormatter : createNonCachedFormatter;
    this.formats = {
      number: cf((lng, opt) => {
        const formatter = new Intl.NumberFormat(lng, {
          ...opt
        });
        return val => formatter.format(val);
      }),
      currency: cf((lng, opt) => {
        const formatter = new Intl.NumberFormat(lng, {
          ...opt,
          style: 'currency'
        });
        return val => formatter.format(val);
      }),
      datetime: cf((lng, opt) => {
        const formatter = new Intl.DateTimeFormat(lng, {
          ...opt
        });
        return val => formatter.format(val);
      }),
      relativetime: cf((lng, opt) => {
        const formatter = new Intl.RelativeTimeFormat(lng, {
          ...opt
        });
        return val => formatter.format(val, opt.range || 'day');
      }),
      list: cf((lng, opt) => {
        const formatter = new Intl.ListFormat(lng, {
          ...opt
        });
        return val => formatter.format(val);
      })
    };
  }
  add(name, fc) {
    this.formats[name.toLowerCase().trim()] = fc;
  }
  addCached(name, fc) {
    this.formats[name.toLowerCase().trim()] = createCachedFormatter(fc);
  }
  format(value, format, lng, options = {}) {
    if (!format) return value;
    if (value == null) return value;
    const formats = format.split(this.formatSeparator);
    if (formats.length > 1 && formats[0].indexOf('(') > 1 && !formats[0].includes(')') && formats.find(f => f.includes(')'))) {
      const lastIndex = formats.findIndex(f => f.includes(')'));
      formats[0] = [formats[0], ...formats.splice(1, lastIndex)].join(this.formatSeparator);
    }
    const result = formats.reduce((mem, f) => {
      const {
        formatName,
        formatOptions
      } = parseFormatStr(f);
      if (this.formats[formatName]) {
        let formatted = mem;
        try {
          const valOptions = options?.formatParams?.[options.interpolationkey] || {};
          const l = valOptions.locale || valOptions.lng || options.locale || options.lng || lng;
          formatted = this.formats[formatName](mem, l, {
            ...formatOptions,
            ...options,
            ...valOptions
          });
        } catch (error) {
          this.logger.warn(error);
        }
        return formatted;
      } else {
        this.logger.warn(`there was no format function for ${formatName}`);
      }
      return mem;
    }, value);
    return result;
  }
}

const removePending = (q, name) => {
  if (q.pending[name] !== undefined) {
    delete q.pending[name];
    q.pendingCount--;
  }
};
class Connector extends EventEmitter {
  constructor(backend, store, services, options = {}) {
    super();
    this.backend = backend;
    this.store = store;
    this.services = services;
    this.languageUtils = services.languageUtils;
    this.options = options;
    this.logger = baseLogger.create('backendConnector');
    this.waitingReads = [];
    this.maxParallelReads = options.maxParallelReads || 10;
    this.readingCalls = 0;
    this.maxRetries = options.maxRetries >= 0 ? options.maxRetries : 5;
    this.retryTimeout = options.retryTimeout >= 1 ? options.retryTimeout : 350;
    this.state = {};
    this.queue = [];
    this.backend?.init?.(services, options.backend, options);
  }
  queueLoad(languages, namespaces, options, callback) {
    const toLoad = {};
    const pending = {};
    const toLoadLanguages = {};
    const toLoadNamespaces = {};
    languages.forEach(lng => {
      let hasAllNamespaces = true;
      namespaces.forEach(ns => {
        const name = `${lng}|${ns}`;
        if (!options.reload && this.store.hasResourceBundle(lng, ns)) {
          this.state[name] = 2;
        } else if (this.state[name] < 0) ; else if (this.state[name] === 1) {
          if (pending[name] === undefined) pending[name] = true;
        } else {
          this.state[name] = 1;
          hasAllNamespaces = false;
          if (pending[name] === undefined) pending[name] = true;
          if (toLoad[name] === undefined) toLoad[name] = true;
          if (toLoadNamespaces[ns] === undefined) toLoadNamespaces[ns] = true;
        }
      });
      if (!hasAllNamespaces) toLoadLanguages[lng] = true;
    });
    if (Object.keys(toLoad).length || Object.keys(pending).length) {
      this.queue.push({
        pending,
        pendingCount: Object.keys(pending).length,
        loaded: {},
        errors: [],
        callback
      });
    }
    return {
      toLoad: Object.keys(toLoad),
      pending: Object.keys(pending),
      toLoadLanguages: Object.keys(toLoadLanguages),
      toLoadNamespaces: Object.keys(toLoadNamespaces)
    };
  }
  loaded(name, err, data) {
    const s = name.split('|');
    const lng = s[0];
    const ns = s[1];
    if (err) this.emit('failedLoading', lng, ns, err);
    if (!err && data) {
      this.store.addResourceBundle(lng, ns, data, undefined, undefined, {
        skipCopy: true
      });
    }
    this.state[name] = err ? -1 : 2;
    if (err && data) this.state[name] = 0;
    const loaded = {};
    this.queue.forEach(q => {
      pushPath(q.loaded, [lng], ns);
      removePending(q, name);
      if (err) q.errors.push(err);
      if (q.pendingCount === 0 && !q.done) {
        Object.keys(q.loaded).forEach(l => {
          if (!loaded[l]) loaded[l] = {};
          const loadedKeys = q.loaded[l];
          if (loadedKeys.length) {
            loadedKeys.forEach(n => {
              if (loaded[l][n] === undefined) loaded[l][n] = true;
            });
          }
        });
        q.done = true;
        if (q.errors.length) {
          q.callback(q.errors);
        } else {
          q.callback();
        }
      }
    });
    this.emit('loaded', loaded);
    this.queue = this.queue.filter(q => !q.done);
  }
  read(lng, ns, fcName, tried = 0, wait = this.retryTimeout, callback) {
    if (!lng.length) return callback(null, {});
    if (this.readingCalls >= this.maxParallelReads) {
      this.waitingReads.push({
        lng,
        ns,
        fcName,
        tried,
        wait,
        callback
      });
      return;
    }
    this.readingCalls++;
    const resolver = (err, data) => {
      this.readingCalls--;
      if (this.waitingReads.length > 0) {
        const next = this.waitingReads.shift();
        this.read(next.lng, next.ns, next.fcName, next.tried, next.wait, next.callback);
      }
      if (err && data && tried < this.maxRetries) {
        setTimeout(() => {
          this.read(lng, ns, fcName, tried + 1, wait * 2, callback);
        }, wait);
        return;
      }
      callback(err, data);
    };
    const fc = this.backend[fcName].bind(this.backend);
    if (fc.length === 2) {
      try {
        const r = fc(lng, ns);
        if (r && typeof r.then === 'function') {
          r.then(data => resolver(null, data)).catch(resolver);
        } else {
          resolver(null, r);
        }
      } catch (err) {
        resolver(err);
      }
      return;
    }
    return fc(lng, ns, resolver);
  }
  prepareLoading(languages, namespaces, options = {}, callback) {
    if (!this.backend) {
      this.logger.warn('No backend was added via i18next.use. Will not load resources.');
      return callback && callback();
    }
    if (isString(languages)) languages = this.languageUtils.toResolveHierarchy(languages);
    if (isString(namespaces)) namespaces = [namespaces];
    const toLoad = this.queueLoad(languages, namespaces, options, callback);
    if (!toLoad.toLoad.length) {
      if (!toLoad.pending.length) callback();
      return null;
    }
    toLoad.toLoad.forEach(name => {
      this.loadOne(name);
    });
  }
  load(languages, namespaces, callback) {
    this.prepareLoading(languages, namespaces, {}, callback);
  }
  reload(languages, namespaces, callback) {
    this.prepareLoading(languages, namespaces, {
      reload: true
    }, callback);
  }
  loadOne(name, prefix = '') {
    const s = name.split('|');
    const lng = s[0];
    const ns = s[1];
    this.read(lng, ns, 'read', undefined, undefined, (err, data) => {
      if (err) this.logger.warn(`${prefix}loading namespace ${ns} for language ${lng} failed`, err);
      if (!err && data) this.logger.log(`${prefix}loaded namespace ${ns} for language ${lng}`, data);
      this.loaded(name, err, data);
    });
  }
  saveMissing(languages, namespace, key, fallbackValue, isUpdate, options = {}, clb = () => {}) {
    if (this.services?.utils?.hasLoadedNamespace && !this.services?.utils?.hasLoadedNamespace(namespace)) {
      this.logger.warn(`did not save key "${key}" as the namespace "${namespace}" was not yet loaded`, 'This means something IS WRONG in your setup. You access the t function before i18next.init / i18next.loadNamespace / i18next.changeLanguage was done. Wait for the callback or Promise to resolve before accessing it!!!');
      return;
    }
    if (key === undefined || key === null || key === '') return;
    if (this.backend?.create) {
      const opts = {
        ...options,
        isUpdate
      };
      const fc = this.backend.create.bind(this.backend);
      if (fc.length < 6) {
        try {
          let r;
          if (fc.length === 5) {
            r = fc(languages, namespace, key, fallbackValue, opts);
          } else {
            r = fc(languages, namespace, key, fallbackValue);
          }
          if (r && typeof r.then === 'function') {
            r.then(data => clb(null, data)).catch(clb);
          } else {
            clb(null, r);
          }
        } catch (err) {
          clb(err);
        }
      } else {
        fc(languages, namespace, key, fallbackValue, clb, opts);
      }
    }
    if (!languages || !languages[0]) return;
    this.store.addResource(languages[0], namespace, key, fallbackValue);
  }
}

const get = () => ({
  debug: false,
  initAsync: true,
  ns: ['translation'],
  defaultNS: ['translation'],
  fallbackLng: ['dev'],
  fallbackNS: false,
  supportedLngs: false,
  nonExplicitSupportedLngs: false,
  load: 'all',
  preload: false,
  keySeparator: '.',
  nsSeparator: ':',
  pluralSeparator: '_',
  contextSeparator: '_',
  enableSelector: false,
  partialBundledLanguages: false,
  saveMissing: false,
  updateMissing: false,
  saveMissingTo: 'fallback',
  saveMissingPlurals: true,
  missingKeyHandler: false,
  missingInterpolationHandler: false,
  postProcess: false,
  postProcessPassResolved: false,
  returnNull: false,
  returnEmptyString: true,
  returnObjects: false,
  joinArrays: false,
  returnedObjectHandler: false,
  parseMissingKeyHandler: false,
  appendNamespaceToMissingKey: false,
  appendNamespaceToCIMode: false,
  overloadTranslationOptionHandler: args => {
    let ret = {};
    if (typeof args[1] === 'object') ret = args[1];
    if (isString(args[1])) ret.defaultValue = args[1];
    if (isString(args[2])) ret.tDescription = args[2];
    if (typeof args[2] === 'object' || typeof args[3] === 'object') {
      const options = args[3] || args[2];
      Object.keys(options).forEach(key => {
        ret[key] = options[key];
      });
    }
    return ret;
  },
  interpolation: {
    escapeValue: true,
    prefix: '{{',
    suffix: '}}',
    formatSeparator: ',',
    unescapePrefix: '-',
    nestingPrefix: '$t(',
    nestingSuffix: ')',
    nestingOptionsSeparator: ',',
    maxReplaces: 1000,
    skipOnVariables: true
  },
  cacheInBuiltFormats: true
});
const transformOptions = options => {
  if (isString(options.ns)) options.ns = [options.ns];
  if (isString(options.fallbackLng)) options.fallbackLng = [options.fallbackLng];
  if (isString(options.fallbackNS)) options.fallbackNS = [options.fallbackNS];
  if (options.supportedLngs && !options.supportedLngs.includes('cimode')) {
    options.supportedLngs = options.supportedLngs.concat(['cimode']);
  }
  return options;
};

const noop = () => {};
const bindMemberFunctions = inst => {
  const mems = Object.getOwnPropertyNames(Object.getPrototypeOf(inst));
  mems.forEach(mem => {
    if (typeof inst[mem] === 'function') {
      inst[mem] = inst[mem].bind(inst);
    }
  });
};
class I18n extends EventEmitter {
  constructor(options = {}, callback) {
    super();
    this.options = transformOptions(options);
    this.services = {};
    this.logger = baseLogger;
    this.modules = {
      external: []
    };
    bindMemberFunctions(this);
    if (callback && !this.isInitialized && !options.isClone) {
      if (!this.options.initAsync) {
        this.init(options, callback);
        return this;
      }
      setTimeout(() => {
        this.init(options, callback);
      }, 0);
    }
  }
  init(options = {}, callback) {
    this.isInitializing = true;
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    if (options.defaultNS == null && options.ns) {
      if (isString(options.ns)) {
        options.defaultNS = options.ns;
      } else if (!options.ns.includes('translation')) {
        options.defaultNS = options.ns[0];
      }
    }
    const defOpts = get();
    this.options = {
      ...defOpts,
      ...this.options,
      ...transformOptions(options)
    };
    this.options.interpolation = {
      ...defOpts.interpolation,
      ...this.options.interpolation
    };
    if (options.keySeparator !== undefined) {
      this.options.userDefinedKeySeparator = options.keySeparator;
    }
    if (options.nsSeparator !== undefined) {
      this.options.userDefinedNsSeparator = options.nsSeparator;
    }
    if (typeof this.options.overloadTranslationOptionHandler !== 'function') {
      this.options.overloadTranslationOptionHandler = defOpts.overloadTranslationOptionHandler;
    }
    const createClassOnDemand = ClassOrObject => {
      if (!ClassOrObject) return null;
      if (typeof ClassOrObject === 'function') return new ClassOrObject();
      return ClassOrObject;
    };
    if (!this.options.isClone) {
      if (this.modules.logger) {
        baseLogger.init(createClassOnDemand(this.modules.logger), this.options);
      } else {
        baseLogger.init(null, this.options);
      }
      let formatter;
      if (this.modules.formatter) {
        formatter = this.modules.formatter;
      } else {
        formatter = Formatter;
      }
      const lu = new LanguageUtil(this.options);
      this.store = new ResourceStore(this.options.resources, this.options);
      const s = this.services;
      s.logger = baseLogger;
      s.resourceStore = this.store;
      s.languageUtils = lu;
      s.pluralResolver = new PluralResolver(lu, {
        prepend: this.options.pluralSeparator
      });
      if (formatter) {
        s.formatter = createClassOnDemand(formatter);
        if (s.formatter.init) s.formatter.init(s, this.options);
        this.options.interpolation.format = s.formatter.format.bind(s.formatter);
      }
      s.interpolator = new Interpolator(this.options);
      s.utils = {
        hasLoadedNamespace: this.hasLoadedNamespace.bind(this)
      };
      s.backendConnector = new Connector(createClassOnDemand(this.modules.backend), s.resourceStore, s, this.options);
      s.backendConnector.on('*', (event, ...args) => {
        this.emit(event, ...args);
      });
      if (this.modules.languageDetector) {
        s.languageDetector = createClassOnDemand(this.modules.languageDetector);
        if (s.languageDetector.init) s.languageDetector.init(s, this.options.detection, this.options);
      }
      if (this.modules.i18nFormat) {
        s.i18nFormat = createClassOnDemand(this.modules.i18nFormat);
        if (s.i18nFormat.init) s.i18nFormat.init(this);
      }
      this.translator = new Translator(this.services, this.options);
      this.translator.on('*', (event, ...args) => {
        this.emit(event, ...args);
      });
      this.modules.external.forEach(m => {
        if (m.init) m.init(this);
      });
    }
    this.format = this.options.interpolation.format;
    if (!callback) callback = noop;
    if (this.options.fallbackLng && !this.services.languageDetector && !this.options.lng) {
      const codes = this.services.languageUtils.getFallbackCodes(this.options.fallbackLng);
      if (codes.length > 0 && codes[0] !== 'dev') this.options.lng = codes[0];
    }
    if (!this.services.languageDetector && !this.options.lng) {
      this.logger.warn('init: no languageDetector is used and no lng is defined');
    }
    const storeApi = ['getResource', 'hasResourceBundle', 'getResourceBundle', 'getDataByLanguage'];
    storeApi.forEach(fcName => {
      this[fcName] = (...args) => this.store[fcName](...args);
    });
    const storeApiChained = ['addResource', 'addResources', 'addResourceBundle', 'removeResourceBundle'];
    storeApiChained.forEach(fcName => {
      this[fcName] = (...args) => {
        this.store[fcName](...args);
        return this;
      };
    });
    const deferred = defer();
    const load = () => {
      const finish = (err, t) => {
        this.isInitializing = false;
        if (this.isInitialized && !this.initializedStoreOnce) this.logger.warn('init: i18next is already initialized. You should call init just once!');
        this.isInitialized = true;
        if (!this.options.isClone) this.logger.log('initialized', this.options);
        this.emit('initialized', this.options);
        deferred.resolve(t);
        callback(err, t);
      };
      if ((this.languages || this.isLanguageChangingTo) && !this.isInitialized) return finish(null, this.t.bind(this));
      this.changeLanguage(this.options.lng, finish);
    };
    if (this.options.resources || !this.options.initAsync) {
      load();
    } else {
      setTimeout(load, 0);
    }
    return deferred;
  }
  loadResources(language, callback = noop) {
    let usedCallback = callback;
    const usedLng = isString(language) ? language : this.language;
    if (typeof language === 'function') usedCallback = language;
    if (!this.options.resources || this.options.partialBundledLanguages) {
      if (usedLng?.toLowerCase() === 'cimode' && (!this.options.preload || this.options.preload.length === 0)) return usedCallback();
      const toLoad = [];
      const append = lng => {
        if (!lng) return;
        if (lng === 'cimode') return;
        const lngs = this.services.languageUtils.toResolveHierarchy(lng);
        lngs.forEach(l => {
          if (l === 'cimode') return;
          if (!toLoad.includes(l)) toLoad.push(l);
        });
      };
      if (!usedLng) {
        const fallbacks = this.services.languageUtils.getFallbackCodes(this.options.fallbackLng);
        fallbacks.forEach(l => append(l));
      } else {
        append(usedLng);
      }
      this.options.preload?.forEach?.(l => append(l));
      this.services.backendConnector.load(toLoad, this.options.ns, e => {
        if (!e && !this.resolvedLanguage && this.language) this.setResolvedLanguage(this.language);
        usedCallback(e);
      });
    } else {
      usedCallback(null);
    }
  }
  reloadResources(lngs, ns, callback) {
    const deferred = defer();
    if (typeof lngs === 'function') {
      callback = lngs;
      lngs = undefined;
    }
    if (typeof ns === 'function') {
      callback = ns;
      ns = undefined;
    }
    if (!lngs) lngs = this.languages;
    if (!ns) ns = this.options.ns;
    if (!callback) callback = noop;
    this.services.backendConnector.reload(lngs, ns, err => {
      deferred.resolve();
      callback(err);
    });
    return deferred;
  }
  use(module) {
    if (!module) throw new Error('You are passing an undefined module! Please check the object you are passing to i18next.use()');
    if (!module.type) throw new Error('You are passing a wrong module! Please check the object you are passing to i18next.use()');
    if (module.type === 'backend') {
      this.modules.backend = module;
    }
    if (module.type === 'logger' || module.log && module.warn && module.error) {
      this.modules.logger = module;
    }
    if (module.type === 'languageDetector') {
      this.modules.languageDetector = module;
    }
    if (module.type === 'i18nFormat') {
      this.modules.i18nFormat = module;
    }
    if (module.type === 'postProcessor') {
      postProcessor.addPostProcessor(module);
    }
    if (module.type === 'formatter') {
      this.modules.formatter = module;
    }
    if (module.type === '3rdParty') {
      this.modules.external.push(module);
    }
    return this;
  }
  setResolvedLanguage(l) {
    if (!l || !this.languages) return;
    if (['cimode', 'dev'].includes(l)) return;
    for (let li = 0; li < this.languages.length; li++) {
      const lngInLngs = this.languages[li];
      if (['cimode', 'dev'].includes(lngInLngs)) continue;
      if (this.store.hasLanguageSomeTranslations(lngInLngs)) {
        this.resolvedLanguage = lngInLngs;
        break;
      }
    }
    if (!this.resolvedLanguage && !this.languages.includes(l) && this.store.hasLanguageSomeTranslations(l)) {
      this.resolvedLanguage = l;
      this.languages.unshift(l);
    }
  }
  changeLanguage(lng, callback) {
    this.isLanguageChangingTo = lng;
    const deferred = defer();
    this.emit('languageChanging', lng);
    const setLngProps = l => {
      this.language = l;
      this.languages = this.services.languageUtils.toResolveHierarchy(l);
      this.resolvedLanguage = undefined;
      this.setResolvedLanguage(l);
    };
    const done = (err, l) => {
      if (l) {
        if (this.isLanguageChangingTo === lng) {
          setLngProps(l);
          this.translator.changeLanguage(l);
          this.isLanguageChangingTo = undefined;
          this.emit('languageChanged', l);
          this.logger.log('languageChanged', l);
        }
      } else {
        this.isLanguageChangingTo = undefined;
      }
      deferred.resolve((...args) => this.t(...args));
      if (callback) callback(err, (...args) => this.t(...args));
    };
    const setLng = lngs => {
      if (!lng && !lngs && this.services.languageDetector) lngs = [];
      const fl = isString(lngs) ? lngs : lngs && lngs[0];
      const l = this.store.hasLanguageSomeTranslations(fl) ? fl : this.services.languageUtils.getBestMatchFromCodes(isString(lngs) ? [lngs] : lngs);
      if (l) {
        if (!this.language) {
          setLngProps(l);
        }
        if (!this.translator.language) this.translator.changeLanguage(l);
        this.services.languageDetector?.cacheUserLanguage?.(l);
      }
      this.loadResources(l, err => {
        done(err, l);
      });
    };
    if (!lng && this.services.languageDetector && !this.services.languageDetector.async) {
      setLng(this.services.languageDetector.detect());
    } else if (!lng && this.services.languageDetector && this.services.languageDetector.async) {
      if (this.services.languageDetector.detect.length === 0) {
        this.services.languageDetector.detect().then(setLng);
      } else {
        this.services.languageDetector.detect(setLng);
      }
    } else {
      setLng(lng);
    }
    return deferred;
  }
  getFixedT(lng, ns, keyPrefix, fixedOpts) {
    const scopeNs = fixedOpts?.scopeNs;
    const fixedT = (key, opts, ...rest) => {
      let o;
      if (typeof opts !== 'object') {
        o = this.options.overloadTranslationOptionHandler([key, opts].concat(rest));
      } else {
        o = {
          ...opts
        };
      }
      o.lng = o.lng || fixedT.lng;
      o.lngs = o.lngs || fixedT.lngs;
      const explicitCallNs = o.ns !== undefined && o.ns !== null;
      o.ns = o.ns || fixedT.ns;
      if (o.keyPrefix !== '') o.keyPrefix = o.keyPrefix || keyPrefix || fixedT.keyPrefix;
      const selectorOpts = {
        ...this.options,
        ...o
      };
      if (Array.isArray(scopeNs) && !explicitCallNs) selectorOpts.ns = scopeNs;
      if (typeof o.keyPrefix === 'function') o.keyPrefix = keysFromSelector(o.keyPrefix, selectorOpts);
      const keySeparator = this.options.keySeparator || '.';
      let resultKey;
      if (o.keyPrefix && Array.isArray(key)) {
        resultKey = key.map(k => {
          if (typeof k === 'function') k = keysFromSelector(k, selectorOpts);
          return `${o.keyPrefix}${keySeparator}${k}`;
        });
      } else {
        if (typeof key === 'function') key = keysFromSelector(key, selectorOpts);
        resultKey = o.keyPrefix ? `${o.keyPrefix}${keySeparator}${key}` : key;
      }
      return this.t(resultKey, o);
    };
    if (isString(lng)) {
      fixedT.lng = lng;
    } else {
      fixedT.lngs = lng;
    }
    fixedT.ns = ns;
    fixedT.keyPrefix = keyPrefix;
    return fixedT;
  }
  t(...args) {
    return this.translator?.translate(...args);
  }
  exists(...args) {
    return this.translator?.exists(...args);
  }
  setDefaultNamespace(ns) {
    this.options.defaultNS = ns;
  }
  hasLoadedNamespace(ns, options = {}) {
    if (!this.isInitialized) {
      this.logger.warn('hasLoadedNamespace: i18next was not initialized', this.languages);
      return false;
    }
    if (!this.languages || !this.languages.length) {
      this.logger.warn('hasLoadedNamespace: i18n.languages were undefined or empty', this.languages);
      return false;
    }
    const lng = options.lng || this.resolvedLanguage || this.languages[0];
    const fallbackLng = this.options ? this.options.fallbackLng : false;
    const lastLng = this.languages[this.languages.length - 1];
    if (lng.toLowerCase() === 'cimode') return true;
    const loadNotPending = (l, n) => {
      const loadState = this.services.backendConnector.state[`${l}|${n}`];
      return loadState === -1 || loadState === 0 || loadState === 2;
    };
    if (options.precheck) {
      const preResult = options.precheck(this, loadNotPending);
      if (preResult !== undefined) return preResult;
    }
    if (this.hasResourceBundle(lng, ns)) return true;
    if (!this.services.backendConnector.backend || this.options.resources && !this.options.partialBundledLanguages) return true;
    if (loadNotPending(lng, ns) && (!fallbackLng || loadNotPending(lastLng, ns))) return true;
    return false;
  }
  loadNamespaces(ns, callback) {
    const deferred = defer();
    if (!this.options.ns) {
      if (callback) callback();
      return Promise.resolve();
    }
    if (isString(ns)) ns = [ns];
    ns.forEach(n => {
      if (!this.options.ns.includes(n)) this.options.ns.push(n);
    });
    this.loadResources(err => {
      deferred.resolve();
      if (callback) callback(err);
    });
    return deferred;
  }
  loadLanguages(lngs, callback) {
    const deferred = defer();
    if (isString(lngs)) lngs = [lngs];
    const preloaded = this.options.preload || [];
    const newLngs = lngs.filter(lng => !preloaded.includes(lng) && this.services.languageUtils.isSupportedCode(lng));
    if (!newLngs.length) {
      if (callback) callback();
      return Promise.resolve();
    }
    this.options.preload = preloaded.concat(newLngs);
    this.loadResources(err => {
      deferred.resolve();
      if (callback) callback(err);
    });
    return deferred;
  }
  dir(lng) {
    if (!lng) lng = this.resolvedLanguage || (this.languages?.length > 0 ? this.languages[0] : this.language);
    if (!lng) return 'rtl';
    try {
      const l = new Intl.Locale(lng);
      if (l && l.getTextInfo) {
        const ti = l.getTextInfo();
        if (ti && ti.direction) return ti.direction;
      }
    } catch (e) {}
    const rtlLngs = ['ar', 'shu', 'sqr', 'ssh', 'xaa', 'yhd', 'yud', 'aao', 'abh', 'abv', 'acm', 'acq', 'acw', 'acx', 'acy', 'adf', 'ads', 'aeb', 'aec', 'afb', 'ajp', 'apc', 'apd', 'arb', 'arq', 'ars', 'ary', 'arz', 'auz', 'avl', 'ayh', 'ayl', 'ayn', 'ayp', 'bbz', 'pga', 'he', 'iw', 'ps', 'pbt', 'pbu', 'pst', 'prp', 'prd', 'ug', 'ur', 'ydd', 'yds', 'yih', 'ji', 'yi', 'hbo', 'men', 'xmn', 'fa', 'jpr', 'peo', 'pes', 'prs', 'dv', 'sam', 'ckb'];
    const languageUtils = this.services?.languageUtils || new LanguageUtil(get());
    if (lng.toLowerCase().indexOf('-latn') > 1) return 'ltr';
    return rtlLngs.includes(languageUtils.getLanguagePartFromCode(lng)) || lng.toLowerCase().indexOf('-arab') > 1 ? 'rtl' : 'ltr';
  }
  static createInstance(options = {}, callback) {
    const instance = new I18n(options, callback);
    instance.createInstance = I18n.createInstance;
    return instance;
  }
  cloneInstance(options = {}, callback = noop) {
    const forkResourceStore = options.forkResourceStore;
    if (forkResourceStore) delete options.forkResourceStore;
    const mergedOptions = {
      ...this.options,
      ...options,
      ...{
        isClone: true
      }
    };
    const clone = new I18n(mergedOptions);
    if (options.debug !== undefined || options.prefix !== undefined) {
      clone.logger = clone.logger.clone(options);
    }
    const membersToCopy = ['store', 'services', 'language'];
    membersToCopy.forEach(m => {
      clone[m] = this[m];
    });
    clone.services = {
      ...this.services
    };
    clone.services.utils = {
      hasLoadedNamespace: clone.hasLoadedNamespace.bind(clone)
    };
    if (forkResourceStore) {
      const clonedData = Object.keys(this.store.data).reduce((prev, l) => {
        prev[l] = {
          ...this.store.data[l]
        };
        prev[l] = Object.keys(prev[l]).reduce((acc, n) => {
          acc[n] = {
            ...prev[l][n]
          };
          return acc;
        }, prev[l]);
        return prev;
      }, {});
      clone.store = new ResourceStore(clonedData, mergedOptions);
      clone.services.resourceStore = clone.store;
    }
    if (options.interpolation) {
      const defOpts = get();
      const mergedInterpolation = {
        ...defOpts.interpolation,
        ...this.options.interpolation,
        ...options.interpolation
      };
      const mergedForInterpolator = {
        ...mergedOptions,
        interpolation: mergedInterpolation
      };
      clone.services.interpolator = new Interpolator(mergedForInterpolator);
    }
    clone.translator = new Translator(clone.services, mergedOptions);
    clone.translator.on('*', (event, ...args) => {
      clone.emit(event, ...args);
    });
    clone.init(mergedOptions, callback);
    clone.translator.options = mergedOptions;
    clone.translator.backendConnector.services.utils = {
      hasLoadedNamespace: clone.hasLoadedNamespace.bind(clone)
    };
    return clone;
  }
  toJSON() {
    return {
      options: this.options,
      store: this.store,
      language: this.language,
      languages: this.languages,
      resolvedLanguage: this.resolvedLanguage
    };
  }
}
const instance = I18n.createInstance();

instance.createInstance;
instance.dir;
instance.init;
instance.loadResources;
instance.reloadResources;
instance.use;
instance.changeLanguage;
instance.getFixedT;
instance.t;
instance.exists;
instance.setDefaultNamespace;
instance.hasLoadedNamespace;
instance.loadNamespaces;
instance.loadLanguages;

function builtinI18nSchema() {
  return object({
    ...strictObject({ ...starlightI18nSchema().required().shape }).shape,
    ...pagefindI18nSchema().shape,
    ...expressiveCodeI18nSchema().shape
  });
}
function starlightI18nSchema() {
  return object({
    "skipLink.label": string().meta({
      description: "Text displayed in the accessible “Skip link” when a keyboard user first tabs into a page."
    }),
    "search.label": string().meta({ description: "Text displayed in the search bar." }),
    "search.ctrlKey": string().meta({
      description: "Visible representation of the Control key potentially used in the shortcut key to open the search modal."
    }),
    "search.cancelLabel": string().meta({ description: "Text for the “Cancel” button that closes the search modal." }),
    "search.devWarning": string().meta({
      description: "Warning displayed when opening the Search in a dev environment."
    }),
    "themeSelect.accessibleLabel": string().meta({ description: "Accessible label for the theme selection dropdown." }),
    "themeSelect.dark": string().meta({ description: "Name of the dark color theme." }),
    "themeSelect.light": string().meta({ description: "Name of the light color theme." }),
    "themeSelect.auto": string().meta({
      description: "Name of the automatic color theme that syncs with system preferences."
    }),
    "languageSelect.accessibleLabel": string().meta({ description: "Accessible label for the language selection dropdown." }),
    "menuButton.accessibleLabel": string().meta({ description: "Accessible label for the mobile menu button." }),
    "sidebarNav.accessibleLabel": string().meta({
      description: "Accessible label for the main sidebar `<nav>` element to distinguish it from other `<nav>` landmarks on the page."
    }),
    "tableOfContents.onThisPage": string().meta({ description: "Title for the table of contents component." }),
    "tableOfContents.overview": string().meta({
      description: "Label used for the first link in the table of contents, linking to the page title."
    }),
    "i18n.untranslatedContent": string().meta({
      description: "Notice informing users they are on a page that is not yet translated to their language."
    }),
    "page.editLink": string().meta({ description: "Text for the link to edit a page." }),
    "page.lastUpdated": string().meta({
      description: "Text displayed in front of the last updated date in the page footer."
    }),
    "page.previousLink": string().meta({
      description: "Label shown on the “previous page” pagination arrow in the page footer."
    }),
    "page.nextLink": string().meta({
      description: "Label shown on the “next page” pagination arrow in the page footer."
    }),
    "page.draft": string().meta({
      description: "Development-only notice informing users they are on a page that is a draft which will not be included in production builds."
    }),
    "404.text": string().meta({ description: "Text shown on Starlight’s default 404 page" }),
    "aside.tip": string().meta({ description: "Text shown on the tip aside variant" }),
    "aside.note": string().meta({ description: "Text shown on the note aside variant" }),
    "aside.caution": string().meta({ description: "Text shown on the warning aside variant" }),
    "aside.danger": string().meta({ description: "Text shown on the danger aside variant" }),
    "fileTree.directory": string().meta({ description: "Label for the directory icon in the file tree component." }),
    "builtWithStarlight.label": string().meta({
      description: "Label for the “Built with Starlight” badge optionally displayed in the site footer."
    }),
    "heading.anchorLabel": string().meta({ description: "Label for anchor links in Markdown content." })
  }).partial();
}
function pagefindI18nSchema() {
  return object({
    "pagefind.clear_search": string().meta({
      description: 'Pagefind UI translation. English default value: `"Clear"`. See https://pagefind.app/docs/ui/#translations'
    }),
    "pagefind.load_more": string().meta({
      description: 'Pagefind UI translation. English default value: `"Load more results"`. See https://pagefind.app/docs/ui/#translations'
    }),
    "pagefind.search_label": string().meta({
      description: 'Pagefind UI translation. English default value: `"Search this site"`. See https://pagefind.app/docs/ui/#translations'
    }),
    "pagefind.filters_label": string().meta({
      description: 'Pagefind UI translation. English default value: `"Filters"`. See https://pagefind.app/docs/ui/#translations'
    }),
    "pagefind.zero_results": string().meta({
      description: 'Pagefind UI translation. English default value: `"No results for [SEARCH_TERM]"`. See https://pagefind.app/docs/ui/#translations'
    }),
    "pagefind.many_results": string().meta({
      description: 'Pagefind UI translation. English default value: `"[COUNT] results for [SEARCH_TERM]"`. See https://pagefind.app/docs/ui/#translations'
    }),
    "pagefind.one_result": string().meta({
      description: 'Pagefind UI translation. English default value: `"[COUNT] result for [SEARCH_TERM]"`. See https://pagefind.app/docs/ui/#translations'
    }),
    "pagefind.alt_search": string().meta({
      description: 'Pagefind UI translation. English default value: `"No results for [SEARCH_TERM]. Showing results for [DIFFERENT_TERM] instead"`. See https://pagefind.app/docs/ui/#translations'
    }),
    "pagefind.search_suggestion": string().meta({
      description: 'Pagefind UI translation. English default value: `"No results for [SEARCH_TERM]. Try one of the following searches:"`. See https://pagefind.app/docs/ui/#translations'
    }),
    "pagefind.searching": string().meta({
      description: 'Pagefind UI translation. English default value: `"Searching for [SEARCH_TERM]..."`. See https://pagefind.app/docs/ui/#translations'
    })
  }).partial();
}
function expressiveCodeI18nSchema() {
  return object({
    "expressiveCode.copyButtonCopied": string().meta({
      description: 'Expressive Code UI translation. English default value: `"Copied!"`'
    }),
    "expressiveCode.copyButtonTooltip": string().meta({
      description: 'Expressive Code UI translation. English default value: `"Copy to clipboard"`'
    }),
    "expressiveCode.terminalWindowFallbackTitle": string().meta({
      description: 'Expressive Code UI translation. English default value: `"Terminal window"`'
    })
  }).partial();
}

const cs = {
  "skipLink.label": "Přeskočit na obsah",
  "search.label": "Hledat",
  "search.ctrlKey": "Ctrl",
  "search.cancelLabel": "Zrušit",
  "search.devWarning": "Vyhledávání je dostupné pouze v produkčních sestaveních. \nZkuste sestavit a zobrazit náhled webu a otestovat jej lokálně.",
  "themeSelect.accessibleLabel": "Vyberte motiv",
  "themeSelect.dark": "Tmavý",
  "themeSelect.light": "Světlý",
  "themeSelect.auto": "Auto",
  "languageSelect.accessibleLabel": "Vyberte jazyk",
  "menuButton.accessibleLabel": "Nabídka",
  "sidebarNav.accessibleLabel": "Hlavní",
  "tableOfContents.onThisPage": "Na této stránce",
  "tableOfContents.overview": "Přehled",
  "i18n.untranslatedContent": "Tento obsah zatím není dostupný ve vašem jazyce.",
  "page.editLink": "Upravit stránku",
  "page.lastUpdated": "Aktualizováno:",
  "page.previousLink": "Předchozí",
  "page.nextLink": "Další",
  "page.draft": "Tento obsah je koncept a nebude zahrnutý v produkčním sestavení.",
  "404.text": "Stránka nenalezena. Zkontrolujte adresu nebo zkuste použít vyhledávač.",
  "aside.note": "Poznámka",
  "aside.tip": "Tip",
  "aside.caution": "Upozornění",
  "aside.danger": "Nebezpečí",
  "fileTree.directory": "Adresář",
  "builtWithStarlight.label": "Postaveno se Starlight",
  "expressiveCode.copyButtonCopied": "Zkopírováno!",
  "expressiveCode.copyButtonTooltip": "Kopírovat do schránky",
  "expressiveCode.terminalWindowFallbackTitle": "Terminál",
  "pagefind.clear_search": "Vyčistit",
  "pagefind.load_more": "Načíst další výsledky",
  "pagefind.search_label": "Vyhledat stránku",
  "pagefind.filters_label": "Filtry",
  "pagefind.zero_results": "Žádný výsledek pro: [SEARCH_TERM]",
  "pagefind.many_results": "počet výsledků: [COUNT] pro: [SEARCH_TERM]",
  "pagefind.one_result": "[COUNT] výsledek pro: [SEARCH_TERM]",
  "pagefind.alt_search": "Žádné výsledky pro [SEARCH_TERM]. Namísto toho zobrazuji výsledky pro: [DIFFERENT_TERM]",
  "pagefind.search_suggestion": "Žádný výsledek pro [SEARCH_TERM]. Zkus nějaké z těchto hledání:",
  "pagefind.searching": "Hledám [SEARCH_TERM]...",
  "heading.anchorLabel": "Sekce “{{title}}”",
};

const en = {
  "skipLink.label": "Skip to content",
  "search.label": "Search",
  "search.ctrlKey": "Ctrl",
  "search.cancelLabel": "Cancel",
  "search.devWarning": "Search is only available in production builds. \nTry building and previewing the site to test it out locally.",
  "themeSelect.accessibleLabel": "Select theme",
  "themeSelect.dark": "Dark",
  "themeSelect.light": "Light",
  "themeSelect.auto": "Auto",
  "languageSelect.accessibleLabel": "Select language",
  "menuButton.accessibleLabel": "Menu",
  "sidebarNav.accessibleLabel": "Main",
  "tableOfContents.onThisPage": "On this page",
  "tableOfContents.overview": "Overview",
  "i18n.untranslatedContent": "This content is not available in your language yet.",
  "page.editLink": "Edit page",
  "page.lastUpdated": "Last updated:",
  "page.previousLink": "Previous",
  "page.nextLink": "Next",
  "page.draft": "This content is a draft and will not be included in production builds.",
  "404.text": "Page not found. Check the URL or try using the search bar.",
  "aside.note": "Note",
  "aside.tip": "Tip",
  "aside.caution": "Caution",
  "aside.danger": "Danger",
  "fileTree.directory": "Directory",
  "builtWithStarlight.label": "Built with Starlight",
  "heading.anchorLabel": "Section titled “{{title}}”",
};

const es = {
  "skipLink.label": "Ir al contenido",
  "search.label": "Buscar",
  "search.ctrlKey": "Ctrl",
  "search.cancelLabel": "Cancelar",
  "search.devWarning": "La búsqueda solo está disponible en las versiones de producción.  \nIntenta construir y previsualizar el sitio para probarlo localmente.",
  "themeSelect.accessibleLabel": "Seleccionar tema",
  "themeSelect.dark": "Oscuro",
  "themeSelect.light": "Claro",
  "themeSelect.auto": "Automático",
  "languageSelect.accessibleLabel": "Seleccionar idioma",
  "menuButton.accessibleLabel": "Menú",
  "sidebarNav.accessibleLabel": "Primario",
  "tableOfContents.onThisPage": "En esta página",
  "tableOfContents.overview": "Sinopsis",
  "i18n.untranslatedContent": "Esta página aún no está disponible en tu idioma.",
  "page.editLink": "Edita esta página",
  "page.lastUpdated": "Última actualización:",
  "page.previousLink": "Página anterior",
  "page.nextLink": "Siguiente página",
  "page.draft": "Este contenido es un borrador y no se incluirá en las versiones de producción.",
  "404.text": "Página no encontrada. Verifica la URL o intenta usar la barra de búsqueda.",
  "aside.note": "Nota",
  "aside.tip": "Consejo",
  "aside.caution": "Precaución",
  "aside.danger": "Peligro",
  "expressiveCode.copyButtonCopied": "¡Copiado!",
  "expressiveCode.copyButtonTooltip": "Copiar al portapapeles",
  "expressiveCode.terminalWindowFallbackTitle": "Ventana de terminal",
  "fileTree.directory": "Directorio",
  "builtWithStarlight.label": "Hecho con Starlight",
  "pagefind.clear_search": "Limpiar",
  "pagefind.load_more": "Cargar más resultados",
  "pagefind.search_label": "Buscar página",
  "pagefind.filters_label": "Filtros",
  "pagefind.zero_results": "Ningún resultado para: [SEARCH_TERM]",
  "pagefind.many_results": "[COUNT] resultados para: [SEARCH_TERM]",
  "pagefind.one_result": "[COUNT] resultado para: [SEARCH_TERM]",
  "pagefind.alt_search": "Ningún resultado para [SEARCH_TERM]. Mostrando resultados para: [DIFFERENT_TERM]",
  "pagefind.search_suggestion": "Ningún resultado para [SEARCH_TERM]. Prueba alguna de estas búsquedas:",
  "pagefind.searching": "Buscando [SEARCH_TERM]...",
  "heading.anchorLabel": "Sección titulada «{{title}}»",
};

const ca = {
  "skipLink.label": "Saltar al contingut",
  "search.label": "Cercar",
  "search.ctrlKey": "Ctrl",
  "search.cancelLabel": "Cancel·lar",
  "search.devWarning": "La cerca només està disponible a les versions de producció.  \nProva de construir i previsualitzar el lloc per provar-ho localment.",
  "themeSelect.accessibleLabel": "Seleccionar tema",
  "themeSelect.dark": "Fosc",
  "themeSelect.light": "Clar",
  "themeSelect.auto": "Automàtic",
  "languageSelect.accessibleLabel": "Seleccionar idioma",
  "menuButton.accessibleLabel": "Menú",
  "sidebarNav.accessibleLabel": "Primari",
  "tableOfContents.onThisPage": "En aquesta pàgina",
  "tableOfContents.overview": "Sinopsi",
  "i18n.untranslatedContent": "Aquesta pàgina encara no està disponible en el teu idioma.",
  "page.editLink": "Edita aquesta pàgina",
  "page.lastUpdated": "Última actualització:",
  "page.previousLink": "Pàgina anterior",
  "page.nextLink": "Pàgina següent",
  "page.draft": "Aquest contingut és un esborrany i no s'inclourà en les versions de producció.",
  "404.text": "Pàgina no trobada. Comprova la URL o intenta utilitzar la barra de cerca.",
  "aside.note": "Nota",
  "aside.tip": "Consell",
  "aside.caution": "Precaució",
  "aside.danger": "Perill",
  "expressiveCode.copyButtonCopied": "Copiat!",
  "expressiveCode.copyButtonTooltip": "Copiar al porta-retalls",
  "expressiveCode.terminalWindowFallbackTitle": "Finestra del terminal",
  "fileTree.directory": "Directori",
  "builtWithStarlight.label": "Fet amb Starlight",
  "pagefind.clear_search": "Netejar",
  "pagefind.load_more": "Carregar més resultats",
  "pagefind.search_label": "Cercar pàgina",
  "pagefind.filters_label": "Filtres",
  "pagefind.zero_results": "Cap resultat per a: [SEARCH_TERM]",
  "pagefind.many_results": "[COUNT] resultats per a: [SEARCH_TERM]",
  "pagefind.one_result": "[COUNT] resultat per a: [SEARCH_TERM]",
  "pagefind.alt_search": "Cap resultat per a [SEARCH_TERM]. Mostrant resultats per a: [DIFFERENT_TERM]",
  "pagefind.search_suggestion": "Cap resultat per a [SEARCH_TERM]. Prova alguna d’aquestes cerques:",
  "pagefind.searching": "Cercant [SEARCH_TERM]...",
  "heading.anchorLabel": "Section titled “{{title}}”",
};

const de = {
  "skipLink.label": "Zum Inhalt springen",
  "search.label": "Suchen",
  "search.ctrlKey": "Strg",
  "search.cancelLabel": "Abbrechen",
  "search.devWarning": "Die Suche ist nur in Produktions-Builds verfügbar. \nVersuche, die Website zu bauen und in der Vorschau anzusehen, um sie lokal zu testen.",
  "themeSelect.accessibleLabel": "Farbschema wählen",
  "themeSelect.dark": "Dunkel",
  "themeSelect.light": "Hell",
  "themeSelect.auto": "System",
  "languageSelect.accessibleLabel": "Sprache wählen",
  "menuButton.accessibleLabel": "Menü",
  "sidebarNav.accessibleLabel": "Hauptnavigation",
  "tableOfContents.onThisPage": "Auf dieser Seite",
  "tableOfContents.overview": "Überblick",
  "i18n.untranslatedContent": "Dieser Inhalt ist noch nicht in deiner Sprache verfügbar.",
  "page.editLink": "Seite bearbeiten",
  "page.lastUpdated": "Zuletzt aktualisiert:",
  "page.previousLink": "Vorherige Seite",
  "page.nextLink": "Nächste Seite",
  "page.draft": "Dieser Inhalt ist ein Entwurf und wird nicht in den Produktions-Builds enthalten sein.",
  "404.text": "Seite nicht gefunden. Überprüfe die URL oder nutze die Suchleiste.",
  "aside.note": "Hinweis",
  "aside.tip": "Tipp",
  "aside.caution": "Achtung",
  "aside.danger": "Gefahr",
  "fileTree.directory": "Ordner",
  "builtWithStarlight.label": "Erstellt mit Starlight",
  "heading.anchorLabel": "Abschnitt betitelt „{{title}}“",
};

const ja = {
  "skipLink.label": "コンテンツにスキップ",
  "search.label": "検索",
  "search.ctrlKey": "Ctrl",
  "search.cancelLabel": "キャンセル",
  "search.devWarning": "検索はプロダクションビルドでのみ利用可能です。\nローカルでテストするには、サイトをビルドしてプレビューしてください。",
  "themeSelect.accessibleLabel": "テーマの選択",
  "themeSelect.dark": "ダーク",
  "themeSelect.light": "ライト",
  "themeSelect.auto": "自動",
  "languageSelect.accessibleLabel": "言語の選択",
  "menuButton.accessibleLabel": "メニュー",
  "sidebarNav.accessibleLabel": "メイン",
  "tableOfContents.onThisPage": "目次",
  "tableOfContents.overview": "概要",
  "i18n.untranslatedContent": "このコンテンツはまだ日本語訳がありません。",
  "page.editLink": "ページを編集",
  "page.lastUpdated": "最終更新日:",
  "page.previousLink": "前へ",
  "page.nextLink": "次へ",
  "page.draft": "このコンテンツは下書きです。プロダクションビルドには含まれません。",
  "404.text": "ページが見つかりません。 URL を確認するか、検索バーを使用してみてください。",
  "aside.note": "ノート",
  "aside.tip": "ヒント",
  "aside.caution": "注意",
  "aside.danger": "危険",
  "fileTree.directory": "ディレクトリ",
  "builtWithStarlight.label": "Starlightで作成",
  "heading.anchorLabel": "Section titled “{{title}}”",
};

const pt = {
  "skipLink.label": "Pular para o conteúdo",
  "search.label": "Pesquisar",
  "search.ctrlKey": "Ctrl",
  "search.cancelLabel": "Cancelar",
  "search.devWarning": "A pesquisa está disponível apenas em builds em produção. \nTente fazer a build e pré-visualize o site para testar localmente.",
  "themeSelect.accessibleLabel": "Selecionar tema",
  "themeSelect.dark": "Escuro",
  "themeSelect.light": "Claro",
  "themeSelect.auto": "Auto",
  "languageSelect.accessibleLabel": "Selecionar língua",
  "menuButton.accessibleLabel": "Menu",
  "sidebarNav.accessibleLabel": "Principal",
  "tableOfContents.onThisPage": "Nesta página",
  "tableOfContents.overview": "Visão geral",
  "i18n.untranslatedContent": "Este conteúdo não está disponível em sua língua ainda.",
  "page.editLink": "Editar página",
  "page.lastUpdated": "Última atualização:",
  "page.previousLink": "Anterior",
  "page.nextLink": "Próximo",
  "page.draft": "Esse conteúdo é um rascunho e não será incluído em builds de produção.",
  "404.text": "Página não encontrada. Verifique o URL ou tente usar a barra de pesquisa.",
  "aside.note": "Nota",
  "aside.tip": "Dica",
  "aside.caution": "Cuidado",
  "aside.danger": "Perigo",
  "fileTree.directory": "Directory",
  "builtWithStarlight.label": "Feito com Starlight",
  "heading.anchorLabel": "Seção intitulada “{{title}}”",
};

const fa = {
  "skipLink.label": "رفتن به محتوا",
  "search.label": "جستجو",
  "search.ctrlKey": "Ctrl",
  "search.cancelLabel": "لغو",
  "search.devWarning": "جستجو تنها در نسخه‌های تولیدی در دسترس است. \nسعی کنید سایت را بسازید و پیش‌نمایش آن را به صورت محلی آزمایش کنید.",
  "themeSelect.accessibleLabel": "انتخاب پوسته",
  "themeSelect.dark": "تیره",
  "themeSelect.light": "روشن",
  "themeSelect.auto": "خودکار",
  "languageSelect.accessibleLabel": "انتخاب زبان",
  "menuButton.accessibleLabel": "منو",
  "sidebarNav.accessibleLabel": "اصلی",
  "tableOfContents.onThisPage": "در این صفحه",
  "tableOfContents.overview": "نگاه کلی",
  "i18n.untranslatedContent": "این محتوا هنوز به زبان شما در دسترس نیست.",
  "page.editLink": "ویرایش صفحه",
  "page.lastUpdated": "آخرین به‌روزرسانی:",
  "page.previousLink": "قبلی",
  "page.nextLink": "بعدی",
  "page.draft": "This content is a draft and will not be included in production builds.",
  "404.text": "صفحه یافت نشد. لطفاً URL را بررسی کنید یا از جستجو استفاده نمایید.",
  "aside.note": "یادداشت",
  "aside.tip": "نکته",
  "aside.caution": "احتیاط",
  "aside.danger": "خطر",
  "fileTree.directory": "فهرست",
  "builtWithStarlight.label": "Built with Starlight",
  "heading.anchorLabel": "Section titled “{{title}}”",
};

const fi = {
  "skipLink.label": "Siirry sisältöön",
  "search.label": "Haku",
  "search.ctrlKey": "Ctrl",
  "search.cancelLabel": "Peruuta",
  "search.devWarning": "Haku on käytettävissä vain tuotantoversioissa.\nKokeile kääntää ja esikatsella sivustoa paikallisesti testataksesi sitä.",
  "themeSelect.accessibleLabel": "Valitse teema",
  "themeSelect.dark": "Tumma",
  "themeSelect.light": "Vaalea",
  "themeSelect.auto": "Automaattinen",
  "languageSelect.accessibleLabel": "Valitse kieli",
  "menuButton.accessibleLabel": "Valikko",
  "sidebarNav.accessibleLabel": "Päävalikko",
  "tableOfContents.onThisPage": "Tällä sivulla",
  "tableOfContents.overview": "Yleiskatsaus",
  "i18n.untranslatedContent": "Tämä sisältö ei ole vielä saatavilla valitsemallasi kielellä.",
  "page.editLink": "Muokkaa sivua",
  "page.lastUpdated": "Viimeksi päivitetty:",
  "page.previousLink": "Edellinen",
  "page.nextLink": "Seuraava",
  "page.draft": "Tämä sisältö on luonnos eikä sitä sisällytetä tuotantoversioon.",
  "404.text": "Sivua ei löytynyt. Tarkista URL-osoite tai käytä hakupalkkia.",
  "aside.note": "Huomio",
  "aside.tip": "Vinkki",
  "aside.caution": "Varoitus",
  "aside.danger": "Vaara",
  "fileTree.directory": "Hakemisto",
  "builtWithStarlight.label": "Rakennettu Starlightilla",
  "heading.anchorLabel": "Osio nimeltä “{{title}}”",
};

const fr = {
  "skipLink.label": "Aller au contenu",
  "search.label": "Rechercher",
  "search.ctrlKey": "Ctrl",
  "search.cancelLabel": "Annuler",
  "search.devWarning": "La recherche est disponible uniquement en mode production. \nEssayez de construire puis de prévisualiser votre site pour tester la recherche localement.",
  "themeSelect.accessibleLabel": "Selectionner le thème",
  "themeSelect.dark": "Sombre",
  "themeSelect.light": "Clair",
  "themeSelect.auto": "Auto",
  "languageSelect.accessibleLabel": "Selectionner la langue",
  "menuButton.accessibleLabel": "Menu",
  "sidebarNav.accessibleLabel": "principale",
  "tableOfContents.onThisPage": "Sur cette page",
  "tableOfContents.overview": "Vue d’ensemble",
  "i18n.untranslatedContent": "Ce contenu n’est pas encore disponible dans votre langue.",
  "page.editLink": "Modifier cette page",
  "page.lastUpdated": "Dernière mise à jour :",
  "page.previousLink": "Précédent",
  "page.nextLink": "Suivant",
  "page.draft": "Ce contenu est une ébauche et ne sera pas inclus dans la version de production.",
  "404.text": "Page non trouvée. Vérifiez l’URL ou essayez d’utiliser la barre de recherche.",
  "aside.note": "Note",
  "aside.tip": "Astuce",
  "aside.caution": "Attention",
  "aside.danger": "Danger",
  "expressiveCode.copyButtonCopied": "Copié !",
  "expressiveCode.copyButtonTooltip": "Copier dans le presse-papiers",
  "expressiveCode.terminalWindowFallbackTitle": "Fenêtre de terminal",
  "fileTree.directory": "Répertoire",
  "builtWithStarlight.label": "Créé avec Starlight",
  "heading.anchorLabel": "Section intitulée « {{title}} »",
};

const gl = {
  "skipLink.label": "Ir ao contido",
  "search.label": "Busca",
  "search.ctrlKey": "Ctrl",
  "search.cancelLabel": "Deixar",
  "search.devWarning": "A busca só está dispoñible nas versións de producción. \nTrata de construir e ollear o sitio para probalo localmente.",
  "themeSelect.accessibleLabel": "Selecciona tema",
  "themeSelect.dark": "Escuro",
  "themeSelect.light": "Claro",
  "themeSelect.auto": "Auto",
  "languageSelect.accessibleLabel": "Seleciona linguaxe",
  "menuButton.accessibleLabel": "Menú",
  "sidebarNav.accessibleLabel": "Principal",
  "tableOfContents.onThisPage": "Nesta páxina",
  "tableOfContents.overview": "Sinopse",
  "i18n.untranslatedContent": "Este contido aínda non está dispoñible no teu idioma.",
  "page.editLink": "Editar páxina",
  "page.lastUpdated": "Última actualización:",
  "page.previousLink": "Anterior",
  "page.nextLink": "Seguinte",
  "page.draft": "Este contido é un borrador e non se incluirá nas versións de producción.",
  "404.text": "Páxina non atopada. Comproba a URL ou intenta usar a barra de busca.",
  "aside.note": "Nota",
  "aside.tip": "Consello",
  "aside.caution": "Precaución",
  "aside.danger": "Perigo",
  "expressiveCode.copyButtonCopied": "¡Copiado!",
  "expressiveCode.copyButtonTooltip": "Copiar ao portapapeis",
  "expressiveCode.terminalWindowFallbackTitle": "Fiestra do terminal",
  "fileTree.directory": "Directorio",
  "builtWithStarlight.label": "Feito con Starlight",
  "pagefind.clear_search": "Limpar",
  "pagefind.load_more": "Cargar máis resultados",
  "pagefind.search_label": "Buscar páxina",
  "pagefind.filters_label": "Filtros",
  "pagefind.zero_results": "Ningún resultado para: [SEARCH_TERM]",
  "pagefind.many_results": "[COUNT] resultados para: [SEARCH_TERM]",
  "pagefind.one_result": "[COUNT] resultado para: [SEARCH_TERM]",
  "pagefind.alt_search": "Ningún resultado para [SEARCH_TERM]. Amósanse resultados para: [DIFFERENT_TERM]",
  "pagefind.search_suggestion": "Ningún resultado para [SEARCH_TERM]. Proba algunha destas buscas:",
  "pagefind.searching": "Buscando [SEARCH_TERM]...",
  "heading.anchorLabel": "Sección titulada «{{title}}»",
};

const he = {
  "skipLink.label": "דלגו לתוכן",
  "search.label": "חיפוש",
  "search.ctrlKey": "Ctrl",
  "search.cancelLabel": "ביטול",
  "search.devWarning": "החיפוש זמין רק בסביבת ייצור. \nנסו לבנות ולהציג תצוגה מקדימה של האתר כדי לבדוק אותו באופן מקומי.",
  "themeSelect.accessibleLabel": "בחרו פרופיל צבע",
  "themeSelect.dark": "כהה",
  "themeSelect.light": "בהיר",
  "themeSelect.auto": "מערכת",
  "languageSelect.accessibleLabel": "בחרו שפה",
  "menuButton.accessibleLabel": "תפריט",
  "sidebarNav.accessibleLabel": "ראשי",
  "tableOfContents.onThisPage": "בדף זה",
  "tableOfContents.overview": "סקירה כללית",
  "i18n.untranslatedContent": "תוכן זה אינו זמין עדיין בשפה שלך.",
  "page.editLink": "ערכו דף",
  "page.lastUpdated": "עדכון אחרון:",
  "page.previousLink": "הקודם",
  "page.nextLink": "הבא",
  "page.draft": "This content is a draft and will not be included in production builds.",
  "404.text": "הדף לא נמצא. אנא בדקו את כתובת האתר או נסו להשתמש בסרגל החיפוש.",
  "aside.note": "Note",
  "aside.tip": "Tip",
  "aside.caution": "Caution",
  "aside.danger": "Danger",
  "fileTree.directory": "Directory",
  "builtWithStarlight.label": "Built with Starlight",
  "heading.anchorLabel": "Section titled “{{title}}”",
};

const id = {
  "skipLink.label": "Lewati ke konten",
  "search.label": "Pencarian",
  "search.ctrlKey": "Ctrl",
  "search.cancelLabel": "Batal",
  "search.devWarning": "Pencarian hanya tersedia pada build produksi. \nLakukan proses build dan pratinjau situs Anda sebelum mencoba di lingkungan lokal.",
  "themeSelect.accessibleLabel": "Pilih tema",
  "themeSelect.dark": "Gelap",
  "themeSelect.light": "Terang",
  "themeSelect.auto": "Otomatis",
  "languageSelect.accessibleLabel": "Pilih Bahasa",
  "menuButton.accessibleLabel": "Menu",
  "sidebarNav.accessibleLabel": "Utama",
  "tableOfContents.onThisPage": "Di halaman ini",
  "tableOfContents.overview": "Ringkasan",
  "i18n.untranslatedContent": "Konten ini belum tersedia dalam bahasa Anda.",
  "page.editLink": "Edit halaman",
  "page.lastUpdated": "Terakhir diperbaharui:",
  "page.previousLink": "Sebelumnya",
  "page.nextLink": "Selanjutnya",
  "page.draft": "This content is a draft and will not be included in production builds.",
  "404.text": "Halaman tidak ditemukan. Cek kembali kolom URL atau gunakan fitur pencarian.",
  "aside.note": "Catatan",
  "aside.tip": "Tips",
  "aside.caution": "Perhatian",
  "aside.danger": "Bahaya",
  "fileTree.directory": "Directory",
  "builtWithStarlight.label": "Built with Starlight",
  "heading.anchorLabel": "Section titled “{{title}}”",
};

const it = {
  "skipLink.label": "Salta ai contenuti",
  "search.label": "Cerca",
  "search.ctrlKey": "Ctrl",
  "search.cancelLabel": "Cancella",
  "search.devWarning": "La ricerca è disponibile solo nelle build di produzione. \nProvare ad eseguire il processo di build e visualizzare la preview del sito per testarlo localmente.",
  "themeSelect.accessibleLabel": "Seleziona tema",
  "themeSelect.dark": "Scuro",
  "themeSelect.light": "Chiaro",
  "themeSelect.auto": "Auto",
  "languageSelect.accessibleLabel": "Seleziona lingua",
  "menuButton.accessibleLabel": "Menu",
  "sidebarNav.accessibleLabel": "Principale",
  "tableOfContents.onThisPage": "In questa pagina",
  "tableOfContents.overview": "Panoramica",
  "i18n.untranslatedContent": "Questi contenuti non sono ancora disponibili nella tua lingua.",
  "page.editLink": "Modifica pagina",
  "page.lastUpdated": "Ultimo aggiornamento:",
  "page.previousLink": "Indietro",
  "page.nextLink": "Avanti",
  "page.draft": "This content is a draft and will not be included in production builds.",
  "404.text": "Pagina non trovata. Verifica l'URL o prova a utilizzare la barra di ricerca.",
  "aside.note": "Nota",
  "aside.tip": "Consiglio",
  "aside.caution": "Attenzione",
  "aside.danger": "Pericolo",
  "fileTree.directory": "Directory",
  "builtWithStarlight.label": "Built with Starlight",
  "heading.anchorLabel": "Sezione intitolata “{{title}}”",
};

const nl = {
  "skipLink.label": "Ga naar inhoud",
  "search.label": "Zoeken",
  "search.ctrlKey": "Ctrl",
  "search.cancelLabel": "Annuleren",
  "search.devWarning": "Zoeken is alleen beschikbaar tijdens productie. \nProbeer om de site te builden en er een preview van te bekijken om lokaal te testen.",
  "themeSelect.accessibleLabel": "Selecteer thema",
  "themeSelect.dark": "Donker",
  "themeSelect.light": "Licht",
  "themeSelect.auto": "Auto",
  "languageSelect.accessibleLabel": "Selecteer taal",
  "menuButton.accessibleLabel": "Menu",
  "sidebarNav.accessibleLabel": "Hoofdnavigatie",
  "tableOfContents.onThisPage": "Op deze pagina",
  "tableOfContents.overview": "Overzicht",
  "i18n.untranslatedContent": "Deze inhoud is nog niet vertaald.",
  "page.editLink": "Bewerk pagina",
  "page.lastUpdated": "Laatst bewerkt:",
  "page.previousLink": "Vorige",
  "page.nextLink": "Volgende",
  "page.draft": "This content is a draft and will not be included in production builds.",
  "404.text": "Pagina niet gevonden. Controleer de URL of probeer de zoekbalk.",
  "aside.note": "Opmerking",
  "aside.tip": "Tip",
  "aside.caution": "Opgepast",
  "aside.danger": "Gevaar",
  "fileTree.directory": "Directory",
  "builtWithStarlight.label": "Built with Starlight",
  "heading.anchorLabel": "Section titled “{{title}}”",
};

const da = {
  "skipLink.label": "Gå til indhold",
  "search.label": "Søg",
  "search.ctrlKey": "Ctrl",
  "search.cancelLabel": "Annuller",
  "search.devWarning": "Søgning er kun tilgængeligt i produktions versioner. \nPrøv at bygge siden og forhåndsvis den for at teste det lokalt.",
  "themeSelect.accessibleLabel": "Vælg tema",
  "themeSelect.dark": "Mørk",
  "themeSelect.light": "Lys",
  "themeSelect.auto": "Auto",
  "languageSelect.accessibleLabel": "Vælg sprog",
  "menuButton.accessibleLabel": "Menu",
  "sidebarNav.accessibleLabel": "Hovednavigation",
  "tableOfContents.onThisPage": "På denne side",
  "tableOfContents.overview": "Oversigt",
  "i18n.untranslatedContent": "Dette indhold er ikke tilgængeligt i dit sprog endnu.",
  "page.editLink": "Rediger siden",
  "page.lastUpdated": "Sidst opdateret:",
  "page.previousLink": "Forrige",
  "page.nextLink": "Næste",
  "page.draft": "Indholdet er en kladde og vil ikke blive inkluderet i produktions versioner.",
  "404.text": "Siden er ikke fundet. Tjek din URL eller prøv søgelinjen.",
  "aside.note": "Note",
  "aside.tip": "Tip",
  "aside.caution": "Bemærk",
  "aside.danger": "Advarsel",
  "fileTree.directory": "Mappe",
  "builtWithStarlight.label": "Bygget med Starlight",
  "heading.anchorLabel": "Sektion kaldt “{{title}}”",
};

const th = {
  "skipLink.label": "ข้ามไปยังเนื้อหา",
  "search.label": "ค้นหา",
  "search.ctrlKey": "Ctrl",
  "search.cancelLabel": "ยกเลิก",
  "search.devWarning": "การค้นหาสามารถใช้งานได้ในเฉพาะเวอร์ชันใช้งานจริงเท่านั้น\nโปรดลองบิลด์และดูตัวอย่างเว็บไซต์เพื่อทดสอบฟังก์ชันบนอุปกรณ์ของคุณ",
  "themeSelect.accessibleLabel": "เลือกธีม",
  "themeSelect.dark": "มืด",
  "themeSelect.light": "สว่าง",
  "themeSelect.auto": "อัตโนมัติ",
  "languageSelect.accessibleLabel": "เลือกภาษา",
  "menuButton.accessibleLabel": "เมนู",
  "sidebarNav.accessibleLabel": "หลัก",
  "tableOfContents.onThisPage": "ในหน้านี้",
  "tableOfContents.overview": "ภาพรวม",
  "i18n.untranslatedContent": "เนื้อหานี้ยังไม่มีในภาษาของคุณ",
  "page.editLink": "แก้ไขหน้า",
  "page.lastUpdated": "อัพเดทล่าสุด:",
  "page.previousLink": "ก่อนหน้า",
  "page.nextLink": "ถัดไป",
  "page.draft": "เนื้อหานี้เป็นแบบร่างและจะไม่ถูกใส่ในเวอร์ชันใช้งานจริง",
  "404.text": "ไม่พบหน้า โปรดตรวจสอบ URL หรือลองใช้ฟังก์ชันการค้นหา",
  "aside.note": "หมายเหตุ",
  "aside.tip": "เคล็ดลับ",
  "aside.caution": "คำเตือน",
  "aside.danger": "อันตราย",
  "fileTree.directory": "โฟลเดอร์",
  "builtWithStarlight.label": "ถูกสร้างขึ้นด้วย Starlight",
  "heading.anchorLabel": "หัวข้อที่มีชื่อว่า “{{title}}”",
};

const tr = {
  "skipLink.label": "İçeriğe geç",
  "search.label": "Ara",
  "search.ctrlKey": "Ctrl",
  "search.cancelLabel": "İptal",
  "search.devWarning": "Arama yalnızca üretim derlemelerinde kullanılabilir. \nYerel bilgisayarınızda test etmek için siteyi derleyin ve önizleme yapın.",
  "themeSelect.accessibleLabel": "Tema seç",
  "themeSelect.dark": "Koyu",
  "themeSelect.light": "Açık",
  "themeSelect.auto": "Otomatik",
  "languageSelect.accessibleLabel": "Dil seçin",
  "menuButton.accessibleLabel": "Menü",
  "sidebarNav.accessibleLabel": "Ana",
  "tableOfContents.onThisPage": "Sayfa içeriği",
  "tableOfContents.overview": "Genel bakış",
  "i18n.untranslatedContent": "Bu içerik henüz dilinizde mevcut değil.",
  "page.editLink": "Sayfayı düzenle",
  "page.lastUpdated": "Son güncelleme:",
  "page.previousLink": "Önceki",
  "page.nextLink": "Sonraki",
  "page.draft": "Bu içerik taslaktır ve canlı sürümde bulunmayacaktır.",
  "404.text": "Sayfa bulunamadı. URL'i kontrol edin ya da arama çubuğunu kullanmayı deneyin.",
  "aside.note": "Not",
  "aside.tip": "İpucu",
  "aside.caution": "Dikkat",
  "aside.danger": "Tehlike",
  "fileTree.directory": "Dizin",
  "builtWithStarlight.label": "Built with Starlight",
  "heading.anchorLabel": "Section titled “{{title}}”",
};

const ar = {
  "skipLink.label": "تخطَّ إلى المحتوى",
  "search.label": "ابحث",
  "search.ctrlKey": "Ctrl",
  "search.cancelLabel": "إلغاء",
  "search.devWarning": "البحث متوفر فقط في بنيات اﻹنتاج. \n جرب بناء المشروع ومعاينته على جهازك",
  "themeSelect.accessibleLabel": "اختر سمة",
  "themeSelect.dark": "داكن",
  "themeSelect.light": "فاتح",
  "themeSelect.auto": "تلقائي",
  "languageSelect.accessibleLabel": "اختر لغة",
  "menuButton.accessibleLabel": "القائمة",
  "sidebarNav.accessibleLabel": "الرئيسية",
  "tableOfContents.onThisPage": "على هذه الصفحة",
  "tableOfContents.overview": "نظرة عامة",
  "i18n.untranslatedContent": "هذا المحتوى غير متوفر بلغتك بعد.",
  "page.editLink": "عدل الصفحة",
  "page.lastUpdated": "آخر تحديث:",
  "page.previousLink": "السابق",
  "page.nextLink": "التالي",
  "page.draft": "هذا المحتوى مجرد مسودة ولن يظهر في بنيات الإنتاج",
  "404.text": "الصفحة غير موجودة. تأكد من الرابط أو ابحث بإستعمال شريط البحث.",
  "aside.note": "ملاحظة",
  "aside.tip": "نصيحة",
  "aside.caution": "تنبيه",
  "aside.danger": "تحذير",
  "fileTree.directory": "Directory",
  "builtWithStarlight.label": "طوِّر بواسطة Starlight",
  "heading.anchorLabel": "Section titled “{{title}}”",
};

const nb = {
  "skipLink.label": "Gå til innholdet",
  "search.label": "Søk",
  "search.ctrlKey": "Ctrl",
  "search.cancelLabel": "Avbryt",
  "search.devWarning": "Søk er bare tilgjengelig i produksjonsbygg. \nPrøv å bygg siden og forhåndsvis den for å teste det lokalt.",
  "themeSelect.accessibleLabel": "Velg tema",
  "themeSelect.dark": "Mørk",
  "themeSelect.light": "Lys",
  "themeSelect.auto": "Auto",
  "languageSelect.accessibleLabel": "Velg språk",
  "menuButton.accessibleLabel": "Meny",
  "sidebarNav.accessibleLabel": "Hovednavigasjon",
  "tableOfContents.onThisPage": "På denne siden",
  "tableOfContents.overview": "Oversikt",
  "i18n.untranslatedContent": "Dette innholdet er ikke tilgjengelig på ditt språk.",
  "page.editLink": "Rediger side",
  "page.lastUpdated": "Sist oppdatert:",
  "page.previousLink": "Forrige",
  "page.nextLink": "Neste",
  "page.draft": "This content is a draft and will not be included in production builds.",
  "404.text": "Siden ble ikke funnet. Sjekk URL-en eller prøv å bruke søkefeltet.",
  "aside.note": "Merknad",
  "aside.tip": "Tips",
  "aside.caution": "Advarsel",
  "aside.danger": "Fare",
  "fileTree.directory": "Mappe",
  "builtWithStarlight.label": "Laget med Starlight",
  "heading.anchorLabel": "Section titled “{{title}}”",
};

const zh = {
  "skipLink.label": "跳转到内容",
  "search.label": "搜索",
  "search.ctrlKey": "Ctrl",
  "search.cancelLabel": "取消",
  "search.devWarning": "搜索仅适用于生产版本。\n尝试构建并预览网站以在本地测试。",
  "themeSelect.accessibleLabel": "选择主题",
  "themeSelect.dark": "深色",
  "themeSelect.light": "浅色",
  "themeSelect.auto": "自动",
  "languageSelect.accessibleLabel": "选择语言",
  "menuButton.accessibleLabel": "菜单",
  "sidebarNav.accessibleLabel": "主要",
  "tableOfContents.onThisPage": "本页内容",
  "tableOfContents.overview": "概述",
  "i18n.untranslatedContent": "此内容尚不支持你的语言。",
  "page.editLink": "编辑此页",
  "page.lastUpdated": "最近更新：",
  "page.previousLink": "上一页",
  "page.nextLink": "下一页",
  "page.draft": "此内容为草稿，不会包含在生产版本中。",
  "404.text": "页面未找到。检查 URL 或尝试使用搜索栏。",
  "aside.note": "注意",
  "aside.tip": "提示",
  "aside.caution": "警告",
  "aside.danger": "危险",
  "fileTree.directory": "文件夹",
  "builtWithStarlight.label": "基于 Starlight 构建",
  "heading.anchorLabel": "Section titled “{{title}}”",
};

const ko = {
  "skipLink.label": "콘텐츠로 이동",
  "search.label": "검색",
  "search.ctrlKey": "Ctrl",
  "search.cancelLabel": "취소",
  "search.devWarning": "검색 기능은 프로덕션 빌드에서만 작동합니다. \n로컬에서 테스트하려면 사이트를 빌드하고 미리 보기를 실행하세요.",
  "themeSelect.accessibleLabel": "테마 선택",
  "themeSelect.dark": "어두운 테마",
  "themeSelect.light": "밝은 테마",
  "themeSelect.auto": "자동",
  "languageSelect.accessibleLabel": "언어 선택",
  "menuButton.accessibleLabel": "메뉴",
  "sidebarNav.accessibleLabel": "메인",
  "tableOfContents.onThisPage": "목차",
  "tableOfContents.overview": "개요",
  "i18n.untranslatedContent": "이 콘텐츠는 아직 번역되지 않았습니다.",
  "page.editLink": "페이지 편집",
  "page.lastUpdated": "마지막 업데이트:",
  "page.previousLink": "이전 페이지",
  "page.nextLink": "다음 페이지",
  "page.draft": "이 콘텐츠는 아직 초안 상태이며, 최종 빌드에는 포함되지 않습니다.",
  "404.text": "페이지를 찾을 수 없습니다. URL을 다시 확인해보거나 검색을 사용해보세요.",
  "aside.note": "참고",
  "aside.tip": "팁",
  "aside.caution": "주의",
  "aside.danger": "위험",
  "fileTree.directory": "디렉터리",
  "builtWithStarlight.label": "이 웹사이트는 Starlight로 제작되었습니다.",
  "heading.anchorLabel": "섹션 제목: “{{title}}”",
};

const sv = {
  "skipLink.label": "Hoppa till innehåll",
  "search.label": "Sök",
  "search.ctrlKey": "Ctrl",
  "search.cancelLabel": "Avbryt",
  "search.devWarning": "Sökfunktionen är endast tillgänglig i produktionsbyggen. \nProva att bygga och förhandsvisa siten för att testa det lokalt.",
  "themeSelect.accessibleLabel": "Välj tema",
  "themeSelect.dark": "Mörkt",
  "themeSelect.light": "Ljust",
  "themeSelect.auto": "Auto",
  "languageSelect.accessibleLabel": "Välj språk",
  "menuButton.accessibleLabel": "Meny",
  "sidebarNav.accessibleLabel": "Huvudmeny",
  "tableOfContents.onThisPage": "På den här sidan",
  "tableOfContents.overview": "Översikt",
  "i18n.untranslatedContent": "Det här innehållet är inte tillgängligt på ditt språk än.",
  "page.editLink": "Redigera sida",
  "page.lastUpdated": "Senast uppdaterad:",
  "page.previousLink": "Föregående",
  "page.nextLink": "Nästa",
  "page.draft": "This content is a draft and will not be included in production builds.",
  "404.text": "Sidan hittades inte. Kontrollera URL:n eller testa att använda sökfältet.",
  "aside.note": "Note",
  "aside.tip": "Tip",
  "aside.caution": "Caution",
  "aside.danger": "Danger",
  "fileTree.directory": "Directory",
  "builtWithStarlight.label": "Built with Starlight",
  "heading.anchorLabel": "Section titled “{{title}}”",
};

const ro = {
  "skipLink.label": "Sari la conținut",
  "search.label": "Caută",
  "search.ctrlKey": "Ctrl",
  "search.cancelLabel": "Anulează",
  "search.devWarning": "Căutarea este disponibilă numai în versiunea de producție. \nÎncercă să construiești și să previzualizezi site-ul pentru a-l testa local.",
  "themeSelect.accessibleLabel": "Selectează tema",
  "themeSelect.dark": "Întunecată",
  "themeSelect.light": "Deschisă",
  "themeSelect.auto": "Auto",
  "languageSelect.accessibleLabel": "Selectează limba",
  "menuButton.accessibleLabel": "Meniu",
  "sidebarNav.accessibleLabel": "Principal",
  "tableOfContents.onThisPage": "Pe această pagină",
  "tableOfContents.overview": "Sinopsis",
  "i18n.untranslatedContent": "Acest conținut nu este încă disponibil în limba selectată.",
  "page.editLink": "Editează pagina",
  "page.lastUpdated": "Ultima actualizare:",
  "page.previousLink": "Pagina precendentă",
  "page.nextLink": "Pagina următoare",
  "page.draft": "This content is a draft and will not be included in production builds.",
  "404.text": "Pagina nu a fost găsită. Verifică adresa URL sau încercă să folosești bara de căutare.",
  "aside.note": "Mențiune",
  "aside.tip": "Sfat",
  "aside.caution": "Atenție",
  "aside.danger": "Pericol",
  "fileTree.directory": "Directory",
  "builtWithStarlight.label": "Built with Starlight",
  "heading.anchorLabel": "Section titled “{{title}}”",
};

const ru = {
  "skipLink.label": "Перейти к содержимому",
  "search.label": "Поиск",
  "search.ctrlKey": "Ctrl",
  "search.cancelLabel": "Отменить",
  "search.devWarning": "Поиск доступен только в продакшен-сборках. \nВыполните сборку и запустите превью, чтобы протестировать поиск локально.",
  "themeSelect.accessibleLabel": "Выберите тему",
  "themeSelect.dark": "Тёмная",
  "themeSelect.light": "Светлая",
  "themeSelect.auto": "Авто",
  "languageSelect.accessibleLabel": "Выберите язык",
  "menuButton.accessibleLabel": "Меню",
  "sidebarNav.accessibleLabel": "Основное",
  "tableOfContents.onThisPage": "На этой странице",
  "tableOfContents.overview": "Обзор",
  "i18n.untranslatedContent": "Это содержимое пока не доступно на вашем языке.",
  "page.editLink": "Редактировать страницу",
  "page.lastUpdated": "Последнее обновление:",
  "page.previousLink": "Предыдущая",
  "page.nextLink": "Следующая",
  "page.draft": "Этот контент является черновиком и не будет добавлен в продакшен-сборки.",
  "404.text": "Страница не найдена. Проверьте URL или используйте поиск по сайту.",
  "aside.note": "Заметка",
  "aside.tip": "Совет",
  "aside.caution": "Осторожно",
  "aside.danger": "Опасно",
  "fileTree.directory": "Директория",
  "expressiveCode.copyButtonCopied": "Скопировано!",
  "expressiveCode.copyButtonTooltip": "Копировать",
  "expressiveCode.terminalWindowFallbackTitle": "Окно терминала",
  "builtWithStarlight.label": "Сделано с помощью Starlight",
  "heading.anchorLabel": "Заголовок раздела «{{title}}»",
};

const vi = {
  "skipLink.label": "Bỏ qua để đến nội dung",
  "search.label": "Tìm kiếm",
  "search.ctrlKey": "Ctrl",
  "search.cancelLabel": "Hủy",
  "search.devWarning": "Chức năng tìm kiếm chỉ có sẵn trong các phiên bản thật.\nHãy thử xây dựng và xem trước trang web để kiểm tra.",
  "themeSelect.accessibleLabel": "Chọn giao diện",
  "themeSelect.dark": "Tối",
  "themeSelect.light": "Sáng",
  "themeSelect.auto": "Tự động",
  "languageSelect.accessibleLabel": "Chọn ngôn ngữ",
  "menuButton.accessibleLabel": "Menu",
  "sidebarNav.accessibleLabel": "Chính",
  "tableOfContents.onThisPage": "Trên trang này",
  "tableOfContents.overview": "Tổng quan",
  "i18n.untranslatedContent": "Nội dung này hiện chưa có sẵn bằng ngôn ngữ của bạn.",
  "page.editLink": "Chỉnh sửa trang",
  "page.lastUpdated": "Cập nhật lần cuối:",
  "page.previousLink": "Trước",
  "page.nextLink": "Tiếp",
  "page.draft": "Nội dung này là bản nháp và sẽ không được đưa vào các phiên bản thật.",
  "404.text": "Không tìm thấy trang. Hãy kiểm tra lại URL hoặc thử dùng thanh tìm kiếm.",
  "aside.note": "Ghi chú",
  "aside.tip": "Mẹo",
  "aside.caution": "Chú ý",
  "aside.danger": "Nguy hiểm",
  "fileTree.directory": "Thư mục",
  "builtWithStarlight.label": "Được xây dựng bằng Starlight",
  "heading.anchorLabel": "Phần tiêu đề “{{title}}”",
};

const uk = {
  "skipLink.label": "Перейти до вмісту",
  "search.label": "Пошук",
  "search.ctrlKey": "Ctrl",
  "search.cancelLabel": "Скасувати",
  "search.devWarning": "Пошук доступний лише у виробничих збірках. \nСпробуйте зібрати та переглянути сайт, щоби протестувати його локально",
  "themeSelect.accessibleLabel": "Обрати тему",
  "themeSelect.dark": "Темна",
  "themeSelect.light": "Світла",
  "themeSelect.auto": "Авто",
  "languageSelect.accessibleLabel": "Обрати мову",
  "menuButton.accessibleLabel": "Меню",
  "sidebarNav.accessibleLabel": "Головне",
  "tableOfContents.onThisPage": "На цій сторінці",
  "tableOfContents.overview": "Огляд",
  "i18n.untranslatedContent": "Цей контент ще не доступний вашою мовою.",
  "page.editLink": "Редагувати сторінку",
  "page.lastUpdated": "Останнє оновлення:",
  "page.previousLink": "Назад",
  "page.nextLink": "Далі",
  "page.draft": "Цей контент є чернеткою і не буде включений до виробничих збірок.",
  "404.text": "Сторінку не знайдено. Перевірте URL або спробуйте скористатися пошуком.",
  "aside.note": "Заувага",
  "aside.tip": "Порада",
  "aside.caution": "Обережно",
  "aside.danger": "Небезпечно",
  "fileTree.directory": "Каталог",
  "builtWithStarlight.label": "Створено з Starlight",
  "heading.anchorLabel": "Section titled “{{title}}”",
};

const hi = {
  "skipLink.label": "इसे छोड़कर कंटेंट पर जाएं",
  "search.label": "खोजें",
  "search.ctrlKey": "Ctrl",
  "search.cancelLabel": "रद्द करे",
  "search.devWarning": "खोज केवल उत्पादन बिल्ड में उपलब्ध है। \nस्थानीय स्तर पर परीक्षण करने के लिए साइट बनाए और उसका पूर्वावलोकन करने का प्रयास करें।",
  "themeSelect.accessibleLabel": "थीम चुनें",
  "themeSelect.dark": "अँधेरा",
  "themeSelect.light": "रोशनी",
  "themeSelect.auto": "स्वत",
  "languageSelect.accessibleLabel": "भाषा चुने",
  "menuButton.accessibleLabel": "मेन्यू",
  "sidebarNav.accessibleLabel": "मुख्य",
  "tableOfContents.onThisPage": "इस पृष्ठ पर",
  "tableOfContents.overview": "अवलोकन",
  "i18n.untranslatedContent": "यह कंटेंट अभी तक आपकी भाषा में उपलब्ध नहीं है।",
  "page.editLink": "पृष्ठ संपादित करें",
  "page.lastUpdated": "आखिरी अद्यतन:",
  "page.previousLink": "पिछला",
  "page.nextLink": "अगला",
  "page.draft": "This content is a draft and will not be included in production builds.",
  "404.text": "यह पृष्ठ नहीं मिला। URL जांचें या खोज बार का उपयोग करने का प्रयास करें।",
  "aside.note": "टिप्पणी",
  "aside.tip": "संकेत",
  "aside.caution": "सावधानी",
  "aside.danger": "खतरा",
  "fileTree.directory": "Directory",
  "builtWithStarlight.label": "Starlight द्वारा निर्मित",
  "heading.anchorLabel": "Section titled “{{title}}”",
};

const zhTW = {
  "skipLink.label": "跳到內容",
  "search.label": "搜尋",
  "search.ctrlKey": "Ctrl",
  "search.cancelLabel": "取消",
  "search.devWarning": "正式版本才能使用搜尋功能。\n如要在本地測試，請先建置並預覽網站。",
  "themeSelect.accessibleLabel": "選擇佈景主題",
  "themeSelect.dark": "深色",
  "themeSelect.light": "淺色",
  "themeSelect.auto": "自動",
  "languageSelect.accessibleLabel": "選擇語言",
  "menuButton.accessibleLabel": "選單",
  "sidebarNav.accessibleLabel": "主要",
  "tableOfContents.onThisPage": "本頁內容",
  "tableOfContents.overview": "概述",
  "i18n.untranslatedContent": "本頁內容尚未翻譯。",
  "page.editLink": "編輯頁面",
  "page.lastUpdated": "最後更新於：",
  "page.previousLink": "前一則",
  "page.nextLink": "下一則",
  "page.draft": "This content is a draft and will not be included in production builds.",
  "404.text": "找不到頁面。請檢查網址或改用搜尋功能。",
  "aside.note": "注意",
  "aside.tip": "提示",
  "aside.caution": "警告",
  "aside.danger": "危險",
  "fileTree.directory": "目錄",
  "builtWithStarlight.label": "Built with Starlight",
  "heading.anchorLabel": "Section titled “{{title}}”",
};

const pl = {
  "skipLink.label": "Przejdź do głównej zawartości",
  "search.label": "Szukaj",
  "search.ctrlKey": "Ctrl",
  "search.cancelLabel": "Anuluj",
  "search.devWarning": "Wyszukiwanie jest dostępne tylko w buildach produkcyjnych. \nSpróbuj zbudować i uruchomić aplikację, aby przetestować lokalnie.",
  "themeSelect.accessibleLabel": "Wybierz motyw",
  "themeSelect.dark": "Ciemny",
  "themeSelect.light": "Jasny",
  "themeSelect.auto": "Auto",
  "languageSelect.accessibleLabel": "Wybierz język",
  "menuButton.accessibleLabel": "Menu",
  "sidebarNav.accessibleLabel": "Główne",
  "tableOfContents.onThisPage": "Na tej stronie",
  "tableOfContents.overview": "Przegląd",
  "i18n.untranslatedContent": "Ta treść nie jest jeszcze dostępna w Twoim języku.",
  "page.editLink": "Edytuj stronę",
  "page.lastUpdated": "Ostatnia aktualizacja:",
  "page.previousLink": "Poprzednia strona",
  "page.nextLink": "Następna strona",
  "page.draft": "This content is a draft and will not be included in production builds.",
  "404.text": "Nie znaleziono. Sprawdź URL lub użyj wyszukiwarki.",
  "aside.note": "Notatka",
  "aside.tip": "Wskazówka",
  "aside.caution": "Uwaga",
  "aside.danger": "Ważne",
  "fileTree.directory": "Folder",
  "expressiveCode.copyButtonCopied": "Skopiowane!",
  "expressiveCode.copyButtonTooltip": "Skopiuj do schowka",
  "expressiveCode.terminalWindowFallbackTitle": "Okno terminala",
  "builtWithStarlight.label": "Built with Starlight",
  "heading.anchorLabel": "Dział zatytułowany „{{title}}”",
};

const sk = {
  "skipLink.label": "Preskočiť na obsah",
  "search.label": "Hľadať",
  "search.ctrlKey": "Ctrl",
  "search.cancelLabel": "Zrušiť",
  "search.devWarning": "Vyhľadávanie je dostupné len v produkčných zostaveniach. \nSkúste vytvoriť a zobraziť náhľad stránky lokálne.",
  "themeSelect.accessibleLabel": "Vyberte tému",
  "themeSelect.dark": "Tmavý",
  "themeSelect.light": "Svetlý",
  "themeSelect.auto": "Auto",
  "languageSelect.accessibleLabel": "Vyberte jazyk",
  "menuButton.accessibleLabel": "Menu",
  "sidebarNav.accessibleLabel": "Hlavný",
  "tableOfContents.onThisPage": "Na tejto stránke",
  "tableOfContents.overview": "Prehľad",
  "i18n.untranslatedContent": "Tento obsah zatiaľ nie je dostupný vo vašom jazyku.",
  "page.editLink": "Upraviť stránku",
  "page.lastUpdated": "Posledná aktualizácia:",
  "page.previousLink": "Predchádzajúce",
  "page.nextLink": "Nasledujúce",
  "page.draft": "Tento obsah je koncept a nebude zahrnutý do produkčných zostavení.",
  "404.text": "Stránka nenájdená. Skontrolujte URL alebo skúste použiť vyhľadávacie pole.",
  "aside.note": "Poznámka",
  "aside.tip": "Tip",
  "aside.caution": "Upozornenie",
  "aside.danger": "Nebezpečenstvo",
  "fileTree.directory": "Adresár",
  "builtWithStarlight.label": "Postavené so Starlight",
  "heading.anchorLabel": "Section titled “{{title}}”",
};

const lv = {
  "skipLink.label": "Pāriet uz saturu",
  "search.label": "Meklēt",
  "search.ctrlKey": "Ctrl",
  "search.cancelLabel": "Atcelt",
  "search.devWarning": "Meklēšana ir pieejama tikai ražošanas kompilācijās. \nMēģiniet kompilēt un priekšskatīt vietni, lai to pārbaudītu lokāli.",
  "themeSelect.accessibleLabel": "Izvēlieties tēmu",
  "themeSelect.dark": "Tumša",
  "themeSelect.light": "Gaiša",
  "themeSelect.auto": "Automātiska",
  "languageSelect.accessibleLabel": "Izvēlieties valodu",
  "menuButton.accessibleLabel": "Izvēlne",
  "sidebarNav.accessibleLabel": "Galvenā",
  "tableOfContents.onThisPage": "Šajā lapā",
  "tableOfContents.overview": "Pārskats",
  "i18n.untranslatedContent": "Šis saturs vēl nav pieejams jūsu valodā.",
  "page.editLink": "Rediģēt lapu",
  "page.lastUpdated": "Pēdējoreiz atjaunināts:",
  "page.previousLink": "Iepriekšējā",
  "page.nextLink": "Nākamā",
  "page.draft": "Šis saturs ir melnraksts un netiks iekļauts ražošanas kompilācijās.",
  "404.text": "Lapa nav atrasta. Pārbaudiet URL vai mēģiniet izmantot meklēšanas joslu.",
  "aside.note": "Piezīme",
  "aside.tip": "Padoms",
  "aside.caution": "Uzmanību",
  "aside.danger": "Bīstamība",
  "fileTree.directory": "Direktorija",
  "builtWithStarlight.label": "Veidots ar Starlight",
  "heading.anchorLabel": "Section titled “{{title}}”",
};

const hu = {
  "skipLink.label": "Tovább a tartalomhoz",
  "search.label": "Keresés",
  "search.ctrlKey": "Ctrl",
  "search.cancelLabel": "Mégsem",
  "search.devWarning": "A keresés csak a production build-ekben működik. \nPróbáld meg először buildelni, hogy kipróbálhasd.",
  "themeSelect.accessibleLabel": "Téma választás",
  "themeSelect.dark": "Sötét",
  "themeSelect.light": "Világos",
  "themeSelect.auto": "Auto",
  "languageSelect.accessibleLabel": "Nyelv választása",
  "menuButton.accessibleLabel": "Menü",
  "sidebarNav.accessibleLabel": "Fő",
  "tableOfContents.onThisPage": "Ezen az oldalon",
  "tableOfContents.overview": "Tartalom",
  "i18n.untranslatedContent": "Ez a tartalom még nem érhető el a jelenlegi nyelven.",
  "page.editLink": "Oldal szerkesztése",
  "page.lastUpdated": "Utoljára frissítve:",
  "page.previousLink": "Előző",
  "page.nextLink": "Következő",
  "page.draft": "Ez a tartalom még vázlat, így nem lesz benne a production build-ben.",
  "404.text": "Az oldal nem található. Nézd meg az URL-t vagy használd a keresőt.",
  "aside.note": "Megjegyzés",
  "aside.tip": "Tipp",
  "aside.caution": "Figyelem",
  "aside.danger": "Veszély",
  "fileTree.directory": "Könyvtár",
  "builtWithStarlight.label": "Starlight-tal készítve",
  "heading.anchorLabel": "Szekció neve “{{title}}”",
  "expressiveCode.copyButtonCopied": "Másolva!",
  "expressiveCode.copyButtonTooltip": "Másolás",
  "expressiveCode.terminalWindowFallbackTitle": "Terminál",
  "pagefind.clear_search": "Törlés",
  "pagefind.load_more": "Több találat betöltése",
  "pagefind.search_label": "Keresés ezen az oldalon",
  "pagefind.filters_label": "Szűrők",
  "pagefind.zero_results": "Erre a kifejezésre nincs találat: [SEARCH_TERM]",
  "pagefind.many_results": "[COUNT] találat erre: [SEARCH_TERM]",
  "pagefind.one_result": "[COUNT] találat erre: [SEARCH_TERM]",
  "pagefind.alt_search": "Erre a kifejezésre nincs találat: [SEARCH_TERM]. Találatok mutatása erre: [DIFFERENT_TERM]",
  "pagefind.search_suggestion": "Erre a kifejezésre nincs találat: [SEARCH_TERM]. Próbáld meg ezek közül az egyiket:",
  "pagefind.searching": "Keresés erre: [SEARCH_TERM]...",
};

const el = {
  "skipLink.label": "Μετάβαση στο περιεχόμενο",
  "search.label": "Αναζήτηση",
  "search.ctrlKey": "Ctrl",
  "search.cancelLabel": "Ακύρωση",
  "search.devWarning": "Η αναζήτηση είναι διαθέσιμη μόνο σε builds παραγωγής.\nΔοκίμασε να κάνεις build τον ιστότοπο και να τον προεπισκοπήσεις για να τον ελέγξεις τοπικά.",
  "themeSelect.accessibleLabel": "Επιλογή χρωματικού θέματος",
  "themeSelect.dark": "Σκοτεινό",
  "themeSelect.light": "Φωτεινό",
  "themeSelect.auto": "Σύστημα",
  "languageSelect.accessibleLabel": "Επιλογή γλώσσας",
  "menuButton.accessibleLabel": "Μενού",
  "sidebarNav.accessibleLabel": "Κύρια πλοήγηση",
  "tableOfContents.onThisPage": "Σε αυτή τη σελίδα",
  "tableOfContents.overview": "Επισκόπηση",
  "i18n.untranslatedContent": "Αυτό το περιεχόμενο δεν είναι ακόμη διαθέσιμο στη γλώσσα σου.",
  "page.editLink": "Επεξεργασία σελίδας",
  "page.lastUpdated": "Τελευταία ενημέρωση:",
  "page.previousLink": "Προηγούμενη σελίδα",
  "page.nextLink": "Επόμενη σελίδα",
  "page.draft": "Αυτό το περιεχόμενο είναι πρόχειρο και δεν θα περιλαμβάνεται στα builds παραγωγής.",
  "404.text": "Η σελίδα δεν βρέθηκε. Έλεγξε το URL ή χρησιμοποίησε τη γραμμή αναζήτησης.",
  "aside.note": "Σημείωση",
  "aside.tip": "Συμβουλή",
  "aside.caution": "Προσοχή",
  "aside.danger": "Κίνδυνος",
  "fileTree.directory": "Φάκελος",
  "builtWithStarlight.label": "Δημιουργήθηκε με το Starlight",
  "heading.anchorLabel": "Ενότητα με τίτλο «{{title}}»",
};

const { parse } = builtinI18nSchema();
const builtinTranslations = Object.fromEntries(
  Object.entries({
    cs,
    en,
    es,
    ca,
    de,
    ja,
    pt,
    fa,
    fi,
    fr,
    gl,
    he,
    id,
    it,
    nl,
    da,
    th,
    tr,
    ar,
    nb,
    zh,
    ko,
    sv,
    ro,
    ru,
    vi,
    uk,
    hi,
    "zh-TW": zhTW,
    pl,
    sk,
    lv,
    hu,
    el
  }).map(([key, dict]) => [key, parse(dict)])
);

const wellKnownRTL = ["ar", "fa", "he", "prs", "ps", "syc", "ug", "ur"];
const BuiltInDefaultLocale = { ...getLocaleInfo("en"), lang: "en" };
function getLocaleInfo(lang) {
  try {
    const locale = new Intl.Locale(lang);
    const label = new Intl.DisplayNames(locale, { type: "language" }).of(lang);
    if (!label || lang === label) throw new Error("Label not found.");
    return {
      label: label[0]?.toLocaleUpperCase(locale) + label.slice(1),
      dir: getLocaleDir(locale)
    };
  } catch {
    throw new AstroUserError(
      `Failed to get locale information for the '${lang}' locale.`,
      "Make sure to provide a valid BCP-47 tags (e.g. en, ar, or zh-CN)."
    );
  }
}
function getLocaleDir(locale) {
  if ("textInfo" in locale) {
    return locale.textInfo.direction;
  } else if ("getTextInfo" in locale) {
    return locale.getTextInfo().direction;
  }
  return wellKnownRTL.includes(locale.language) ? "rtl" : "ltr";
}

const I18nextNamespace = "starlight";
async function createTranslationSystem(config, userTranslations, pluginTranslations = {}) {
  const defaultLocale = config.defaultLocale.lang || config.defaultLocale?.locale || BuiltInDefaultLocale.lang;
  const translations = {
    [defaultLocale]: buildResources(
      builtinTranslations[defaultLocale] || builtinTranslations[stripLangRegion(defaultLocale)],
      pluginTranslations[defaultLocale],
      userTranslations[defaultLocale]
    )
  };
  if (config.locales) {
    for (const locale in config.locales) {
      const lang = localeToLang(locale, config.locales, config.defaultLocale);
      translations[lang] = buildResources(
        builtinTranslations[lang] || builtinTranslations[stripLangRegion(lang)],
        pluginTranslations[lang],
        userTranslations[lang]
      );
    }
  }
  const i18n = instance.createInstance();
  await i18n.init({
    resources: translations,
    fallbackLng: config.defaultLocale.lang || config.defaultLocale?.locale || BuiltInDefaultLocale.lang
  });
  return (lang) => {
    lang ??= config.defaultLocale?.lang || BuiltInDefaultLocale.lang;
    const t = i18n.getFixedT(lang, I18nextNamespace);
    t.all = () => i18n.getResourceBundle(lang, I18nextNamespace);
    t.exists = ((key, options) => i18n.exists(key, { lng: lang, ns: I18nextNamespace, ...options }));
    t.dir = (dirLang = lang) => i18n.dir(dirLang);
    return t;
  };
}
function stripLangRegion(lang) {
  return lang.replace(/-[a-zA-Z]{2}/, "");
}
function localeToLang(locale, locales, defaultLocale) {
  const lang = locale ? locales?.[locale]?.lang : locales?.root?.lang;
  const defaultLang = defaultLocale?.lang || defaultLocale?.locale;
  return lang || defaultLang || BuiltInDefaultLocale.lang;
}
function buildResources(...dictionaries) {
  const dictionary = {};
  for (const dict of dictionaries) {
    for (const key in dict) {
      const value = dict[key];
      if (value) dictionary[key] = value;
    }
  }
  return { [I18nextNamespace]: dictionary };
}

function getCollectionPathFromRoot(collection, { root, srcDir }) {
  return (srcDir ).replace(
    root ,
    ""
  ) + "content/" + collection;
}

function stripLeadingSlash(href) {
  if (href[0] === "/") href = href.slice(1);
  return href;
}
function stripExtension(path) {
  const periodIndex = path.lastIndexOf(".");
  return path.slice(0, periodIndex > -1 ? periodIndex : void 0);
}

const i18nCollectionPathFromRoot = getCollectionPathFromRoot("i18n", project);
async function loadTranslations() {
  const warn = console.warn;
  console.warn = () => {
  };
  const userTranslations = Object.fromEntries(
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore — may be a type error in projects without an i18n collection
    (await getCollection("i18n")).map(({ id, data, filePath }) => {
      const lang = !filePath ? id : stripExtension(stripLeadingSlash(filePath.replace(i18nCollectionPathFromRoot, "")));
      return [lang, data];
    })
  );
  console.warn = warn;
  return userTranslations;
}
const useTranslations = await createTranslationSystem(
  starlightConfig,
  await loadTranslations(),
  pluginTranslations
);

const onRequest$1 = defineMiddleware(async (context, next) => {
  context.locals.t = useTranslations(context.currentLocale);
  initializeStarlightRoute(context);
  return next();
});
function initializeStarlightRoute(context) {
  if ("starlightRoute" in context.locals) return;
  const state = { routeData: void 0 };
  Object.defineProperty(context.locals, "starlightRoute", {
    get() {
      if (!state.routeData) {
        throw new AstroUserError(
          "`locals.starlightRoute` is not defined",
          "This usually means a component that accesses `locals.starlightRoute` is being rendered outside of a Starlight page, which is not supported.\n\nIf this is a component you authored, you can do one of the following:\n\n1. Avoid using this component in non-Starlight pages.\n2. Wrap the code that reads `locals.starlightRoute` in a  `try/catch` block and handle the cases where `starlightRoute` is not available.\n\nIf this is a Starlight built-in or third-party component, you may need to report a bug or avoid this use of the component."
        );
      }
      return state.routeData;
    },
    set(routeData) {
      state.routeData = routeData;
    }
  });
}

const onRequest = sequence(
	onRequest$1,
	
	
);

export { onRequest };
