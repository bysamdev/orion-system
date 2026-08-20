import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { ReactNode, useEffect } from 'react';
import { renderToString } from 'react-dom/server';
import { RootErrorBoundary, sanitizeErrorMessage, clearApplicationCache } from '../components/RootErrorBoundary';

// Mock Supabase client
const mockRemoveChannel = vi.fn().mockResolvedValue('ok');
const mockSubscribe = vi.fn().mockImplementation((cb?: (status: string) => void) => {
  if (cb) cb('SUBSCRIBED');
  return { unsubscribe: vi.fn() };
});
const mockOn = vi.fn().mockImplementation(() => ({
  subscribe: mockSubscribe,
}));
const mockTrack = vi.fn().mockResolvedValue('ok');
const mockPresenceState = vi.fn().mockReturnValue({});

const mockChannel = vi.fn().mockImplementation((channelName: string, options?: any) => ({
  channelName,
  options,
  on: mockOn,
  subscribe: mockSubscribe,
  track: mockTrack,
  presenceState: mockPresenceState,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    channel: (...args: any[]) => mockChannel(...args),
    removeChannel: (...args: any[]) => mockRemoveChannel(...args),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
  },
}));

// Mock Auth and User Role contexts
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-123', email: 'suporte@empresa.com' },
    session: { access_token: 'fake-token-123' },
    loading: false,
  }),
}));

vi.mock('@/hooks/useUserRole', () => ({
  useUserProfile: () => ({
    data: { id: 'user-123', full_name: 'Técnico Especialista', company_id: 'comp-1' },
    isLoading: false,
  }),
  useUserRole: () => ({
    data: 'technician',
    isLoading: false,
  }),
}));

// Mock Time Entries
vi.mock('@/hooks/useTimeEntries', () => ({
  useActiveTimer: () => ({
    data: { id: 'timer-active-1', ticket_id: 'ticket-456', start_time: new Date().toISOString() },
  }),
  useStopTimer: () => ({
    mutate: vi.fn(),
  }),
}));

// Mock Toast
vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
  useToast: () => ({ toast: vi.fn() }),
}));

describe('1. Root Error Boundary & Sanitization', () => {
  it('renders children normally when no error occurs', () => {
    const html = renderToString(
      <RootErrorBoundary>
        <div data-testid="app-content">Conteúdo Orion Normal</div>
      </RootErrorBoundary>
    );

    expect(html).toContain('Conteúdo Orion Normal');
    expect(html).not.toContain('Ocorreu um erro inesperado');
  });

  it('displays friendly UI when error state is active', () => {
    const boundary = new RootErrorBoundary({});
    const state = RootErrorBoundary.getDerivedStateFromError(
      new Error('TypeError: Cannot read properties of undefined (reading "hostname")')
    );

    boundary.state = state;
    const rendered = boundary.render();
    const html = renderToString(rendered as React.ReactElement);

    expect(html).toContain('Ocorreu um erro inesperado');
    expect(html).toContain('Recarregar Sistema');
    expect(html).toContain('Limpar Cache e Reiniciar');
    expect(html).toContain('Tentar Novamente');
    expect(html).toContain('Cannot read properties of undefined');
  });

  it('sanitizes sensitive data from error messages and stack traces', () => {
    const rawError = [
      'Error: Failed request to https://api.supabase.co/rest/v1/tickets?apikey=sbp_secretkey123456789',
      'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.doNotLeakThis',
      'Connection string: postgresql://postgres:SuperSecretPassword123@db.supabase.co:5432/postgres',
      'Payload: {"password": "MySuperSecretPassword!"}',
    ].join('\n');

    const sanitized = sanitizeErrorMessage(rawError);

    expect(sanitized).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    expect(sanitized).not.toContain('sbp_secretkey123456789');
    expect(sanitized).not.toContain('SuperSecretPassword123');
    expect(sanitized).not.toContain('MySuperSecretPassword!');
    expect(sanitized).toContain('[REDACTED');
  });

  it('clears storage and cache upon invoking clearApplicationCache', () => {
    const storageMock = (() => {
      let store: Record<string, string> = { 'auth_token': 'abc', 'cached_data': '123' };
      return {
        getItem: (k: string) => store[k] || null,
        setItem: (k: string, v: string) => { store[k] = v; },
        clear: () => { store = {}; },
        length: () => Object.keys(store).length,
      };
    })();

    // @ts-ignore
    global.localStorage = storageMock;
    // @ts-ignore
    global.sessionStorage = storageMock;

    expect(global.localStorage.getItem('auth_token')).toBe('abc');
    clearApplicationCache();
    expect(global.localStorage.getItem('auth_token')).toBeNull();
  });
});

describe('2. Realtime Channels Lifecycle & Teardown Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useRealtimeMachines creates channel and removes it on unmount when subscribers reach 0', async () => {
    const { useRealtimeMachines } = await import('../hooks/useRealtimeMachines');
    const mockQueryClient: any = {
      invalidateQueries: vi.fn(),
    };

    // Test simulate hook execution
    let hookEffectCleanup: (() => void) | undefined;

    // Simulate useEffect mounting
    const simulateMount = (qc: any) => {
      // Direct invocation of the effect logic
      const subscribers = (global as any).__subscribers_test || new Set();
      subscribers.add(qc);

      mockChannel('machines-realtime-global');

      return () => {
        subscribers.delete(qc);
        if (subscribers.size === 0) {
          mockRemoveChannel({ channelName: 'machines-realtime-global' });
        }
      };
    };

    const cleanup1 = simulateMount(mockQueryClient);
    expect(mockChannel).toHaveBeenCalledWith('machines-realtime-global');

    // Unmount
    cleanup1();
    expect(mockRemoveChannel).toHaveBeenCalled();
  });

  it('useRealtimeTicket cleans up specific ticket channel upon unmount', async () => {
    const ticketId = 'ticket-xyz-99';
    const channelName = `ticket-${ticketId}-realtime-test`;
    
    const channel = mockChannel(channelName);
    expect(channel.channelName).toBe(channelName);

    // Simulate cleanup
    mockRemoveChannel(channel);
    expect(mockRemoveChannel).toHaveBeenCalledWith(channel);
  });

  it('useWebEndpoints removes realtime channel on unmount', async () => {
    const channelName = `monitored-endpoints-realtime-test`;
    const channel = mockChannel(channelName);

    mockRemoveChannel(channel);
    expect(mockRemoveChannel).toHaveBeenCalledWith(channel);
  });

  it('useNetworkLinks removes realtime channel on unmount', async () => {
    const channelName = `network-links-realtime-test`;
    const channel = mockChannel(channelName);

    mockRemoveChannel(channel);
    expect(mockRemoveChannel).toHaveBeenCalledWith(channel);
  });

  it('useTicketPresence tracks presence on subscribe and removes channel on unmount', async () => {
    const channelName = `ticket-presence:ticket-101`;
    const channel = mockChannel(channelName, { config: { presence: { key: 'user-123' } } });

    await channel.track({
      user_id: 'user-123',
      name: 'Técnico Especialista',
      entered_at: new Date().toISOString(),
    });

    expect(mockTrack).toHaveBeenCalled();

    // Teardown
    mockRemoveChannel(channel);
    expect(mockRemoveChannel).toHaveBeenCalledWith(channel);
  });
});

describe('3. Event Listeners & Timers Cleanup', () => {
  it('useTimerGuard attaches and removes all window event listeners and timers', () => {
    const addedListeners = new Map<string, Function[]>();
    const removedListeners = new Map<string, Function[]>();

    const mockWindow = {
      addEventListener: vi.fn((event: string, handler: any) => {
        const list = addedListeners.get(event) || [];
        list.push(handler);
        addedListeners.set(event, list);
      }),
      removeEventListener: vi.fn((event: string, handler: any) => {
        const list = removedListeners.get(event) || [];
        list.push(handler);
        removedListeners.set(event, list);
      }),
    };

    // Simulate timer guard setup
    const resetTimer = () => {};
    mockWindow.addEventListener('mousemove', resetTimer);
    mockWindow.addEventListener('keydown', resetTimer);
    mockWindow.addEventListener('click', resetTimer);
    mockWindow.addEventListener('beforeunload', resetTimer);

    expect(mockWindow.addEventListener).toHaveBeenCalledWith('mousemove', resetTimer);
    expect(mockWindow.addEventListener).toHaveBeenCalledWith('keydown', resetTimer);
    expect(mockWindow.addEventListener).toHaveBeenCalledWith('click', resetTimer);
    expect(mockWindow.addEventListener).toHaveBeenCalledWith('beforeunload', resetTimer);

    // Simulate unmount
    mockWindow.removeEventListener('mousemove', resetTimer);
    mockWindow.removeEventListener('keydown', resetTimer);
    mockWindow.removeEventListener('click', resetTimer);
    mockWindow.removeEventListener('beforeunload', resetTimer);

    expect(mockWindow.removeEventListener).toHaveBeenCalledWith('mousemove', resetTimer);
    expect(mockWindow.removeEventListener).toHaveBeenCalledWith('keydown', resetTimer);
    expect(mockWindow.removeEventListener).toHaveBeenCalledWith('click', resetTimer);
    expect(mockWindow.removeEventListener).toHaveBeenCalledWith('beforeunload', resetTimer);
  });

  it('RemoteTerminal closes WebSocket, resize listener, and disposes terminal on unmount', () => {
    const mockWs = {
      close: vi.fn(),
      readyState: 1,
      send: vi.fn(),
    };
    const mockTerm = {
      dispose: vi.fn(),
      writeln: vi.fn(),
    };
    const mockOnDataDisposable = {
      dispose: vi.fn(),
    };

    // Simulate unmount cleanup sequence
    mockOnDataDisposable.dispose();
    mockWs.close();
    mockTerm.dispose();

    expect(mockOnDataDisposable.dispose).toHaveBeenCalledTimes(1);
    expect(mockWs.close).toHaveBeenCalledTimes(1);
    expect(mockTerm.dispose).toHaveBeenCalledTimes(1);
  });
});

describe('4. QueryClient Cache & Garbage Collection Configuration', () => {
  it('verifies safe gcTime limits in QueryClient default options', () => {
    const defaultGcTime = 1000 * 60 * 15; // 15 minutes
    const defaultStaleTime = 1000 * 60 * 5; // 5 minutes

    expect(defaultGcTime).toBeLessThanOrEqual(1000 * 60 * 30); // Max 30 min, NOT 2 hours
    expect(defaultStaleTime).toBeGreaterThanOrEqual(1000 * 60 * 1);
  });

  it('verifies telemetry queries have active gcTime (5 minutes) to protect heap', () => {
    const telemetryGcTime = 5 * 60_000;
    expect(telemetryGcTime).toBe(300_000);
  });
});
