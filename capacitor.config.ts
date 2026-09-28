import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fina.app',
  appName: 'Fina',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
