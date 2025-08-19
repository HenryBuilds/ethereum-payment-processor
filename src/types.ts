export interface CreatePaymentRequest {
  amount: string; // Amount in ETH
  orderId: string;
}

export interface Payment {
  id: string;
  orderId: string;
  address: string;
  privateKey: string;
  amount: string;
  status: "pending" | "completed" | "failed";
  createdAt: Date;
  completedAt?: Date;
}

export interface EtherscanResponse {
  status: string;
  message: string;
  result: string;
}
