import { expect, test } from '@playwright/test';

test('carrega a aplicação sem erro em viewport móvel', async ({ page, request }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await page.goto('/');
  await expect(page).toHaveTitle('Fina');
  await expect(page.getByRole('heading', { name: /Falta configurar o Supabase|Fina/ })).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
  expect(consoleErrors).toEqual([]);

  const manifest = await request.get('/manifest.webmanifest');
  expect(manifest.ok()).toBe(true);
  await expect(manifest.json()).resolves.toMatchObject({ name: 'Fina — Controle financeiro', display: 'standalone' });
});
