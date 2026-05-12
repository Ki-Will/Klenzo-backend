import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';

/**
 * Global module — import once in AppModule, available everywhere.
 * No need to import RedisModule in every feature module.
 */
@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
