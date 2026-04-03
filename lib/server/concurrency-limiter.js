"use strict";

function normalizePositiveInteger(value, fallback) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function createConcurrencyLimiter(limit = 4) {
  const maxConcurrent = normalizePositiveInteger(limit, 4);
  let activeCount = 0;
  const queue = [];

  function drainQueue() {
    while (activeCount < maxConcurrent && queue.length) {
      const next = queue.shift();
      activeCount += 1;

      Promise.resolve()
        .then(next.task)
        .then(next.resolve, next.reject)
        .finally(() => {
          activeCount -= 1;
          drainQueue();
        });
    }
  }

  return {
    run(task) {
      return new Promise((resolve, reject) => {
        queue.push({ task, resolve, reject });
        drainQueue();
      });
    },
  };
}

module.exports = {
  createConcurrencyLimiter,
};
