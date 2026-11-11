import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import type { Relation } from 'typeorm';
import { BaseRecord } from '../database/base-record.js';
import { User } from './user.entity.js';

@Entity('auth_sessions')
@Unique('auth_sessions_token_unique', ['tokenHash'])
@Index('auth_sessions_user_idx', ['userId'])
@Index('auth_sessions_expiry_idx', ['expiresAt'])
export class AuthSession extends BaseRecord {
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'auth_sessions_user_fk',
  })
  user: Relation<User>;

  @Column({ name: 'token_hash', type: 'varchar', length: 64, select: false })
  tokenHash: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;
}
