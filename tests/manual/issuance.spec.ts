import { test, expect } from '@playwright/test';
import { EArsivPage } from '../../pages/earsiv.page';
import { EFaturaPage } from '../../pages/efatura.page';

/**
 * ⚠️⚠️ GERÇEK BELGE ÜRETEN TESTLER — VARSAYILAN `npm test`'E DAHİL DEĞİL ⚠️⚠️
 *
 * Bu dosyadaki testler GERÇEK e-Arşiv/e-Fatura belgesi olusturur/gonderir (GİB test
 * ortami da olsa geri alinmasi zor islemler). Bu yuzden:
 *   1) Ayri "issuance" projesindeler; normal `npm test` bunlari CALISTIRMAZ.
 *   2) Ayrica her biri .env flag'i olmadan `test.fixme` ile atlanir (ikili guvenlik).
 *
 * Sadece bilerek calistirmak icin:
 *   npm run test:issue        (once .env'e ilgili flag'i ekle)
 *
 * Flag'ler (.env):
 *   E_ARSIV_ISSUE=1   -> e-Arsiv olusturma (taslak)
 *   E_ARSIV_SEND=1    -> e-Arsiv olustur + "Müşteriye Gönder" (resmi gonderim)
 *   E_FATURA_ISSUE=1  -> gercek e-Fatura kesimi (mukellef cari; default CARREFOURSA)
 */

test.describe('MANUAL: e-Arşiv üretimi', () => {
  test('e-arşiv oluşturulabiliyor (taslağa kaydediliyor)', async ({ page }) => {
    test.fixme(!process.env.E_ARSIV_ISSUE, 'Gercek belge uretir. .env: E_ARSIV_ISSUE=1');
    test.setTimeout(90_000);

    const earsiv = new EArsivPage(page);
    await earsiv.gotoOlustur();
    const musteri = await earsiv.hizliMusteriOlustur(); // rastgele GERCEK isim, TCKN 11111111111
    console.log('Hızlı Müşteri:', musteri);
    await earsiv.kalemDoldur('Test Hizmet', 100, 1, 20);
    expect(await earsiv.toplamTutar()).toContain('120,00');

    const ettn = await earsiv.olustur(); // basari modali gorunmezse throw
    await expect(page.getByText(/taslak olarak başarıyla kaydedildi/i)).toBeVisible();
    console.log('Fatura olusturuldu. ETTN:', ettn || '(onizleme iframe\'inde)');
  });

  test('e-arşiv oluşturulup müşteriye gönderilip tamamlaniyor', async ({ page }) => {
    test.fixme(!process.env.E_ARSIV_SEND, 'Resmi GİB gonderimi. .env: E_ARSIV_SEND=1');
    test.setTimeout(120_000);

    const earsiv = new EArsivPage(page);
    await earsiv.gotoOlustur();
    const musteri = await earsiv.hizliMusteriOlustur();
    console.log('Hızlı Müşteri:', musteri);
    await earsiv.kalemDoldur('Test Hizmet', 100, 1, 20);
    const ettn = await earsiv.olustur();
    await expect(page.getByText(/başarıyla kaydedildi/i)).toBeVisible();
    console.log('Taslak kaydedildi, ETTN:', ettn || '(önizleme iframe\'inde)');

    // Müşteriye Gönder -> gonderim sonucu sinyalini dogrula (taslaktaYok sabit isimle
    // guvenilmez cunku ayni "Utkuhan Bulut" birden fazla kez olusabiliyor).
    const gonderimSonucu = await earsiv.musteriyeGonder();
    console.log('GÖNDERİM SONUCU:', gonderimSonucu || '(bildirim yakalanamadi)');
    expect(
      /başarı|gönderil|iletildi|kaydedildi|kabul/i.test(gonderimSonucu),
      `Gönderim başarı sinyali beklenir, gelen: "${gonderimSonucu}"`
    ).toBeTruthy();
  });
});

/**
 * Büşra: "Bütün senaryolarda kesebilirsin." -> her senaryo icin ayri test.
 *
 * Varsayilan senaryolar BASIT test verisiyle kesilebilenler (Temel/Ticari Fatura).
 * Digerleri (İhracat, İlaç, Yolcu Beraber Eşya, İnşaat Demiri, Yatırım Teşvik, Hal
 * Kayıt, Özel) EK ALAN ister (GTİP, yurtdisi alici, takip no...) -> basit veriyle
 * validasyona takilir. Onlari da denemek istersen .env ile ekle:
 *   E_FATURA_SENARYOLAR=Temel Fatura,Ticari Fatura,Özel Fatura
 */
const EF_SENARYOLAR = (process.env.E_FATURA_SENARYOLAR || 'Temel Fatura,Ticari Fatura')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

test.describe('MANUAL: e-Fatura — tüm senaryolar', () => {
  for (const senaryo of EF_SENARYOLAR) {
    test(`e-fatura kesilebiliyor ve tamamlandi [${senaryo}]`, async ({ page }) => {
      test.fixme(
        !process.env.E_FATURA_ISSUE,
        'Gercek fatura keser. .env: E_FATURA_ISSUE=1 (+ gerekirse E_FATURA_MUSTERI=<mukellef cari>)'
      );
      test.setTimeout(120_000);

      const efatura = new EFaturaPage(page);

      // ÖNCE: mevcut en yeni fatura no'yu kaydet. Kesimden SONRA bunun DEGISMESI
      // (yeni fatura no cikmasi) gerekir; aksi halde "yeni fatura kesildi" diyemeyiz.
      // (Onceki hata: sadece listenin tepesini okuyup eski faturayla "gecti" veriyordu.)
      await efatura.gotoGidenVeFiltrele();
      const oncekiNo = (await efatura.ilkFatura()).faturaNo;
      console.log(`[${senaryo}] kesim ÖNCESİ en yeni fatura:`, oncekiNo || '(yok)');

      // Formu doldur: mukellef cari (default CARREFOURSA) + senaryo + kalem
      await efatura.gotoOlustur();
      const musteri = await efatura.formuDoldur({
        musteriAdi: process.env.E_FATURA_MUSTERI,
        aramaTerimi: 'carrefour',
        senaryo,
        urun: 'Test Hizmet',
        birimFiyat: 100,
        miktar: 1,
        kdvOrani: 20,
        not: `Otomasyon ${senaryo} TEST-${Date.now()}`,
      });
      console.log(`[${senaryo}] mukellef cari:`, musteri);

      // 1) Oluştur -> faturayi TASLAK olarak kaydeder ("başarıyla kaydedildi" modali).
      //    (e-Fatura de e-Arşiv gibi once taslak yapar; tek basina Giden'e ATMAZ.)
      const ettn = await efatura.olustur();
      await expect(page.getByText(/başarıyla kaydedildi/i)).toBeVisible();
      console.log(`[${senaryo}] taslak kaydedildi, ETTN:`, ettn || '(önizleme iframe\'inde)');

      // 2) Müşteriye Gönder -> RESMİ gönderim (fatura numarasi alir, Giden'e gecer).
      await efatura.musteriyeGonder();

      // 3) DOĞRULA: Giden'de ÖNCEKİNDEN FARKLI yeni bir fatura + basarili/isleme girmis durum.
      //    (Yeni fatura once Onay Bekleniyor'da olabilir -> yeniFaturaBekle poll eder.)
      const sonra = await efatura.yeniFaturaBekle(oncekiNo);
      console.log(`[${senaryo}] gönderim SONRASI en yeni Giden fatura:`, JSON.stringify(sonra));

      expect(sonra.faturaNo, 'fatura no okunmali').not.toBe('');
      expect(
        sonra.faturaNo,
        `YENİ fatura Giden'e düşmeli — liste hala eskiyi (${oncekiNo}) gösteriyor. ` +
          `Müşteriye Gönder çalışmadı ya da fatura hâlâ Onay Bekleniyor'da olabilir.`
      ).not.toBe(oncekiNo);
      expect(
        EFaturaPage.durumBasarili(sonra.durum) || /Beklen|İşlen/i.test(sonra.durum),
        `Yeni faturanın durumu basarili/isleme girmis olmali, gelen: "${sonra.durum}"`
      ).toBeTruthy();
    });
  }
});
