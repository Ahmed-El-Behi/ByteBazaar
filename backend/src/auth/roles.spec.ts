import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminController } from '../admin/admin.controller';
import { RolesGuard } from './roles';

function contextFor(role: string | undefined): ExecutionContext {
  return {
    getHandler: () =>
      Reflect.get(AdminController.prototype, 'getAllOrders') as () => unknown,
    getClass: () => AdminController,
    switchToHttp: () => ({
      getRequest: () => ({ user: role ? { id: 1, role } : undefined }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard on AdminController', () => {
  const guard = new RolesGuard(new Reflector());

  it('lets administrators through', () => {
    expect(guard.canActivate(contextFor('ADMIN'))).toBe(true);
  });

  it('rejects customers', () => {
    expect(() => guard.canActivate(contextFor('CUSTOMER'))).toThrow(
      ForbiddenException,
    );
  });

  it('rejects anonymous requests', () => {
    expect(() => guard.canActivate(contextFor(undefined))).toThrow(
      ForbiddenException,
    );
  });
});
