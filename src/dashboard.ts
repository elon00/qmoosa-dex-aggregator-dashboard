import {
  DexAggregatorClient,
  AggregatedRouteQuote,
  SwapExecutionResult,
  PoolLiquidity
} from "@qmoosa/dex-aggregator-sdk";

export interface TelemetryRecord {
  txId: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  actualAmountOut: string;
  priceImpactBps: string;
  pathsUsed: number;
  timestamp: number;
}

export type SlippageRiskLevel = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

export interface DashboardView {
  totalPoolsTracked: number;
  totalSwapsExecuted: number;
  activeLiquidityDepthUsd: string;
  recentTelemetry: TelemetryRecord[];
}

export class DexAggregatorDashboard {
  private readonly client: DexAggregatorClient;
  private readonly telemetryStore: TelemetryRecord[] = [];

  constructor(client: DexAggregatorClient) {
    this.client = client;
  }

  public getClient(): DexAggregatorClient {
    return this.client;
  }

  public getSlippageRisk(priceImpactBps: bigint): SlippageRiskLevel {
    if (priceImpactBps < 50n) return "LOW";
    if (priceImpactBps < 200n) return "MODERATE";
    if (priceImpactBps < 500n) return "HIGH";
    return "CRITICAL";
  }

  public renderRouteDiagram(quote: AggregatedRouteQuote): string {
    const lines: string[] = [];
    lines.push(`ROUTE: [${quote.tokenIn}] ---> [${quote.tokenOut}]`);
    lines.push(`Total Input: ${quote.totalAmountIn} | Expected Output: ${quote.totalExpectedAmountOut}`);
    lines.push(`Min Guaranteed Output: ${quote.minAmountOut} (Slippage: ${Number(quote.slippageToleranceBps) / 100}%)`);
    lines.push(`Price Impact: ${Number(quote.priceImpactBps) / 100}% [Risk: ${this.getSlippageRisk(quote.priceImpactBps)}]`);
    lines.push(`Paths (${quote.paths.length}):`);

    for (let i = 0; i < quote.paths.length; i++) {
      const p = quote.paths[i];
      const pct = (Number(p.percentBps) / 100).toFixed(1);
      const hopStr = p.hops.map(h => `${h.dexName}(${h.tokenIn}->${h.tokenOut})`).join(" => ");
      lines.push(`  Path ${i + 1} [${pct}%]: ${hopStr} -> yields ${p.expectedAmountOut}`);
    }

    return lines.join("\n");
  }

  public async executeTrade(
    quote: AggregatedRouteQuote,
    recipient: string
  ): Promise<SwapExecutionResult> {
    const result = await this.client.executeSwap(quote, recipient);

    this.telemetryStore.push({
      txId: result.txId,
      tokenIn: result.tokenIn,
      tokenOut: result.tokenOut,
      amountIn: result.amountIn.toString(),
      actualAmountOut: result.actualAmountOut.toString(),
      priceImpactBps: result.priceImpactBps.toString(),
      pathsUsed: result.pathsUsed,
      timestamp: result.timestamp
    });

    return result;
  }

  public getTelemetry(limit: number = 50): TelemetryRecord[] {
    return this.telemetryStore.slice(-limit).reverse();
  }

  public getDashboardOverview(): DashboardView {
    const allPools = this.client.getAllPools();
    return {
      totalPoolsTracked: allPools.length,
      totalSwapsExecuted: this.telemetryStore.length,
      activeLiquidityDepthUsd: `${allPools.length * 1_000_000}`,
      recentTelemetry: this.getTelemetry(5)
    };
  }
}
