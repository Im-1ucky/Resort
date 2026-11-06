import { describe, test, expect } from "bun:test";
import {
  validateClassification,
  validateReply,
} from "../src/services/aiService.js";

const validClassification = {
  category: "ROOM_BOOKING",
  confidence: 0.95,
  summary: "Guest is asking about room availability.",
  extractedData: {
    checkIn: "2027-01-10",
    checkOut: "2027-01-12",
    guestCount: 4,
    roomCount: 2,
    budget: 15000,
    eventType: null,
    eventDate: null,
  },
};

describe("AI classification validation", () => {
  test("accepts valid classification", () => {
    expect(validateClassification(validClassification).success).toBe(true);
  });

  test("rejects invalid category", () => {
    expect(
      validateClassification({
        ...validClassification,
        category: "HOTEL",
      }).success,
    ).toBe(false);
  });

  test("rejects confidence above 1", () => {
    expect(
      validateClassification({
        ...validClassification,
        confidence: 1.5,
      }).success,
    ).toBe(false);
  });

  test("rejects negative guest count", () => {
    expect(
      validateClassification({
        ...validClassification,
        extractedData: {
          ...validClassification.extractedData,
          guestCount: -2,
        },
      }).success,
    ).toBe(false);
  });

  test("rejects missing extracted fields", () => {
    const invalid = structuredClone(validClassification);
    delete invalid.extractedData.checkIn;

    expect(validateClassification(invalid).success).toBe(false);
  });
});

describe("AI reply validation", () => {
  test("accepts valid reply", () => {
    expect(validateReply({ draft: "Thank you for contacting us." }).success)
      .toBe(true);
  });

  test("rejects empty reply", () => {
    expect(validateReply({ draft: "" }).success).toBe(false);
  });

  test("rejects missing draft", () => {
    expect(validateReply({}).success).toBe(false);
  });

  test("rejects whitespace-only reply", () => {
    expect(validateReply({ draft: "   " }).success).toBe(false);
  });
});
