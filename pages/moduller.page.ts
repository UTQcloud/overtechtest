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

/** E-İrsaliye (Despatch) — /Despatch. Sevkiyat belgesi; mükellef gerektirir. */
export class EIrsaliyePage extends BelgePage {
  static readonly OLUSTUR = '/Despatch/CreateDespatch/Index';
  static readonly GIDEN = '/Despatch/OutgoingDespatch/Index';
  async gotoOlustur() { await this.goto(EIrsaliyePage.OLUSTUR); }
  async gotoGiden() { await this.gotoGidenVeFiltrele(EIrsaliyePage.GIDEN); }
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

/** E-Bilet — /ETicket. Yolcu/etkinlik bileti; özel alanlar olabilir. */
export class EBiletPage extends BelgePage {
  static readonly OLUSTUR = '/ETicket/CreateTicket/Index';
  static readonly GIDEN = '/ETicket/Ticket/Index';
  async gotoOlustur() { await this.goto(EBiletPage.OLUSTUR); }
  async gotoGiden() { await this.gotoGidenVeFiltrele(EBiletPage.GIDEN); }
}

/** Mutabakat — /Reconciliation. */
export class MutabakatPage extends BelgePage {
  static readonly OLUSTUR = '/Reconciliation/CreateReconciliation/Index';
  static readonly GIDEN = '/Reconciliation/Reconciliation/Index';
  async gotoOlustur() { await this.goto(MutabakatPage.OLUSTUR); }
  async gotoGiden() { await this.gotoGidenVeFiltrele(MutabakatPage.GIDEN); }
}
