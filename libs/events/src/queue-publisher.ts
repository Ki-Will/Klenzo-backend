/**
 * Typed queue publisher utilities for Cloudflare Queues.
 * Uses the `Queue` interface from @cloudflare/workers-types.
 *
 * Import the full QueueMessage union from @klenzo/contracts when needed.
 * This module keeps its own send helpers to avoid circular dependencies.
 */

import type { DomainEvent } from './domain-events';

// ─── Minimal type re-imports ──────────────────────────────────────────────
// Consumers should import QueueMessage union from @klenzo/contracts.
// Here we accept `unknown` typed bodies and rely on the Queue API being generic.

/** Options for a single send */
export interface QueueSendOptions {
  delaySeconds?: number;
}

/** Options applied to all messages in a batch */
export interface QueueSendBatchOptions {
  delaySeconds?: number;
}

/**
 * Minimal Cloudflare Queue interface used by this module.
 * Compatible with the @cloudflare/workers-types Queue<Body> definition.
 */
export interface TypedQueue<T = unknown> {
  send(message: T, options?: QueueSendOptions): Promise<void>;
  sendBatch(
    messages: Iterable<MessageSendRequest<T>>,
    options?: QueueSendBatchOptions,
  ): Promise<void>;
}

export interface MessageSendRequest<T> {
  body: T;
  delaySeconds?: number;
}

// ─── Generic publisher ─────────────────────────────────────────────────────

/**
 * Publish a single typed queue message.
 *
 * @param queue   The Cloudflare Queue binding from the Worker env.
 * @param message A strongly-typed message body.
 * @param options Optional Queue send options (e.g. delaySeconds).
 *
 * @example
 * const job: PushNotificationJob = { type: 'NOTIFICATION_PUSH', ... }
 * await publishToQueue(env.NOTIFICATION_QUEUE, job)
 */
export async function publishToQueue<T>(
  queue: TypedQueue<T>,
  message: T,
  options?: QueueSendOptions,
): Promise<void> {
  await queue.send(message, options);
}

/**
 * Publish multiple messages in a single Queues batch call.
 * More efficient than looping publishToQueue for high-volume scenarios.
 */
export async function publishBatchToQueue<T>(
  queue: TypedQueue<T>,
  messages: T[],
  delaySeconds?: number,
): Promise<void> {
  if (messages.length === 0) return;
  await queue.sendBatch(
    messages.map((body) => ({
      body,
      ...(delaySeconds !== undefined && { delaySeconds }),
    })),
  );
}

// ─── Domain event publisher ─────────────────────────────────────────────────

/**
 * Publish a typed domain event to a queue.
 * Events are published as-is; the event's `type` field acts as the discriminator
 * so consumers can use a switch/match on `message.type`.
 */
export async function publishDomainEvent(
  queue: TypedQueue<DomainEvent>,
  event: DomainEvent,
  options?: QueueSendOptions,
): Promise<void> {
  await queue.send(event, options);
}

/**
 * Publish a batch of domain events.
 */
export async function publishDomainEvents(
  queue: TypedQueue<DomainEvent>,
  events: DomainEvent[],
  delaySeconds?: number,
): Promise<void> {
  await publishBatchToQueue(queue, events, delaySeconds);
}

// ─── Factory: create a scoped publisher ────────────────────────────────────

/**
 * Create a scoped publisher bound to a specific queue.
 * Useful when you want to pass the publisher to a service layer
 * without exposing the raw Queue binding.
 */
export function createQueuePublisher<T>(queue: TypedQueue<T>) {
  return {
    send: (message: T, options?: QueueSendOptions) =>
      publishToQueue(queue, message, options),
    sendBatch: (messages: T[], delaySeconds?: number) =>
      publishBatchToQueue(queue, messages, delaySeconds),
  };
}
