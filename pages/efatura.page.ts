import { BelgePage } from './belge.page';

/**
 * OverED (Pavo) e-FATURA ekrani. Ortak mantik BelgePage'de; burada e-fatura'ya ozel:
 *  - MUKELLEF cari sart (Alıcı Etiketi dolan) -> selectMukellefMusteri (base).
 *  - "Senaryo" ve "Fatura Tipi" secimi (Ticari'de Fatura Tipi zorunlu olur).
 *  - Giden'de "tamamlandı" = Durum kolonu (Müşteriye Ulaştı / Gönderilmiş).
 */
export class EFaturaPage extends BelgePage {
  static readonly ROUTES = {
    olustur: '/EInvoice/CreateInvoice/Index',
    giden: '/EInvoice/OutgoingInvoice/Index',
  };

  // ---------- Navigasyon ----------

  async gotoOlustur() {
    await this.goto(EFaturaPage.ROUTES.olustur, /Fatura Oluştur/i);
  }

  async gotoGiden() {
    await this.goto(EFaturaPage.ROUTES.giden);
  }

  async gotoGidenVeFiltrele() {
    await super.gotoGidenVeFiltrele(EFaturaPage.ROUTES.giden);
  }

  /** Giden'deki ilk fatura (base ilkKayit'in e-fatura isimlendirmesiyle). */
  async ilkFatura(): Promise<{ faturaNo: string; musteri: string; durum: string }> {
    const k = await this.ilkKayit();
    return { faturaNo: k.no, musteri: k.musteri, durum: k.durum };
  }

  async yeniFaturaBekle(oncekiNo: string): Promise<{ faturaNo: string; musteri: string; durum: string }> {
    const k = await this.yeniKayitBekle(oncekiNo, EFaturaPage.ROUTES.giden);
    return { faturaNo: k.no, musteri: k.musteri, durum: k.durum };
  }

  // ---------- e-Fatura'ya ozel form alanlari ----------

  /** Senaryo: Temel Fatura, Ticari Fatura, Özel Fatura, İhracat, İlaç... */
  async senaryoSec(senaryoAdi: string) {
    await this.dropdownSec(/^Senaryo/i, senaryoAdi);
  }

  /** Fatura Tipi: Satış (default), İade, Tevkifat, İstisna... Ticari'de zorunlu olur. */
  async faturaTipiSec(tip: string) {
    await this.dropdownSec(/^Fatura Tipi/i, tip);
  }

  /**
   * Formu bastan sona doldurur: MUKELLEF cari + (senaryo) + Fatura Tipi + kalem.
   * KDV %0 birakma (istisna modali); default 20. Secilen cari adini doner.
   */
  async formuDoldur(data: {
    musteriAdi?: string;
    aramaTerimi?: string;
    senaryo?: string;
    faturaTipi?: string;
    urun: string;
    birimFiyat: number;
    miktar?: number;
    kdvOrani?: number;
    tarih?: string;
    not?: string;
  }): Promise<string> {
    const secilen = await this.selectMukellefMusteri({
      musteriAdi: data.musteriAdi,
      aramaTerimi: data.aramaTerimi,
    });

    if (data.senaryo) await this.senaryoSec(data.senaryo);
    // Senaryo degisince Fatura Tipi sifirlanabiliyor -> senaryodan SONRA sec (zorunlu).
    await this.faturaTipiSec(data.faturaTipi ?? 'Satış');
    if (data.tarih) await this.fillDate('#datetimepicker-1', data.tarih);

    await this.page.locator('table input[type="text"]').first().fill(data.urun);
    await this.setGridNumeric(0, data.birimFiyat);
    await this.setGridNumeric(1, data.miktar ?? 1);
    await this.setGridNumeric(3, data.kdvOrani ?? 20);

    if (data.not) await this.page.locator('textarea').first().fill(data.not);
    return secilen;
  }

  /** Maskeli/Kendo tarih inputu: fill() calismaz, tus tus yaz. */
  async fillDate(selector: string, value: string) {
    const input = this.page.locator(selector).first();
    await input.click();
    await input.press('Control+a');
    await input.pressSequentially(value, { delay: 50 });
    await input.press('Escape');
  }
}
