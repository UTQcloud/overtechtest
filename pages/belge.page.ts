import { Page, expect } from '@playwright/test';

/**
 * OverED (Pavo) portalindaki TUM e-belge modulleri (e-Fatura, e-Arsiv, Gider Pusulasi,
 * e-Adisyon, e-Irsaliye, e-SMM, e-MM, e-Bilet, Mutabakat) ayni Kendo UI desenini paylasir:
 *
 *   Oluştur (form) -> "başarıyla kaydedildi" MODALI (taslak) -> Müşteriye Gönder (resmi) -> Giden
 *
 * Bu base class o ortak mantigi tutar. Her modul bunu extend edip sadece kendi
 * rotalarini + varsa ozel alanlarini ekler.
 *
 * Ortak gercekler (canli dogrulandi):
 *  - Sag altta "Accept Cookies" bandi butonlarin ustune biniyor -> tiklamadan once kapat.
 *  - Kendo input id'leri her render'da degisen GUID -> gorunur etiket/pozisyona gore hedef al.
 *  - Kalem grid'i: num[0]=Birim/Item Fiyat, num[1]=Miktar, num[3]=KDV % (hesaplananlar disabled).
 *  - KDV %0 birakma -> "Vergi İstisna" modali. Gercek oran (20) ver.
 *  - "Oluştur" faturayi TASLAK yapar; Giden'e dusmesi icin "Müşteriye Gönder" gerekir.
 *  - Durum ("tamamlandı"): Onay Bekleniyor -> Gönderilmiş -> Müşteriye Ulaştı.
 */
export class BelgePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // ---------- Navigasyon / genel ----------

  async goto(route: string, baslikRegex?: RegExp) {
    await this.page.goto(route, { waitUntil: 'networkidle' });
    await this.dismissCookieBanner();
    if (baslikRegex) {
      await expect(this.page.getByRole('heading', { name: baslikRegex })).toBeVisible();
    }
  }

  /** Sag alttaki "Accept Cookies" bandini kapatir (butonlarin ustune binebiliyor). */
  async dismissCookieBanner() {
    const accept = this.page.getByRole('button', { name: /accept cookies/i });
    if (await accept.isVisible().catch(() => false)) await accept.click().catch(() => {});
  }

  /** Etiket metnine gore Kendo dropdownlist secimi (Senaryo, Fatura Tipi, Gönderim Şekli...). */
  async dropdownSec(etiketRegex: RegExp, deger: string) {
    const grp = this.page
      .locator('div.form-group.row, div.form-group', { has: this.page.getByText(etiketRegex) })
      .first();
    await grp.locator('kendo-dropdownlist').first().click();
    await this.page.waitForTimeout(500);
    await this.page
      .locator('.k-animation-container .k-list-item, .k-popup .k-list-item, [role="option"]', {
        hasText: new RegExp(`^\\s*${deger}\\s*$`, 'i'),
      })
      .first()
      .click();
    await this.page.waitForTimeout(500);
  }

  // ---------- Alici secimi ----------

  /**
   * "Hızlı Müşteri" ile anlik SAHTE alici olusturur (mukellef gerektirmeyen modullerde:
   * e-Arsiv, Gider Pusulasi, e-Bilet...). Varsayilan "Utkuhan Bulut", TCKN 11111111111.
   * ÖNEMLI: ad/soyad'da rakam/"Test"/anlamsiz dizi reddedilir -> gercek isim ver.
   */
  async hizliMusteriOlustur(ad = 'Utkuhan', soyad = 'Bulut'): Promise<string> {
    await this.page.locator('[role="combobox"]').first().click();
    await this.page.waitForTimeout(400);
    await this.page.keyboard.type('test', { delay: 30 });
    await this.page.waitForTimeout(1500);
    await this.page.locator('.k-list-item', { hasText: 'Hızlı Müşteri' }).first().click();
    await this.page.waitForTimeout(1200);
    await this.page.getByPlaceholder('Adı', { exact: true }).fill(ad);
    await this.page.getByPlaceholder('Soyadı', { exact: true }).fill(soyad);
    await this.page.locator('modal-container button:has-text("Oluştur")').first().click();
    // Musteri olusturma ASENKRON; chip (TCKN) forma dusene kadar bekle (yaris kosulu).
    await expect(this.page.getByText(/TCKN:\s*11111111111/i).first()).toBeVisible({ timeout: 15_000 });
    await this.page.waitForTimeout(800);
    return `${ad} ${soyad}`;
  }

  /** "Müşteri Ara" combobox'inda arar, index'teki cariyi secer. */
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
   * "Alıcı Etiketi" (GİB alias) dropdownlist'inde secenek varsa MUKELLEFTIR: ilkini secip
   * true doner. (Turuncu "mükellefi değildir" toast'i gecici oldugu icin GUVENILMEZ.)
   */
  async aliciEtiketiSecVeDogrula(): Promise<boolean> {
    const ddl = this.page
      .locator('div.form-group.row', { has: this.page.getByText(/Alıcı Etiketi/i) })
      .locator('kendo-dropdownlist')
      .first();
    if (!(await ddl.isVisible().catch(() => false))) return false;
    await ddl.click();
    await this.page.waitForTimeout(700);
    const opts = this.page.locator('.k-animation-container .k-list-item, .k-popup .k-list-item, [role="option"]');
    if ((await opts.count()) > 0) {
      await opts.first().click();
      return true;
    }
    await this.page.keyboard.press('Escape').catch(() => {});
    return false;
  }

  /** e-fatura MUKELLEFI (Alıcı Etiketi dolan) ilk cariyi secer. Bulamazsa hata. */
  async selectMukellefMusteri(opts: { musteriAdi?: string; aramaTerimi?: string; maxDeneme?: number } = {}): Promise<string> {
    const terim = opts.musteriAdi ?? opts.aramaTerimi ?? 'test';
    const maxDeneme = opts.maxDeneme ?? 15;
    for (let i = 0; i < maxDeneme; i++) {
      let ad: string;
      try {
        ad = await this.musteriSec(terim, i);
      } catch {
        break;
      }
      if (await this.aliciEtiketiSecVeDogrula()) return ad;
    }
    throw new Error(`"${terim}" ile mukellef (Alıcı Etiketi dolan) cari bulunamadi.`);
  }

  // ---------- Kalem grid ----------

  /** Grid'deki gorunur numeric input'a (index) deger yazar. num[0]=Fiyat 1=Miktar 3=KDV%. */
  async setGridNumeric(index: number, value: number) {
    const nums = this.page.locator('table [role="spinbutton"], table input.k-input-inner');
    await nums.nth(index).click();
    await this.page.keyboard.press('Control+a');
    await this.page.keyboard.type(String(value), { delay: 25 });
    await this.page.keyboard.press('Tab');
    await this.page.waitForTimeout(400);
  }

  /** Ilk kalem satirini doldurur (KDV %0 birakma; default 20). */
  async kalemDoldur(urun: string, birimFiyat: number, miktar = 1, kdv = 20) {
    await this.page.locator('table input[type="text"]').first().fill(urun);
    await this.setGridNumeric(0, birimFiyat);
    await this.setGridNumeric(1, miktar);
    await this.setGridNumeric(3, kdv);
  }

  /** Toplam (Ödenecek/Payable) tutar metni. */
  async toplamTutar(): Promise<string> {
    const t = await this.page
      .getByText(/Toplam Ödenecek|Total Payable/i)
      .last()
      .locator('xpath=..')
      .textContent()
      .catch(() => '');
    return (t || '').replace(/\s+/g, ' ').trim();
  }

  // ---------- Oluştur / Gönder ----------

  /**
   * "Oluştur" -> belgeyi TASLAK yapar: "başarıyla kaydedildi" MODALI acilir (ETTN + "Müşteriye
   * Gönder" butonu). Tek basina GONDERMEZ. Hata/validasyon olursa firlatir. ETTN'yi doner.
   */
  async olustur(): Promise<string> {
    await this.dismissCookieBanner(); // banner "Oluştur"un ustune binebiliyor
    await this.page.getByRole('button', { name: /^Oluştur$/i }).first().click();
    const basariModal = this.page.getByText(/başarıyla kaydedildi/i).first();
    const hata = this.page
      .locator('.k-notification-error, .toast-error, .validation-message, .text-danger')
      .filter({ hasText: /\S/ })
      .first();
    const validasyon = this.page.getByText(/Zorunlu alan|Lütfen gerekli alanları/i).first();
    for (let i = 0; i < 40; i++) {
      if (await basariModal.isVisible().catch(() => false)) {
        const modalTxt =
          (await this.page.locator('.modal.show, modal-container, .swal2-popup').first().textContent().catch(() => '')) || '';
        return (modalTxt.match(/ETTN:\s*([A-F0-9-]{20,})/i) || [])[1] || '';
      }
      if (i >= 3 && (await validasyon.isVisible().catch(() => false))) {
        throw new Error('"Oluştur": zorunlu alan bos (ör. Fatura Tipi). Form tam doldurulmali.');
      }
      if (await hata.isVisible().catch(() => false)) {
        throw new Error(`"Oluştur" hatasi: ${((await hata.textContent()) || '').replace(/\s+/g, ' ').trim()}`);
      }
      await this.page.waitForTimeout(400);
    }
    throw new Error('"Oluştur" sonrasi basari modali (başarıyla kaydedildi) gorunmedi (16sn).');
  }

  /**
   * Basari modalindeki "Müşteriye Gönder" ile RESMEN gonderir.
   * Basari sinyali: modal KAPANIR ve form sifirlanir (kalici toast yok). Kapandiysa true.
   * ⚠️ Gercek GİB gonderimi. Otomatik ajan CALISTIRAMAZ; ilgili flag ile gated.
   */
  async musteriyeGonder(): Promise<boolean> {
    await this.dismissCookieBanner();
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
    await this.page.getByText(/başarıyla kaydedildi/i).first().waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => {});
    await this.page.waitForLoadState('networkidle').catch(() => {});
    return !(await this.page.getByText(/başarıyla kaydedildi/i).first().isVisible().catch(() => false));
  }

  // ---------- Giden liste (durum / "tamamlandı") ----------

  /** Giden listesini acar ve genis tarih araligiyla filtreler (pill tiklamasi flaky -> retry). */
  async gotoGidenVeFiltrele(gidenRoute: string) {
    await this.goto(gidenRoute);
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

  /** Grid altindaki "X - Y / Z Kayıt" sayacindan toplam kayit sayisi. */
  async kayitSayisi(): Promise<number> {
    const t = (await this.page.getByText(/\/\s*\d+\s*Kayıt/i).first().textContent().catch(() => '')) || '';
    const m = t.match(/\/\s*(\d+)\s*Kayıt/i);
    return m ? parseInt(m[1], 10) : 0;
  }

  /** Giden'deki ilk (en yeni) kaydin { no, musteri, durum } bilgisi. */
  async ilkKayit(): Promise<{ no: string; musteri: string; durum: string }> {
    const row = this.page.locator('.k-grid-content tbody tr, .k-grid tbody tr').first();
    const cells = (await row.locator('td').allTextContents()).map((c) => c.replace(/\s+/g, ' ').trim());
    const no = cells.find((c) => /^[A-Z]{2,}\d{6,}/.test(c)) ?? '';
    const durum = cells.find((c) => /Ulaştı|Gönderil|Başarı|Tamamland|Beklen|Hata|İptal|Kabul|Red|İşlen/i.test(c)) ?? '';
    const musteri = cells.find((c) => c && c !== no && c !== durum && !/^\d/.test(c)) ?? '';
    return { no, musteri, durum };
  }

  /** Durum "basarili/tamamlandi" ailesinden mi? (Müşteriye Ulaştı, Gönderilmiş...) */
  static durumBasarili(durum: string): boolean {
    return /Ulaştı|Gönderil|Başarı|Tamamland|Kabul/i.test(durum);
  }

  /** Kesim sonrasi: Giden'de `oncekiNo`'dan FARKLI yeni kayit gelene kadar bekler (poll). */
  async yeniKayitBekle(oncekiNo: string, gidenRoute: string, maxSaniye = 45): Promise<{ no: string; musteri: string; durum: string }> {
    let son = { no: '', musteri: '', durum: '' };
    for (let i = 0; i < Math.ceil(maxSaniye / 6); i++) {
      await this.gotoGidenVeFiltrele(gidenRoute);
      son = await this.ilkKayit();
      if (son.no && son.no !== oncekiNo) return son;
      await this.page.waitForTimeout(6000);
    }
    return son;
  }
}
