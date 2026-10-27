import { defaultPermissionsFor } from "../../lib/permissions.js";

describe("Permissions", () => {
  it("returns default permissions for OWNER", () => {
    const perms = defaultPermissionsFor("OWNER");
    expect(perms.can_manage_products).toBe(true);
    expect(perms.can_manage_invoices).toBe(true);
    expect(perms.can_manage_settings).toBe(true);
  });

  it("returns limited permissions for CASHIER", () => {
    const perms = defaultPermissionsFor("CASHIER");
    expect(perms.can_manage_invoices).toBe(true);
    expect(perms.can_manage_products).toBe(false);
    expect(perms.can_manage_settings).toBe(false);
  });

  it("returns limited permissions for MANAGER", () => {
    const perms = defaultPermissionsFor("MANAGER");
    expect(perms.can_manage_products).toBe(true);
    expect(perms.can_manage_invoices).toBe(true);
    expect(perms.can_manage_settings).toBe(false);
  });
});
