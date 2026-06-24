// Design tokens for What's first? — dark-mode-first theme.
// Both light and dark palettes use the dark scheme so the app always
// looks dark regardless of the user's system preference.

const palette = {
  text: "#FFFFFF",
  tint: "#6366F1",
  background: "#0F0F0F",
  foreground: "#FFFFFF",
  card: "#1A1A1A",
  cardForeground: "#FFFFFF",
  primary: "#6366F1",
  primaryForeground: "#FFFFFF",
  secondary: "#242424",
  secondaryForeground: "#A0A0A0",
  muted: "#242424",
  mutedForeground: "#737373",
  accent: "#6366F1",
  accentForeground: "#FFFFFF",
  destructive: "#EF4444",
  destructiveForeground: "#FFFFFF",
  border: "#2A2A2A",
  input: "#2A2A2A",
  surface: "#242424",
  // Urgency colors
  urgencyHigh: "#EF4444",
  urgencyMedium: "#F97316",
  urgencyLow: "#22C55E",
  urgencyGrey: "#9CA3AF",
};

const colors = {
  light: palette,
  dark: palette,
  radius: 12,
};

export default colors;
