import { test as setup, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page';

const authFile = 'playwright/.auth/user.json';

setup('giris yap ve oturumu kaydet', async ({ page }) => {
  const user = process.env.PORTAL_USER;
  const pass = process.env.PORTAL_PASS;

  if (!user || !pass) {
    throw new Error('PORTAL_USER / PORTAL_PASS tanimli degil. .env dosyasini olustur.');
  }

  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login(user, pass);

  // Giris basarili mi? Dashboard'a dustuysek tamam.
  await expect(page).toHaveURL(/Dashboard/i, { timeout: 20_000 });

  // ONEMLI: Bu portalda oturum, localStorage'daki "ot-user" JWT'sinde tutulur
  // (auth cookie'si YOK). Token yazilmadan storageState alirsak diger testler
  // login sayfasina duser. Bu yuzden AccessToken localStorage'a dusene kadar bekle.
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('ot-user')), { timeout: 15_000 })
    .toContain('AccessToken');

  // Cerezleri + localStorage'i diske yaz -> diger testler login olmadan baslar
  await page.context().storageState({ path: authFile });
});
