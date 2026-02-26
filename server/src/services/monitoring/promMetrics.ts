type HttpCounterKey = string;
type HttpHistogramKey = string;

const DEFAULT_BUCKETS_SECONDS = [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10] as const;

function escapeLabelValue(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/\"/g, '\\"');
}

function formatLabels(labels: Record<string, string | number>): string {
  const entries = Object.entries(labels)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}="${escapeLabelValue(String(v))}"`);
  return entries.length ? `{${entries.join(",")}}` : "";
}

function nowSeconds(): number {
  return Date.now() / 1000;
}

/**
 * Minimal Prometheus metrics registry.
 *
 * Intentionally avoids adding a new dependency (e.g. prom-client) while still
 * emitting real, non-mock request counters + latency histogram.
 */
class PromMetrics {
  private startedAtSeconds = nowSeconds();
  private httpRequestsTotal = new Map<HttpCounterKey, number>();
  private httpDuration = new Map<
    HttpHistogramKey,
    {
      buckets: number[];
      bucketCounts: number[]; // cumulative counts per bucket (including +Inf stored separately)
      count: number;
      sum: number;
    }
  >();

  public recordHttpRequest(params: {
    method: string;
    path: string;
    status: number;
    durationSeconds: number;
  }): void {
    const method = (params.method || "UNKNOWN").toUpperCase();
    const path = params.path || "unknown";
    const status = params.status || 0;
    const durationSeconds = Math.max(0, params.durationSeconds || 0);

    const counterKey = `${method}||${path}||${status}`;
    this.httpRequestsTotal.set(
      counterKey,
      (this.httpRequestsTotal.get(counterKey) || 0) + 1,
    );

    const histogramKey = `${method}||${path}`;
    let hist = this.httpDuration.get(histogramKey);
    if (!hist) {
      const buckets = [...DEFAULT_BUCKETS_SECONDS];
      hist = {
        buckets,
        bucketCounts: new Array(buckets.length + 1).fill(0), // +1 for +Inf
        count: 0,
        sum: 0,
      };
      this.httpDuration.set(histogramKey, hist);
    }

    // Update histogram.
    hist.count += 1;
    hist.sum += durationSeconds;
    const bucketIndex = hist.buckets.findIndex((b) => durationSeconds <= b);
    const idx = bucketIndex === -1 ? hist.buckets.length : bucketIndex; // +Inf bucket
    hist.bucketCounts[idx] += 1;
  }

  public render(): string {
    const lines: string[] = [];

    // App uptime as a gauge (derived from process start; not reset on scrape).
    lines.push(
      "# HELP presence_process_uptime_seconds Process uptime in seconds",
      "# TYPE presence_process_uptime_seconds gauge",
      `presence_process_uptime_seconds ${Math.max(0, nowSeconds() - this.startedAtSeconds)}`,
      "",
    );

    // HTTP request count.
    lines.push(
      "# HELP http_requests_total Total number of HTTP requests",
      "# TYPE http_requests_total counter",
    );
    for (const [key, value] of this.httpRequestsTotal) {
      const [method, path, status] = key.split("||");
      lines.push(
        `http_requests_total${formatLabels({ method, path, status })} ${value}`,
      );
    }
    lines.push("");

    // HTTP latency histogram.
    lines.push(
      "# HELP http_request_duration_seconds HTTP request latency in seconds",
      "# TYPE http_request_duration_seconds histogram",
    );

    for (const [key, hist] of this.httpDuration) {
      const [method, path] = key.split("||");

      // Convert per-bucket (non-cumulative) counts into cumulative counts.
      let cumulative = 0;
      for (let i = 0; i < hist.buckets.length; i++) {
        cumulative += hist.bucketCounts[i];
        lines.push(
          `http_request_duration_seconds_bucket${formatLabels({ method, path, le: hist.buckets[i] })} ${cumulative}`,
        );
      }
      // +Inf bucket must equal count
      lines.push(
        `http_request_duration_seconds_bucket${formatLabels({ method, path, le: "+Inf" })} ${hist.count}`,
      );
      lines.push(
        `http_request_duration_seconds_sum${formatLabels({ method, path })} ${hist.sum}`,
      );
      lines.push(
        `http_request_duration_seconds_count${formatLabels({ method, path })} ${hist.count}`,
      );
    }

    lines.push("");
    return lines.join("\n");
  }
}

export const promMetrics = new PromMetrics();
