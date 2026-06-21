import { getRedis } from "@/lib/kv.server";
import { getLockTier } from "@/lib/staking/config";
import { formatDateTime, formatMedusaAmount } from "@/lib/staking/format";
import {
  fetchStakingGlobalStats,
  getStreamflowStakingConnection,
} from "@/lib/staking/streamflow.server";
import type { VerifiedStakeTx } from "@/lib/staking/verifyStakeTx.server";
import { verifyStakeTransaction } from "@/lib/staking/verifyStakeTx.server";
import { getAppBaseUrl, getSolanaExplorerUrl } from "@/lib/passport/config";

const NOTIFY_KEY_PREFIX = "medusa:staking:notify:";
const memoryNotified = new Set<string>();

export interface StakeNotifyRequest {
  signature: string;
  wallet: string;
  tierDays: number;
  amount: string;
}

export interface StakeNotifyResult {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function shortAddress(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export function isTelegramStakeNotifyConfigured(): boolean {
  return Boolean(
    process.env.TELEGRAM_BOT_TOKEN?.trim() &&
      process.env.TELEGRAM_STAKE_CHAT_ID?.trim(),
  );
}

async function claimNotifySlot(signature: string): Promise<boolean> {
  const redis = getRedis();
  const key = `${NOTIFY_KEY_PREFIX}${signature}`;

  if (redis) {
    const inserted = await redis.set(key, "1", { nx: true });
    return inserted === "OK";
  }

  if (memoryNotified.has(signature)) {
    return false;
  }
  memoryNotified.add(signature);
  return true;
}

const DEFAULT_PUBLIC_SITE = "https://www.zkmedusa.com";

function isTelegramSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    return host !== "localhost" && host !== "127.0.0.1" && !host.endsWith(".local");
  } catch {
    return false;
  }
}

/** Telegram inline buttons require public HTTPS URLs (not localhost). */
function resolveTelegramButtonUrl(
  configured: string | undefined,
  fallback: string,
): string {
  const candidate = configured?.trim();
  if (candidate && isTelegramSafeUrl(candidate)) {
    return candidate.replace(/\/$/, "");
  }
  return fallback.replace(/\/$/, "");
}

function getPublicSiteBaseUrl(): string {
  const candidates = [
    process.env.TELEGRAM_LINK_WEBSITE?.trim(),
    getAppBaseUrl(),
    process.env.NEXT_PUBLIC_APP_URL?.trim(),
  ];

  for (const candidate of candidates) {
    if (candidate && isTelegramSafeUrl(candidate)) {
      return candidate.replace(/\/$/, "");
    }
  }

  return DEFAULT_PUBLIC_SITE;
}

function getStakeNotifyLinks(stake: VerifiedStakeTx) {
  const siteBase = getPublicSiteBaseUrl();
  return {
    website: resolveTelegramButtonUrl(
      process.env.TELEGRAM_LINK_WEBSITE?.trim(),
      siteBase,
    ),
    stake: resolveTelegramButtonUrl(
      process.env.TELEGRAM_LINK_STAKE?.trim(),
      `${siteBase}/stake`,
    ),
    x: resolveTelegramButtonUrl(
      process.env.TELEGRAM_LINK_X?.trim(),
      "https://x.com/ZkMedusa",
    ),
    tx: getSolanaExplorerUrl(stake.signature, "tx"),
    wallet: getSolanaExplorerUrl(stake.wallet, "address"),
  };
}

function getStakeNotifyImageUrl(): string {
  const configured = process.env.TELEGRAM_STAKE_IMAGE_URL?.trim();
  if (configured && isTelegramSafeUrl(configured)) {
    return configured;
  }

  return `${getPublicSiteBaseUrl()}/head.webp`;
}

function buildStakeNotifyKeyboard(links: ReturnType<typeof getStakeNotifyLinks>) {
  return {
    inline_keyboard: [
      [
        { text: "X", url: links.x },
        { text: "Stake", url: links.stake },
        { text: "Website", url: links.website },
      ],
    ],
  };
}

function formatStakeNotifyMessage(
  stake: VerifiedStakeTx,
  stats: Awaited<ReturnType<typeof fetchStakingGlobalStats>>,
): string {
  const tier = getLockTier(stake.tierDays);
  const tierLabel = tier?.label ?? `${stake.tierDays} days`;
  const share = tier?.multiplierPercent ?? 0;
  const links = getStakeNotifyLinks(stake);

  const lines = [
    "<b>New stake · $MEDUSA</b>",
    "",
    `Wallet: <a href="${escapeHtml(links.wallet)}">${escapeHtml(shortAddress(stake.wallet))}</a>`,
    `Amount: <b>${escapeHtml(formatMedusaAmount(stake.amount))} $MEDUSA</b>`,
    `Lock: ${escapeHtml(tierLabel)} · ${share}% buyback share`,
    "",
    "<b>Protocol</b>",
    `• Total staked: ${escapeHtml(formatMedusaAmount(stats.totalStakedMedusa))} MEDUSA`,
    `• Active stakers: ${stats.activeStakers.toLocaleString("en-US")}`,
    `• Pending reward pool: ${escapeHtml(formatMedusaAmount(stats.pendingRewardPoolMedusa))} MEDUSA`,
    `• Rewards claimed: ${escapeHtml(formatMedusaAmount(stats.totalRewardsClaimedMedusa))} MEDUSA`,
  ];

  if (stats.nextDripAt) {
    lines.push(`• Next drip: ${escapeHtml(formatDateTime(stats.nextDripAt))}`);
  }

  lines.push(
    "",
    `<a href="${escapeHtml(links.tx)}">View transaction</a>`,
  );

  return lines.join("\n");
}

async function sendTelegramRequest(
  method: "sendMessage" | "sendPhoto",
  payload: Record<string, unknown>,
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_STAKE_CHAT_ID?.trim();

  if (!token || !chatId) {
    throw new Error("Telegram stake notifications are not configured.");
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, ...payload }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Telegram ${method} failed (${response.status}): ${body}`);
  }
}

async function sendTelegramMessage(
  text: string,
  replyMarkup?: { inline_keyboard: Array<Array<{ text: string; url: string }>> },
): Promise<void> {
  await sendTelegramRequest("sendMessage", {
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
}

async function sendTelegramPhoto(
  photoUrl: string,
  caption: string,
  replyMarkup?: { inline_keyboard: Array<Array<{ text: string; url: string }>> },
): Promise<void> {
  await sendTelegramRequest("sendPhoto", {
    photo: photoUrl,
    caption,
    parse_mode: "HTML",
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
}

async function sendStakeTelegramNotification(
  text: string,
  replyMarkup: { inline_keyboard: Array<Array<{ text: string; url: string }>> },
): Promise<void> {
  const photoUrl = getStakeNotifyImageUrl();

  try {
    await sendTelegramPhoto(photoUrl, text, replyMarkup);
  } catch (error) {
    console.error("[telegram/stakeNotify] photo send failed, falling back to text", {
      photoUrl,
      error,
    });
    await sendTelegramMessage(text, replyMarkup);
  }
}

export async function processStakeNotify(
  request: StakeNotifyRequest,
): Promise<StakeNotifyResult> {
  if (!isTelegramStakeNotifyConfigured()) {
    return { ok: true, skipped: true, reason: "telegram_not_configured" };
  }

  const connection = await getStreamflowStakingConnection();
  const verified = await verifyStakeTransaction(connection, request);

  const shouldNotify = await claimNotifySlot(verified.signature);
  if (!shouldNotify) {
    return { ok: true, skipped: true, reason: "already_notified" };
  }

  const stats = await fetchStakingGlobalStats();
  const message = formatStakeNotifyMessage(verified, stats);
  const links = getStakeNotifyLinks(verified);
  const keyboard = buildStakeNotifyKeyboard(links);

  await sendStakeTelegramNotification(message, keyboard);

  return { ok: true };
}
