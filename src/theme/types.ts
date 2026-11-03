export type ThemePreference = 'light' | 'dark' | 'system';

export type ResolvedColorScheme = 'light' | 'dark';

/**
 * Semantic color tokens used across the app.
 * Legacy keys (textMain, bgSecondary, etc.) remain during migration
 * so existing screens can adopt theme gradually.
 */
export type ThemeColors = {
  // Brand
  primary: string;
  primaryforeground: string;
  secondary: string;
  secondaryforeground: string;

  // Base
  white: string;
  black: string;
  transparent: string;

  // Semantic surfaces
  background: string;
  surface: string;
  surfaceElevated: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;

  // Legacy text aliases (migration)
  textMain: string;

  // UI states
  border: string;
  error: string;
  online: string;
  offline: string;
  presenceOnline: string;
  presenceOffline: string;
  presenceOnlineText: string;
  bgSecondary: string;
  topNavigation: string;
  lightBlue: string;
  lightYellow: string;

  // Navigation / chrome
  tabBar: string;
  tabBarBorder: string;
  iconDefault: string;
  iconMuted: string;

  // Chat
  chatSentBubble: string;
  chatReceivedBubble: string;
  chatHighlight: string;
  unreadMarker: string;
  channelMentionBackground: string;
  channelMentionForeground: string;

  // Lists & loading
  categoryChip: string;
  skeleton: string;
  messageMeta: string;
  reactionBackground: string;
  threadBarBackground: string;
  dateHeaderBackground: string;
  channelAvatarBackground: string;
  waveformInactive: string;

  // Status bar
  statusBarStyle: 'light-content' | 'dark-content';
  statusBarBackground: string;
};

export type AppTheme = {
  colors: ThemeColors;
  colorScheme: ResolvedColorScheme;
  isDark: boolean;
};
