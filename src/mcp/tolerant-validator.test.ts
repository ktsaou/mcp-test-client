import { describe, it, expect, vi } from 'vitest';

import { TolerantValidator, type SchemaCompileWarning } from './tolerant-validator.ts';

describe('TolerantValidator', () => {
  it('delegates to the inner validator on a compilable schema', () => {
    const onWarn = vi.fn();
    const v = new TolerantValidator(onWarn);
    const validate = v.getValidator({
      type: 'object',
      properties: { name: { type: 'string' } },
      required: ['name'],
    });
    expect(validate({ name: 'ok' })).toEqual({
      valid: true,
      data: { name: 'ok' },
      errorMessage: undefined,
    });
    const bad = validate({ name: 42 });
    expect(bad.valid).toBe(false);
    expect(onWarn).not.toHaveBeenCalled();
  });

  it('returns a permissive validator when the inner provider throws', () => {
    const onWarn = vi.fn();
    const inner = {
      getValidator: () => {
        throw new Error('boom');
      },
    };
    const v = new TolerantValidator(onWarn, inner);
    const validate = v.getValidator({ type: 'object' });
    const result = validate({ anything: 'goes' });
    expect(result).toEqual({
      valid: true,
      data: { anything: 'goes' },
      errorMessage: undefined,
    });
    expect(onWarn).toHaveBeenCalledTimes(1);
    const warning = onWarn.mock.calls[0][0] as SchemaCompileWarning;
    expect(warning.message).toBe('boom');
    expect(warning.schema).toEqual({ type: 'object' });
  });

  it('coerces non-Error throws into string messages', () => {
    const onWarn = vi.fn();
    const inner = {
      getValidator: () => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'not-an-error';
      },
    };
    const v = new TolerantValidator(onWarn, inner);
    v.getValidator({ type: 'object' });
    expect(onWarn).toHaveBeenCalledTimes(1);
    const warning = onWarn.mock.calls[0][0] as SchemaCompileWarning;
    expect(warning.message).toBe('not-an-error');
  });

  it('falls back to the SDK default validator when no inner is supplied', () => {
    const onWarn = vi.fn();
    const v = new TolerantValidator(onWarn);
    // A schema the default Ajv validator handles fine.
    const validate = v.getValidator({ type: 'string' });
    expect(validate('hello').valid).toBe(true);
    expect(validate(123).valid).toBe(false);
    expect(onWarn).not.toHaveBeenCalled();
  });
});
