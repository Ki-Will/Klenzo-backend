import { createApp } from './app';
import type { Env } from './types/env';

export { createApp } from './app';
export type { AppDeps } from './types/deps';

// One app per isolate — env bindings are read per request inside handlers.
let app: ReturnType<typeof createApp> | undefined;

function defaultApp(): ReturnType<typeof createApp> {
  app ??= createApp();
  return app;
}

// ---------------------------------------------------------------------------
// Worker export — standard CF Workers module syntax.
// ---------------------------------------------------------------------------
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return defaultApp().fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
