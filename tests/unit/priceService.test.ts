import { describe, it, expect, vi, beforeEach } from "vitest";
import { ethToUsd, usdToEth } from "../../src/priceService";

describe("priceService", () => {
  describe("ethToUsd", () => {
    it("converts ETH to USD correctly", () => {
      expect(ethToUsd(1, 2000)).toBe("2000.00");
      expect(ethToUsd(0.5, 3000)).toBe("1500.00");
      expect(ethToUsd(0, 2000)).toBe("0.00");
    });

    it("handles small amounts", () => {
      expect(ethToUsd(0.001, 2000)).toBe("2.00");
    });
  });

  describe("usdToEth", () => {
    it("converts USD to ETH correctly", () => {
      expect(parseFloat(usdToEth(2000, 2000))).toBeCloseTo(1, 10);
      expect(parseFloat(usdToEth(100, 2000))).toBeCloseTo(0.05, 10);
    });

    it("handles small amounts", () => {
      const result = parseFloat(usdToEth(1, 2000));
      expect(result).toBeCloseTo(0.0005, 6);
    });
  });
});
