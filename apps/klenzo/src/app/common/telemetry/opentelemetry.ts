import { NodeSDK } from '@opentelemetry/sdk-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { ConsoleSpanExporter, BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { PrismaInstrumentation } from '@prisma/instrumentation';
import { RedisInstrumentation } from '@opentelemetry/instrumentation-redis';
import { GraphQLInstrumentation } from '@opentelemetry/instrumentation-graphql';

/**
 * OpenTelemetry setup for distributed tracing.
 * Traces requests across HTTP, gRPC, database, and Redis.
 *
 * Environment variables:
 * - OTEL_EXPORTER_TYPE: 'jaeger' | 'otlp' | 'console'
 * - OTEL_ENDPOINT: Exporter endpoint URL
 * - SERVICE_NAME: Service name for traces
 */
export function initTelemetry() {
  const serviceName = process.env.SERVICE_NAME || 'klenzo-backend';
  const serviceVersion = process.env.SERVICE_VERSION || '1.0.0';

  const resource = new Resource({
    [ATTR_SERVICE_NAME]: serviceName,
    [ATTR_SERVICE_VERSION]: serviceVersion,
  });

  // Choose exporter based on environment
  const exporterType = process.env.OTEL_EXPORTER_TYPE || 'console';

  let exporter;
  switch (exporterType) {
    case 'jaeger':
      exporter = new JaegerExporter({
        endpoint:
          process.env.OTEL_ENDPOINT || 'http://localhost:14268/api/traces',
      });
      break;
    case 'otlp':
      exporter = new OTLPTraceExporter({
        url:
          process.env.OTEL_ENDPOINT ||
          'http://localhost:4318/v1/traces',
      });
      break;
    default:
      exporter = new ConsoleSpanExporter();
  }

  const sdk = new NodeSDK({
    resource,
    spanProcessor: new BatchSpanProcessor(exporter),
    instrumentations: [
      new HttpInstrumentation(),
      new ExpressInstrumentation(),
      new RedisInstrumentation(),
      new PrismaInstrumentation(),
    ],
  });

  // Only start if not already started
  try {
    sdk.start();
    console.log(
      JSON.stringify({
        event: 'opentelemetry_started',
        serviceName,
        exporterType,
        timestamp: new Date().toISOString(),
      }),
    );
  } catch (err) {
    console.warn(
      JSON.stringify({
        event: 'opentelemetry_start_failed',
        error: (err as Error).message,
        timestamp: new Date().toISOString(),
      }),
    );
  }

  // Graceful shutdown
  process.on('SIGTERM', () => {
    sdk.shutdown();
  });

  return sdk;
}
