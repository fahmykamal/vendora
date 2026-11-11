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
import { Vendor } from './vendor.entity.js';

@Entity('branches')
@Index('branches_vendor_idx', ['vendorId'])
@Unique('branches_vendor_id_unique', ['vendorId', 'id'])
@Check('branches_name_not_blank', 'length(btrim(name)) > 0')
export class Branch extends BaseRecord {
  @Column({ name: 'vendor_id', type: 'uuid' })
  vendorId: string;

  @ManyToOne(() => Vendor, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'vendor_id',
    foreignKeyConstraintName: 'branches_vendor_fk',
  })
  vendor: Relation<Vendor>;

  @Column({ type: 'varchar', length: 200 })
  name: string;
}
