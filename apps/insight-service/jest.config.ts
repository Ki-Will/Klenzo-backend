/* eslint-disable */
export default {
  displayName: 'insight-service',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/../../apps/klenzo/src/app'],
  testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)'],
  transformIgnorePatterns: ['/node_modules/'],
  coverageDirectory: '../../coverage/apps/insight-service',
};
