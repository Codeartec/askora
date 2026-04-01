/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '..',
  testRegex: '.e2e-spec.ts$',
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      { tsconfig: { types: ['jest', 'node'] } },
    ],
  },
  moduleNameMapper: {
    '^uuid$': '<rootDir>/test/__mocks__/uuid.js',
  },
  testEnvironment: 'node',
};
