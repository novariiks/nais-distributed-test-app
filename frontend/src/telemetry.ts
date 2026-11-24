import { faro, getWebInstrumentations, initializeFaro } from '@grafana/faro-web-sdk';
import { ReactIntegration } from '@grafana/faro-react';
import { TracingInstrumentation } from '@grafana/faro-web-tracing';

export interface FrontendConfig {
  telemetryCollectorURL: string;
  app: { name: string; namespace: string; version?: string };
}

export function initializeTelemetry(config: FrontendConfig) {
  if (!config.telemetryCollectorURL) return false;
  if (faro.config) return true;

  initializeFaro({
    url: config.telemetryCollectorURL,
    app: config.app,
    instrumentations: [
      ...getWebInstrumentations({ captureConsole: false }),
      new ReactIntegration(),
      new TracingInstrumentation(),
    ],
    beforeSend: item => {
      if (item.meta.page?.url) {
        try {
          const url = new URL(item.meta.page.url);
          url.search = '';
          url.hash = '';
          item.meta.page.url = url.toString();
        } catch {
          return null;
        }
      }
      return item;
    },
  });
  return true;
}
