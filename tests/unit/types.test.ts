import { describe, it, expect } from "vitest";
import { SUPPORTED_TOKENS, ERC20_ABI } from "../../src/types";

describe("types", () => {
  describe("SUPPORTED_TOKENS", () => {
    it("contains USDT with correct address", () => {
      expect(SUPPORTED_TOKENS.USDT).toBeDefined();
      expect(SUPPORTED_TOKENS.USDT.address).toMatch(/^0x/);
      expect(SUPPORTED_TOKENS.USDT.decimals).toBe(6);
      expect(SUPPORTED_TOKENS.USDT.symbol).toBe("USDT");
    });

    it("contains USDC with correct address", () => {
      expect(SUPPORTED_TOKENS.USDC).toBeDefined();
      expect(SUPPORTED_TOKENS.USDC.address).toMatch(/^0x/);
      expect(SUPPORTED_TOKENS.USDC.decimals).toBe(6);
    });

    it("contains DAI with 18 decimals", () => {
      expect(SUPPORTED_TOKENS.DAI).toBeDefined();
      expect(SUPPORTED_TOKENS.DAI.decimals).toBe(18);
    });

    it("does not contain unsupported tokens", () => {
      expect((SUPPORTED_TOKENS as any).BTC).toBeUndefined();
      expect((SUPPORTED_TOKENS as any).SOL).toBeUndefined();
    });
  });

  describe("ERC20_ABI", () => {
    it("contains balanceOf function", () => {
      expect(ERC20_ABI.some((fn) => fn.includes("balanceOf"))).toBe(true);
    });

    it("contains transfer function", () => {
      expect(ERC20_ABI.some((fn) => fn.includes("transfer"))).toBe(true);
    });

    it("contains decimals function", () => {
      expect(ERC20_ABI.some((fn) => fn.includes("decimals"))).toBe(true);
    });
  });
});
