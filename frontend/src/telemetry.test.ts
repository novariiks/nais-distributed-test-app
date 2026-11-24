import { beforeEach, describe, expect, it, vi } from 'vitest';
import { faro, getWebInstrumentations, initializeFaro } from '@grafana/faro-web-sdk';
import { TracingInstrumentation } from '@grafana/faro-web-tracing';
import { ReactIntegration } from '@grafana/faro-react';
import { initializeTelemetry } from './telemetry';

vi.mock('@grafana/faro-web-sdk', () => ({
  faro: { api: {} },
  getWebInstrumentations: vi.fn(() => ['web-instrumentation']),
  initializeFaro: vi.fn(),
}));
vi.mock('@grafana/faro-web-tracing', () => ({
  TracingInstrumentation: class {},
}));
vi.mock('@grafana/faro-react', () => ({ ReactIntegration: class {} }));

const config = {
  telemetryCollectorURL: 'https://telemetry.example.test/collect',
  app: { name: 'nais-chat-frontend', namespace: 'flais', version: 'test-version' },
};

describe('frontend telemetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (faro as { config?: unknown }).config;
  });

  it('disables telemetry with the local fallback configuration', () => {
    expect(initializeTelemetry({ ...config, telemetryCollectorURL: '' })).toBe(false);
    expect(initializeFaro).not.toHaveBeenCalled();
  });

  it('uses runtime metadata and enables browser and API tracing', () => {
    expect(initializeTelemetry(config)).toBe(true);
    const options = vi.mocked(initializeFaro).mock.calls[0][0];
    expect(options.url).toBe(config.telemetryCollectorURL);
    expect(options.app).toEqual(config.app);
    expect(getWebInstrumentations).toHaveBeenCalledWith({ captureConsole: false });
    expect(options.instrumentations).toEqual([
      'web-instrumentation', expect.any(ReactIntegration), expect.any(TracingInstrumentation),
    ]);
  });

  it('keeps an already initialized SDK', () => {
    (faro as { config?: unknown }).config = {};
    expect(initializeTelemetry(config)).toBe(true);
    expect(initializeFaro).not.toHaveBeenCalled();
  });

  it('strips query parameters and fragments from outgoing page metadata', () => {
    initializeTelemetry(config);
    const beforeSend = vi.mocked(initializeFaro).mock.calls[0][0].beforeSend!;
    const item = {
      type: 'event',
      payload: { name: 'test' },
      meta: { page: { url: 'https://chat.example.test/?token=secret#private' } },
    } as Parameters<typeof beforeSend>[0];
    expect(beforeSend(item)?.meta.page?.url).toBe('https://chat.example.test/');
    item.meta.page!.url = 'invalid-url';
    expect(beforeSend(item)).toBeNull();
  });
});
