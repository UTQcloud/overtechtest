import { Page, expect } from '@playwright/test';

/**
 * OverED (Pavo) E-ARŞİV ekrani — CANLI DOM'dan kesfedildi.
 *
 * Neden e-Arşiv? e-Fatura sadece kayitli e-fatura MUKELLEFINE kesilir; bu hesaptaki
 * test carilerinin hicbiri mukellef degil. Mukellef OLMAYAN aliciya kesilen belge
 * e-Arsiv'dir. Ayrica e-Arsiv "Hızlı Müşteri" ile ANLIK alici olusturmaya izin verir
 * (TCKN default 11111111111) — yani bozuk test verisine bagimli kalmadan calisir.
 *
 * Rota   : /EArchive/CreateArchiveInvoice/Index  (baslik "E-arşiv Oluştur")
 * Fark   : "Alıcı Etiketi" YOK; bunun yerine "Gönderim Şekli" (ELEKTRONİK varsayilan).
 * Grid   : e-Fatura ile ayni yapida — num[0]=Item Price, num[1]=Miktar, num[3]=KDV %.
 *
 * GERCEKTE DOGRULANAN AKIS (canli):
 *   Oluştur -> "Fatura taslak olarak başarıyla kaydedildi" MODALI acilir (onizleme + ETTN).
 *   Bu modalde "Müşteriye Gönder" butonu var -> resmi gonderim (musteriyeGonder()).
 *   Yani: Oluştur = olusturur (taslak), Müşteriye Gönder = resmi gonderim (ayri adim).
 * NOT: Bu Development/test ortami taslaklari KALICI tutmuyor (olusan Taslak listesinde
 *   gorunmeyebiliyor); basari sinyali olarak liste yerine MODAL kullaniliyor.
 *
 * ⚠️ Ad/Soyad dogrulaniyor: RAKAM ve "Test"/anlamsiz dizi REDDEDILIYOR
 *   ("valid first and last name" hatasi) -> gercek isim kullan (hizliMusteriOlustur).
 * ⚠️ KDV %0 -> "Vergi İstisna" modali -> gercek oran (20) ver.
 */
export class EArsivPage {
  readonly page: Page;
  static readonly ROUTE = '/EArchive/CreateArchiveInvoice/Index';

  constructor(page: Page) {
    this.page = page;
  }

  async gotoOlustur() {
    await this.page.goto(EArsivPage.ROUTE, { waitUntil: 'networkidle' });
    await this.dismissCookieBanner();
    await expect(this.page.getByRole('heading', { name: /E-?arşiv Oluştur/i })).toBeVisible();
  }

  /**
   * "Hızlı Müşteri" ile anlik SAHTE alici olusturur (mukellef sarti YOK).
   * TCKN/Şehir/İlçe/EMail default dolu gelir (TCKN = 11111111111).
   * Ad/soyad verilmezse varsayilan "Utkuhan Bulut" (sahte kimlik, gercek kisi degil).
   * Uretilen musteri adini dondurur.
   */
  async hizliMusteriOlustur(ad?: string, soyad?: string): Promise<string> {
    // SAHTE test alicisi (GERCEK KISI DEGIL): varsayilan "Utkuhan Bulut", TCKN 11111111111.
    // NOT: e-Arsiv ad/soyad'i dogruluyor -> rakam VE "Test"/anlamsiz harf dizisi reddedilir
    // ("valid first and last name"). "Utkuhan"/"Bulut" gecerli ad/soyad formatinda.
    const adFinal = ad ?? 'Utkuhan';
    const soyadFinal = soyad ?? 'Bulut';

    await this.page.locator('[role="combobox"]').first().click();
    await this.page.waitForTimeout(400);
    await this.page.keyboard.type('test', { delay: 30 });
    await this.page.waitForTimeout(1500);
    await this.page.locator('.k-list-item', { hasText: 'Hızlı Müşteri' }).first().click();
    await this.page.waitForTimeout(1200);

    // placeholder "Adı" -> exact (yoksa "Soyadı"yi da yakalar)
    await this.page.getByPlaceholder('Adı', { exact: true }).fill(adFinal);
    await this.page.getByPlaceholder('Soyadı', { exact: true }).fill(soyadFinal);
    // Modal ngx-bootstrap <modal-container> icinde; buton metni " Oluştur " (bosluklu),
    // bu yuzden anchor'li getByRole eslesmiyor. modal-container'a scope + substring text.
    await this.page.locator('modal-container button:has-text("Oluştur")').first().click();
    // KRITIK: Musteri olusturma ASENKRON. Musteri forma DUSMEDEN kalem/Oluştur'a
    // gecersek fatura musterisiz gidip SESSIZCE resetlenir (yaris kosulu).
    // Bu yuzden musteri "chip"i (TCKN: 11111111111) forma dusene kadar bekle.
    await expect(this.page.getByText(/TCKN:\s*11111111111/i).first()).toBeVisible({ timeout: 15_000 });
    await this.page.waitForTimeout(800);
    return `${adFinal} ${soyadFinal}`;
  }

  /** Ilk kalem satirini doldurur (KDV %0 birakma; default 20). */
  async kalemDoldur(urun: string, birimFiyat: number, miktar = 1, kdv = 20) {
    await this.page.locator('table input[type="text"]').first().fill(urun);
    await this.setGridNumeric(0, birimFiyat); // Item Price
    await this.setGridNumeric(1, miktar);     // Miktar
    await this.setGridNumeric(3, kdv);        // KDV %
  }

  async setGridNumeric(index: number, value: number) {
    const nums = this.page.locator('table [role="spinbutton"], table input.k-input-inner');
    await nums.nth(index).click();
    await this.page.keyboard.press('Control+a');
    await this.page.keyboard.type(String(value), { delay: 25 });
    await this.page.keyboard.press('Tab');
    await this.page.waitForTimeout(400);
  }

  async toplamTutar(): Promise<string> {
    const t = await this.page
      .getByText(/Total Payable Amount|Toplam Ödenecek/i)
      .last()
      .locator('xpath=..')
      .textContent()
      .catch(() => '');
    return (t || '').replace(/\s+/g, ' ').trim();
  }

  /**
   * ⚠️ Faturayi OLUSTURUR (taslak olarak kaydeder). " Oluştur " butonu bosluklu -> btn-lg.
   *
   * KESIN basari sinyali: "Fatura taslak olarak başarıyla kaydedildi" MODALI acilir
   * (faturanin onizlemesi + ETTN ile). Bu modal "Müşteriye Gönder" butonu da icerir.
   * Hata olursa kirmizi bildirimi firlatir. Modaldeki ETTN'yi dondurur.
   */
  async olustur(): Promise<string> {
    // Cookie bandi "Oluştur" butonunun ustune binip tiklamayi engelliyor -> once kapat.
    await this.dismissCookieBanner();
    await this.page.locator('button.btn-lg:has-text("Oluştur")').first().click();

    // "Fatura taslak olarak başarıyla kaydedildi" -> INVOICE modali (musteri toast'i
    // "başarılı bir şekilde oluşturuldu" der; karistirmamak icin "kaydedildi" ozel).
    const basariModal = this.page.getByText(/başarıyla kaydedildi/i).first();
    const hata = this.page
      .locator('.k-notification-error, .toast-error, .validation-message, .text-danger')
      .filter({ hasText: /\S/ })
      .first();
    for (let i = 0; i < 40; i++) {
      if (await basariModal.isVisible().catch(() => false)) {
        const modalTxt =
          (await this.page.locator('.modal.show, modal-container, .swal2-popup').first().textContent().catch(() => '')) || '';
        const ettn = (modalTxt.match(/ETTN:\s*([A-F0-9-]{20,})/i) || [])[1] || '';
        return ettn;
      }
      if (await hata.isVisible().catch(() => false)) {
        const msg = ((await hata.textContent()) || '').replace(/\s+/g, ' ').trim();
        throw new Error(`e-Arsiv "Oluştur" hatasi: ${msg}`);
      }
      await this.page.waitForTimeout(400);
    }
    throw new Error('e-Arsiv "Oluştur" sonrasi basari modali (başarıyla kaydedildi) gorunmedi (16sn).');
  }

  /**
   * Basari modalindeki "Müşteriye Gönder" butonuyla faturayi RESMEN gonderir.
   * ⚠️ Gercek GİB gonderimi (yasal). Otomatik ajan CALISTIRAMAZ; E_ARSIV_SEND ile gated.
   *
   * Basari sinyali: gonderim islenince "başarıyla kaydedildi" MODALI KAPANIR ve form
   * sifirlanir (kalici bir toast YOK). Modal kapandiysa true doner.
   */
  async musteriyeGonder(): Promise<boolean> {
    await this.dismissCookieBanner(); // banner "Müşteriye Gönder"i de kapatabiliyor
    await this.page
      .locator('.modal.show, modal-container, .swal2-popup')
      .getByRole('button', { name: /Müşteriye Gönder/i })
      .first()
      .click();
    await this.page.waitForTimeout(1500);
    // Olasi onay ("Emin misiniz?" vb.)
    for (const label of [/^Evet$/i, /^Onayla$/i, /^Gönder$/i, /^Tamam$/i]) {
      const btn = this.page.locator('.modal.show, modal-container, .swal2-actions').getByRole('button', { name: label }).first();
      if (await btn.isVisible().catch(() => false)) {
        await btn.click().catch(() => {});
        await this.page.waitForTimeout(2000);
        break;
      }
    }
    // Basari = "başarıyla kaydedildi" modali kapandi (form resetlendi).
    await this.page.getByText(/başarıyla kaydedildi/i).first().waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => {});
    await this.page.waitForLoadState('networkidle').catch(() => {});
    return !(await this.page.getByText(/başarıyla kaydedildi/i).first().isVisible().catch(() => false));
  }

  async dismissCookieBanner() {
    const accept = this.page.getByRole('button', { name: /accept cookies/i });
    if (await accept.isVisible().catch(() => false)) await accept.click().catch(() => {});
  }
}
