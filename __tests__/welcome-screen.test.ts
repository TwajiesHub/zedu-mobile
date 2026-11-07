/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { requestAndroidNotificationPermission } from '@/services/android-fcm.service';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { requestAppPermissions } from '@/lib/permissions';
import WelcomeScreen from '@/screens/welcomescreen';

jest.mock('@/lib/permissions', () => ({
  requestAppPermissions: jest.fn(),
}));

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: jest.fn() }),
}));

jest.mock('@/services/android-fcm.service', () => ({
  ...jest.requireActual('@/services/android-fcm.service'),
  requestAndroidNotificationPermission: jest.fn(),
}));

const mockRequestAppPermissions = requestAppPermissions as jest.MockedFunction<
  typeof requestAppPermissions
>;

// The first render in a cold worker loads the theme and styles, which can pass Jest's default 5s.
jest.setTimeout(30000);

describe('WelcomeScreen permissions', () => {
  const requestNotifications = jest.mocked(
    requestAndroidNotificationPermission,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    requestNotifications.mockResolvedValue(true);
  });

  const renderWelcomeScreen = async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        React.createElement(
          ThemeProvider,
          null,
          React.createElement(WelcomeScreen),
        ),
      );
    });
    return renderer as ReactTestRenderer.ReactTestRenderer;
  };

  it('asks for notifications only after the camera and audio dialogs are answered', async () => {
    let answerCameraAndAudio: (granted: boolean) => void = () => {};
    mockRequestAppPermissions.mockReturnValue(
      new Promise<boolean>(resolve => {
        answerCameraAndAudio = resolve;
      }),
    );

    const renderer = await renderWelcomeScreen();

    // Camera/audio dialogs are still open, so a notification dialog must not stack on top of them.
    expect(mockRequestAppPermissions).toHaveBeenCalledTimes(1);
    expect(requestNotifications).not.toHaveBeenCalled();

    await ReactTestRenderer.act(async () => {
      answerCameraAndAudio(true);
    });

    expect(requestNotifications).toHaveBeenCalledTimes(1);

    await ReactTestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it('requests notification permission once per launch', async () => {
    mockRequestAppPermissions.mockResolvedValue(true);

    const renderer = await renderWelcomeScreen();

    expect(requestNotifications).toHaveBeenCalledTimes(1);

    await ReactTestRenderer.act(() => {
      renderer.unmount();
    });
  });
});
