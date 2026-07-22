import type { Locator } from '@playwright/test';
import { BelgePage } from './belge.page';

/**
 * Diger e-belge modulleri. Hepsi BelgePage'i extend eder -> ortak akis (Oluştur ->
 * "başarıyla kaydedildi" modali -> Müşteriye Gönder -> Giden) hazir gelir.
 * Burada sadece rotalar + navigasyon var.
 *
 * NOT: Her modulun formundaki OZEL alanlar (ör. e-Bilet'te yolcu bilgisi, e-İrsaliye'de
 * sevkiyat, Gider Pusulasi'nda gider tipi) farkli olabilir. Ortak "kalemDoldur / olustur"
 * cogunda calisir; ozel alan gerekirse ilgili modulde override edilir.
 */

/** Gider Pusulası — /ExpenseBill. Mükellef olmayan kisilere kesilir (Hızlı Müşteri gibi). */
export class GiderPusulasiPage extends BelgePage {
  static readonly OLUSTUR = '/ExpenseBill/CreateExpenseBill/Index';
  static readonly GIDEN = '/ExpenseBill/ExpenseBill/Index';
  async gotoOlustur() { await this.goto(GiderPusulasiPage.OLUSTUR); }
  async gotoGiden() { await this.gotoGidenVeFiltrele(GiderPusulasiPage.GIDEN); }
}

/** E-Adisyon — /EAdisyon. */
export class EAdisyonPage extends BelgePage {
  static readonly OLUSTUR = '/EAdisyon/CreateAdisyon/Index';
  static readonly GIDEN = '/EAdisyon/Adisyon/Index';
  async gotoOlustur() { await this.goto(EAdisyonPage.OLUSTUR); }
  async gotoGiden() { await this.gotoGidenVeFiltrele(EAdisyonPage.GIDEN); }
}

/**
 * E-İrsaliye (Despatch) — /Despatch. Sevkiyat belgesi (bespoke form).
 * Zorunlu: Sevk Tarihi, Alıcı Taraf (combobox), Plaka + kalem (Ürün + Teslim Edilen Miktar).
 * Grid e-Fatura'dan farkli: ilk numeric = "Teslim Edilen Miktar" (Birim Fiyat degil).
 */
export class EIrsaliyePage extends BelgePage {
  static readonly OLUSTUR = '/Despatch/CreateDespatch/Index';
  static readonly GIDEN = '/Despatch/OutgoingDespatch/Index';
  async gotoOlustur() { await this.goto(EIrsaliyePage.OLUSTUR); }
  async gotoGiden() { await this.gotoGidenVeFiltrele(EIrsaliyePage.GIDEN); }

  /**
   * Zorunlu alanlari doldurur. İrsaliye'de 3 AYRI kendo-grid var (Sürücü / Plaka / Kalem) ve
   * her grid'in BASLIK ve GOVDE'si ayri <table>'dir -> govdeyi 'kendo-grid' wrapper'i uzerinden
   * bul (header table'in 0 input'u vardi, eski hata buydu).
   */
  async formuDoldur(opts: { aliciArama?: string; plaka?: string; urun?: string; miktar?: number } = {}) {
    // Maskeli tarih alanina AYRAÇSIZ rakam yazan yardimci (fillDate maskeyi bozuyor).
    const tarihYaz = async (etiket: RegExp, digits: string) => {
      const inp = this.page.locator('div.form-group.row, div.form-group', { has: this.page.getByText(etiket) }).first().locator('input').first();
      await inp.click();
      await inp.press('Control+a');
      await inp.pressSequentially(digits, { delay: 60 });
      await this.page.keyboard.press('Escape').catch(() => {});
    };
    const iki = (n: number) => String(n).padStart(2, '0');
    // Düzenlenme Tarihi: default dolu gelir ama "touched" degil -> aria-invalid. BUGÜN'ü yeniden yaz.
    const now = new Date();
    await tarihYaz(/Düzenlenme Tarihi/i, `${iki(now.getDate())}${iki(now.getMonth() + 1)}${now.getFullYear()}${iki(now.getHours())}${iki(now.getMinutes())}`);
    // Sevk Tarihi: GELECEK olmalı (geçmiş/düzenleme tarihinden önce olamaz) -> bugün+2.
    const d = new Date();
    d.setDate(d.getDate() + 2);
    await tarihYaz(/Sevk Tarihi/i, `${iki(d.getDate())}${iki(d.getMonth() + 1)}${d.getFullYear()}1200`);
    // Alıcı Taraf combobox
    const grp = this.page.locator('div.form-group.row', { has: this.page.getByText(/Alıcı Taraf/i) }).first();
    await grp.locator('[role="combobox"]').first().click();
    await this.page.waitForTimeout(400);
    await this.page.keyboard.type(opts.aliciArama ?? 'test', { delay: 25 });
    await this.page.waitForTimeout(1400);
    await this.page.locator('.k-list-item').filter({ hasNotText: 'Yeni Alıcı Ekle' }).first().click();
    await this.page.waitForTimeout(1200);

    // Her grid'i basliktaki metne gore 'kendo-grid' wrapper'inda bul, GOVDE input'larini doldur.
    const gridBody = (rx: RegExp | string) =>
      this.page.locator('kendo-grid', { has: this.page.getByText(rx) }).first()
        .locator('.k-grid-content input, tbody input');
    const setCell = async (loc: Locator, val: string) => {
      await loc.click();
      await loc.fill(val);
      await loc.press('Tab'); // Kendo change event'ini tetikle
    };
    // Kendo grid metin hucreleri (Sürücü Ad/Soyadı) .fill() ile Angular model'e commit OLMUYOR
    // (validasyon "Sürücü Bilgileri *" bos sayiyor). Gercek klavye tuslamasi + blur ile yaz.
    const typeCell = async (loc: Locator, val: string) => {
      await loc.click();
      await this.page.keyboard.press('Control+a');
      await this.page.keyboard.type(val, { delay: 40 });
      await this.page.keyboard.press('Tab');
      await this.page.waitForTimeout(150);
    };
    // Sürücü grid'i (Soyadı basligiyla): govde input[0]=Ad, [1]=Soyadı, [2]=Sürücü Id (TC).
    // Ad/Soyadı sabit sahte kimlik "Utkuhan Bulut". Sürücü Id ZORUNLU -> gecerli TC.
    const surucu = gridBody('Soyadı');
    await typeCell(surucu.nth(0), 'Utkuhan');
    await typeCell(surucu.nth(1), 'Bulut');
    await typeCell(surucu.nth(2), '10000000146');
    // Kalem grid'i (Teslim Edilen Miktar basligiyla): govde input sirasi
    // [0]=Ürün Adı(text) [1]=Teslim Miktar(spin) [2]=Birim Fiyat(spin) [3]=Satır Tutar(disabled).
    // Birim Fiyat 0 kalirsa [invalid] -> >0 ver.
    const kalem = gridBody(/Teslim Edilen Miktar/i);
    await setCell(kalem.nth(0), opts.urun ?? 'Test Ürün');
    await setCell(kalem.nth(1), String(opts.miktar ?? 1));
    await setCell(kalem.nth(2), '10'); // Birim Fiyat
    // Plaka: DİKKAT — iki "Plaka" var: (1) Taşıyıcı'daki standalone ZORUNLU "Plaka" alani,
    // (2) Dorse grid'indeki opsiyonel "Plaka" kolonu. Zorunlu "*" CSS ::after (DOM metninde yok),
    // o yüzden asterisk'le ayirt edilemez. Ayirt edici: zorunlu olan kendo-grid DIŞINDA.
    const plaka = this.page
      .locator('xpath=//*[normalize-space(.)="Plaka"][not(ancestor::kendo-grid)]/following::input[1]')
      .first();
    await plaka.fill(opts.plaka ?? '34ABC123');
    await plaka.press('Tab');
    await this.page.waitForTimeout(300);

    // ⚠️ KRITIK: Dorse (trailer) grid'inde default BOŞ satir gelir. Bos gonderilince backend
    // "Unexpected exception" (HTTP 500) firlatiyor (agdan kanitlandi: bos satir cikinca 200).
    // Dorse opsiyonel -> bos satiri SIL, DespatchTrailerPlates=[] olsun. Dorse grid = tek "Plaka"
    // kolon basligina sahip kendo-grid (standalone Plaka form alani, grid degil).
    const dorseGrid = this.page.locator('kendo-grid', { has: this.page.getByRole('columnheader', { name: 'Plaka' }) }).first();
    const dorseSil = dorseGrid.getByRole('button', { name: /^Sil$/i }).first();
    if (await dorseSil.isVisible().catch(() => false)) {
      await dorseSil.click().catch(() => {});
      await this.page.waitForTimeout(300);
    }
  }
}

/** E-SMM Makbuz (serbest meslek makbuzu) — /ESMReceipt. */
export class ESMMPage extends BelgePage {
  static readonly OLUSTUR = '/ESMReceipt/CreateEsmReceipt/Index';
  static readonly GIDEN = '/ESMReceipt/EsmReceipt/Index';
  async gotoOlustur() { await this.goto(ESMMPage.OLUSTUR); }
  async gotoGiden() { await this.gotoGidenVeFiltrele(ESMMPage.GIDEN); }
}

/** E-MM Makbuz (müstahsil makbuzu) — /EMMReceipt. */
export class EMMPage extends BelgePage {
  static readonly OLUSTUR = '/EMMReceipt/CreateEmmReceipt/Index';
  static readonly GIDEN = '/EMMReceipt/EmmReceipt/Index';
  async gotoOlustur() { await this.goto(EMMPage.OLUSTUR); }
  async gotoGiden() { await this.gotoGidenVeFiltrele(EMMPage.GIDEN); }
}

/**
 * E-Bilet — /ETicket (bespoke form). Müşteri "combobox" YOK; alanlar doğrudan yazılır.
 * Zorunlu: Bilet Tipi, Bilet Numarası, Ödeme Şekli, Müşteri Adı, Müşteri Kimlik No, Sefer Tarihi.
 */
export class EBiletPage extends BelgePage {
  static readonly OLUSTUR = '/ETicket/CreateTicket/Index';
  static readonly GIDEN = '/ETicket/Ticket/Index';
  async gotoOlustur() { await this.goto(EBiletPage.OLUSTUR); }
  async gotoGiden() { await this.gotoGidenVeFiltrele(EBiletPage.GIDEN); }

  /** Zorunlu bilet alanlarini doldurur. NOT: label "Bilet Tİpi" (Türkçe İ) -> [iİ]. */
  async formuDoldur(opts: { biletNo?: string; musteriAd?: string; tckn?: string } = {}) {
    await this.dropdownIlkSec(/Bilet\s*T[iİ]pi/i);   // "Bilet Tİpi" (Türkçe büyük İ) — ilk: HAVAYOLU
    await this.dropdownIlkSec(/Doküman Tipi/i);       // Bilet Tipi secilince zorunlu olur
    // HAVAYOLU: bilet no 13 karakter + BENZERSIZ olmali (kayitli no reddedilir).
    // Date.now() tam 13 hane ve her kosuda farkli.
    await this.alanDoldur(/Bilet Numarası/i, opts.biletNo ?? String(Date.now()));
    await this.dropdownIlkSec(/Ödeme Şekli/i);
    await this.alanDoldur(/Müşteri Adı/i, opts.musteriAd ?? 'Utkuhan Bulut');
    // TCKN 11111111111 checksum gecersiz -> gecerli TC.
    await this.alanDoldur(/Müşteri Kimlik No/i, opts.tckn ?? '10000000146');
    // Sefer Tarihi/Düzenlenme/Ödeme Tarihi default dolu gelir; kalirsa maskeli fill gerekir.
  }
}

// NOT: Mutabakat kaldirildi — create endpoint'i (/api/Reconciliation/.../Create) her gecerli
// payload'a (dosya eki + calisan kayit replay'i dahil) HTTP 500 donuyordu (backend arizasi).
