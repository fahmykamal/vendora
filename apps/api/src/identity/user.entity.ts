import { Check, Column, Entity, Unique } from 'typeorm';
import { BaseRecord } from '../database/base-record.js';

@Entity('users')
@Unique('users_email_unique', ['email'])
@Check(
  'users_email_normalized',
  'email = lower(btrim(email)) AND length(email) > 0',
)
export class User extends BaseRecord {
  @Column({ type: 'varchar', length: 254 })
  email: string;

  // Authentication code must explicitly select this field when checking a password.
  @Column({ name: 'password_hash', type: 'text', select: false })
  passwordHash: string;
}
