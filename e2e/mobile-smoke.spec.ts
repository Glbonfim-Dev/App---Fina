import { expect, test } from '@playwright/test';

test('carrega a aplicação sem erro no viewport configurado', async ({ page, request }) => {
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

  const favicon = await request.get('/icons/icon-192.png');
  expect(favicon.ok()).toBe(true);
});
