import type { ScreenBrightnessPlugin } from './ScreenBrightness';

export class ScreenBrightnessWeb implements ScreenBrightnessPlugin {
  async setBrightness(options: { brightness: number }): Promise<void> {
    try {
      (screen as any).brightness = options.brightness;
    } catch {
      // experimental API not available in browser
    }
  }

  async getBrightness(): Promise<{ brightness: number }> {
    let val = 0.5;
    try {
      val = (screen as any).brightness ?? 0.5;
    } catch {
      // fallback
    }
    return { brightness: val };
  }
}
