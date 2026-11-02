/** Minimal jest stub for react-native-fs (native module, untranspiled source). */
const RNFS = {
  readDir: async () => [],
  exists: async () => false,
};

module.exports = RNFS;
module.exports.default = RNFS;
