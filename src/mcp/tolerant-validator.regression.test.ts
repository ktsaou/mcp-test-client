import { describe, it, expect, vi } from 'vitest';

import { TolerantValidator } from './tolerant-validator.ts';

/**
 * Regression test for DEC-024 with the exact `outputSchema` payload from
 * Costa's bug report (the brave-brave_image_search tool, plus two
 * minimax tools whose schemas use `$defs`/`$ref` and triggered the same
 * error). If the wrapper's try/catch doesn't fully contain the throw,
 * these tests will throw out of `getValidator` and fail.
 */

const BRAVE_IMAGE_SEARCH_OUTPUT_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  properties: {
    type: { type: 'string', const: 'object' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          url: { type: 'string', format: 'uri' },
          page_fetched: {
            type: 'string',
            format: 'date-time',
            pattern:
              '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z))$',
          },
          confidence: {
            type: 'string',
            enum: ['low', 'medium', 'high'],
            description: 'The confidence level of the result.',
          },
          properties: {
            type: 'object',
            properties: {
              url: { type: 'string', format: 'uri' },
              width: { type: 'integer', exclusiveMinimum: 0, maximum: 9007199254740991 },
              height: { type: 'integer', exclusiveMinimum: 0, maximum: 9007199254740991 },
            },
            required: ['url', 'width', 'height'],
            additionalProperties: false,
          },
        },
        required: ['title', 'url', 'page_fetched', 'confidence', 'properties'],
        additionalProperties: false,
      },
    },
    count: { type: 'integer', minimum: 0, maximum: 9007199254740991 },
    might_be_offensive: { type: 'boolean', description: 'Whether the image might be offensive.' },
  },
  required: ['type', 'items', 'count', 'might_be_offensive'],
  additionalProperties: false,
};

const MINIMAX_TEXT_CONTENT_OUTPUT_SCHEMA = {
  $defs: {
    Annotations: {
      additionalProperties: true,
      properties: {
        audience: {
          anyOf: [
            { items: { enum: ['user', 'assistant'], type: 'string' }, type: 'array' },
            { type: 'null' },
          ],
          default: null,
          title: 'Audience',
        },
        priority: {
          anyOf: [{ maximum: 1, minimum: 0, type: 'number' }, { type: 'null' }],
          default: null,
          title: 'Priority',
        },
      },
      title: 'Annotations',
      type: 'object',
    },
  },
  additionalProperties: true,
  description: 'Text content for a message.',
  properties: {
    type: { const: 'text', title: 'Type', type: 'string' },
    text: { title: 'Text', type: 'string' },
    annotations: { anyOf: [{ $ref: '#/$defs/Annotations' }, { type: 'null' }], default: null },
    _meta: {
      anyOf: [{ additionalProperties: true, type: 'object' }, { type: 'null' }],
      default: null,
      title: 'Meta',
    },
  },
  required: ['type', 'text'],
  title: 'TextContent',
  type: 'object',
};

describe('TolerantValidator — DEC-024 production payload', () => {
  it('does not throw on the brave-brave_image_search outputSchema', () => {
    const onWarn = vi.fn();
    const v = new TolerantValidator(onWarn);
    // The whole point: this call must NOT throw.
    expect(() => v.getValidator(BRAVE_IMAGE_SEARCH_OUTPUT_SCHEMA)).not.toThrow();
  });

  it('does not throw on the minimax web_search/understand_image outputSchema (uses $defs/$ref)', () => {
    const onWarn = vi.fn();
    const v = new TolerantValidator(onWarn);
    expect(() => v.getValidator(MINIMAX_TEXT_CONTENT_OUTPUT_SCHEMA)).not.toThrow();
  });

  it('returns a validator function in both cases (permissive on failure, real on success)', () => {
    const onWarn = vi.fn();
    const v = new TolerantValidator(onWarn);
    const v1 = v.getValidator(BRAVE_IMAGE_SEARCH_OUTPUT_SCHEMA);
    const v2 = v.getValidator(MINIMAX_TEXT_CONTENT_OUTPUT_SCHEMA);
    // Either compiled successfully (and validates real shapes) or fell back
    // to the permissive validator (and accepts anything). Either way, calling
    // them must not throw.
    expect(() => v1({ anything: 'goes' })).not.toThrow();
    expect(() => v2({ anything: 'goes' })).not.toThrow();
  });
});
