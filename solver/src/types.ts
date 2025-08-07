export interface NetworkConfig {
  name: string;
  rpcUrl: string;
  chainId: number;
  bridgeAddress: string;
  explorer: string;
}

export interface Intent {
  intentId: string;
  user: string;
  tokenA: string;
  tokenB: string;
  amountA: bigint;
  expectedAmountB: bigint;
  reward: bigint;
  endTime: bigint;
  completed: boolean;
  winningSolver: string;
  deposited: boolean;
}

export interface RecipientInfo {
  success: boolean;
  intentId: string;
  recipients: string[];
  amounts: string[];
  timestamp: number;
  chainId: number;
  totalAmount: string;
}

export interface BidInfo {
  amount: bigint;
  bidder: string;
}

export interface SolverConfig {
  minProfitMargin: number;
  maxBidAmount: bigint;
  bidIncrement: bigint;
  balanceBuffer: number;
}

export interface RelayerResponse {
  success: boolean;
  transactionHash?: string;
  blockNumber?: number;
  network?: string;
  chainId?: number;
  intentId?: string;
  chain2IntentId?: string;
  solverAddress?: string;
  error?: string;
  message?: string;
} 