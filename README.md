# OverED (Pavo) Portal — Test Otomasyonu

`https://overed.overtech.com.tr` e-Fatura / e-Arşiv ekranları için Playwright + TypeScript
uçtan uca test otomasyonu (Page Object Model).

## Kurulum

```bash
npm install
npx playwright install chromium
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
tests/moduller.spec.ts         diğer 7 modül GÜVENLİ smoke (ekran + Giden açılıyor)
tests/manual/issuance.spec.ts  ⚠️ GERÇEK belge üreten testler (flag'li)
pages/belge.page.ts            ORTAK base class (tüm modüller bunu extend eder)
pages/efatura.page.ts          e-Fatura (mükellef + senaryo/tip) — BelgePage'i extend eder
pages/earsiv.page.ts           e-Arşiv (Hızlı Müşteri) — BelgePage'i extend eder
pages/moduller.page.ts         diğer 7 modül (Gider Pusulası, E-Adisyon, E-İrsaliye, ...)
playwright.config.ts           chromium (güvenli) + issuance (manuel) projeleri
```

**Mimari:** Tüm e-belge modülleri aynı Kendo deseni (Oluştur → "başarıyla kaydedildi"
modalı → Müşteriye Gönder → Giden). Ortak mantık `BelgePage` base class'ında; her modül
onu extend edip sadece kendi rotasını + varsa özel alanını ekler (~6 satır).

**Kapsanan modüller:** e-Fatura, e-Arşiv, Gider Pusulası, E-Adisyon, E-İrsaliye (Despatch),
E-SMM, E-MM, E-Bilet, Mutabakat.

### Modül kapsama

**7/9 modül kes+gönder CANLI doğrulandı** (gerçek belge kesildi). Kalan 2'si smoke ile kapsanıyor.

| Modül | Smoke | Kes+Gönder | Not |
|---|---|---|---|
| e-Fatura | ✅ | ✅ kanıtlı | Mükellef + senaryo/tip |
| e-Arşiv | ✅ | ✅ kanıtlı | Hızlı Müşteri |
| Gider Pusulası | ✅ | ✅ kanıtlı | Hızlı Müşteri (İade Bilgi Fişi) |
| E-MM Makbuz | ✅ | ✅ kanıtlı | Hızlı Müşteri + GV STPJ (stopaj) |
| E-SMM Makbuz | ✅ | ✅ kanıtlı | Kayıtlı cari + Brüt Ücret |
| E-Adisyon | ✅ | ✅ kanıtlı | Kayıtlı cari (CARREFOURSA) + KDV |
| E-Bilet | ✅ | ✅ kanıtlı | Doğrudan müşteri + 13-hane benzersiz no |
| **E-İrsaliye** | ✅ | ⚠️ form tam, sunucu 500 | Form otomasyonu TAM (Sürücü/Dorse/Kalem 3 grid + Plaka + tarihler); `Oluştur`'da backend "Unexpected exception" |
| **Mutabakat** | ✅ | ⚠️ sunucu 500 | Form dolduruluyor; `Oluştur`'da backend "Unexpected exception" (İrsaliye ile AYNI hata) |

"kanıtlı" = gerçek belge kesildi (canlı). Son 2 modülde **form otomasyonu tamamlandı** (tüm
zorunlu alanlar geçiyor, form sunucuya gidiyor) ama `Development` backend her ikisinde de
**aynı generic `Unexpected exception. Further investigation required.`** (HTTP 500) dönüyor.
İrsaliye dosya GEREKTİRMEDEN bu hatayı verdiği için ortak neden test-tenant/backend — test
kodu değil. Manuel olarak bu tenant'ta İrsaliye/Mutabakat kesilebiliyorsa alan haritası hazır.

Öğrenilen portal iş kuralları (`formuDoldur`/`hizliMusteriOlustur`'da kodlu):
TCKN 11111111111 checksum geçersiz → geçerli TC (10000000146); E-MM tax (stopaj) > 0;
Mutabakat Toplam Tutar ≥ 5000; E-Bilet no 13-hane + benzersiz; İrsaliye Sevk Tarihi gelecekte.

## Gerçek belge testleri (`test:issue`)

`.env`'e flag ekle, sonra çalıştır. İş bitince flag'i **sil**.

```
E_ARSIV_ISSUE=1     # e-Arşiv oluştur (taslak — geri alınabilir)
E_ARSIV_SEND=1      # e-Arşiv oluştur + Müşteriye Gönder (resmi)
E_FATURA_ISSUE=1    # e-Fatura kes — her senaryo (mükellef cari gerekir)
E_GIDER_ISSUE=1     # Gider Pusulası oluştur + gönder (Hızlı Müşteri)
E_MM_ISSUE=1        # E-MM Makbuz (Hızlı Müşteri)
E_SMM_ISSUE=1       # E-SMM Makbuz (kayıtlı cari)
E_ADISYON_ISSUE=1   # E-Adisyon (kayıtlı cari + adisyon alanları)
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

