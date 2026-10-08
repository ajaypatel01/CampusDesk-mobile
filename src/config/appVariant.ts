import Constants from 'expo-constants';

// Which of the three CampusDesk apps this build is (see app.config.js).
export type AppVariant = 'parent' | 'staff' | 'admin' | 'dev';

export const APP_VARIANT: AppVariant = (Constants.expoConfig?.extra?.appVariant as AppVariant) || 'dev';

const ROLES: Record<AppVariant, string[] | null> = {
  parent: ['parent'],
  staff: ['teacher', 'registrar', 'school_admin'],
  admin: ['super_admin'],
  dev: null, // development build: every role
};

/** Which login a phone number gets in this app (see /auth/otp/send). */
export const OTP_AUDIENCE: Record<AppVariant, string> = {
  parent: 'parent',
  staff: 'staff',
  admin: 'staff',
  dev: '',
};

export const APP_AUDIENCE: Record<AppVariant, string> = {
  parent: 'Parents',
  staff: 'Staff',
  admin: 'Admin',
  dev: 'Development build',
};

const APP_FOR_ROLE: Record<string, string> = {
  parent: 'the CampusDesk app',
  teacher: 'the CampusDesk Staff app',
  registrar: 'the CampusDesk Staff app',
  school_admin: 'the CampusDesk Staff app',
  super_admin: 'the CampusDesk Admin app',
};

export function roleAllowed(role: string | undefined): boolean {
  const allowed = ROLES[APP_VARIANT];
  return allowed === null || (!!role && allowed.includes(role));
}

/** Message for someone who signed into the wrong app. */
export function wrongAppMessage(role: string): string {
  const which = APP_FOR_ROLE[role] || 'another CampusDesk app';
  const self = { parent: "the parents' app", staff: 'the staff app', admin: "the owner's app", dev: 'this app' }[APP_VARIANT];
  return `This is ${self}. Please sign in with ${which} instead.`;
}
