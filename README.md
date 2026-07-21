# OverED (Pavo) Portal — Test Otomasyonu

`https://overed.overtech.com.tr` e-Fatura / e-Arşiv ekranları için Playwright + TypeScript
uçtan uca test otomasyonu (Page Object Model).

## Kurulum

```bash
npm install
npx playwright install chromium
```

`.env` (repoya girmez):

```
BASE_URL=https://overed.overtech.com.tr
PORTAL_USER=artiyazilim
PORTAL_PASS=12345
```

## Komutlar

| Komut | Ne yapar |
|---|---|
| `npm test` | **HEPSİ** (güvenli + manuel). Manuel testler `.env` flag'i yoksa atlanır. |
| `npm run test:safe` | **Sadece güvenli** testler — hiçbir belge üretmez (her zaman güvenli) |
| `npm run test:ui` | UI mode — adım adım izleme |
| `npm run test:issue` | Sadece manuel/gerçek belge testleri (flag'li, tarayıcı açık) |
| `npm run report` | Son HTML raporunu açar |

> ⚠️ **Birleşik `npm test`:** `.env`'de `E_FATURA_ISSUE` / `E_ARSIV_SEND` / `E_ARSIV_ISSUE`
> **açıksa**, `npm test` gerçek belge üreten testleri de çalıştırır (CARREFOURSA'ya gerçek
> e-Fatura keser!). **Günlük güvenli koşu için flag'leri `.env`'den sil** veya `npm run test:safe` kullan.
> Flag yoksa `npm test` = **9 passed + 4 skipped** (belge üretmez).

## Yapı

```
tests/auth.setup.ts            login olur, oturumu playwright/.auth/user.json'a yazar
tests/efatura.spec.ts          e-Fatura GÜVENLİ testler (belge üretmez)
tests/earsiv.spec.ts           e-Arşiv GÜVENLİ testler (belge üretmez)
tests/manual/issuance.spec.ts  ⚠️ GERÇEK belge üreten testler (flag'li)
pages/*.page.ts                seçiciler + aksiyonlar (Page Object)
playwright.config.ts           chromium (güvenli) + issuance (manuel) projeleri
```

## Gerçek belge testleri (`test:issue`)

`.env`'e flag ekle, sonra çalıştır. İş bitince flag'i **sil**.

```
E_ARSIV_ISSUE=1     # e-Arşiv oluştur (taslak — geri alınabilir)
E_ARSIV_SEND=1      # e-Arşiv oluştur + Müşteriye Gönder (resmi)
E_FATURA_ISSUE=1    # e-Fatura kes — her senaryo (mükellef cari gerekir)
# E_FATURA_MUSTERI=CARREFOURSA          (mükellef cari; boşsa 'carrefour' aranır)
# E_FATURA_SENARYOLAR=Temel Fatura,Ticari Fatura,Özel Fatura
```

```bash
npx playwright test --project=issuance -g "Temel Fatura" --headed
```

Akış: form doldur → **Oluştur** (taslak, "başarıyla kaydedildi" modalı) → **Müşteriye Gönder**
(resmi) → Giden'de yeni fatura no + durum doğrulanır. Kanıtlandı: `REW…385 · Müşteriye Ulaştı`.

## Portalın gerçekleri (canlı DOM'dan)

- **Oturum COOKIE değil:** localStorage'daki `ot-user` JWT'sinde. `auth.setup` token düşene
  kadar bekleyip kaydeder. Oturum bozulursa `playwright/.auth/user.json`'ı sil.
- **e-Fatura sadece kayıtlı MÜKELLEFE kesilir** (ör. CARREFOURSA). Mükellef değilse "Alıcı
  Etiketi" boş kalır. Mükellef olmayan alıcıya (ör. sahte TCKN 11111111111) belge = **e-Arşiv**
  ("Hızlı Müşteri" ile anlık alıcı).
- **e-Fatura/e-Arşiv "Oluştur" = TASLAK.** "Tamamlandı" için ayrıca **"Müşteriye Gönder"** gerekir.
- **Senaryolar:** Temel, Ticari, Özel, İhracat, Hal Kayıt, Yolcu Beraber Eşya, İlaç/Tıbbi Cihaz,
  Yatırım Teşvik, İnşaat Demiri. Temel/Ticari basit veriyle kesilir; diğerleri ek alan ister.
- **Ticari Fatura'da Fatura Tipi zorunlu** olur (senaryo değişince sıfırlanır); form "Satış" seçer.
- **Kendo UI:** input id'leri değişken → seçiciler görünür etiket/pozisyona göre yazıldı.
- **Durum ("tamamlandı"):** Onay Bekleniyor → Gönderilmiş → Müşteriye Ulaştı.

## Sorun giderme

| Belirti | Çözüm |
|---|---|
| Testler `/login`'e düşüyor | `playwright/.auth/user.json` sil, tekrar çalıştır |
| Seçici bulunamadı (ekran değişti) | `npm run codegen` ile al, `pages/*.page.ts` güncelle |
| e-Arşiv "valid first and last name" | Ad/soyad rakam/"Test" içeremez; gerçek isim ver |
| e-Fatura "zorunlu alan (Fatura Tipi)" | Senaryo değişince Fatura Tipi seçilmeli (form otomatik yapar) |

## Not (QA bulgusu)

Test hesabı şifresi `12345` — zayıf. Şifre `.env`'de, repoya asla commit etme.
