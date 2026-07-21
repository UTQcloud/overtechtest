import { Page, Locator, expect } from '@playwright/test';

/**
 * OverED (Pavo) e-Fatura ekrani — CANLI DOM'a gore, gercek etkilesimle dogrulandi.
 *
 * Kesfedilen gercekler:
 *  - Tek "e-Fatura" linki YOK; sol menude "E-Fatura" grubu. Sayfalar:
 *      Olustur : /EInvoice/CreateInvoice/Index  (baslik "Fatura Oluştur")
 *      Giden   : /EInvoice/OutgoingInvoice/Index
 *      Taslak  : /EInvoice/DraftInvoice/Index
 *  - Form tamamen Kendo UI; input id'leri her render'da degisen GUID -> id'ye guvenme.
 *  - Musteri "Müşteri Ara" combobox'i kayitli carileri arar. AMA e-Fatura sadece
 *    KAYITLI e-fatura mukellefine kesilir. Mukellef olmayan alici secilirse
 *    "Bu alıcı e-fatura mükellefi değildir" uyarisi cikar (ve fatura kesilemez).
 *    selectMukellefMusteri() uyari cikmayan ilk cariyi secer.
 *  - Alici secilince "Alıcı Etiketi *" (GİB alias) kendo-dropdownlist'i cikar; secilmeli.
 *  - Kalem grid'i (dogrulanmis kolon haritasi, gorunur numeric input sirasi):
 *      num[0]=Birim Fiyat  num[1]=Miktar  num[2]=Satır Bazlı Tutar(hesaplanan)
 *      num[3]=KDV %        num[4]=KDV Tutarı(hesaplanan)  num[5]=KDV Dahil Toplam
 *  - KDV %0 birakilirsa "Vergi İstisna Muafiyet" modali cikar; gercek oran (20) ver.
 *  - Sag altta "Accept Cookies" bandi; kapatiliyor.
 *
 * UYARI: "Oluştur" GERCEK e-fatura keser (GİB test ortamina bile olsa dis islem).
 * Guvenli/geri alinabilir yol: "Taslak Kaydet". Gercek kesim icin olustur() var
 * ama testte bilincli fixme.
 */
export class EFaturaPage {
  readonly page: Page;

  static readonly ROUTES = {
    olustur: '/EInvoice/CreateInvoice/Index',
    giden: '/EInvoice/OutgoingInvoice/Index',
  };

  constructor(page: Page) {
    this.page = page;
  }

  // ---------- Navigasyon ----------

  async gotoOlustur() {
    await this.page.goto(EFaturaPage.ROUTES.olustur, { waitUntil: 'networkidle' });
    await this.dismissCookieBanner();
    await expect(this.page.getByRole('heading', { name: /Fatura Oluştur/i })).toBeVisible();
  }

  async gotoGiden() {
    await this.page.goto(EFaturaPage.ROUTES.giden, { waitUntil: 'networkidle' });
    await this.dismissCookieBanner();
  }

  /**
   * Giden listesini acar, "This month" + Filtrele ile doldurur.
   * (Liste tarih filtreli; Filtrele'ye basmadan bos gelir.)
   */
  async gotoGidenVeFiltrele() {
    await this.gotoGiden();
    // Genis tarih araligi + Filtrele. Pill tiklamasi zamanlamaya duyarli oldugundan,
    // kayit gelene kadar (ya da gercekten bos oldugu netlesene kadar) tekrar dene.
    for (let deneme = 0; deneme < 3; deneme++) {
      const pill = this.page.getByText(deneme === 0 ? 'This month' : 'Last 30 days', { exact: true }).first();
      if (await pill.isVisible().catch(() => false)) await pill.click().catch(() => {});
      await this.page.waitForTimeout(500);
      await this.page.getByRole('button', { name: /^Filtrele$/i }).click().catch(() => {});
      await this.page.waitForLoadState('networkidle').catch(() => {});
      await this.page.waitForTimeout(1200);
      if ((await this.kayitSayisi()) > 0) return;
    }
  }

  /** Grid altindaki "X - Y / Z Kayıt" sayacindan toplam kayit sayisini okur. */
  async kayitSayisi(): Promise<number> {
    const t = (await this.page.getByText(/\/\s*\d+\s*Kayıt/i).first().textContent().catch(() => '')) || '';
    const m = t.match(/\/\s*(\d+)\s*Kayıt/i);
    return m ? parseInt(m[1], 10) : 0;
  }

  /** Giden listesindeki ilk (en yeni) faturanin { faturaNo, musteri, durum } bilgisi. */
  async ilkFatura(): Promise<{ faturaNo: string; musteri: string; durum: string }> {
    const row = this.page.locator('.k-grid-content tbody tr, .k-grid tbody tr').first();
    const cells = (await row.locator('td').allTextContents()).map((c) => c.replace(/\s+/g, ' ').trim());
    // Kolon sirasi: [sec][ikonlar] Fatura No, Düzenlenme Tarihi, Müşteri Adı, Durum, ...
    const faturaNo = cells.find((c) => /^[A-Z]{2,}\d{6,}/.test(c)) ?? '';
    const durum = cells.find((c) => /Ulaştı|Gönderil|Başarı|Tamamland|Beklen|Hata|İptal|Kabul|Red/i.test(c)) ?? '';
    const musteri = cells.find((c) => c && c !== faturaNo && c !== durum && !/^\d/.test(c)) ?? '';
    return { faturaNo, musteri, durum };
  }

  /**
   * Kesim sonrasi: Giden'de `oncekiNo`'dan FARKLI (yeni) fatura gelene kadar bekler.
   * Yeni e-fatura once "Onay Bekleniyor"da olup birkac saniye sonra Giden'e dustugu
   * icin poll gerekiyor. Bulamazsa son okunan faturayi doner (test farki yakalar).
   */
  async yeniFaturaBekle(oncekiNo: string, maxSaniye = 45): Promise<{ faturaNo: string; musteri: string; durum: string }> {
    let son = { faturaNo: '', musteri: '', durum: '' };
    for (let i = 0; i < Math.ceil(maxSaniye / 6); i++) {
      await this.gotoGidenVeFiltrele();
      son = await this.ilkFatura();
      if (son.faturaNo && son.faturaNo !== oncekiNo) return son;
      await this.page.waitForTimeout(6000);
    }
    return son;
  }

  /**
   * Durum metni "basarili/tamamlandi" ailesinden mi?
   * Gercek portal degerleri (canli gorulen): "Müşteriye Ulaştı", "Gönderilmiş".
   * NOT: "Gönderil" hem "Gönderilmiş" hem "Gönderildi"yi yakalar.
   */
  static durumBasarili(durum: string): boolean {
    return /Ulaştı|Gönderil|Başarı|Tamamland|Kabul/i.test(durum);
  }

  // ---------- Musteri secimi ----------

  /**
   * "Müşteri Ara" combobox'inda arar, index'teki cariyi secer, secilen adi dondurur.
   * NOT: arama backend'e gidiyor ve sonuc SIRASI her cagride degisebiliyor.
   */
  async musteriSec(aramaTerimi: string, index = 0): Promise<string> {
    await this.page.locator('[role="combobox"]').first().click();
    await this.page.waitForTimeout(300);
    await this.page.keyboard.press('Control+a').catch(() => {});
    await this.page.keyboard.type(aramaTerimi, { delay: 25 });
    await this.page.waitForTimeout(1300);
    const opts = this.page.locator('.k-list-item').filter({ hasNotText: 'Yeni Alıcı Ekle' });
    if (index >= (await opts.count())) throw new Error(`"${aramaTerimi}" icin index ${index} yok`);
    const ad = ((await opts.nth(index).textContent()) || '').trim();
    await opts.nth(index).click();
    await this.page.waitForTimeout(1500);
    return ad;
  }

  /**
   * Secili carinin e-fatura MUKELLEFI olup olmadigini GUVENILIR sekilde anlar:
   * "Alıcı Etiketi" (GİB alias) dropdownlist'inde secenek varsa mukelleftir.
   * (Turuncu "mükellefi değildir" uyarisi kaybolan bir toast oldugu icin GUVENILMEZ.)
   * Mukellefse ilk alias'i secer ve true doner; degilse false.
   */
  async aliciEtiketiSecVeDogrula(): Promise<boolean> {
    const ddl = this.page
      .locator('div.form-group.row', { has: this.page.getByText(/Alıcı Etiketi/i) })
      .locator('kendo-dropdownlist')
      .first();
    if (!(await ddl.isVisible().catch(() => false))) return false;
    await ddl.click();
    await this.page.waitForTimeout(700);
    // Kendo popup body'ye eklenir (.k-animation-container)
    const opts = this.page.locator(
      '.k-animation-container .k-list-item, .k-popup .k-list-item, [role="option"]'
    );
    const count = await opts.count();
    if (count > 0) {
      await opts.first().click();
      return true;
    }
    await this.page.keyboard.press('Escape').catch(() => {});
    return false;
  }

  /**
   * e-fatura MUKELLEFI olan bir cari secer.
   * - musteriAdi verilirse o carilerde arar (Büşra'nin sabit test carisi).
   * - verilmezse aramaTerimi ('test') sonuclarini tarayip alias'i DOLAN ilki secer.
   * Bulamazsa net hata firlatir (bu hesapta mukellef cari yoksa issue edilemez).
   */
  async selectMukellefMusteri(opts: { musteriAdi?: string; aramaTerimi?: string; maxDeneme?: number } = {}): Promise<string> {
    const terim = opts.musteriAdi ?? opts.aramaTerimi ?? 'test';
    const maxDeneme = opts.maxDeneme ?? 15;
    for (let i = 0; i < maxDeneme; i++) {
      let ad: string;
      try {
        ad = await this.musteriSec(terim, i);
      } catch {
        break; // liste bitti
      }
      if (await this.aliciEtiketiSecVeDogrula()) return ad;
    }
    throw new Error(
      `"${terim}" ile e-fatura mukellefi (Alıcı Etiketi dolan) cari bulunamadi. ` +
        `Gecerli bir e-fatura mukellefi cari adi verin ya da e-Arsiv kullanin.`
    );
  }

  /**
   * "Fatura Bilgisi" bolumundeki "Senaryo" dropdownlist'inden senaryo secer.
   * Gecerli degerler (canli): "Temel Fatura", "Ticari Fatura", "Özel Fatura",
   * "İhracat Fatura", "Hal Kayıt Sistemi Fatura", "Yolcu Beraber Eşya",
   * "İlaç ve Tıbbi Cihaz Faturası", "Yatırım Teşvik", "İnşaat Demiri İzleme Sistemi".
   * NOT: Temel/Ticari disindakiler ozel alan (GTİP, yurtdisi alici vb.) ister.
   */
  async senaryoSec(senaryoAdi: string) {
    const grp = this.page
      .locator('div.form-group.row, div.form-group', { has: this.page.getByText(/^Senaryo/i) })
      .first();
    await grp.locator('kendo-dropdownlist').first().click();
    await this.page.waitForTimeout(500);
    await this.page
      .locator('.k-animation-container .k-list-item, .k-popup .k-list-item, [role="option"]', {
        hasText: senaryoAdi,
      })
      .first()
      .click();
    await this.page.waitForTimeout(600);
  }

  /**
   * "Fatura Tipi" dropdownlist'inden secim. Gecerli: "Satış", "İade", "Tevkifat",
   * "İstisna", "Özel Matrah", "İhraç Kayıtlı", "Sgk".
   * ÖNEMLI: Senaryo degisince (ör. Ticari Fatura) Fatura Tipi SIFIRLANIP zorunlu olur;
   * bu yuzden senaryodan SONRA cagirilmali.
   */
  async faturaTipiSec(tip: string) {
    const grp = this.page
      .locator('div.form-group.row, div.form-group', { has: this.page.getByText(/^Fatura Tipi/i) })
      .first();
    await grp.locator('kendo-dropdownlist').first().click();
    await this.page.waitForTimeout(500);
    await this.page
      .locator('.k-animation-container .k-list-item, .k-popup .k-list-item, [role="option"]', {
        hasText: new RegExp(`^\\s*${tip}\\s*$`, 'i'),
      })
      .first()
      .click();
    await this.page.waitForTimeout(500);
  }

  // ---------- Kalem / form ----------

  /**
   * Formu bastan sona doldurur: mukellef musteri + alici etiketi + (senaryo) + kalem.
   * KDV %0 birakma (istisna modali cikar); varsayilan 20.
   */
  async formuDoldur(data: {
    musteriAdi?: string;   // Büşra'nin sabit mukellef test carisi (verilirse buna sabitlenir)
    aramaTerimi?: string;  // verilmezse 'test' arayip alias'i dolan ilk mukellefi bulur
    senaryo?: string;      // "Temel Fatura" / "Ticari Fatura" ... (verilmezse formun varsayilani)
    faturaTipi?: string;   // "Satış" (default) / "İade" ... — Ticari'de zorunlu olur
    urun: string;
    birimFiyat: number;
    miktar?: number;
    kdvOrani?: number;
    tarih?: string;   // "20.07.2026 18:00"
    not?: string;
  }): Promise<string> {
    // Mukellef cari sec + alias (Alıcı Etiketi) otomatik secilir
    const secilen = await this.selectMukellefMusteri({
      musteriAdi: data.musteriAdi,
      aramaTerimi: data.aramaTerimi,
    });

    if (data.senaryo) await this.senaryoSec(data.senaryo);
    // Senaryo degisince Fatura Tipi sifirlanabiliyor -> senaryodan SONRA sec (zorunlu).
    await this.faturaTipiSec(data.faturaTipi ?? 'Satış');
    if (data.tarih) await this.fillDate('#datetimepicker-1', data.tarih);

    // Kalem satiri
    await this.page.locator('table input[type="text"]').first().fill(data.urun);
    await this.setGridNumeric(0, data.birimFiyat);          // Birim Fiyat
    await this.setGridNumeric(1, data.miktar ?? 1);         // Miktar
    await this.setGridNumeric(3, data.kdvOrani ?? 20);      // KDV %

    if (data.not) await this.page.locator('textarea').first().fill(data.not);
    return secilen;
  }

  /** Grid'deki gorunur numeric input'a (index) deger yazar. Bkz. kolon haritasi. */
  async setGridNumeric(index: number, value: number) {
    const nums = this.page.locator('table [role="spinbutton"], table input.k-input-inner');
    await nums.nth(index).click();
    await this.page.keyboard.press('Control+a');
    await this.page.keyboard.type(String(value), { delay: 25 });
    await this.page.keyboard.press('Tab');
    await this.page.waitForTimeout(400);
  }

  /**
   * "Oluştur" -> faturayi TASLAK olarak kaydeder (e-Arşiv ile ayni!): "Fatura taslak
   * olarak başarıyla kaydedildi" MODALI acilir (onizleme + ETTN, "Müşteriye Gönder" butonu).
   * Bu tek basina GONDERMEZ; Giden'e dusmesi icin musteriyeGonder() gerekir.
   * Basari modali gorunmezse / hata cikarsa firlatir. Modaldeki ETTN'yi doner.
   */
  async olustur(): Promise<string> {
    await this.page.getByRole('button', { name: /^Oluştur$/i }).first().click();
    const basariModal = this.page.getByText(/başarıyla kaydedildi/i).first();
    const hata = this.page
      .locator('.k-notification-error, .toast-error, .validation-message, .text-danger')
      .filter({ hasText: /\S/ })
      .first();
    // Hizli-fail: zorunlu alan bos kaldiysa (ör. Fatura Tipi) 16sn bekleme, hemen soyle.
    const validasyon = this.page.getByText(/Zorunlu alan|Lütfen gerekli alanları/i).first();
    for (let i = 0; i < 40; i++) {
      if (await basariModal.isVisible().catch(() => false)) {
        const modalTxt =
          (await this.page.locator('.modal.show, modal-container, .swal2-popup').first().textContent().catch(() => '')) || '';
        return (modalTxt.match(/ETTN:\s*([A-F0-9-]{20,})/i) || [])[1] || '';
      }
      if (i >= 3 && (await validasyon.isVisible().catch(() => false))) {
        throw new Error('e-Fatura "Oluştur": zorunlu alan bos (ör. Fatura Tipi). Form tam doldurulmali.');
      }
      if (await hata.isVisible().catch(() => false)) {
        const msg = ((await hata.textContent()) || '').replace(/\s+/g, ' ').trim();
        throw new Error(`e-Fatura "Oluştur" hatasi: ${msg}`);
      }
      await this.page.waitForTimeout(400);
    }
    throw new Error('e-Fatura "Oluştur" sonrasi basari modali (başarıyla kaydedildi) gorunmedi (16sn).');
  }

  /**
   * Basari modalindeki "Müşteriye Gönder" ile faturayi RESMEN gonderir (-> Giden).
   * ⚠️ Gercek GİB gonderimi. Otomatik ajan CALISTIRAMAZ; E_FATURA_ISSUE ile gated.
   */
  async musteriyeGonder() {
    await this.page
      .locator('.modal.show, modal-container, .swal2-popup')
      .getByRole('button', { name: /Müşteriye Gönder/i })
      .first()
      .click();
    await this.page.waitForTimeout(1500);
    for (const label of [/^Evet$/i, /^Onayla$/i, /^Gönder$/i, /^Tamam$/i]) {
      const btn = this.page.locator('.modal.show, modal-container, .swal2-actions').getByRole('button', { name: label }).first();
      if (await btn.isVisible().catch(() => false)) {
        await btn.click().catch(() => {});
        await this.page.waitForTimeout(2000);
        break;
      }
    }
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }

  // ---------- yardimcilar ----------

  async dismissCookieBanner() {
    const accept = this.page.getByRole('button', { name: /accept cookies/i });
    if (await accept.isVisible().catch(() => false)) await accept.click().catch(() => {});
  }

  async fillDate(selector: string, value: string) {
    const input = this.page.locator(selector).first();
    await input.click();
    await input.press('Control+a');
    await input.pressSequentially(value, { delay: 50 });
    await input.press('Escape');
  }
}
