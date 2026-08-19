import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { encrypt } from "@torup/shared";

const TEST_KEY = Buffer.alloc(32, 5).toString("base64");

const singleMock = vi.fn();
const eqMock = vi.fn(() => ({ single: singleMock }));
const selectMock = vi.fn(() => ({ eq: eqMock }));
const fromMock = vi.fn(() => ({ select: selectMock }));

vi.mock("@torup/db", () => ({
  createClient: () => ({ from: fromMock }),
}));

describe("getCredentialByBusinessId", () => {
  const originalKey = process.env.ENCRYPTION_KEY;
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY;
    vi.clearAllMocks();
  });
  afterEach(() => {
    process.env.ENCRYPTION_KEY = originalKey;
  });

  it("decrypts access_token, app_secret, verify_token for an active row", async () => {
    singleMock.mockResolvedValue({
      data: {
        business_id: "b1",
        phone_number_id: "pn1",
        access_token: encrypt("tok"),
        app_secret: encrypt("secret"),
        verify_token: encrypt("verify"),
        is_active: true,
      },
      error: null,
    });

    const { getCredentialByBusinessId } = await import("../credentials.js");
    const cred = await getCredentialByBusinessId("b1");

    expect(cred).toEqual({
      businessId: "b1",
      phoneNumberId: "pn1",
      accessToken: "tok",
      appSecret: "secret",
      verifyToken: "verify",
    });
    expect(eqMock).toHaveBeenCalledWith("business_id", "b1");
  });

  it("returns null when no row exists", async () => {
    singleMock.mockResolvedValue({ data: null, error: { message: "not found" } });
    const { getCredentialByBusinessId } = await import("../credentials.js");
    expect(await getCredentialByBusinessId("missing")).toBeNull();
  });

  it("returns null when the row is inactive", async () => {
    singleMock.mockResolvedValue({
      data: {
        business_id: "b1",
        phone_number_id: "pn1",
        access_token: encrypt("tok"),
        app_secret: encrypt("secret"),
        verify_token: encrypt("verify"),
        is_active: false,
      },
      error: null,
    });
    const { getCredentialByBusinessId } = await import("../credentials.js");
    expect(await getCredentialByBusinessId("b1")).toBeNull();
  });

  it("tolerates legacy plaintext access_token", async () => {
    singleMock.mockResolvedValue({
      data: {
        business_id: "b1",
        phone_number_id: "pn1",
        access_token: "legacy-plaintext",
        app_secret: encrypt("secret"),
        verify_token: encrypt("verify"),
        is_active: true,
      },
      error: null,
    });
    const { getCredentialByBusinessId } = await import("../credentials.js");
    const cred = await getCredentialByBusinessId("b1");
    expect(cred?.accessToken).toBe("legacy-plaintext");
  });
});
