"use strict";

function normalizePositiveInteger(value, fallback) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function hasCachedValue(entry) {
  return Boolean(entry) && Object.prototype.hasOwnProperty.call(entry, "value");
}

function createAsyncResultCache({
  ttlMs = 60 * 1000,
  staleTtlMs = ttlMs,
  maxEntries = 200,
} = {}) {
  const cacheTtlMs = normalizePositiveInteger(ttlMs, 60 * 1000);
  const staleWindowMs = Math.max(
    cacheTtlMs,
    normalizePositiveInteger(staleTtlMs, cacheTtlMs),
  );
  const maxCacheEntries = normalizePositiveInteger(maxEntries, 200);
  const entries = new Map();

  function isFresh(entry, now) {
    return hasCachedValue(entry) && now - entry.storedAt <= cacheTtlMs;
  }

  function canServeStale(entry, now) {
    return hasCachedValue(entry) && now - entry.storedAt <= staleWindowMs;
  }

  function prune(now = Date.now()) {
    for (const [key, entry] of entries.entries()) {
      if (!entry.promise && !canServeStale(entry, now)) {
        entries.delete(key);
      }
    }

    if (entries.size <= maxCacheEntries) {
      return;
    }

    const evictableKeys = Array.from(entries.entries())
      .filter(([, entry]) => !entry.promise)
      .sort((left, right) => left[1].lastAccessedAt - right[1].lastAccessedAt)
      .map(([key]) => key);

    while (entries.size > maxCacheEntries && evictableKeys.length) {
      entries.delete(evictableKeys.shift());
    }
  }

  async function getOrLoad(key, load, { allowStaleOnError = true } = {}) {
    const now = Date.now();
    prune(now);

    const existing = entries.get(key);
    if (existing) {
      existing.lastAccessedAt = now;

      if (isFresh(existing, now)) {
        return existing.value;
      }

      if (existing.promise) {
        return existing.promise;
      }
    }

    const staleEntry = existing && canServeStale(existing, now) ? existing : null;

    const promise = Promise.resolve()
      .then(load)
      .then((value) => {
        entries.set(key, {
          value,
          storedAt: Date.now(),
          lastAccessedAt: Date.now(),
        });
        prune();
        return value;
      })
      .catch((error) => {
        if (allowStaleOnError && staleEntry) {
          entries.set(key, {
            value: staleEntry.value,
            storedAt: staleEntry.storedAt,
            lastAccessedAt: Date.now(),
          });
          return staleEntry.value;
        }

        const current = entries.get(key);
        if (current?.promise === promise) {
          if (hasCachedValue(current)) {
            entries.set(key, {
              value: current.value,
              storedAt: current.storedAt,
              lastAccessedAt: Date.now(),
            });
          } else {
            entries.delete(key);
          }
        }

        throw error;
      });

    entries.set(key, {
      ...(staleEntry && hasCachedValue(staleEntry)
        ? {
            value: staleEntry.value,
            storedAt: staleEntry.storedAt,
          }
        : {}),
      promise,
      lastAccessedAt: now,
    });

    return promise;
  }

  return {
    getOrLoad,
    clear() {
      entries.clear();
    },
  };
}

module.exports = {
  createAsyncResultCache,
};
