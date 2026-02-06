# Ethereum Payment Processor

A simple, automated Ethereum payment processor that generates unique wallets for each payment and forwards received ETH to your main address.

## Features

- **HD Wallet Generation** — Unique address for each payment
- **Automatic Monitoring** — Polls Etherscan API for incoming payments
- **Auto-Forward** — Automatically forwards ETH to your main address
- **Gas Optimization** — Calculates optimal gas fees
- **REST API** — Simple endpoints for payment creation and status

## Quick Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
Create a `.env` file:
```bash
MASTER_ADDRESS=0x...                                    # Your main ETH address
RPC_URL=https://ethereum-sepolia.publicnode.com         # For testnet
# RPC_URL=https://mainnet.infura.io/v3/YOUR_PROJECT_ID  # For mainnet
PORT=3000
```

### 3. Get RPC Access (Free)

**Infura** (Recommended)
- Sign up at [infura.io](https://infura.io), create a project, and use `https://mainnet.infura.io/v3/YOUR_PROJECT_ID`

**Alchemy**
- Sign up at [alchemy.com](https://alchemy.com), create an app, and use `https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY`

**Public RPC** (No signup required)
- `https://ethereum.publicnode.com`
- `https://rpc.ankr.com/eth`

### 4. Start the Server
```bash
# Development
npm run dev

# Production
npm run build && npm start
```

## API Usage

### Create Payment
```bash
curl -X POST http://localhost:3000/payment/create \
  -H "Content-Type: application/json" \
  -d '{
    "amount": "0.1",
    "orderId": "ORDER_123"
  }'
```

Response:
```json
{
  "success": true,
  "data": {
    "paymentId": "uuid-here",
    "address": "0x...",
    "amount": "0.1"
  }
}
```

### Check Payment Status
```bash
curl http://localhost:3000/payment/{paymentId}/status
```

### List All Payments
```bash
curl http://localhost:3000/payments
```

## How It Works

1. **Payment Creation** — Generates a new HD wallet
2. **Customer Payment** — Customer sends ETH to the generated address
3. **Monitoring** — System polls Etherscan API every 30 seconds
4. **Auto-Forward** — Once payment is detected, forwards ETH to your main address
5. **Completion** — Payment status updated to `completed`

## Important Notes

- Keep your `MASTER_ADDRESS` private key secure
- The system only needs your receiving address, not private keys
- Each payment wallet's private key is generated and stored temporarily
- Use testnet for development and testing
- Monitor gas prices for cost optimization

## Tech Stack

- **Node.js** + **TypeScript**
- **Express.js** — REST API
- **ethers.js** — Ethereum interaction
- **winston** — Structured logging
- **Etherscan API** — Balance monitoring
