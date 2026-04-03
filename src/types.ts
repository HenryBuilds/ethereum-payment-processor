// Payment

export interface CreatePaymentRequest {
  amount: string;
  orderId: string;
  currency?: string; // 'ETH' | 'USDT' | 'USDC' | 'DAI' - default: ETH
  merchantId?: string;
}

export interface Payment {
  id: string;
  orderId: string;
  merchantId: string | null;
  address: string;
  privateKey: string;
  amount: string;
  currency: string;
  tokenAddress: string | null;
  status: "pending" | "completed" | "failed" | "expired" | "partial" | "cancelled" | "refunded";
  receivedAmount: string | null;
  txHash: string | null;
  refundTxHash: string | null;
  gasUsed: string | null;
  gasCost: string | null;
  confirmations: number;
  createdAt: Date;
  completedAt: Date | null;
  expiresAt: Date | null;
}

export type SafePayment = Omit<Payment, "privateKey">;

// Merchant

export interface CreateMerchantRequest {
  name: string;
  email?: string;
}

export interface Merchant {
  id: string;
  name: string;
  email: string | null;
  apiKey: string;
  createdAt: Date;
}

// Webhook

export interface RegisterWebhookRequest {
  url: string;
  events: WebhookEvent[];
  merchantId?: string;
}

export type WebhookEvent =
  | "payment.completed"
  | "payment.failed"
  | "payment.expired"
  | "payment.partial"
  | "payment.cancelled"
  | "payment.refunded";

export interface Webhook {
  id: string;
  merchantId: string | null;
  url: string;
  secret: string;
  events: WebhookEvent[];
  active: boolean;
  createdAt: Date;
}

// Analytics

export interface AnalyticsSummary {
  totalPayments: number;
  completedPayments: number;
  failedPayments: number;
  expiredPayments: number;
  pendingPayments: number;
  totalVolumeETH: string;
  totalGasCostETH: string;
  averagePaymentETH: string;
  byStatus: Record<string, number>;
  byCurrency: Record<string, { count: number; volume: string }>;
}

// ERC-20

export interface TokenConfig {
  symbol: string;
  address: string;
  decimals: number;
}

export const SUPPORTED_TOKENS: Record<string, TokenConfig> = {
  USDT: {
    symbol: "USDT",
    address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    decimals: 6,
  },
  USDC: {
    symbol: "USDC",
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    decimals: 6,
  },
  DAI: {
    symbol: "DAI",
    address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    decimals: 18,
  },
};

export const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
];

// Etherscan

export interface EtherscanResponse {
  status: string;
  message: string;
  result: string;
}

// Price

export interface PriceData {
  ethUsd: number;
  updatedAt: Date;
}
