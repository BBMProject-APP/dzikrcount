export interface DhikrType {
  id: string;
  name: string;
  arabic: string;
  transliteration: string;
  translation: string;
  defaultDurationMs: number; // simulated duration of audio track in ms
  audioFrequency: number;     // frequency for synthetic vocal/hum generator
}

export interface AmbientLayer {
  id: string;
  name: string;
  icon: string;
  volume: number; // 0.0 to 1.0
}
