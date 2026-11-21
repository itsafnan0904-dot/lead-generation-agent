import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserRole } from '@ai-sales-agent/database';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateUserDto, ResetPasswordDto, UpdateUserDto } from './dto/user.dto';

const SALT_ROUNDS = 12;
/** Never expose password or token hashes. */
const PUBLIC_USER = { id: true, email: true, name: true, role: true, isActive: true, googleId: false, createdAt: true, updatedAt: true } as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  list() {
    return this.prisma.client.user.findMany({ select: PUBLIC_USER, orderBy: { createdAt: 'asc' } });
  }

  async create(dto: CreateUserDto, actorId: string) {
    const email = dto.email.toLowerCase().trim();
    if (await this.prisma.client.user.findUnique({ where: { email }, select: { id: true } })) {
      throw new ConflictException('An account with this email address already exists.');
    }
    const user = await this.prisma.client.user.create({
      data: { email, name: dto.name.trim(), role: dto.role, passwordHash: await bcrypt.hash(dto.password, SALT_ROUNDS) },
      select: PUBLIC_USER,
    });
    await this.audit.log({
      actorType: 'USER', actorId, userId: actorId, action: 'USER_CREATED', entityType: 'USER', entityId: user.id,
      metadata: { email: user.email, role: user.role },
    });
    return user;
  }

  async update(id: string, dto: UpdateUserDto, actorId: string) {
    const target = await this.requireUser(id);

    if (id === actorId && (dto.isActive === false || (dto.role && dto.role !== target.role))) {
      throw new BadRequestException('You cannot deactivate or change the role of your own account.');
    }
    const losesAdmin = target.role === UserRole.ADMIN && target.isActive && (dto.isActive === false || (dto.role && dto.role !== UserRole.ADMIN));
    if (losesAdmin && (await this.activeAdminCount()) <= 1) {
      throw new BadRequestException('At least one active administrator must remain.');
    }

    const user = await this.prisma.client.user.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.role ? { role: dto.role } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        // A deactivated or re-roled account loses its refresh token so it cannot quietly keep a session alive
        ...(dto.isActive === false || (dto.role && dto.role !== target.role) ? { refreshTokenHash: null } : {}),
      },
      select: PUBLIC_USER,
    });
    await this.audit.log({
      actorType: 'USER', actorId, userId: actorId, action: 'USER_UPDATED', entityType: 'USER', entityId: id,
      oldState: { role: target.role, isActive: target.isActive }, newState: { role: user.role, isActive: user.isActive },
    });
    return user;
  }

  async resetPassword(id: string, dto: ResetPasswordDto, actorId: string) {
    await this.requireUser(id);
    await this.prisma.client.user.update({
      where: { id },
      // Setting a new password also revokes the existing refresh token
      data: { passwordHash: await bcrypt.hash(dto.password, SALT_ROUNDS), refreshTokenHash: null },
    });
    await this.audit.log({
      actorType: 'USER', actorId, userId: actorId, action: 'USER_PASSWORD_RESET', entityType: 'USER', entityId: id,
    });
    return { success: true };
  }

  private activeAdminCount() {
    return this.prisma.client.user.count({ where: { role: UserRole.ADMIN, isActive: true } });
  }

  private async requireUser(id: string) {
    const user = await this.prisma.client.user.findUnique({ where: { id }, select: { id: true, role: true, isActive: true } });
    if (!user) throw new NotFoundException(`User with ID '${id}' not found.`);
    return user;
  }
}
