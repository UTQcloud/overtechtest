import { test, expect } from '@playwright/test';
import { EArsivPage } from '../pages/earsiv.page';

/**
 * E-ARŞİV testleri.
 *
 * Bu hesaptaki test carilerinin hicbiri e-fatura mukellefi olmadigi icin dogru
 * belge e-Arsiv. e-Arsiv "Hızlı Müşteri" ile anlik alici olusturur -> bozuk test
 * verisine bagimli degil.
 */
test.describe('e-Arşiv', () => {
  test('E-arşiv Oluştur ekrani aciliyor', async ({ page }) => {
    const earsiv = new EArsivPage(page);
    await earsiv.gotoOlustur();
    await expect(page).toHaveURL(/CreateArchiveInvoice/i);
    await expect(page.getByText(/Gönderim Şekli/i)).toBeVisible();     // e-arsiv'e ozel alan
    await expect(page.getByText(/Alıcı Etiketi/i)).toHaveCount(0);     // e-arsiv'de yok
  });

  test('kalem doldurulunca toplam hesaplaniyor', async ({ page }) => {
    // Musteri gerektirmeden grid hesabini dogrular
    const earsiv = new EArsivPage(page);
    await earsiv.gotoOlustur();
    await page.locator('table input[type="text"]').first().fill('Test Hizmet');
    await earsiv.setGridNumeric(0, 100); // Item Price
    await earsiv.setGridNumeric(1, 3);   // Miktar
    await earsiv.setGridNumeric(3, 20);  // KDV %
    await expect(page.getByText(/360,00/).first()).toBeVisible(); // 100*3*1.20 = 360
  });

  // NOT: Gercek e-Arsiv OLUSTURMA ve MÜŞTERİYE GÖNDERME testleri artik
  // tests/manual/issuance.spec.ts icinde (varsayilan `npm test`'e dahil DEGIL).
  // Calistirmak icin: npm run test:issue  (once .env'e E_ARSIV_ISSUE / E_ARSIV_SEND).
});
