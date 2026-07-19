import {
  createStrategy,
  deleteStrategy,
  findStrategiesByUserId,
  findStrategyForUser,
  updateStrategy,
} from "../../models/strategy.model.js";
import { AppError } from "../../types/api.js";
import { EXCHANGE_OPTIONS } from "../../types/settings.js";
import type {
  CreateStrategyInput,
  StrategyDetail,
  StrategyRecord,
  StrategySummary,
  StrategyTemplate,
  StrategyTimeframe,
  StrategyValidationResult,
  UpdateStrategyInput,
} from "../../types/strategy.js";
import { STRATEGY_TIMEFRAMES } from "../../types/strategy.js";
import { BLANK_STRATEGY_SOURCE } from "./strategyApi.js";
import { findTemplate, STRATEGY_TEMPLATES } from "./templates.js";
import { validateStrategyCode } from "./validateStrategy.js";

function toSummary(strategy: StrategyRecord): StrategySummary {
  return {
    id: strategy.id,
    name: strategy.name,
    description: strategy.description,
    tags: strategy.tags,
    isFavorite: strategy.isFavorite,
    validationStatus: strategy.validationStatus,
    symbols: strategy.symbols,
    timeframe: strategy.timeframe,
    updatedAt: strategy.updatedAt.toISOString(),
  };
}

function toDetail(strategy: StrategyRecord): StrategyDetail {
  return {
    id: strategy.id,
    name: strategy.name,
    description: strategy.description,
    sourceCode: strategy.sourceCode,
    tags: strategy.tags,
    isFavorite: strategy.isFavorite,
    validationStatus: strategy.validationStatus,
    validationMessages: strategy.validationMessages,
    symbols: strategy.symbols,
    exchange: strategy.exchange,
    timeframe: strategy.timeframe,
    startingCapital: strategy.startingCapital,
    params: strategy.params,
    risk: strategy.risk,
    notes: strategy.notes,
    createdAt: strategy.createdAt.toISOString(),
    updatedAt: strategy.updatedAt.toISOString(),
  };
}

function normalizeName(name: string | undefined): string {
  const trimmed = name?.trim() ?? "";
  if (!trimmed || trimmed.length > 80) {
    throw new AppError(
      "Strategy name is required (max 80 characters)",
      400,
      "INVALID_STRATEGY",
    );
  }
  return trimmed;
}

function normalizeTimeframe(value: string | undefined): StrategyTimeframe {
  if (!value) return "1h";
  if (!(STRATEGY_TIMEFRAMES as readonly string[]).includes(value)) {
    throw new AppError("Invalid timeframe", 400, "INVALID_STRATEGY");
  }
  return value as StrategyTimeframe;
}

function normalizeExchange(value: string | null | undefined) {
  if (value == null) return null;
  if (!(EXCHANGE_OPTIONS as readonly string[]).includes(value)) {
    throw new AppError("Invalid exchange", 400, "INVALID_STRATEGY");
  }
  return value as (typeof EXCHANGE_OPTIONS)[number];
}

function uniqueName(base: string, existing: Set<string>): string {
  if (!existing.has(base.toLowerCase())) return base;
  let index = 2;
  while (existing.has(`${base} (${index})`.toLowerCase())) {
    index += 1;
  }
  return `${base} (${index})`;
}

export class StrategyService {
  listTemplates(): StrategyTemplate[] {
    return STRATEGY_TEMPLATES;
  }

  async listStrategies(userId: string): Promise<StrategySummary[]> {
    const strategies = await findStrategiesByUserId(userId);
    return strategies.map(toSummary);
  }

  async getStrategy(userId: string, strategyId: string): Promise<StrategyDetail> {
    const strategy = await findStrategyForUser(strategyId, userId);
    if (!strategy) {
      throw new AppError("Strategy not found", 404, "STRATEGY_NOT_FOUND");
    }
    return toDetail(strategy);
  }

  async createStrategy(
    userId: string,
    input: CreateStrategyInput,
  ): Promise<StrategyDetail> {
    const template = input.templateId ? findTemplate(input.templateId) : undefined;
    if (input.templateId && !template) {
      throw new AppError("Template not found", 404, "TEMPLATE_NOT_FOUND");
    }

    const existing = await findStrategiesByUserId(userId);
    const names = new Set(existing.map((item) => item.name.toLowerCase()));
    const requestedName = normalizeName(input.name ?? template?.name);
    const name = uniqueName(requestedName, names);

    try {
      const strategy = await createStrategy({
        userId,
        name,
        description: (input.description ?? template?.description ?? "").trim(),
        sourceCode: input.sourceCode ?? template?.sourceCode ?? BLANK_STRATEGY_SOURCE,
        tags: input.tags ?? template?.tags ?? ["Custom"],
        symbols: input.symbols ?? template?.symbols ?? ["BTC-USD"],
        exchange: normalizeExchange(input.exchange),
        timeframe: normalizeTimeframe(input.timeframe ?? template?.timeframe),
        startingCapital:
          input.startingCapital !== undefined ? input.startingCapital : 100_000,
        params: input.params ?? template?.params ?? {},
        risk: input.risk ?? template?.risk ?? {},
        notes: input.notes?.trim() ?? "",
      });

      return toDetail(strategy);
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code?: string }).code === "23505"
      ) {
        throw new AppError(
          "A strategy with that name already exists",
          409,
          "STRATEGY_NAME_TAKEN",
        );
      }
      throw error;
    }
  }

  async updateStrategy(
    userId: string,
    strategyId: string,
    input: UpdateStrategyInput,
  ): Promise<StrategyDetail> {
    const existing = await findStrategyForUser(strategyId, userId);
    if (!existing) {
      throw new AppError("Strategy not found", 404, "STRATEGY_NOT_FOUND");
    }

    const codeChanged =
      input.sourceCode !== undefined && input.sourceCode !== existing.sourceCode;
    const paramsChanged =
      input.params !== undefined &&
      JSON.stringify(input.params) !== JSON.stringify(existing.params);

    const updated = await updateStrategy(strategyId, userId, {
      name: input.name !== undefined ? normalizeName(input.name) : undefined,
      description:
        input.description !== undefined ? input.description.trim() : undefined,
      sourceCode: input.sourceCode,
      tags: input.tags,
      isFavorite: input.isFavorite,
      symbols: input.symbols,
      exchange:
        input.exchange !== undefined
          ? normalizeExchange(input.exchange)
          : undefined,
      timeframe:
        input.timeframe !== undefined
          ? normalizeTimeframe(input.timeframe)
          : undefined,
      startingCapital: input.startingCapital,
      params: input.params,
      risk: input.risk,
      notes: input.notes !== undefined ? input.notes.trim() : undefined,
      ...(codeChanged || paramsChanged
        ? {
            validationStatus: "unvalidated" as const,
            validationMessages: [],
          }
        : {}),
    });

    if (!updated) {
      throw new AppError("Strategy not found", 404, "STRATEGY_NOT_FOUND");
    }

    return toDetail(updated);
  }

  async duplicateStrategy(
    userId: string,
    strategyId: string,
  ): Promise<StrategyDetail> {
    const source = await findStrategyForUser(strategyId, userId);
    if (!source) {
      throw new AppError("Strategy not found", 404, "STRATEGY_NOT_FOUND");
    }

    return this.createStrategy(userId, {
      name: `${source.name} Copy`,
      description: source.description,
      sourceCode: source.sourceCode,
      tags: source.tags,
      symbols: source.symbols,
      exchange: source.exchange,
      timeframe: source.timeframe,
      startingCapital: source.startingCapital,
      params: source.params,
      risk: source.risk,
      notes: source.notes,
    });
  }

  async deleteStrategy(userId: string, strategyId: string): Promise<void> {
    const deleted = await deleteStrategy(strategyId, userId);
    if (!deleted) {
      throw new AppError("Strategy not found", 404, "STRATEGY_NOT_FOUND");
    }
  }

  async validateStrategy(
    userId: string,
    strategyId: string,
  ): Promise<StrategyValidationResult & { strategy: StrategyDetail }> {
    const strategy = await findStrategyForUser(strategyId, userId);
    if (!strategy) {
      throw new AppError("Strategy not found", 404, "STRATEGY_NOT_FOUND");
    }

    const result = validateStrategyCode(strategy.sourceCode, strategy.params);
    const updated = await updateStrategy(strategyId, userId, {
      validationStatus: result.status,
      validationMessages: result.messages,
    });

    if (!updated) {
      throw new AppError("Strategy not found", 404, "STRATEGY_NOT_FOUND");
    }

    return {
      ...result,
      strategy: toDetail(updated),
    };
  }
}

export const strategyService = new StrategyService();
