import { test, expect } from '@playwright/test';
import { BelgePage } from '../pages/belge.page';

/**
 * Diger e-belge modulleri icin GÜVENLİ smoke testleri: ekran + Giden listesi aciliyor mu.
 * Hicbir belge URETMEZ (sadece navigasyon + oturum kontrolu). Gunluk `npm test`'e dahil.
 *
 * Gercek "kes + gönder" testleri (belge ureten) tests/manual/ altinda, flag'li.
 */
const MODULLER = [
  { ad: 'Gider Pusulası', olustur: '/ExpenseBill/CreateExpenseBill/Index', giden: '/ExpenseBill/ExpenseBill/Index' },
  { ad: 'E-Adisyon', olustur: '/EAdisyon/CreateAdisyon/Index', giden: '/EAdisyon/Adisyon/Index' },
  { ad: 'E-İrsaliye', olustur: '/Despatch/CreateDespatch/Index', giden: '/Despatch/OutgoingDespatch/Index' },
  { ad: 'E-SMM Makbuz', olustur: '/ESMReceipt/CreateEsmReceipt/Index', giden: '/ESMReceipt/EsmReceipt/Index' },
  { ad: 'E-MM Makbuz', olustur: '/EMMReceipt/CreateEmmReceipt/Index', giden: '/EMMReceipt/EmmReceipt/Index' },
  { ad: 'E-Bilet', olustur: '/ETicket/CreateTicket/Index', giden: '/ETicket/Ticket/Index' },
];

test.describe('Diğer modüller — güvenli smoke', () => {
  for (const m of MODULLER) {
    const segment = m.olustur.split('/')[1]; // ör. "ExpenseBill" — /login'e düşerse eşleşmez

    test(`${m.ad}: oluştur ekranı açılıyor`, async ({ page }) => {
      await new BelgePage(page).goto(m.olustur);
      await expect(page, 'oturum ayakta + doğru modül').toHaveURL(new RegExp(segment, 'i'));
      await expect(page).not.toHaveURL(/login/i);
    });

    test(`${m.ad}: giden listesi açılıyor`, async ({ page }) => {
      await new BelgePage(page).goto(m.giden);
      await expect(page).not.toHaveURL(/login/i);
    });
  }
});
