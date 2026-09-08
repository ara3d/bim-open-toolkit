// The settings panel in the DOM, built from the control descriptions. Impure: it creates elements
// and listens to them, and it is the only file that knows what kind of input each setting uses.
//
// The gallery plan puts in-canvas widgets on Gratify. That layer does not exist yet, so this page
// uses plain inputs; the descriptions in `controls.ts` are what a Gratify panel would read too.

import { controls, type ControlKey, type ControlSpec } from './controls.js';

// A built panel: what its controls hold, a way to show values in them, and a way to take it down.
export type Panel = {
  readonly values: () => Readonly<Record<ControlKey, string>>;
  // Puts values into the controls without reporting a change.
  readonly show: (values: Readonly<Record<ControlKey, string>>) => void;
  readonly dispose: () => void;
};

type Field = {
  readonly spec: ControlSpec;
  readonly input: HTMLInputElement | HTMLSelectElement;
  readonly shown: HTMLElement | undefined;
};

const valueOf = (field: Field): string =>
  field.input instanceof HTMLInputElement && field.input.type === 'checkbox' ? String(field.input.checked) : field.input.value;

const showIn = (field: Field, value: string): void => {
  if (field.input instanceof HTMLInputElement && field.input.type === 'checkbox') field.input.checked = value === 'true';
  else field.input.value = value;
  if (field.shown !== undefined) field.shown.textContent = value;
};

const buildInput = (spec: ControlSpec, document: Document): HTMLInputElement | HTMLSelectElement => {
  switch (spec.kind) {
    case 'toggle': {
      const input = document.createElement('input');
      input.type = 'checkbox';
      return input;
    }
    case 'choice': {
      const select = document.createElement('select');
      for (const option of spec.options) {
        const element = document.createElement('option');
        element.value = option.value;
        element.textContent = option.label;
        select.append(element);
      }
      return select;
    }
    case 'number': {
      const input = document.createElement('input');
      input.type = 'range';
      input.min = String(spec.min);
      input.max = String(spec.max);
      input.step = String(spec.step);
      return input;
    }
  }
};

// Builds one labelled control per description into `host`, showing `initial`, and calls
// `onInput` whenever a person changes any of them.
export const buildPanel = (
  host: HTMLElement,
  initial: Readonly<Record<ControlKey, string>>,
  onInput: () => void,
): Panel => {
  const document = host.ownerDocument;
  const listeners = new AbortController();
  const fields = new Map<ControlKey, Field>();
  const built: HTMLElement[] = [];
  for (const spec of controls) {
    const label = document.createElement('label');
    const text = document.createElement('span');
    text.textContent = spec.label;
    const input = buildInput(spec, document);
    input.name = spec.key;
    input.addEventListener('input', onInput, { signal: listeners.signal });
    let shown: HTMLElement | undefined;
    if (spec.kind === 'number') {
      shown = document.createElement('span');
      shown.className = 'value';
      label.append(text, shown, input);
    } else {
      label.append(text, input);
    }
    host.append(label);
    built.push(label);
    fields.set(spec.key, { spec, input, shown });
  }
  const panel: Panel = {
    values: () => {
      const values: Record<ControlKey, string> = { ...initial };
      for (const [key, field] of fields) values[key] = valueOf(field);
      return values;
    },
    show: (values) => {
      for (const [key, field] of fields) showIn(field, values[key]);
    },
    dispose: () => {
      listeners.abort();
      for (const element of built) element.remove();
    },
  };
  panel.show(initial);
  return panel;
};
