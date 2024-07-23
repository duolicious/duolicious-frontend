import { test, expect } from '@playwright/test';

test('has correct onboarding flow', async ({ page }) => {
  await page.route('**', async (route, request) => {
    // Parse the URL of the request
    const url = new URL(request.url());

    // Check if the port is 8080
    if (url.port === "8080") {
      // Fulfill or modify the request as needed
      await route.fulfill({
        json: {
          "api_version": 5,
          "statuses": [ "ok", "down for maintenance" ],
          "status_index": 0,
        }
      });
    } else {
      await route.continue();
    }
  });

  await page.route('*/**/stats', async route => {
    await route.fulfill({ json: {"num_active_users":1} });
  });

  await page.route('*/**/request-otp', async route => {
    await route.fulfill({
      json: {
        "session_token": "redacted"
      }
    });
  });

  await page.route('*/**/check-otp', async route => {
    await route.fulfill();
  });

  await page.route('*/**/onboardee-info', async route => {
    await route.fulfill();
  });

  await page.route('*/**/profile-info', async route => {
    await route.fulfill({
      json: {
        "about": "",
        "chats": "Immediately",
        "clubs": [],
        "drinking": "Unanswered",
        "drugs": "Unanswered",
        "education": null,
        "ethnicity": "Unanswered",
        "exercise": "Unanswered",
        "gender": "Woman",
        "has kids": "Unanswered",
        "height": null,
        "hide me from strangers": "No",
        "intros": "Every 3 days",
        "location": "Paris, \u00cele-de-France, France",
        "long distance": "Unanswered",
        "looking for": "Unanswered",
        "name": "Test",
        "occupation": null,
        "orientation": "Unanswered",
        "photo": null,
        "photo_blurhash": null,
        "photo_verification": null,
        "relationship status": "Unanswered",
        "religion": "Unanswered",
        "show my age": "Yes",
        "show my location": "Yes",
        "smoking": "Unanswered",
        "star sign": "Unanswered",
        "theme": {
          "background_color": "#ffffff",
          "body_color": "#000000",
          "title_color": "#000000"
        },
        "units": "Metric",
        "verified_age": false,
        "verified_ethnicity": false,
        "verified_gender": false,
        "wants kids": "Unanswered"
      }
    });
  });

  await page.route('*/**/finish-onboarding', async route => {
    await route.fulfill({
      json: {
        "clubs": [],
        "pending_club": null,
        "person_id": 13,
        "person_uuid": "ed2f2e22-d62e-4d29-bada-62e25d6dedcb",
        "units": "Metric"
      }
    });
  });

  await page.route('*/**/search-locations?q=Paris', async route => {
    await route.fulfill({
      json: [
        "Paris, \u00cele-de-France, France",
        "Paris, Ontario, Canada",
        "Paris (Paris 02), \u00cele-de-France, France",
        "Paris (Od\u00e9on), \u00cele-de-France, France",
        "Paris, Texas, United States",
        "Paris (Bercy), \u00cele-de-France, France",
        "Paris (Ternes), \u00cele-de-France, France",
        "Paris (Paris 16 Passy), \u00cele-de-France, France",
        "Paris (Auteuil), \u00cele-de-France, France",
        "Paris, Illinois, United States"
      ]
    });
  });

  await page.goto('http://localhost:8081');

  await page.getByPlaceholder('Enter your email to begin').click();
  await page.getByPlaceholder('Enter your email to begin').fill('user1@example.com');
  await page.locator('div').filter({ hasText: /^Sign Up or Sign In$/ }).nth(1).click();

  await page.locator('div:nth-child(2) > .css-view-175oi2r > input').first().fill('0');
  await page.locator('input:nth-child(2)').fill('0');
  await page.locator('input:nth-child(3)').fill('0');
  await page.locator('input:nth-child(4)').fill('0');
  await page.locator('input:nth-child(5)').fill('0');
  await page.locator('input:nth-child(6)').fill('0');
  await page.locator('div').filter({ hasText: /^Continue$/ }).nth(2).click();

  await page.getByPlaceholder('First name').fill('Test');
  await page.getByText('Continue').nth(1).click();

  await page.getByText('Woman', { exact: true }).click();
  await page.getByText('Continue').nth(2).click();

  await page.getByText('Man', { exact: true }).nth(1).click();
  await page.getByText('Other').nth(1).click();
  await page.getByText('Continue').nth(3).click();

  await page.getByText('Day').click();
  await page.getByText('1', { exact: true }).click();
  await page.locator('img').nth(1).click();
  await page.getByText('Jan').click();
  await page.locator('img').nth(2).click();
  await page.getByText('2004').click();
  await page.getByText('Continue').nth(4).click();

  await page.getByPlaceholder('Type a location...').click();
  await page.getByPlaceholder('Type a location...').fill('Paris');
  await page.getByText('Paris, Île-de-France, France').click();

  await page.getByText('Continue').nth(5).click();

  await page.getByText('Continue').nth(6).click();

  await page.route('*/**/sign-out', async route => {
    await route.fulfill();
  });

  await page.locator('button', { hasText: /Profile$/ }).last().click();
  await page.getByText('Sign Out').nth(1).click();
});
