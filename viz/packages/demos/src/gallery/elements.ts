// The four DOM helpers the chrome is built from. They exist so no file below repeats
// `createElement`, `className =`, `textContent =` three lines at a time, and so that every element
// the gallery makes is made the same way.

// An element with a class and, optionally, its text.
export const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] => {
  const made = document.createElement(tag);
  if (className !== '') made.className = className;
  if (text !== undefined) made.textContent = text;
  return made;
};

// A link. The gallery's routes are query strings, so an href here is `?demo=...`, never a fragment.
export const link = (className: string, href: string, text: string): HTMLAnchorElement => {
  const made = el('a', className, text);
  made.href = href;
  return made;
};

// A button that does something on the page rather than going somewhere.
export const button = (className: string, text: string, onClick: () => void): HTMLButtonElement => {
  const made = el('button', className, text);
  made.type = 'button';
  made.addEventListener('click', onClick);
  return made;
};

// A label followed by its value, which is the shape of most of the chrome.
export const labelled = (className: string, label: string, value: Node | string): HTMLParagraphElement => {
  const made = el('p', className);
  made.append(el('span', 'label', label), typeof value === 'string' ? el('span', 'value', value) : value);
  return made;
};

// Removes every child, so a region can be drawn again from its current state.
export const clear = (parent: Element): void => {
  while (parent.firstChild !== null) parent.firstChild.remove();
};
