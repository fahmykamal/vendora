import { Check, Column, Entity } from 'typeorm';
import { BaseRecord } from '../database/base-record.js';

@Entity('vendors')
@Check('vendors_name_not_blank', 'length(btrim(name)) > 0')
export class Vendor extends BaseRecord {
  @Column({ type: 'varchar', length: 200 })
  name: string;
}
