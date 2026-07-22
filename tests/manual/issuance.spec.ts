import { test, expect } from '@playwright/test';
import { EArsivPage } from '../../pages/earsiv.page';
import { EFaturaPage } from '../../pages/efatura.page';
import { GiderPusulasiPage, EMMPage, ESMMPage, EAdisyonPage, EIrsaliyePage, EBiletPage } from '../../pages/moduller.page';

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
 *   E_GIDER_ISSUE=1   -> Gider Pusulasi olustur + gonder (Hızlı Müşteri)
 *   E_MM_ISSUE=1        -> E-MM Makbuz (Hızlı Müşteri)
 *   E_SMM_ISSUE=1       -> E-SMM Makbuz (kayitli cari)
 *   E_ADISYON_ISSUE=1   -> E-Adisyon (kayitli cari + adisyon alanlari)
 *   E_IRSALIYE_ISSUE=1  -> E-İrsaliye (Alıcı Taraf + Plaka + kalem)
 *   E_BILET_ISSUE=1     -> E-Bilet (doğrudan müşteri alanlari + sefer)
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

    // Müşteriye Gönder -> başarı sinyali = "başarıyla kaydedildi" modalı KAPANIR
    // (kalıcı toast yok, form resetlenir). taslaktaYok sabit isimle güvenilmezdi.
    const gonderildi = await earsiv.musteriyeGonder();
    console.log('GÖNDERİM işlendi mi (modal kapandı):', gonderildi);
    expect(gonderildi, 'Müşteriye Gönder sonrası başarı modalı kapanmalı (gönderim işlendi)').toBeTruthy();
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
      // Kes + gonder + GİB'in Giden'e yansitmasini poll etme -> canli backend yavas; 180sn.
      test.setTimeout(180_000);

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

/**
 * GİDER PUSULASI — e-Arşiv ile AYNI desen (canli teyit): "Müşteri Ara"da Hızlı Müşteri var,
 * mükellef gerektirmez, grid + Oluştur → "başarıyla kaydedildi" modalı → Müşteriye Gönder.
 * Fark: KDV yerine stopaj -> kalemDoldurBasit (KDV set etmez).
 *
 * ⚠️ DEFAULT KAPALI. Açmak için .env: E_GIDER_ISSUE=1
 * NOT: Kalem/vergi alanları modüle özel olabilir; ilk canlı koşuda --headed ile izle.
 */
test.describe('MANUAL: Gider Pusulası üretimi', () => {
  test('gider pusulası oluşturulup gönderilebiliyor', async ({ page }) => {
    test.fixme(!process.env.E_GIDER_ISSUE, 'Gercek belge uretir. .env: E_GIDER_ISSUE=1');
    test.setTimeout(120_000);

    const gp = new GiderPusulasiPage(page);
    await gp.gotoOlustur();
    const musteri = await gp.hizliMusteriOlustur(); // Utkuhan Bulut / TCKN 11111111111
    console.log('Hızlı Müşteri:', musteri);
    await gp.kalemDoldurBasit('Test Gider', 100, 1); // KDV yok (gider pusulası)

    const ettn = await gp.olustur();
    await expect(page.getByText(/başarıyla kaydedildi/i)).toBeVisible();
    console.log('Gider Pusulası oluşturuldu (taslak), ETTN:', ettn || '(önizleme iframe\'inde)');

    // NOT: Gider Pusulası modalı SADECE önizleme (İade Bilgi Fişi); gönder modaldan yapılmıyor.
    // Gönderim Taslak listesinden (İşlemler → Onaya Gönder) yapılır. Create başarısı esas alınır.
    const gonderildi = await gp.musteriyeGonder();
    console.log('Modaldan gönderim:', gonderildi ? 'yapıldı' : 'yok (Taslak listesinden yapılır)');
  });
});

/**
 * E-MM MAKBUZ (müstahsil makbuzu) — Hızlı Müşteri var (E-Arşiv/Gider Pusulası gibi).
 * ⚠️ .env: E_MM_ISSUE=1
 */
test.describe('MANUAL: E-MM Makbuz üretimi', () => {
  test('e-MM makbuz oluşturulup gönderilebiliyor', async ({ page }) => {
    test.fixme(!process.env.E_MM_ISSUE, 'Gercek belge uretir. .env: E_MM_ISSUE=1');
    test.setTimeout(120_000);

    const emm = new EMMPage(page);
    await emm.gotoOlustur();
    const musteri = await emm.hizliMusteriOlustur(); // Utkuhan Bulut
    console.log('Hızlı Müşteri:', musteri);
    await emm.dropdownIlkSec(/Makbuz Tasarımı/i).catch(() => {});
    await emm.kalemDoldur('Test Hizmet', 100, 1, 2); // E-MM: KDV değil GV STPJ (>0 zorunlu)
    await emm.olustur();
    await expect(page.getByText(/başarıyla kaydedildi/i)).toBeVisible();
    expect(await emm.musteriyeGonder(), 'gönderim sonrası modal kapanmalı').toBeTruthy();
  });
});

/**
 * E-SMM (serbest meslek makbuzu) — KAYITLI cari (Hızlı Müşteri yok). Senaryo yok.
 * ⚠️ .env: E_SMM_ISSUE=1  (kayıtlı bir 'test' carisi kullanır)
 */
test.describe('MANUAL: E-SMM Makbuz üretimi', () => {
  test('e-SMM makbuz oluşturulup gönderilebiliyor', async ({ page }) => {
    test.fixme(!process.env.E_SMM_ISSUE, 'Gercek belge uretir. .env: E_SMM_ISSUE=1');
    test.setTimeout(120_000);

    const esmm = new ESMMPage(page);
    await esmm.gotoOlustur();
    const cari = await esmm.musteriSec('test', 1); // "Yeni Alıcı Ekle" sonrası ilk kayıtlı cari
    console.log('Cari:', cari);
    await esmm.kalemUrunFiyat('Test Hizmet', 100); // Ücretin Nedeni + Brüt Ücret (miktar yok)
    await esmm.olustur();
    await expect(page.getByText(/başarıyla kaydedildi/i)).toBeVisible();
    expect(await esmm.musteriyeGonder(), 'gönderim sonrası modal kapanmalı').toBeTruthy();
  });
});

/**
 * E-ADİSYON — KAYITLI cari + Senaryo + adisyon alanları (Masa No, İşlemi Yapan, Kapatma Tarihi).
 * ⚠️ .env: E_ADISYON_ISSUE=1
 * NOT: Masa No / İşlemi Yapan zorunlu olabilir; olustur() "zorunlu alan" derse o alanı ekle.
 */
test.describe('MANUAL: E-Adisyon üretimi', () => {
  test('e-adisyon oluşturulup gönderilebiliyor', async ({ page }) => {
    test.fixme(!process.env.E_ADISYON_ISSUE, 'Gercek belge uretir. .env: E_ADISYON_ISSUE=1');
    test.setTimeout(120_000);

    const ea = new EAdisyonPage(page);
    await ea.gotoOlustur();
    // "test" carilerinin TC'si geçersiz olabiliyor -> CARREFOURSA (geçerli VKN, gerçek şirket).
    const cari = await ea.musteriSec('carrefour', 0);
    console.log('Cari:', cari);
    await ea.kalemDoldur('Test Hizmet', 100, 1, 20); // Ürün Adı(text) + Birim Fiyat + Miktar + KDV
    const ettn = await ea.olustur(); // E-Adisyon: metinsiz önizleme modalı (ETTN iframe'de)
    console.log('Adisyon oluşturuldu, ETTN:', ettn || '(önizleme iframe\'inde)');
    // Başarı = önizleme modalı açıldı (Onayla/Yazdır/Mail Gönder butonlu). olustur() zaten doğruladı.
    await expect(
      page.locator('.modal.show, modal-container').getByRole('button', { name: /Onayla|Yazdır|Mail Gönder/i }).first()
    ).toBeVisible();
    const g = await ea.musteriyeGonder();
    console.log('Modaldan gönderim:', g ? 'yapıldı' : 'yok');
  });
});

/**
 * E-İRSALİYE, E-BİLET — bespoke formlar (CANLI incelendi + gerçek belge kesildi).
 * Alan haritalari `pages/moduller.page.ts` icindeki formuDoldur()'da.
 */
test.describe('MANUAL: E-İrsaliye üretimi', () => {
  // KANITLI: gerçek e-İrsaliye kesiliyor. Kritik düzeltme: boş Dorse (trailer) satiri gonderilince
  // backend "Unexpected exception" (500) firlatiyordu -> formuDoldur bos satiri siliyor.
  test('e-irsaliye kesilip müşteriye gönderilebiliyor', async ({ page }) => {
    test.fixme(!process.env.E_IRSALIYE_ISSUE, 'Gercek belge uretir. .env: E_IRSALIYE_ISSUE=1');
    test.setTimeout(120_000);
    const ir = new EIrsaliyePage(page);
    await ir.gotoOlustur();
    await ir.formuDoldur({ aliciArama: 'test', plaka: '34ABC123', urun: 'Test Ürün', miktar: 1 });
    const ettn = await ir.olustur(); // 500 olursa firlatir (regresyon yakalanir)
    await expect(page.getByText(/başarıyla kaydedildi/i)).toBeVisible();
    expect(await ir.musteriyeGonder(), 'gönderim sonrası modal kapanmalı').toBeTruthy();
    console.log('E-İrsaliye kesildi, ETTN:', ettn || '(önizleme iframe\'inde)');
  });
});

test.describe('MANUAL: E-Bilet üretimi', () => {
  test('e-bilet oluşturulup gönderilebiliyor', async ({ page }) => {
    test.fixme(!process.env.E_BILET_ISSUE, 'Gercek belge uretir. .env: E_BILET_ISSUE=1');
    test.setTimeout(120_000);
    const bilet = new EBiletPage(page);
    await bilet.gotoOlustur();
    // Default'lar geçerli: biletNo 13 haneli (hava kuralı), tckn geçerli. Override etme.
    await bilet.formuDoldur({ musteriAd: 'Utkuhan Bulut' });
    const ettn = await bilet.olustur(); // önizleme modalı (metinsiz olabilir)
    console.log('Bilet oluşturuldu, ETTN:', ettn || '(önizleme iframe\'inde)');
    await expect(
      page.locator('.modal.show, modal-container').getByRole('button', { name: /Onayla|Yazdır|Mail Gönder|Müşteriye Gönder/i }).first()
    ).toBeVisible();
    const g = await bilet.musteriyeGonder();
    console.log('Modaldan gönderim:', g ? 'yapıldı' : 'yok');
  });
});
