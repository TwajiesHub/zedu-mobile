module.exports = {
  preset: 'react-native',
  setupFiles: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '\\.(mp3|mp4|m4a|wav|aac)$': '<rootDir>/test/asset-mock.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation|react-native-.*|rn-emoji-keyboard|emoji-mart-native)/)',
  ],
};
