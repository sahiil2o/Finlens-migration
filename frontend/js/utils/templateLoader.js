// ==========================================
// DYNAMIC FETCH TEMPLATE LOADER UTILITY
// ==========================================

/**
 * Fetches and injects HTML structural fragment templates into DOM slot elements.
 * Runs fetches in parallel using Promise.all to guarantee ultra-fast, snappy startup.
 */
export async function loadTemplates() {
  const mainTemplates = [
    { slotId: "upload-screen", path: "templates/upload.html" },
    { slotId: "dashboard", path: "templates/dashboard.html" }
  ];

  // Load primary screen shell layouts in parallel
  await Promise.all(
    mainTemplates.map(async ({ slotId, path }) => {
      const resp = await fetch(path);
      if (!resp.ok) throw new Error(`Failed to load template: ${path}`);
      const text = await resp.text();
      document.getElementById(slotId).innerHTML = text;
    })
  );

  const subTemplates = [
    { slotId: "tab-spend", path: "templates/spend.html" },
    { slotId: "tab-cashflow", path: "templates/cashflow.html" },
    { slotId: "tab-merchants", path: "templates/vendors.html" },
    { slotId: "tab-transactions", path: "templates/table.html" }
  ];

  // Load tab sub-layouts into their respective inner dashboard slots
  await Promise.all(
    subTemplates.map(async ({ slotId, path }) => {
      const resp = await fetch(path);
      if (!resp.ok) throw new Error(`Failed to load tab template: ${path}`);
      const text = await resp.text();
      document.getElementById(slotId).innerHTML = text;
    })
  );
}
