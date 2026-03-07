import { extractBusinessDomain, splitName } from "@/lib/crm";

describe("extractBusinessDomain", () => {
  it("returns domain for business emails", () => {
    expect(extractBusinessDomain("jane@acmecorp.com")).toBe("acmecorp.com");
  });
  it("returns null for gmail", () => {
    expect(extractBusinessDomain("jane@gmail.com")).toBeNull();
  });
  it("returns null for icloud", () => {
    expect(extractBusinessDomain("jane@icloud.com")).toBeNull();
  });
  it("returns null for malformed email", () => {
    expect(extractBusinessDomain("notanemail")).toBeNull();
  });
  it("lowercases the domain", () => {
    expect(extractBusinessDomain("Jane@AcmeCorp.COM")).toBe("acmecorp.com");
  });
});

describe("splitName", () => {
  it("splits first and last name", () => {
    expect(splitName("Jane Smith")).toEqual({ first: "Jane", last: "Smith" });
  });
  it("handles single name", () => {
    expect(splitName("Jane")).toEqual({ first: "Jane", last: null });
  });
  it("handles multi-word first name", () => {
    expect(splitName("Mary Jo Smith")).toEqual({ first: "Mary Jo", last: "Smith" });
  });
  it("trims whitespace", () => {
    expect(splitName("  Jane  Smith  ")).toEqual({ first: "Jane", last: "Smith" });
  });
});
