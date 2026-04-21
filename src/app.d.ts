import type { LocalsUser } from '$lib/types';

declare global {
  namespace App {
    interface Locals {
      user: LocalsUser | null;
    }
  }
}

export {};
