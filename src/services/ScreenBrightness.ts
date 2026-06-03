import { registerPlugin } from '@capacitor/core';

export interface ScreenBrightnessPlugin {
  setBrightness(options: { brightness: number }): Promise<void>;
  getBrightness(): Promise<{ brightness: number }>;
}

const ScreenBrightness = registerPlugin<ScreenBrightnessPlugin>('ScreenBrightness', {
  web: () => import('./ScreenBrightnessWeb').then(m => new m.ScreenBrightnessWeb()),
});

export default ScreenBrightness;
