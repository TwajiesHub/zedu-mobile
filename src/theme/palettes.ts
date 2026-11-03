import type { ThemeColors } from './types';

/** Light palette — matches the existing app colors today. */
export const lightColors: ThemeColors = {
  primary: '#6C47FF',
  primaryforeground: '#7141F8',
  secondary: '#303073',
  secondaryforeground: '#D3C4FD33',

  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',

  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceElevated: '#F8F9FA',

  textPrimary: '#000000',
  textSecondary: '#666666',
  textMuted: '#333333',
  textMain: '#000000',

  border: '#E5E5E5',
  error: '#FF3B30',
  online: '#22C55E',
  offline: '#9095A1',
  presenceOnline: '#16A34A',
  presenceOffline: '#B8BEC8',
  presenceOnlineText: '#15803D',
  bgSecondary: '#F8F9FA',
  topNavigation: '#F2F2FF',
  lightBlue: '#f7f7fc',
  lightYellow: '#f3ffc1',

  tabBar: '#FFFFFF',
  tabBarBorder: '#E5E5E5',
  iconDefault: '#54656F',
  iconMuted: '#C4C4C6',

  chatSentBubble: '#F2F2FF',
  chatReceivedBubble: '#FFFFFF',
  chatHighlight: '#f3ffc1',
  unreadMarker: '#DC2626',
  channelMentionBackground: '#FFE066',
  channelMentionForeground: '#CA8A04',

  categoryChip: '#F3F4F6',
  skeleton: '#E1E9EE',
  messageMeta: '#667781',
  reactionBackground: '#F0F2F5',
  threadBarBackground: '#F7F7F8',
  dateHeaderBackground: 'rgba(255, 255, 255, 0.8)',
  channelAvatarBackground: 'rgba(0, 52, 115, 0.18)',
  waveformInactive: '#C8CCCE',

  statusBarStyle: 'dark-content',
  statusBarBackground: '#FFFFFF',
};

//  Dark palette — Slack-inspired: deep gray backgrounds, soft text, brand purple retained.

export const darkColors: ThemeColors = {
  primary: '#6C47FF',
  primaryforeground: '#9B7BFF',
  secondary: '#303073',
  secondaryforeground: '#D3C4FD33',

  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',

  background: '#1A1D21',
  surface: '#222529',
  surfaceElevated: '#2C2D30',

  textPrimary: '#D1D2D3',
  textSecondary: '#ABABAD',
  textMuted: '#868686',
  textMain: '#D1D2D3',

  border: '#3F3F41',
  error: '#FF3B30',
  online: '#22C55E',
  offline: '#9095A1',
  presenceOnline: '#16A34A',
  presenceOffline: '#B8BEC8',
  presenceOnlineText: '#4ADE80',
  bgSecondary: '#222529',
  topNavigation: '#303073',
  lightBlue: '#252830',
  lightYellow: '#3D3A28',

  tabBar: '#1A1D21',
  tabBarBorder: '#3F3F41',
  iconDefault: '#ABABAD',
  iconMuted: '#616061',

  chatSentBubble: '#2A2640',
  chatReceivedBubble: '#222529',
  chatHighlight: '#3D3A28',
  unreadMarker: '#DC2626',
  channelMentionBackground: '#6B5600',
  channelMentionForeground: '#FACC15',

  categoryChip: '#2C2D30',
  skeleton: '#3A3D42',
  messageMeta: '#ABABAD',
  reactionBackground: '#2C2D30',
  threadBarBackground: '#252830',
  dateHeaderBackground: 'rgba(34, 37, 41, 0.92)',
  channelAvatarBackground: 'rgba(107, 124, 255, 0.15)',
  waveformInactive: '#4B5563',

  statusBarStyle: 'light-content',
  statusBarBackground: '#1A1D21',
};
