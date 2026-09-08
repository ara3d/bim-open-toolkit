// The DOM controls every feature demo page uses: a strip of labelled inputs and a status line.
// Each helper returns the element it made, so a page can read or update it, and everything is
// appended to one container the page clears on dispose.

// One choice in a picker.
export type Choice = { readonly value: string; readonly label: string };

// A labelled `<select>`; `onChange` is called with the chosen value.
export const addSelect = (
  parent: HTMLElement,
  id: string,
  label: string,
  choices: readonly Choice[],
  onChange: (value: string) => void,
): HTMLSelectElement => {
  const wrapper = document.createElement('label');
  wrapper.className = 'demo-control';
  wrapper.append(document.createTextNode(`${label} `));
  const select = document.createElement('select');
  select.id = id;
  for (const choice of choices) {
    const option = document.createElement('option');
    option.value = choice.value;
    option.textContent = choice.label;
    select.append(option);
  }
  select.addEventListener('change', () => {
    onChange(select.value);
  });
  wrapper.append(select);
  parent.append(wrapper);
  return select;
};

// Replaces a select's choices, keeping the current value when it is still among them.
export const setChoices = (select: HTMLSelectElement, choices: readonly Choice[]): void => {
  const current = select.value;
  select.replaceChildren();
  for (const choice of choices) {
    const option = document.createElement('option');
    option.value = choice.value;
    option.textContent = choice.label;
    select.append(option);
  }
  if (choices.some((choice) => choice.value === current)) select.value = current;
};

// A button that runs `onClick`.
export const addButton = (parent: HTMLElement, id: string, label: string, onClick: () => void): HTMLButtonElement => {
  const button = document.createElement('button');
  button.id = id;
  button.type = 'button';
  button.className = 'demo-control';
  button.textContent = label;
  button.addEventListener('click', onClick);
  parent.append(button);
  return button;
};

// A labelled checkbox; `onChange` is called with whether it is ticked.
export const addCheckbox = (
  parent: HTMLElement,
  id: string,
  label: string,
  checked: boolean,
  onChange: (checked: boolean) => void,
): HTMLInputElement => {
  const wrapper = document.createElement('label');
  wrapper.className = 'demo-control';
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.id = id;
  box.checked = checked;
  box.addEventListener('change', () => {
    onChange(box.checked);
  });
  wrapper.append(box, document.createTextNode(` ${label}`));
  parent.append(wrapper);
  return box;
};

// A labelled range slider showing its value; `onChange` is called with the number.
export const addSlider = (
  parent: HTMLElement,
  id: string,
  label: string,
  range: { readonly min: number; readonly max: number; readonly step: number; readonly value: number },
  onChange: (value: number) => void,
): HTMLInputElement => {
  const wrapper = document.createElement('label');
  wrapper.className = 'demo-control';
  wrapper.append(document.createTextNode(`${label} `));
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.id = id;
  slider.min = String(range.min);
  slider.max = String(range.max);
  slider.step = String(range.step);
  slider.value = String(range.value);
  const shown = document.createElement('output');
  shown.textContent = String(range.value);
  slider.addEventListener('input', () => {
    shown.textContent = slider.value;
    onChange(Number(slider.value));
  });
  wrapper.append(slider, document.createTextNode(' '), shown);
  parent.append(wrapper);
  return slider;
};

// A line of text the page updates.
export const addStatus = (parent: HTMLElement, id: string, text = ''): HTMLParagraphElement => {
  const line = document.createElement('p');
  line.id = id;
  line.className = 'demo-status';
  line.textContent = text;
  parent.append(line);
  return line;
};
