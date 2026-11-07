/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { requestAndroidNotificationPermission } from '@/services/android-fcm.service';
import { requestAppPermissions } from '@/lib/permissions';
import App from '../App';

// The launch flow awaits the camera/audio permissions before asking for notifications. Mock them so
// the test doesn't depend on native permission stubs.
jest.mock('@/lib/permissions', () => ({
  requestAppPermissions: jest.fn(),
}));

jest.mock('@/services/android-fcm.service', () => ({
  ...jest.requireActual('@/services/android-fcm.service'),
  requestAndroidNotificationPermission: jest.fn(),
}));

const mockRequestAppPermissions = requestAppPermissions as jest.MockedFunction<
  typeof requestAppPermissions
>;

// Rendering the whole app in a cold worker can pass Jest's default 5s.
jest.setTimeout(30000);

describe('notification permission at launch', () => {
  const requestNotifications = jest.mocked(
    requestAndroidNotificationPermission,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    requestNotifications.mockResolvedValue(true);
    mockRequestAppPermissions.mockResolvedValue(true);
  });

  it('is requested exactly once on a signed-out launch', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(React.createElement(App));
    });

    // Let the launch flow finish its awaited permission requests before counting.
    await ReactTestRenderer.act(async () => {
      await new Promise<void>(resolve => setImmediate(resolve));
    });

    const requests = requestNotifications.mock.calls.length;

    // Unmount before asserting, so a failing assertion can't leave navigation animations running after
    // Jest tears the environment down.
    await ReactTestRenderer.act(() => {
      renderer?.unmount();
    });

    expect(requests).toBe(1);
  });
});
