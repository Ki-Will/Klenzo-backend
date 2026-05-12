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
import { ProductivityService } from './productivity.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../entities/user.entity';
import { CreateTaskDto, UpdateTaskDto } from '../dto/task.dto';

@UseGuards(JwtAuthGuard)
@Controller('productivity/tasks')
export class ProductivityController {
  constructor(private readonly productivityService: ProductivityService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  createTask(@CurrentUser() user: User, @Body() dto: CreateTaskDto) {
    return this.productivityService.createTask(user.id, dto);
  }

  @Get()
  getTasks(@CurrentUser() user: User) {
    return this.productivityService.getTasks(user.id);
  }

  @Get(':id')
  getTask(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.productivityService.getTask(user.id, id);
  }

  @Patch(':id')
  updateTask(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.productivityService.updateTask(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  deleteTask(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.productivityService.deleteTask(user.id, id);
  }
}
