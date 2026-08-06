import { describe, it, expect, beforeEach, afterEach } from "vitest";

const TEST_KEY = Buffer.alloc(32, 7).toString("base64");

describe("crypto", () => {
  const originalKey = process.env.ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY;
  });

  afterEach(() => {
    process.env.ENCRYPTION_KEY = originalKey;
  });

  it("round-trips plaintext through encrypt/decrypt", async () => {
    const { encrypt, decrypt } = await import("../crypto.js");
    const plaintext = "EAAG-super-secret-access-token";
    const ciphertext = encrypt(plaintext);
    expect(ciphertext).not.toBe(plaintext);
    expect(decrypt(ciphertext)).toBe(plaintext);
  });

  it("produces output prefixed with v1: and isEncrypted recognizes it", async () => {
    const { encrypt, isEncrypted } = await import("../crypto.js");
    const ciphertext = encrypt("hello");
    expect(ciphertext.startsWith("v1:")).toBe(true);
    expect(isEncrypted(ciphertext)).toBe(true);
  });

  it("isEncrypted returns false for plaintext values", async () => {
    const { isEncrypted } = await import("../crypto.js");
    expect(isEncrypted("plain-legacy-token")).toBe(false);
    expect(isEncrypted("")).toBe(false);
  });

  it("produces different ciphertext for the same plaintext (random IV)", async () => {
    const { encrypt } = await import("../crypto.js");
    const a = encrypt("same-value");
    const b = encrypt("same-value");
    expect(a).not.toBe(b);
  });

  it("throws a clear error when ENCRYPTION_KEY is missing", async () => {
    delete process.env.ENCRYPTION_KEY;
    const { encrypt } = await import("../crypto.js");
    expect(() => encrypt("x")).toThrow(/ENCRYPTION_KEY/);
  });

  it("throws a clear error when ENCRYPTION_KEY is the wrong length", async () => {
    process.env.ENCRYPTION_KEY = Buffer.alloc(16, 1).toString("base64");
    const { encrypt } = await import("../crypto.js");
    expect(() => encrypt("x")).toThrow(/32-byte|ENCRYPTION_KEY/);
  });

  it("throws when decrypting a tampered ciphertext (auth tag mismatch)", async () => {
    const { encrypt, decrypt } = await import("../crypto.js");
    const ciphertext = encrypt("secret");
    const tampered = ciphertext.slice(0, -4) + "abcd";
    expect(() => decrypt(tampered)).toThrow();
  });
});
