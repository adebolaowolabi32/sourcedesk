import { test, expect } from "@playwright/test";
test("question, citations, feedback, and persistent history work", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Clarity, with a source." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /A payment is still confirming/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Here’s what the guides say." }),
  ).toBeVisible();
  await expect(page.locator(".answer-card")).toContainText(
    "Do not create a replacement payment",
  );
  await page
    .getByRole("button", { name: "Open citation 1", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("An uncertain outcome");
  await expect(page.locator(".source-section.highlighted")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page
    .getByRole("button", { name: "Helpful answer", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Feedback saved");
  await page.reload();
  await page.locator(".recent-list").getByRole("button").first().click();
  await expect(page.locator(".answer-card")).toContainText(
    "Do not create a replacement payment",
  );
  await expect(
    page.getByRole("button", { name: "Helpful answer", exact: true }),
  ).toHaveClass(/chosen/);
  expect(errors).toEqual([]);
});
test("unsupported question creates an isolated handoff that can be resolved", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByLabel("Ask a support question")
    .fill("What is my bank balance?");
  await page
    .getByRole("button", { name: "Send question", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Let’s get the right person involved." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Send to review", exact: true })
    .click();
  await page
    .getByLabel("Additional context")
    .fill("Need an authorized account lookup.");
  await page.getByRole("button", { name: "Create review case" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page
    .getByRole("button", { name: "Handoffs", exact: false })
    .first()
    .click();
  await page.getByRole("button", { name: "Review case", exact: true }).click();
  await page
    .getByLabel("Resolution note")
    .fill("Ask the account owner to contact the operations team directly.");
  await page.getByRole("button", { name: "Resolve case", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.locator(".case-card")).toContainText("Resolved");
  await expect(page.locator(".resolution")).toContainText("account owner");
});
test("knowledge search and evaluation display real case outcomes", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Knowledge", exact: true }).click();
  await page.getByLabel("Search guides").fill("password");
  await expect(page.locator(".document-card").first()).toBeVisible();
  await page.getByLabel("Search guides").fill("no-result-xyz");
  await expect(
    page.getByRole("heading", { name: "No matching guides" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Evaluations", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Measured, not assumed." }),
  ).toBeVisible();
  await expect(page.locator(".eval-result")).toHaveCount(40);
  await page
    .getByRole("button", { name: "Run evaluation", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Evaluation complete");
  await page.locator(".panel-title select").selectOption("injection");
  await expect(page.locator(".eval-result")).toHaveCount(4);
  await expect(page.locator(".eval-result .fail")).toHaveCount(0);
});
test("desktop and mobile layouts stay usable and save visual evidence", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Clarity, with a source." }),
  ).toBeVisible();
  await page.screenshot({ path: "docs/desktop.png", fullPage: true });
  await page
    .getByRole("button", { name: /A payment is still confirming/ })
    .click();
  await expect(page.locator(".answer-card")).toBeVisible();
  await page.screenshot({ path: "docs/answer.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.getByRole("button", { name: "Knowledge", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Knowledge, kept close." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.getByRole("button", { name: "Assistant", exact: true }).click();
  await page
    .getByRole("button", { name: "New question", exact: true })
    .last()
    .click();
  await expect(page.locator(".sidebar")).toBeHidden();
  await page.evaluate(() => {
    (document.activeElement as HTMLElement)?.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: "docs/mobile.png",
    fullPage: true,
    animations: "disabled",
  });
});
test("failed network requests preserve the question draft for retry", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByLabel("Ask a support question")).toBeVisible();
  await page.route("**/api/ask", (r) =>
    r.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: "Answer service temporarily unavailable.",
      }),
    }),
  );
  await page
    .getByLabel("Ask a support question")
    .fill("How do payment approvals work?");
  await page
    .getByRole("button", { name: "Send question", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "temporarily unavailable",
  );
  await expect(page.getByLabel("Ask a support question")).toHaveValue(
    "How do payment approvals work?",
  );
});

test("saved citations retain their original evidence after the library changes", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: /A payment is still confirming/ })
    .click();
  await expect(page.locator(".answer-card")).toBeVisible();
  await page.route("**/api/bootstrap", async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    data.corpusVersion = "new-library-version";
    await route.fulfill({ response, json: data });
  });
  await page.route("**/api/documents", async (route) => {
    const response = await route.fetch();
    const docs = await response.json();
    for (const d of docs)
      if (d.id === "reconciliation")
        for (const s of d.sections)
          s.text = "This guide was revised after the saved conversation.";
    await route.fulfill({ response, json: docs });
  });
  await page.reload();
  await page.locator(".recent-list").getByRole("button").first().click();
  await page
    .getByRole("button", { name: "Open citation 1", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Saved evidence snapshot",
  );
  await expect(page.locator(".source-section.highlighted")).toContainText(
    "Do not create a replacement payment",
  );
  await expect(page.getByRole("dialog")).not.toContainText(
    "This guide was revised",
  );
});
