import axios from "axios";
import logger from "./logger";
import { PriceData } from "./types";

let cachedPrice: PriceData | null = null;
const CACHE_TTL_MS = 60_000; // 1 minute

export async function getEthPrice(): Promise<PriceData> {
  if (cachedPrice && Date.now() - cachedPrice.updatedAt.getTime() < CACHE_TTL_MS) {
    return cachedPrice;
  }

  try {
    const response = await axios.get(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
      { timeout: 10000 }
    );

    cachedPrice = {
      ethUsd: response.data.ethereum.usd,
      updatedAt: new Date(),
    };

    logger.debug("ETH price updated", { price: cachedPrice.ethUsd });
    return cachedPrice;
  } catch (error) {
    logger.error("Failed to fetch ETH price", {
      error: error instanceof Error ? error.message : error,
    });

    if (cachedPrice) {
      logger.warn("Using stale ETH price");
      return cachedPrice;
    }

    throw new Error("Unable to fetch ETH price and no cached data available");
  }
}

export function ethToUsd(ethAmount: number, ethPrice: number): string {
  return (ethAmount * ethPrice).toFixed(2);
}

export function usdToEth(usdAmount: number, ethPrice: number): string {
  return (usdAmount / ethPrice).toFixed(18);
}
