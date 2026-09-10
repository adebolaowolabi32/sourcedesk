import { test, expect } from "@playwright/test";
test("static demo answers, citations, feedback, reviews and evaluation work with no API requests", async ({
  page,
}) => {
  const forbidden: string[] = [],
    errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (req) => {
    const u = new URL(req.url());
    if (u.pathname.startsWith("/api/") || u.hostname === "api.openai.com")
      forbidden.push(req.url());
  });
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto("./");
  await expect(
    page.getByText("Interactive portfolio demo", { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "docs/portfolio-desktop.png", fullPage: true });
  await page
    .getByRole("button", { name: /A payment is still confirming/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Here’s what to do." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Open citation 1", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toContainText("An uncertain outcome");
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Helpful answer", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Feedback saved");
  await page.reload();
  await page.locator(".recent-list").getByRole("button").first().click();
  await expect(
    page.getByRole("button", { name: "Helpful answer", exact: true }),
  ).toHaveClass(/chosen/);
  await page
    .getByLabel("Ask a support question")
    .fill("How do I build a rocket?");
  await page
    .getByRole("button", { name: "Send question", exact: true })
    .click();
  await expect(page.locator(".answer-card")).toContainText(
    "no recorded answer",
  );
  await page
    .getByRole("button", { name: "Send to review", exact: true })
    .click();
  await page.getByLabel("Additional context").fill("A sample review request.");
  await page.getByRole("button", { name: "Create review case" }).click();
  await page
    .getByRole("button", { name: /Handoffs/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Review case", exact: true }).click();
  await page
    .getByLabel("Resolution note")
    .fill("Resolved within the browser-only portfolio demo.");
  await page.getByRole("button", { name: "Resolve case", exact: true }).click();
  await expect(page.locator(".case-card")).toContainText("Resolved");
  await page.getByRole("button", { name: "Knowledge", exact: true }).click();
  await page.getByLabel("Search guides").fill("password");
  await expect(page.locator(".document-card").first()).toBeVisible();
  await page.getByRole("button", { name: "Evaluations", exact: true }).click();
  await page.getByRole("button", { name: "View saved evaluation" }).click();
  await expect(page.locator(".eval-result")).toHaveCount(40);
  await page.getByRole("button", { name: "Reset demo" }).click();
  await page
    .getByRole("button", { name: /Handoffs/ })
    .first()
    .click();
  await expect(page.locator(".case-card")).toHaveCount(0);
  expect(forbidden).toEqual([]);
  expect(errors).toEqual([]);
});
test("mobile demo stays within the viewport and works without persistent storage", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error("storage disabled");
    };
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./");
  await page.getByRole("button", { name: /Who can approve a payment/ }).click();
  await expect(page.locator(".answer-card")).toContainText("Recorded sample");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.evaluate(() => {
    (document.activeElement as HTMLElement)?.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({ path: "docs/portfolio-mobile.png", fullPage: true });
});
