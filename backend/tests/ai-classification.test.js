import { test, expect, describe } from "bun:test";
import { routeClassification } from "../src/services/aiService.js";

describe("AI enquiry routing", () => {
  test("high-confidence room booking goes to RESERVATIONS", () => {
    expect(
      routeClassification({
        category: "ROOM_BOOKING",
        confidence: 0.95,
      }),
    ).toBe("RESERVATIONS");
  });

  test("high-confidence wedding enquiry goes to SALES", () => {
    expect(
      routeClassification({
        category: "WEDDING_EVENT",
        confidence: 0.95,
      }),
    ).toBe("SALES");
  });

  test("high-confidence corporate enquiry goes to SALES", () => {
    expect(
      routeClassification({
        category: "CORPORATE_OFFSITE",
        confidence: 0.95,
      }),
    ).toBe("SALES");
  });

  test("complaints always go to GM", () => {
    expect(
      routeClassification({
        category: "COMPLAINT",
        confidence: 0.2,
      }),
    ).toBe("GM");
  });

  test("low-confidence room booking goes to UNSORTED", () => {
    expect(
      routeClassification({
        category: "ROOM_BOOKING",
        confidence: 0.5,
      }),
    ).toBe("UNSORTED");
  });

  test("confidence exactly at 0.75 is accepted", () => {
    expect(
      routeClassification({
        category: "ROOM_BOOKING",
        confidence: 0.75,
      }),
    ).toBe("RESERVATIONS");
  });

  test("general enquiries go to UNSORTED", () => {
    expect(
      routeClassification({
        category: "GENERAL",
        confidence: 0.99,
      }),
    ).toBe("UNSORTED");
  });

  test("unclassified enquiries go to UNSORTED", () => {
    expect(
      routeClassification({
        category: "UNCLASSIFIED",
        confidence: 0.99,
      }),
    ).toBe("UNSORTED");
  });
});
