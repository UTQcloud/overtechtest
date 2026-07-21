import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },

  // Legacy portallarda testler ortak veri (fatura no, cari vs.) ürettiği için
  // paralel çalıştırmak riskli. Stabil olduğundan emin olunca true yaparsın.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,

  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: process.env.BASE_URL ?? 'https://overed.overtech.com.tr',
    trace: 'retain-on-failure',      // hata olursa trace viewer ile adım adım izle
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'tr-TR',
    timezoneId: 'Europe/Istanbul',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    // 1) Bir kez login olur, oturumu diske yazar
    { name: 'setup', testMatch: /auth\.setup\.ts/ },

    // 2) GÜVENLİ testler (varsayilan `npm test`). tests/manual/ HARIÇ -> hicbir
    //    gercek belge uretilmez. Oturumla acilir, her testte tekrar login yok.
    {
      name: 'chromium',
      testIgnore: /[\\/]manual[\\/]/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    // 3) MANUAL / GERÇEK belge ureten testler (SADECE `npm run test:issue`).
    //    Normal `npm test` bu projeyi calistirmaz (scriptler --project ile secer).
    {
      name: 'issuance',
      testMatch: /[\\/]manual[\\/].*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],
});
