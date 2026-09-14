import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.afterlifebureaucracy.game',
  appName: 'Afterlife Bureaucracy',
  webDir: 'dist',
  android: { backgroundColor: '#1B1915' },
  ios: { contentInset: 'never', backgroundColor: '#1B1915' },
};

export default config;
