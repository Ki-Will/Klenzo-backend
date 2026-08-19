import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { HabitService } from './habit.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserPayload } from '../auth/jwt.strategy';
import { CreateHabitDto, UpdateHabitDto } from '../dto/habit.dto';

@UseGuards(JwtAuthGuard)
@Controller('habits')
export class HabitController {
  constructor(private readonly habitService: HabitService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  createHabit(@CurrentUser() user: UserPayload, @Body() dto: CreateHabitDto) {
    return this.habitService.createHabit(user.id, dto);
  }

  @Get()
  getHabits(@CurrentUser() user: UserPayload) {
    return this.habitService.getHabits(user.id);
  }

  @Get(':id')
  getHabit(
    @CurrentUser() user: UserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.habitService.getHabit(user.id, id);
  }

  @Get(':id/stats')
  getHabitStats(
    @CurrentUser() user: UserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.habitService.getHabitStats(user.id, id);
  }

  @Patch(':id')
  updateHabit(
    @CurrentUser() user: UserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateHabitDto,
  ) {
    return this.habitService.updateHabit(user.id, id, dto);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  completeHabit(
    @CurrentUser() user: UserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.habitService.completeHabit(user.id, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  deleteHabit(
    @CurrentUser() user: UserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.habitService.deleteHabit(user.id, id);
  }
}
