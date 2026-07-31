import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToast, toast } from './use-toast';

describe('use-toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('should display success, error, and warning toasts with correct text', () => {
    const { result } = renderHook(() => useToast());
    
    act(() => {
      result.current.toast({ title: 'Sucesso', description: 'Operação realizada', variant: 'default' });
    });
    
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].title).toBe('Sucesso');
    expect(result.current.toasts[0].description).toBe('Operação realizada');
    
    act(() => {
      result.current.toast({ title: 'Erro', description: 'Falha na operação', variant: 'destructive' });
    });
    
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].title).toBe('Erro');
    expect(result.current.toasts[0].description).toBe('Falha na operação');

    
    // Test direct toast function
    act(() => {
      toast({ title: 'Aviso', description: 'Atenção' });
    });
    
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].title).toBe('Aviso');
  });

  it('should remove toast after 5 seconds (timing)', () => {
    const { result } = renderHook(() => useToast());
    
    act(() => {
      result.current.toast({ title: 'Teste de timing' });
    });
    
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].open).toBe(true);
    
    // Simulate toast closing (called by Toast component after duration)
    act(() => {
      result.current.dismiss();
    });
    
    expect(result.current.toasts[0].open).toBe(false);

    // After dismiss, TOAST_REMOVE_DELAY takes effect to remove it from state
    act(() => {
      vi.advanceTimersByTime(4900);
    });
    
    // Should still be in state (closed, waiting for animation delay to finish)
    expect(result.current.toasts).toHaveLength(1);
    
    act(() => {
      vi.advanceTimersByTime(200); // 5100 total
    });
    
    // Removed from state
    expect(result.current.toasts).toHaveLength(0);
  });
});
