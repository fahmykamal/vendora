import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PasswordHasher } from '@nestjs/authentication';
import { createHash, randomBytes } from 'node:crypto';
import { DataSource, MoreThan, QueryFailedError } from 'typeorm';
import type { EntityManager } from 'typeorm';
import { User } from './user.entity.js';
import { AuthSession } from './auth-session.entity.js';
import type { CredentialsDto } from './auth.dto.js';

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(DataSource) private readonly database: DataSource,
    @Inject(PasswordHasher) private readonly passwords: PasswordHasher,
  ) {}

  async register(input: CredentialsDto) {
    const passwordHash = await this.passwords.hash(input.password);
    try {
      return await this.database.transaction(async (manager) => {
        const user = await manager.save(
          User,
          manager.create(User, { email: input.email, passwordHash }),
        );
        return this.issueSession(manager, user);
      });
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string; constraint?: string }).code ===
          '23505' &&
        (error.driverError as { constraint?: string }).constraint ===
          'users_email_unique'
      ) {
        throw new ConflictException('Email already registered');
      }
      throw error;
    }
  }

  async login(input: CredentialsDto) {
    const user = await this.database
      .getRepository(User)
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email: input.email })
      .getOne();
    const valid = await this.passwords.verify(
      input.password,
      user?.passwordHash,
    );
    if (!valid || !user)
      throw new UnauthorizedException('Invalid email or password');
    if (this.passwords.needsRehash(user.passwordHash)) {
      await this.database.getRepository(User).update(user.id, {
        passwordHash: await this.passwords.hash(input.password),
      });
    }
    return this.issueSession(this.database.manager, user);
  }

  private async issueSession(manager: EntityManager, user: User) {
    const accessToken = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await manager.insert(AuthSession, {
      userId: user.id,
      tokenHash: hashToken(accessToken),
      expiresAt,
    });
    return {
      accessToken,
      tokenType: 'Bearer',
      expiresAt,
      user: { id: user.id, email: user.email },
    };
  }

  async authenticate(token: string) {
    const session = await this.database.getRepository(AuthSession).findOne({
      where: { tokenHash: hashToken(token), expiresAt: MoreThan(new Date()) },
      relations: { user: true },
    });
    if (!session) throw new UnauthorizedException('Invalid or expired token');
    return {
      sessionId: session.id,
      user: { id: session.user.id, email: session.user.email },
    };
  }

  async logout(sessionId: string) {
    await this.database.getRepository(AuthSession).delete(sessionId);
  }
}
