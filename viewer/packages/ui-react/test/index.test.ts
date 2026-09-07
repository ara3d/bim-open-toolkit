import { describe, expect, it } from 'vitest';
import * as api from '../src/index.js';

describe('@bim-open-toolkit/ui-react', () => {
  it('loads', () => {
    expect(api).toBeDefined();
  });
});
