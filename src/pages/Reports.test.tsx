import { describe, it, expect } from 'vitest';
import { sanitizeCSV } from './Reports';

describe('sanitizeCSV', () => {
  it('should prefix with an apostrophe if the string starts with =, +, -, @, or tab', () => {
    expect(sanitizeCSV('=cmd|/C calc')).toBe('"\'=cmd|/C calc"');
    expect(sanitizeCSV('+1+1')).toBe('"\'+1+1"');
    expect(sanitizeCSV('-1+1')).toBe('"\'-1+1"');
    expect(sanitizeCSV('@SUM(1+1)')).toBe('"\'@SUM(1+1)"');
    expect(sanitizeCSV('\t=1+1')).toBe('"\'\t=1+1"');
  });

  it('should not alter normal titles', () => {
    expect(sanitizeCSV('Problema na rede')).toBe('"Problema na rede"');
    expect(sanitizeCSV('1234')).toBe('"1234"');
    expect(sanitizeCSV('!@#$%')).toBe('"!@#$%"'); // Starts with !, not in the injection list
  });

  it('should correctly escape internal double quotes and retain them', () => {
    expect(sanitizeCSV('Normal "quote" here')).toBe('"Normal ""quote"" here"');
    expect(sanitizeCSV('="quote"')).toBe('"\'=""quote"""');
    expect(sanitizeCSV('"Starting with quote"')).toBe('"""Starting with quote"""');
  });

  it('should handle null, undefined, or empty values safely', () => {
    expect(sanitizeCSV('')).toBe('""');
    expect(sanitizeCSV(null)).toBe('""');
    expect(sanitizeCSV(undefined)).toBe('""');
  });
});
