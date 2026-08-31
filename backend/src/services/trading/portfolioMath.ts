import { roundAmount, roundUsd } from "../../utils/decimal.js";

export interface PositionSnapshot {
  quantity: number;
  averageCost: number;
}

export interface BuyFillInput {
  cashBalance: number;
  quantity: number;
  executionPrice: number;
  existingPosition: PositionSnapshot | null;
}

export interface BuyFillResult {
  totalCost: number;
  cashBalance: number;
  quantity: number;
  averageCost: number;
}

export interface SellFillInput {
  cashBalance: number;
  quantity: number;
  executionPrice: number;
  position: PositionSnapshot;
}

export interface SellFillResult {
  proceeds: number;
  realizedPnL: number;
  cashBalance: number;
  remainingQuantity: number;
  shouldDeletePosition: boolean;
}

/** Pure buy-side portfolio math (cash debit, position add/average). */
export function computeBuyFill(input: BuyFillInput): BuyFillResult {
  const totalCost = roundUsd(input.quantity * input.executionPrice);
  const existing = input.existingPosition;
  const newQuantity = roundAmount((existing?.quantity ?? 0) + input.quantity);
  const newAverageCost = existing
    ? roundAmount(
        (existing.quantity * existing.averageCost + totalCost) / newQuantity,
      )
    : roundAmount(input.executionPrice);

  return {
    totalCost,
    cashBalance: roundUsd(input.cashBalance - totalCost),
    quantity: newQuantity,
    averageCost: newAverageCost,
  };
}

/** Pure sell-side portfolio math (cash credit, realized PnL, position reduce). */
export function computeSellFill(input: SellFillInput): SellFillResult {
  const proceeds = roundUsd(input.quantity * input.executionPrice);
  const realizedPnL = roundUsd(
    (input.executionPrice - input.position.averageCost) * input.quantity,
  );
  const remainingQuantity = roundAmount(input.position.quantity - input.quantity);

  return {
    proceeds,
    realizedPnL,
    cashBalance: roundUsd(input.cashBalance + proceeds),
    remainingQuantity,
    shouldDeletePosition: remainingQuantity <= 0,
  };
}

export function hasSufficientCash(cashBalance: number, totalCost: number): boolean {
  return totalCost <= cashBalance;
}

export function hasSufficientPosition(
  position: PositionSnapshot | null,
  quantity: number,
): position is PositionSnapshot {
  return position !== null && position.quantity >= quantity;
}
