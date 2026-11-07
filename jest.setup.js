// Native boundaries are provided by the app binary, not the Jest process.
require('react-native-gesture-handler/jestSetup');

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/mock'),
);
jest.mock('react-native-worklets', () =>
  require('react-native-worklets/src/mock'),
);
jest.mock('react-native-bootsplash', () => ({
  hide: jest.fn().mockResolvedValue(undefined),
  isVisible: jest.fn().mockResolvedValue(false),
  useHideAnimation: jest.fn(() => ({ container: {}, logo: {} })),
}));
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn().mockResolvedValue(true),
    signIn: jest.fn(),
    signOut: jest.fn(),
    getTokens: jest.fn(),
  },
  statusCodes: {},
}));
jest.mock('@invertase/react-native-apple-authentication', () => ({
  appleAuth: {
    performRequest: jest.fn(),
    getCredentialStateForUser: jest.fn(),
    Operation: { LOGIN: 1 },
    Scope: { FULL_NAME: 0, EMAIL: 1 },
    State: { AUTHORIZED: 1 },
  },
}));
jest.mock('@sayem314/react-native-keep-awake', () => ({
  useKeepAwake: jest.fn(),
  activateKeepAwake: jest.fn(),
  deactivateKeepAwake: jest.fn(),
}));
jest.mock('react-native-webview', () => {
  const React = require('react');
  const { View } = require('react-native');
  const WebView = React.forwardRef((props, ref) =>
    React.createElement(View, { ...props, ref }),
  );
  return { __esModule: true, default: WebView, WebView };
});
jest.mock('@react-native-documents/viewer', () => ({
  viewDocument: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@react-native-documents/picker', () => ({
  pick: jest.fn(),
  keepLocalCopy: jest.fn(),
  isErrorWithCode: jest.fn(() => false),
  errorCodes: {},
  types: { allFiles: '*/*', images: 'image/*', pdf: 'application/pdf' },
}));
jest.mock('@react-native-camera-roll/camera-roll', () => ({
  CameraRoll: {
    getPhotos: jest
      .fn()
      .mockResolvedValue({ edges: [], page_info: { has_next_page: false } }),
    save: jest.fn(),
  },
}));
jest.mock('react-native-compressor', () => ({
  Image: { compress: jest.fn(async uri => uri) },
  Video: { compress: jest.fn(async uri => uri), cancelCompression: jest.fn() },
  getFileSize: jest.fn().mockResolvedValue(0),
}));
jest.mock('react-native-agora', () => ({
  createAgoraRtcEngine: jest.fn(() => ({
    initialize: jest.fn(),
    release: jest.fn(),
    registerEventHandler: jest.fn(),
    unregisterEventHandler: jest.fn(),
    enableAudio: jest.fn(),
    enableVideo: jest.fn(),
    joinChannel: jest.fn(),
    leaveChannel: jest.fn(),
  })),
  ClientRoleType: { ClientRoleBroadcaster: 1, ClientRoleAudience: 2 },
  ChannelProfileType: { ChannelProfileCommunication: 0 },
  RtcSurfaceView: 'RtcSurfaceView',
  RtcTextureView: 'RtcTextureView',
  VideoSourceType: { VideoSourceCamera: 0 },
}));
/* eslint-env jest */
