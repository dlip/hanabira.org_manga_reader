// SRS algorithm settings (client-side editable model)
export interface SRSAlgorithmSettings {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  // Basic
  initialEaseFactor: number; // e.g. 2.5
  initialInterval: number; // days
  secondInterval: number; // days
  minEaseFactor: number; // lower bound for ease
  maxEaseFactor: number; // optional ceiling
  maxInterval: number; // cap in days
  graduationInterval: number; // threshold for graduating from learning
  lapseMultiplier: number; // factor applied on lapse
  lapseMinInterval: number; // minimum interval after lapse
  // Easy response modifiers
  easyBonus: number;
  easyPenalty: number;
  easyPenaltyMultiplier: number;
  // Hard response modifiers
  hardPenalty: number;
  hardPenaltyLinear: number;
  hardPenaltyQuadratic: number;
}

// Reasonable defaults (inspired by SM-2 style with tweaks)
export const DEFAULT_SRS_SETTINGS: SRSAlgorithmSettings = {
  id: 'supermemo2-default',
  name: 'SuperMemo2 Default',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  initialEaseFactor: 2.5,
  initialInterval: 1,
  secondInterval: 6,
  minEaseFactor: 1.3,
  maxEaseFactor: 5.0,
  maxInterval: 3650,
  graduationInterval: 21,
  lapseMultiplier: 0.5,
  lapseMinInterval: 2,
  easyBonus: 0.15,
  easyPenalty: 0.08,
  easyPenaltyMultiplier: 0.02,
  hardPenalty: 0.8,
  hardPenaltyLinear: 0.25,
  hardPenaltyQuadratic: 0.02,
};

interface SRSPreset {
  id: string;
  name: string;
  description: string;
  settings: Omit<SRSAlgorithmSettings, 'id' | 'name' | 'createdAt' | 'updatedAt'>;
}

export const SRS_PRESETS: SRSPreset[] = [
  {
    id: 'supermemo2-default',
    name: 'SM2 Balanced',
    description: 'Classic SM2 style spacing balanced for mixed difficulty.',
    settings: {
      initialEaseFactor: DEFAULT_SRS_SETTINGS.initialEaseFactor,
      initialInterval: DEFAULT_SRS_SETTINGS.initialInterval,
      secondInterval: DEFAULT_SRS_SETTINGS.secondInterval,
      minEaseFactor: DEFAULT_SRS_SETTINGS.minEaseFactor,
      maxEaseFactor: DEFAULT_SRS_SETTINGS.maxEaseFactor,
      maxInterval: DEFAULT_SRS_SETTINGS.maxInterval,
      graduationInterval: DEFAULT_SRS_SETTINGS.graduationInterval,
      lapseMultiplier: DEFAULT_SRS_SETTINGS.lapseMultiplier,
      lapseMinInterval: DEFAULT_SRS_SETTINGS.lapseMinInterval,
      easyBonus: DEFAULT_SRS_SETTINGS.easyBonus,
      easyPenalty: DEFAULT_SRS_SETTINGS.easyPenalty,
      easyPenaltyMultiplier: DEFAULT_SRS_SETTINGS.easyPenaltyMultiplier,
      hardPenalty: DEFAULT_SRS_SETTINGS.hardPenalty,
      hardPenaltyLinear: DEFAULT_SRS_SETTINGS.hardPenaltyLinear,
      hardPenaltyQuadratic: DEFAULT_SRS_SETTINGS.hardPenaltyQuadratic,
    }
  },
  {
    id: 'aggressive-fast',
    name: 'Aggressive Fast',
    description: 'Shorter early intervals for cram sessions; tight control on ease.',
    settings: {
      initialEaseFactor: 2.3,
      initialInterval: 1,
      secondInterval: 4,
      minEaseFactor: 1.3,
      maxEaseFactor: 4.5,
      maxInterval: 1800,
      graduationInterval: 14,
      lapseMultiplier: 0.45,
      lapseMinInterval: 1,
      easyBonus: 0.12,
      easyPenalty: 0.09,
      easyPenaltyMultiplier: 0.025,
      hardPenalty: 0.85,
      hardPenaltyLinear: 0.28,
      hardPenaltyQuadratic: 0.025,
    }
  },
  {
    id: 'gentle-long',
    name: 'Gentle Long-Term',
    description: 'Longer early ramp; less penalty for hard; slower ease decay.',
    settings: {
      initialEaseFactor: 2.6,
      initialInterval: 2,
      secondInterval: 7,
      minEaseFactor: 1.4,
      maxEaseFactor: 5.0,
      maxInterval: 4000,
      graduationInterval: 30,
      lapseMultiplier: 0.55,
      lapseMinInterval: 2,
      easyBonus: 0.18,
      easyPenalty: 0.07,
      easyPenaltyMultiplier: 0.018,
      hardPenalty: 0.75,
      hardPenaltyLinear: 0.22,
      hardPenaltyQuadratic: 0.018,
    }
  }
];

function loadFromStorage(): SRSAlgorithmSettings | null {
  try {
    const raw = localStorage.getItem('srs:algoSettings');
    if (!raw) return null;
    return JSON.parse(raw) as SRSAlgorithmSettings;
  } catch { return null; }
}

function saveToStorage(settings: SRSAlgorithmSettings): void {
  try { localStorage.setItem('srs:algoSettings', JSON.stringify(settings)); } catch {}
}

export class SRSSettingsManager {
  static async getSettings(): Promise<SRSAlgorithmSettings> {
    const stored = loadFromStorage();
    if (stored) return stored;
    return DEFAULT_SRS_SETTINGS;
  }
  static async saveSettings(s: SRSAlgorithmSettings): Promise<SRSAlgorithmSettings> {
    const updated = { ...s, updatedAt: new Date().toISOString() };
    saveToStorage(updated);
    return updated;
  }
  static async resetToDefaults(): Promise<SRSAlgorithmSettings> {
    const base = { ...DEFAULT_SRS_SETTINGS, id: 'supermemo2-default', updatedAt: new Date().toISOString() };
    saveToStorage(base);
    return base;
  }
  static getPresets(): SRSPreset[] { return SRS_PRESETS; }
  static async applyPreset(presetId: string): Promise<SRSAlgorithmSettings> {
    const preset = SRS_PRESETS.find(p => p.id === presetId);
    if (!preset) return DEFAULT_SRS_SETTINGS;
    const settings: SRSAlgorithmSettings = {
      id: presetId,
      name: preset.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...preset.settings,
    } as unknown as SRSAlgorithmSettings;
    saveToStorage(settings);
    return settings;
  }
  static validateSettings(s: SRSAlgorithmSettings): string[] {
    const errs: string[] = [];
    if (s.initialEaseFactor < 1.3 || s.initialEaseFactor > 3.0) errs.push('Initial Ease Factor out of range');
    if (s.minEaseFactor < 1.0 || s.minEaseFactor > s.maxEaseFactor) errs.push('Min Ease Factor invalid');
    if (s.lapseMultiplier < 0 || s.lapseMultiplier > 1) errs.push('Lapse Multiplier must be between 0 and 1');
    if (s.maxInterval < 30) errs.push('Max Interval too low');
    return errs;
  }
  static getSettingsFromStorage(): SRSAlgorithmSettings { return loadFromStorage() || DEFAULT_SRS_SETTINGS; }
  static saveSettingsToStorage(s: SRSAlgorithmSettings): SRSAlgorithmSettings { saveToStorage(s); return s; }
}