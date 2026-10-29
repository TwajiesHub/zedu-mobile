import React from 'react';
import { StyleSheet } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { ExitChannelSheet } from '@/components/layout/channels/exit-channel';
import { ExitGroupSheet } from '@/components/layout/group-chat/exit-group';
import { AppText } from '@/components/ui/text';
import { darkColors, lightColors } from '@/theme/palettes';
import type { ThemeColors } from '@/theme/types';

let mockColors: ThemeColors = lightColors;
jest.mock('@/theme/ThemeProvider', () => ({
  useTheme: () => ({ colors: mockColors }),
}));
jest.mock('@/components/ui/bottom-sheet', () => {
  const ReactModule = require('react');
  return {
    __esModule: true,
    default: ReactModule.forwardRef(
      ({ children }: { children: React.ReactNode }, _ref: unknown) => children,
    ),
  };
});
jest.mock('@/store/useDataContext', () => ({
  useDataContext: () => ({ state: { orgId: 'org-1' }, dispatch: jest.fn() }),
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), reset: jest.fn() }),
}));
jest.mock('@/utils/requests', () => ({
  PostRequest: jest.fn(),
  DeleteRequest: jest.fn(),
}));
jest.mock('react-native-vector-icons/Ionicons', () => 'Icon');

const NAME = 'study-group';

const sheets = [
  ['ExitChannelSheet', ExitChannelSheet],
  ['ExitGroupSheet', ExitGroupSheet],
] as const;

describe('exit sheet name emphasis', () => {
  let tree: TestRenderer.ReactTestRenderer | undefined;

  afterEach(async () => {
    if (tree) {
      await act(async () => tree?.unmount());
      tree = undefined;
    }
  });

  const nameStyle = async (
    Sheet: (typeof sheets)[number][1],
    colors: ThemeColors,
  ) => {
    mockColors = colors;
    await act(async () => {
      tree = TestRenderer.create(
        <Sheet onClose={jest.fn()} channel_id="channel-1" groupName={NAME} />,
      );
    });
    const name = tree!.root
      .findAllByType(AppText)
      .find(
        node =>
          Array.isArray(node.props.children) &&
          node.props.children.includes(NAME),
      );
    expect(name).toBeDefined();
    return StyleSheet.flatten(name!.props.style);
  };

  describe.each(sheets)('%s', (_, Sheet) => {
    it.each([
      ['light', lightColors],
      ['dark', darkColors],
    ])(
      'renders the name in the %s theme primary text colour',
      async (__, colors) => {
        const style = await nameStyle(Sheet, colors);
        expect(style.color).toBe(colors.textPrimary);
      },
    );
  });
});
