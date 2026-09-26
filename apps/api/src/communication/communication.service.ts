import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantContextService } from '../common/tenant/tenant-context';
import { CreateChannelDto } from './dto/create-channel.dto';
import { SendMessageDto } from './dto/send-message.dto';

@Injectable()
export class CommunicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  /** Canal Jefe-Equipo o Jefe-Gerente, creado por el jefe/manager. */
  async createChannel(managerEmployeeId: string, dto: CreateChannelDto) {
    return this.prisma.client.channel.create({
      data: {
        tenantId: this.tenantContext.getOrThrow().tenantId,
        type: dto.type,
        name: dto.name,
        managerId: managerEmployeeId,
        members: { create: dto.memberUserIds.map((userId) => ({ userId })) },
      },
      include: { members: true },
    });
  }

  async listMyChannels(userId: string) {
    return this.prisma.client.channel.findMany({
      where: { members: { some: { userId } } },
      include: { manager: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listMessages(userId: string, channelId: string) {
    await this.assertMember(userId, channelId);
    return this.prisma.client.message.findMany({
      where: { channelId },
      include: { sender: { select: { id: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async sendMessage(userId: string, channelId: string, dto: SendMessageDto) {
    await this.assertMember(userId, channelId);
    return this.prisma.client.message.create({
      data: { channelId, senderId: userId, content: dto.content },
    });
  }

  private async assertMember(userId: string, channelId: string) {
    // `ChannelMember` no tiene tenantId propio; `channelId` ya viene de un
    // `Channel` scopeado, así que basta validar la membresía del usuario.
    const membership = await this.prisma.client.channelMember.findUnique({
      where: { channelId_userId: { channelId, userId } },
    });
    if (!membership) throw new ForbiddenException('No perteneces a este canal');
  }
}
