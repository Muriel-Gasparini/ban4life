import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { GroupsService } from './groups.service';
import { GroupDto, GroupToggleDto } from '@linkeshield/types';
import { AuthGuard } from '../auth/auth.guard';

@UseGuards(AuthGuard)
@Controller('api/groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Get()
  async listGroups(): Promise<GroupDto[]> {
    return this.groupsService.listGroups();
  }

  @Patch(':id/toggle')
  async toggleGroup(
    @Param('id') id: string,
    @Body() body: GroupToggleDto,
  ): Promise<GroupDto> {
    return this.groupsService.toggleGroup(id, body?.isProtected);
  }
}
