import { describe, it, expect, beforeEach, vi } from "vitest";
import axios from "axios";

// The shared test setup mocks mapService for route tests. These tests exercise
// the real service logic, so opt out of that mock for this file.
vi.unmock("../services/mapService.js");

import mapService from "../services/mapService.js";

const mockAxios = vi.mocked(axios);

describe("MapService pincode validation resilience", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("accepts a valid-format pincode when the lookup service is unavailable", async () => {
    mockAxios.get.mockRejectedValue(new Error("network unavailable"));

    const result = await mapService.validatePincode("700099");

    expect(result.valid).toBe(true);
    expect(result.message).toMatch(/valid format/i);
  });

  it("does not block when the lookup service fails and the pin resolves to another pincode", async () => {
    mockAxios.get.mockImplementation(async (url: unknown) => {
      const value = String(url);
      if (value.includes("pincodeapi")) {
        throw new Error("rate limited");
      }
      if (value.includes("opencagedata")) {
        return {
          data: {
            results: [
              {
                formatted: "Salt Lake, Kolkata, West Bengal, India",
                components: { postcode: "700091", state: "West Bengal", country: "India" },
              },
            ],
          },
        } as any;
      }
      throw new Error(`Unexpected URL: ${value}`);
    });

    const result = await mapService.validatePincode("757039", [88.4, 22.58]);

    expect(result.valid).toBe(true);
    expect(result.message).toContain("700091");
    expect(result.suggestedPincode).toBe("700091");
  });

  it("creates a review warning when the pin is far from the pincode center", async () => {
    mockAxios.get.mockResolvedValue({
      data: {
        success: true,
        data: {
          post_offices: [
            {
              office_name: "Test",
              pincode: "700001",
              district: "Kolkata",
              state: "West Bengal",
              latitude: 22.5726,
              longitude: 88.3639,
            },
          ],
        },
      },
    } as any);

    const result = await mapService.validatePincode("700001", [88.9, 23.2]);

    expect(result.valid).toBe(true);
    expect(result.message).toMatch(/km from the pincode center/i);
  });

  it("still rejects a malformed pincode", async () => {
    const result = await mapService.validatePincode("123");

    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/6 digits/i);
  });
});
