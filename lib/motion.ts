export const motionTiming = {
  quick: 0.15,
  base: 0.3,
  reveal: 0.6,
  hero: 0.8,
  autoAdvanceMs: 6500,
} as const;

export const motionEase = {
  emphasis: [0.645, 0.045, 0.355, 1],
  standard: [0.4, 0, 0.2, 1],
  reveal: [0.22, 1, 0.36, 1],
  bar: [0.5, 0, 0.01, 1],
  stat: [0.1, 0, 0.1, 1],
  card: [0.76, 0, 0.24, 1],
  button: [0.455, 0.03, 0.515, 0.955],
} as const;
