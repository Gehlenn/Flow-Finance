module.exports = {
  testDir: '.',
  testMatch: 'qa-exhaustive.spec.mjs',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:3078',
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  workers: 1,
};
