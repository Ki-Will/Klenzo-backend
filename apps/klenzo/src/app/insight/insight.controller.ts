import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InsightService } from './insight.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserPayload } from '../auth/jwt.strategy';
import { TrendsQueryDto } from '../dto/insight.dto';

@UseGuards(JwtAuthGuard)
@Controller('insights')
export class InsightController {
  constructor(private readonly insightService: InsightService) {}

  @Get('dashboard')
  getDashboard(@CurrentUser() user: UserPayload) {
    return this.insightService.getDashboard(user.id);
  }

  @Get('productivity/trends')
  getProductivityTrends(
    @CurrentUser() user: UserPayload,
    @Query() query: TrendsQueryDto,
  ) {
    return this.insightService.getProductivityTrends(user.id, query.days);
  }

  @Get('finance/trends')
  getSpendingTrends(
    @CurrentUser() user: UserPayload,
    @Query() query: TrendsQueryDto,
  ) {
    return this.insightService.getSpendingTrends(user.id, query.days);
  }
}
