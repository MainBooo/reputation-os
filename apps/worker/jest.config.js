/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
        strict: true,
        esModuleInterop: true,
        module: 'commonjs',
        target: 'ES2022',
      }
    }]
  },
  collectCoverageFrom: ['**/*.ts', '!**/*.module.ts', '!main.ts'],
  testEnvironment: 'node',
}
