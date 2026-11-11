import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  Unique,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { BaseRecord } from '../database/base-record.js';
import { User } from '../identity/user.entity.js';
import { Vendor } from './vendor.entity.js';

export const merchantRoles = ['owner', 'manager', 'cashier'] as const;
export type MerchantRole = (typeof merchantRoles)[number];

@Entity('vendor_memberships')
@Unique('memberships_vendor_user_unique', ['vendorId', 'userId'])
@Index('memberships_user_idx', ['userId'])
@Check('memberships_role_valid', "role IN ('owner', 'manager', 'cashier')")
export class VendorMembership extends BaseRecord {
  @Column({ name: 'vendor_id', type: 'uuid' })
  vendorId: string;

  @ManyToOne(() => Vendor, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'vendor_id',
    foreignKeyConstraintName: 'memberships_vendor_fk',
  })
  vendor: Relation<Vendor>;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'memberships_user_fk',
  })
  user: Relation<User>;

  @Column({ type: 'varchar', length: 20 })
  role: MerchantRole;
}
