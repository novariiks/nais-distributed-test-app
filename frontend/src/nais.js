// NAIS replaces this file with environment-specific configuration at deployment.
export default {
  telemetryCollectorURL: 'http://localhost:12347/collect',
  app: {
    name: 'nais-chat-frontend',
    namespace: 'flais',
    version: 'local',
  },
};
