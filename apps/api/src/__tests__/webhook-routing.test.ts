import { describe, it, expect } from "vitest";
import { extractPhoneNumberId } from "../routes/webhooks";

describe("extractPhoneNumberId", () => {
  it("reads metadata.phone_number_id from a WhatsApp payload", () => {
    const body = {
      entry: [{ changes: [{ value: { metadata: { phone_number_id: "PN999" }, messages: [] } }] }],
    };
    expect(extractPhoneNumberId(body)).toBe("PN999");
  });

  it("returns null when absent", () => {
    expect(extractPhoneNumberId({})).toBeNull();
    expect(extractPhoneNumberId({ entry: [{ changes: [{ value: {} }] }] })).toBeNull();
  });
});
