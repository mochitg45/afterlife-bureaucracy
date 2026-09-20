import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.afterlifebureaucracy.game',
  appName: 'Afterlife Bureaucracy',
  webDir: 'dist',
  android: { backgroundColor: '#EDE7D4', adjustMarginsForEdgeToEdge: 'force' },
  ios: { contentInset: 'never', backgroundColor: '#EDE7D4' },
};

export default config;
