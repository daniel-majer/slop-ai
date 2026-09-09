import { useTestApp } from "./setup.js";

describe("AppModule (e2e)", () => {
  const t = useTestApp();

  it("sets helmet security headers like the real server", async () => {
    const res = await t.app.inject({ method: "GET", url: "/api/health/live" });

    expect(res.statusCode).toBe(200);
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBeDefined();
  });
});
