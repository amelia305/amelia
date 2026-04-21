export type UserRole = 'superadmin' | 'socio' | 'adminEmpresa';

export type Cargo = 'administracion' | 'medios' | 'operativo';

export type Perfil = 'directivos' | 'medios' | 'operativos';

export type TokenStatus = 'pending' | 'inProgress' | 'completed' | 'expired';

/** Populated into event.locals by hooks.server.ts after ID token verification. */
export interface LocalsUser {
  uid: string;
  email: string | null;
  role: UserRole;
  /** Present for socio role. By convention socioUid === uid. */
  socioUid?: string;
  /** Present for adminEmpresa role. */
  empresaIds?: string[];
}
