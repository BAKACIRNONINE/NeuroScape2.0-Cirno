import { describe, expect, it } from 'vitest';
import { validateRuntimeWorldState } from '../src/runtime/validation.js';
import { snapshot } from './fixtures.js';

describe('runtime snapshot validation', () => {
  it('accepts the complete Module 03 contract', () => expect(validateRuntimeWorldState(snapshot()).valid).toBe(true));
  it.each([
    ['non-unit orientation', (value: ReturnType<typeof snapshot>) => { value.listener.orientation = [0, 0, 0, 2]; }],
    ['gain outside range', (value: ReturnType<typeof snapshot>) => { value.ambient[0]!.gain = 2; }],
    ['missing localized position', (value: ReturnType<typeof snapshot>) => { delete value.ambient[1]!.worldPosition; }],
    ['empty asset id', (value: ReturnType<typeof snapshot>) => { value.event[0]!.assetId = ''; }],
  ])('rejects %s without repairing it', (_name, mutate) => {
    const value = snapshot(); mutate(value);
    expect(validateRuntimeWorldState(value).valid).toBe(false);
  });
});
