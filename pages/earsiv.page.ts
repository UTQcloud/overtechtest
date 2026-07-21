import { BelgePage } from './belge.page';

/**
 * OverED (Pavo) E-ARŞİV ekrani. Ortak mantik BelgePage'de; burada sadece rota + baslik.
 *
 * Fark: Mükellef GEREKMEZ -> "Hızlı Müşteri" (Utkuhan Bulut / TCKN 11111111111) kullanir.
 * "Alıcı Etiketi" YOK; onun yerine "Gönderim Şekli" (ELEKTRONİK) var. Grid e-Fatura ile ayni.
 *
 * Akis (canli): Oluştur -> "başarıyla kaydedildi" modali (taslak) -> Müşteriye Gönder (resmi).
 */
export class EArsivPage extends BelgePage {
  static readonly ROUTE = '/EArchive/CreateArchiveInvoice/Index';

  async gotoOlustur() {
    await this.goto(EArsivPage.ROUTE, /E-?arşiv Oluştur/i);
  }
}
