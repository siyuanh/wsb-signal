import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTickerFilter } from '../tools/ticker-filter.js';
import { existsSync, unlinkSync } from 'fs';

const LEARNED_PATH = '/tmp/test-learned-tickers.json';

describe('extractTickers', () => {
  let filter;

  beforeEach(() => {
    filter = createTickerFilter(LEARNED_PATH);
  });

  afterEach(() => {
    if (existsSync(LEARNED_PATH)) unlinkSync(LEARNED_PATH);
  });

  it('extracts $-prefixed tickers', () => {
    const text = 'I think $GME and $TSLA are going to moon';
    expect(filter.extractTickers(text)).toContain('GME');
    expect(filter.extractTickers(text)).toContain('TSLA');
  });

  it('extracts bare uppercase tickers from known list', () => {
    const text = 'GME is going crazy, also watching AAPL';
    expect(filter.extractTickers(text)).toContain('GME');
    expect(filter.extractTickers(text)).toContain('AAPL');
  });

  it('filters false positives like common words', () => {
    const text = 'I think A IT IS THE best DD on this';
    const tickers = filter.extractTickers(text);
    expect(tickers).not.toContain('I');
    expect(tickers).not.toContain('A');
    expect(tickers).not.toContain('IT');
    expect(tickers).not.toContain('IS');
    expect(tickers).not.toContain('THE');
    expect(tickers).not.toContain('DD');
  });

  it('deduplicates tickers', () => {
    const text = '$GME GME $GME';
    expect(filter.extractTickers(text)).toEqual(['GME']);
  });

  it('returns empty for no tickers', () => {
    expect(filter.extractTickers('just a normal sentence')).toEqual([]);
  });

  it('learns unknown $-prefixed tickers', () => {
    const text = 'Just found $ZXYZ, this is the next play';
    const tickers = filter.extractTickers(text);
    expect(tickers).toContain('ZXYZ');
    expect(filter.getLearnedTickers()).toContain('ZXYZ');
  });

  it('persists learned tickers across instances', () => {
    filter.extractTickers('$ZXYZ is mooning');
    const filter2 = createTickerFilter(LEARNED_PATH);
    const text = 'ZXYZ still going';
    expect(filter2.extractTickers(text)).toContain('ZXYZ');
  });

  it('does not learn false positives from $-prefix', () => {
    const text = '$THE $IS $DD';
    const tickers = filter.extractTickers(text);
    expect(tickers).toHaveLength(0);
    expect(filter.getLearnedTickers()).toHaveLength(0);
  });
});
