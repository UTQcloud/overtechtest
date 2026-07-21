import { Page, Locator, expect } from '@playwright/test';

/**
 * OverED (Pavo) portal giris sayfasi.
 * Seciciler CANLI DOM'dan alindi (Metronic temasi, name="username"/"password").
 * Giris basarili olunca /Home/Dashboard/Index'e duser.
 */
export class LoginPage {
  readonly page: Page;
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;

    // Gercek alanlar: name="username" / name="password" (placeholder ile de dogrulanabilir)
    this.usernameInput = page.locator('input[name="username"]');
    this.passwordInput = page.locator('input[name="password"]');
    this.submitButton = page.locator('#kt_sign_in_submit');

    this.errorMessage = page.locator('.validation-summary-errors, .alert-danger, .text-danger, .invalid-feedback').first();
  }

  async goto() {
    // "/" -> /login?returnUrl=... yonlendirir. networkidle beklemek gerek (SPA render).
    await this.page.goto('/', { waitUntil: 'networkidle' });
    await this.dismissCookieBanner();
  }

  async login(username: string, password: string) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  /** Sag altta cikan "Accept Cookies" bandi form ustune binebiliyor; varsa kapat. */
  async dismissCookieBanner() {
    const accept = this.page.getByRole('button', { name: /accept cookies/i });
    if (await accept.isVisible().catch(() => false)) {
      await accept.click().catch(() => {});
    }
  }

  async expectLoginFailed() {
    await expect(this.errorMessage).toBeVisible();
  }
}
