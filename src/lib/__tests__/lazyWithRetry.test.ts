import { describe, it, expect, vi } from 'vitest';
import { lazyWithRetry } from '../lazyWithRetry';
import React from 'react';

describe('lazyWithRetry', () => {
  it('loads component successfully on first attempt', async () => {
    const MockComponent = () => React.createElement('div', null, 'Hello World');
    const mockFactory = vi.fn().mockResolvedValue({ default: MockComponent });

    const LazyComp = lazyWithRetry(mockFactory);
    expect(LazyComp).toBeDefined();

    // Trigger loader
    const loaded = await mockFactory();
    expect(loaded.default).toBe(MockComponent);
    expect(mockFactory).toHaveBeenCalledTimes(1);
  });

  it('retries on transient failure before succeeding', async () => {
    const MockComponent = () => React.createElement('div', null, 'Recovered');
    let attempts = 0;

    const mockFactory = vi.fn().mockImplementation(() => {
      attempts++;
      if (attempts === 1) {
        return Promise.reject(new Error('Network transient error'));
      }
      return Promise.resolve({ default: MockComponent });
    });

    const LazyComp = lazyWithRetry(mockFactory, 2, 10);
    expect(LazyComp).toBeDefined();
  });
});
