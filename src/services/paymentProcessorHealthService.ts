import { config } from 'dotenv';
import { CachedHealth, HealthStatus } from '../shared/interfaces';
import { redis } from '../database/cache';

config();

const CACHE_KEY = 'processor_health';
const LOCK_KEY = 'health_check_lock';
const LOCK_TTL_SECONDS = 4; // Lock should last less than the check interval

const processorDefaultHost = process.env.PAYMENT_PROCESSOR_DEFAULT_HOST;
const processorFallbackHost = process.env.PAYMENT_PROCESSOR_FALLBACK_HOST;

let localHealthCache: CachedHealth = {
  default: { failing: false, minResponseTime: Infinity },
  fallback: { failing: false, minResponseTime: Infinity },
};

async function checkProcessorHealth(host: string): Promise<HealthStatus> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(`${host}/payments/service-health`, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      return { failing: data.failing, minResponseTime: data.minResponseTime };
    }
  } catch (error) {
    console.log("Health check failed, consider processor down", error);
  }
  return { failing: true, minResponseTime: Infinity };
}

async function updateHealthStatus() {
  const lockAcquired = await redis.set(LOCK_KEY, '1', 'EX', LOCK_TTL_SECONDS, 'NX');

  if (lockAcquired) {
    const [defaultStatus, fallbackStatus] = await Promise.all([
      checkProcessorHealth(processorDefaultHost!),
      checkProcessorHealth(processorFallbackHost!),
    ]);

    const newHealth: CachedHealth = { default: defaultStatus, fallback: fallbackStatus };

    await redis.set(CACHE_KEY, JSON.stringify(newHealth));
    localHealthCache = newHealth;
  } else {
    const cachedHealth = await redis.get(CACHE_KEY);
    if (cachedHealth) {
      localHealthCache = JSON.parse(cachedHealth);
    }
  }
}

export function getBestProcessor(): 'default' | 'fallback' {
  // Get the health status from the updated local cache
  const { default: defaultHealth, fallback: fallbackHealth } = localHealthCache;

  // Rule 1: Handle failing processors first (non-negotiable)
  if (defaultHealth.failing && !fallbackHealth.failing) return 'fallback';
  if (!defaultHealth.failing && fallbackHealth.failing) return 'default';

  // Rule 2: Both are healthy, decide based on profit
  const PROFIT_THRESHOLD = 1.118;
  if (defaultHealth.minResponseTime > fallbackHealth.minResponseTime * PROFIT_THRESHOLD) {
    return 'fallback';
  }

  return 'default';
}

function startHealthChecks() {
  // Use a recursive timeout to prevent overlapping checks
  const healthCheckLoop = async () => {
    try {
      await updateHealthStatus();
    } catch (error) {
      console.error('Health check loop failed:', error);
    } finally {
      setTimeout(healthCheckLoop, 5000);
    }
  };

  healthCheckLoop();
}

startHealthChecks();