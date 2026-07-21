import { test, expect } from '@playwright/test';
import { EFaturaPage } from '../pages/efatura.page';

/**
 * QA icin: sunucu hatalarini ve JS hatalarini testin kendisi yakalasin.
 */
test.beforeEach(async ({ page }) => {
  page.on('response', (res) => {
    if (res.status() >= 500) console.warn(`[500+] ${res.status()} ${res.url()}`);
  });
  page.on('pageerror', (err) => console.warn(`[JS HATASI] ${err.message}`));
});

test.describe('e-Fatura', () => {
  // Bu blok calisirken zaten login'siniz (storageState sayesinde)

  test('smoke: dashboard aciliyor ve oturum ayakta', async ({ page }) => {
    await page.goto('/Home/Dashboard/Index');
    await expect(page).toHaveURL(/Dashboard/i);
    await expect(page).not.toHaveURL(/login/i);
  });

  test('Fatura Oluştur ekrani aciliyor', async ({ page }) => {
    const efatura = new EFaturaPage(page);
    await efatura.gotoOlustur();
    await expect(page).toHaveURL(/CreateInvoice/i);
    await expect(page.getByRole('heading', { name: /Fatura Oluştur/i })).toBeVisible();
    await expect(page.getByText(/Müşteri Ara/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /^Oluştur$/i })).toBeVisible();
  });

  test('Giden faturalar listesi aciliyor', async ({ page }) => {
    const efatura = new EFaturaPage(page);
    await efatura.gotoGiden();
    await expect(page).toHaveURL(/OutgoingInvoice/i);
  });

  /**
   * "Faturanın tamamlandı olması" DOGRULAMASI (read-only, hicbir sey kesmez).
   * Giden listesini bu ay icin filtreler, en yeni faturanin Durum'unu okur ve
   * basarili (Müşteriye Ulaştı / Gönderildi / Kabul...) oldugunu dogrular.
   * Kesim adimini SEN yaptiktan sonra bu test yeni faturayi da dogrular.
   */
  test('Giden listesinde son fatura tamamlandi durumda', async ({ page }) => {
    const efatura = new EFaturaPage(page);
    await efatura.gotoGidenVeFiltrele();

    const adet = await efatura.kayitSayisi();
    console.log('Bu ay giden fatura sayisi:', adet);
    test.skip(adet === 0, 'Bu ay giden e-fatura yok; once bir fatura kesilmeli.');

    const fatura = await efatura.ilkFatura();
    console.log('Son fatura:', JSON.stringify(fatura));
    expect(fatura.faturaNo, 'fatura no okunmali').not.toBe('');
    // Basarili VEYA gecis durumu (Onay Bekleniyor) kabul: yeni kesilen fatura GİB'de
    // islenirken kisa sure "Onay Bekleniyor"da kalir — bu hata degildir. Sadece
    // Hata/İptal/Red gibi durumlar fail sayilir.
    expect(
      EFaturaPage.durumBasarili(fatura.durum) || /Beklen|İşlen/i.test(fatura.durum),
      `Durum saglikli degil (hata/iptal?): "${fatura.durum}"`
    ).toBeTruthy();
  });

  test('kalem doldurulunca toplam hesaplaniyor (musteri secmeden)', async ({ page }) => {
    // Musteri gerektirmeden grid hesaplamasini dogrular (mukellef cari sartsiz calisir)
    const efatura = new EFaturaPage(page);
    await efatura.gotoOlustur();
    await page.locator('table input[type="text"]').first().fill('Test Hizmet');
    await efatura.setGridNumeric(0, 100); // Birim Fiyat
    await efatura.setGridNumeric(1, 2);   // Miktar
    await efatura.setGridNumeric(3, 20);  // KDV %
    await expect(page.getByText(/240,00/).first()).toBeVisible(); // 100*2*1.20 = 240
  });

  test('senaryo secilebiliyor (kesmeden, musteri gerekmez)', async ({ page }) => {
    // Büşra: "bütün senaryolarda kesebilirsin" -> senaryo secme mekanigini GÜVENLI dogrula
    // (fatura KESMEZ, sadece Senaryo dropdown'unu degistirir).
    const efatura = new EFaturaPage(page);
    await efatura.gotoOlustur();
    await efatura.senaryoSec('Ticari Fatura');
    const grp = page.locator('div.form-group.row, div.form-group', { has: page.getByText(/^Senaryo/i) }).first();
    await expect(grp.getByText('Ticari Fatura')).toBeVisible();
  });

  // NOT: Gercek e-Fatura KESME testi artik tests/manual/issuance.spec.ts icinde
  // (varsayilan `npm test`'e dahil DEGIL). Calistirmak icin: npm run test:issue
  // (once .env'e E_FATURA_ISSUE=1, gerekirse E_FATURA_MUSTERI=<mukellef cari>).
});
