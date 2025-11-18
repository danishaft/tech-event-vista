/**
 * Performance Monitoring & Tracing
 * Tracks request latency, database queries, cache hits/misses, and identifies bottlenecks
 */

interface PerformanceMetric {
  operation: string
  duration: number
  timestamp: number
  metadata?: Record<string, any>
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = []
  private enabled: boolean = process.env.NODE_ENV === 'development' || process.env.ENABLE_PERFORMANCE_LOGGING === 'true'

  start(operation: string): () => void {
    if (!this.enabled) return () => {}
    
    const startTime = performance.now()
    const timestamp = Date.now()
    
    return () => {
      const duration = performance.now() - startTime
      this.record(operation, duration, timestamp)
      
      // Log slow operations immediately
      if (duration > 100) {
        console.warn(`⚠️ [PERF] Slow operation: ${operation} took ${duration.toFixed(2)}ms`)
      }
    }
  }

  record(operation: string, duration: number, timestamp: number, metadata?: Record<string, any>) {
    this.metrics.push({ operation, duration, timestamp, metadata })
    
    // Keep only last 1000 metrics
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000)
    }
  }

  getMetrics(operation?: string): PerformanceMetric[] {
    if (operation) {
      return this.metrics.filter(m => m.operation === operation)
    }
    return [...this.metrics]
  }

  getStats(operation?: string): {
    count: number
    avg: number
    min: number
    max: number
    p95: number
    p99: number
  } {
    const metrics = operation 
      ? this.metrics.filter(m => m.operation === operation)
      : this.metrics
    
    if (metrics.length === 0) {
      return { count: 0, avg: 0, min: 0, max: 0, p95: 0, p99: 0 }
    }

    const durations = metrics.map(m => m.duration).sort((a, b) => a - b)
    const sum = durations.reduce((a, b) => a + b, 0)
    const avg = sum / durations.length
    const min = durations[0]
    const max = durations[durations.length - 1]
    const p95 = durations[Math.floor(durations.length * 0.95)]
    const p99 = durations[Math.floor(durations.length * 0.99)]

    return { count: metrics.length, avg, min, max, p95, p99 }
  }

  clear() {
    this.metrics = []
  }

  logSummary() {
    if (!this.enabled) return
    
    const stats = this.getStats()
    const operations = [...new Set(this.metrics.map(m => m.operation))]
    
    console.log('\n📊 Performance Summary:')
    console.log(`Total operations: ${stats.count}`)
    console.log(`Average: ${stats.avg.toFixed(2)}ms`)
    console.log(`P95: ${stats.p95.toFixed(2)}ms`)
    console.log(`P99: ${stats.p99.toFixed(2)}ms`)
    
    console.log('\nTop operations by average time:')
    operations.forEach(op => {
      const opStats = this.getStats(op)
      if (opStats.count > 0) {
        console.log(`  ${op}: ${opStats.avg.toFixed(2)}ms (${opStats.count} calls, P95: ${opStats.p95.toFixed(2)}ms)`)
      }
    })
  }
}

export const performanceMonitor = new PerformanceMonitor()

/**
 * Performance tracing decorator for async functions
 */
export function trace<T extends (...args: any[]) => Promise<any>>(
  operation: string,
  fn: T
): T {
  return (async (...args: any[]) => {
    const end = performanceMonitor.start(operation)
    try {
      const result = await fn(...args)
      return result
    } finally {
      end()
    }
  }) as T
}

/**
 * Create a performance trace for a request
 */
export function createRequestTrace(requestId: string) {
  const traces: Array<{ operation: string; duration: number }> = []
  const startTime = performance.now()

  return {
    trace: (operation: string) => {
      const operationStart = performance.now()
      const end = performanceMonitor.start(`${requestId}:${operation}`)
      return () => {
        const duration = performance.now() - operationStart
        end()
        traces.push({ operation, duration })
      }
    },
    getSummary: () => {
      const totalDuration = performance.now() - startTime
      return {
        requestId,
        totalDuration,
        traces,
        summary: traces.reduce((acc, t) => {
          acc[t.operation] = (acc[t.operation] || 0) + t.duration
          return acc
        }, {} as Record<string, number>)
      }
    }
  }
}

