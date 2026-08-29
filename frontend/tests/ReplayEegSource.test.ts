import { describe, expect, it } from 'vitest';
import { parseRawEegCsv } from '../src/calibration/integration.js';

describe('raw EEG replay CSV validation', () => {
  it('parses the exported Muse channel schema without analyzing it locally', () => {
    const rows = parseRawEegCsv(
      'sample_index,monotonic_timestamp,session_elapsed_seconds,tp9,af7,af8,tp10,headband_on,blink,jaw_clench\n' +
      '0,10.0,0,1,2,3,4,true,false,false\n' +
      '1,10.00390625,0.00390625,2,3,4,5,true,false,false\n',
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ sample_index: 0, af7: 2, af8: 3, headband_on: true });
  });

  it('rejects missing channels and malformed timestamps explicitly', () => {
    expect(() => parseRawEegCsv('sample_index,monotonic_timestamp,af7,af8\n0,1,2,3')).toThrow('missing required columns');
    expect(() => parseRawEegCsv('sample_index,monotonic_timestamp,tp9,af7,af8,tp10\n0,nope,1,2,3,4')).toThrow('Malformed monotonic_timestamp');
  });
});
