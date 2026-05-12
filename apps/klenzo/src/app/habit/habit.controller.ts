import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { HabitService } from './habit.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../entities/user.entity';
import { CreateHabitDto, UpdateHabitDto } from '../dto/habit.dto';

@UseGuards(JwtAuthGuard)
@Controller('habits')
export class HabitController {
  constructor(private readonly habitService: HabitService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  createHabit(@CurrentUser() user: User, @Body() dto: CreateHabitDto) {
    return this.habitService.createHabit(user.id, dto);
  }

  @Get()
  getHabits(@CurrentUser() user: User) {
    return this.habitService.getHabits(user.id);
  }

  @Get(':id')
  getHabit(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.habitService.getHabit(user.id, id);
  }

  @Get(':id/stats')
  getHabitStats(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.habitService.getHabitStats(user.id, id);
  }

  @Patch(':id')
  updateHabit(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateHabitDto,
  ) {
    return this.habitService.updateHabit(user.id, id, dto);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  completeHabit(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.habitService.completeHabit(user.id, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  deleteHabit(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.habitService.deleteHabit(user.id, id);
  }
}
