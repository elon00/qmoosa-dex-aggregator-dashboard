import { test } from "node:test";
import assert from "node:assert/strict";
import { DexAggregatorEngine } from "@qmoosa/dex-aggregator-engine";
import { DexAggregatorClient, generateKeyPair } from "@qmoosa/dex-aggregator-sdk";
import { DexAggregatorDashboard } from "../dist/index.js";

function setupDashboard() {
  const { publicKey } = generateKeyPair();
  const engine = new DexAggregatorEngine(publicKey, 31337);

  engine.registerPoolDirect({
    id: "pool_qmoosa_usdc_weth",
    dexName: "QmoosaAMM",
    tokenIn: "USDC",
    tokenOut: "WETH",
    reserveIn: 1_000_000n * 10n ** 6n,
    reserveOut: 500n * 10n ** 18n,
    feeBps: 30n
  });

  engine.registerPoolDirect({
    id: "pool_sushi_usdc_weth",
    dexName: "Sushiswap",
    tokenIn: "USDC",
    tokenOut: "WETH",
    reserveIn: 1_000_000n * 10n ** 6n,
    reserveOut: 500n * 10n ** 18n,
    feeBps: 30n
  });

  const client = new DexAggregatorClient(engine);
  const dashboard = new DexAggregatorDashboard(client);

  return { dashboard, client, engine };
}

test("1. Route diagram formatting with split percentage visualization", () => {
  const { dashboard, client } = setupDashboard();
  const quote = client.getBestRoute("USDC", "WETH", 50_000n * 10n ** 6n);

  const diagram = dashboard.renderRouteDiagram(quote);
  assert.ok(diagram.includes("ROUTE: [USDC] ---> [WETH]"));
  assert.ok(diagram.includes("Paths ("));
  assert.ok(diagram.includes("yields"));
});

test("2. Slippage risk classification metrics", () => {
  const { dashboard } = setupDashboard();

  assert.equal(dashboard.getSlippageRisk(10n), "LOW");
  assert.equal(dashboard.getSlippageRisk(120n), "MODERATE");
  assert.equal(dashboard.getSlippageRisk(350n), "HIGH");
  assert.equal(dashboard.getSlippageRisk(900n), "CRITICAL");
});

test("3. Trade execution records live telemetry and updates dashboard view", async () => {
  const { dashboard, client } = setupDashboard();
  const quote = client.getBestRoute("USDC", "WETH", 10_000n * 10n ** 6n);

  const receipt = await dashboard.executeTrade(quote, "0xDashboardTrader");
  assert.equal(receipt.success, true);

  const telemetry = dashboard.getTelemetry();
  assert.equal(telemetry.length, 1);
  assert.equal(telemetry[0].tokenIn, "USDC");
  assert.equal(telemetry[0].tokenOut, "WETH");
  assert.equal(telemetry[0].txId, receipt.txId);

  const overview = dashboard.getDashboardOverview();
  assert.equal(overview.totalPoolsTracked, 2);
  assert.equal(overview.totalSwapsExecuted, 1);
});
