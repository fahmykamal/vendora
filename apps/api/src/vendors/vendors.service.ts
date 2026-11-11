import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Vendor } from './vendor.entity.js';
import { Branch } from './branch.entity.js';
import { VendorMembership } from './vendor-membership.entity.js';

@Injectable()
export class VendorsService {
  constructor(@Inject(DataSource) private readonly database: DataSource) {}

  create(userId: string, name: string) {
    return this.database.transaction(async (manager) => {
      const vendor = await manager.save(
        Vendor,
        manager.create(Vendor, { name }),
      );
      await manager.insert(VendorMembership, {
        userId,
        vendorId: vendor.id,
        role: 'owner',
      });
      const branch = await manager.save(
        Branch,
        manager.create(Branch, { vendorId: vendor.id, name: 'Main' }),
      );
      return {
        id: vendor.id,
        name: vendor.name,
        role: 'owner',
        branches: [{ id: branch.id, name: branch.name }],
      };
    });
  }

  async list(userId: string) {
    const memberships = await this.database
      .getRepository(VendorMembership)
      .find({
        where: { userId },
        relations: { vendor: true },
        order: { createdAt: 'ASC', id: 'ASC' },
      });
    return memberships.map(({ vendor, role }) => ({
      id: vendor.id,
      name: vendor.name,
      role,
    }));
  }

  async get(userId: string, vendorId: string) {
    const membership = await this.database
      .getRepository(VendorMembership)
      .findOne({ where: { userId, vendorId }, relations: { vendor: true } });
    if (!membership) throw new NotFoundException('Vendor not found');
    const branches = await this.database
      .getRepository(Branch)
      .find({ where: { vendorId }, order: { createdAt: 'ASC', id: 'ASC' } });
    return {
      id: membership.vendor.id,
      name: membership.vendor.name,
      role: membership.role,
      branches: branches.map(({ id, name }) => ({ id, name })),
    };
  }

  rename(userId: string, vendorId: string, name: string) {
    return this.database.transaction(async (manager) => {
      // Hold membership steady until this write commits: revocation/role changes must wait.
      const membership = await manager.getRepository(VendorMembership).findOne({
        where: { userId, vendorId },
        lock: { mode: 'pessimistic_read' },
      });
      if (!membership) throw new NotFoundException('Vendor not found');
      if (membership.role !== 'owner' && membership.role !== 'manager')
        throw new ForbiddenException('Owner or manager role required');
      await manager.update(Vendor, { id: vendorId }, { name });
      return { id: vendorId, name, role: membership.role };
    });
  }
}
