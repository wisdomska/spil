import { describe, expect, it } from "vitest";
import { SECTIONS } from "@/lib/admin/roles";
import { DEFAULT_VIEWS, pageQuery, sectionOf } from "@/lib/admin/views";

// The console's default requests are shared by the sections, the background prefetch and the
// proxy's preload hint (owner request 2026-11-13), so they must agree exactly.
describe("admin default views", () => {
  it("covers every section", () => {
    for (const s of SECTIONS) expect(DEFAULT_VIEWS[s].length).toBeGreaterThan(0);
  });
  it("builds query strings like the console does", () => {
    expect(pageQuery({ page: 1, size: 20, filter: "all", sort: undefined, q: "" })).toBe(
      "page=1&size=20&filter=all",
    );
    expect(DEFAULT_VIEWS.users[0]).toEqual({
      key: ["admin", "/users", "page=1&size=20&filter=all"],
      url: "/users?page=1&size=20&filter=all",
    });
    expect(DEFAULT_VIEWS.overview[0]).toEqual({ key: ["admin", "/overview"], url: "/overview" });
  });
  it("maps console paths to sections", () => {
    expect(sectionOf("/admin")).toBe("overview");
    expect(sectionOf("/admin/")).toBe("overview");
    expect(sectionOf("/admin/users")).toBe("users");
    expect(sectionOf("/admin/login")).toBeNull();
    expect(sectionOf("/admin/nope")).toBeNull();
  });
});
