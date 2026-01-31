import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(entry: {
    actorUserId?: string;
    action: string;
    entity?: string;
    entityId?: string;
    method: string;
    path: string;
    ip?: string;
    userAgent?: string;
    statusCode?: number;
    requestId?: string;
    metadata?: any;
  }) {
    await this.prisma.auditLog.create({
      data: {
        actorUserId: entry.actorUserId,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        method: entry.method,
        path: entry.path,
        ip: entry.ip,
        userAgent: entry.userAgent,
        statusCode: entry.statusCode,
        requestId: entry.requestId,
        metadata: entry.metadata ?? undefined,
      },
    });
  }
}
