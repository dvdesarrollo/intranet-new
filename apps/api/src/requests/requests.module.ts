import { Module } from '@nestjs/common';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';
import { ApprovalWorkflowService } from './approval-workflow.service';

@Module({
  controllers: [RequestsController],
  providers: [RequestsService, ApprovalWorkflowService],
})
export class RequestsModule {}
