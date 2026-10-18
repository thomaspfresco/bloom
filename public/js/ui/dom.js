// @ts-check
// Tiny DOM helpers (no framework).

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * @typedef {object} Attrs
 * @property {string} [class]
 * @property {string | Partial<CSSStyleDeclaration>} [style]
 * @property {Record<string, string>} [dataset]
 * @property {(el: any) => void} [ref]       called with the element after creation
 * @property {boolean} [hidden]
 * @property {string} [text]
 * @property {any} [key]                       any other attribute / on* listener
 */

/** @typedef {Node | string | number | false | null | undefined | (Node | string | number | false | null | undefined)[]} Child */

/**
 * @param {Element} el @param {Attrs & Record<string, any>} attrs @param {Child[]} children
 * @returns {Element}
 */
function apply(el, attrs, children) {
  for (const [key, value] of Object.entries(attrs ?? {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') el.setAttribute('class', value);
    else if (key === 'style') {
      if (typeof value === 'string') el.setAttribute('style', value);
      else Object.assign(/** @type {HTMLElement} */ (el).style, value);
    } else if (key === 'dataset') Object.assign(/** @type {HTMLElement} */ (el).dataset, value);
    else if (key === 'ref') value(el);
    else if (key === 'text') el.textContent = value;
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value === true) el.setAttribute(key, '');
    else el.setAttribute(key, String(value));
  }
  append(el, children);
  return el;
}

/** @param {Node} parent @param {Child[]} children */
export function append(parent, children) {
  for (const child of children.flat()) {
    if (child === false || child === null || child === undefined) continue;
    parent.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

/**
 * Create an HTML element.
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} tag @param {Attrs & Record<string, any>} [attrs] @param {...Child} children
 * @returns {HTMLElementTagNameMap[K]}
 */
export function h(tag, attrs = {}, ...children) {
  return /** @type {HTMLElementTagNameMap[K]} */ (apply(document.createElement(tag), attrs, children));
}

/**
 * Create an SVG element.
 * @param {string} tag @param {Record<string, any>} [attrs] @param {...Child} children
 * @returns {SVGElement}
 */
export function svg(tag, attrs = {}, ...children) {
  return /** @type {SVGElement} */ (apply(document.createElementNS(SVG_NS, tag), attrs, children));
}

/** Remove all children. @param {Element} el */
export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

/** @param {Element} el @param {string} cls @param {boolean} on */
export const toggleClass = (el, cls, on) => el.classList.toggle(cls, on);

/** Set several CSS custom properties. @param {HTMLElement} el @param {Record<string, string | number>} vars */
export function setVars(el, vars) {
  for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, String(v));
}
