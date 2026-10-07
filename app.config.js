// Three apps from one codebase, picked with APP_VARIANT at build time:
//   APP_VARIANT=parent  -> "CampusDesk"        (parents)
//   APP_VARIANT=staff   -> "CampusDesk Staff"  (teachers, registrars, school admins)
//   APP_VARIANT=admin   -> "CampusDesk Admin"  (owner / super admin)
// Without it (e.g. `expo start` in Expo Go) every role is allowed, for development.
// app.json is the shared base; this only overrides what differs per app.
const VARIANTS = {
  parent: { name: 'CampusDesk', package: 'com.campusdesk.parent', scheme: 'campusdesk-parent' },
  staff: { name: 'CampusDesk Staff', package: 'com.campusdesk.staff', scheme: 'campusdesk-staff' },
  admin: { name: 'CampusDesk Admin', package: 'com.campusdesk.admin', scheme: 'campusdesk-admin' },
  dev: { name: 'CampusDesk (dev)', package: 'com.campusdesk.dev', scheme: 'campusdesk-dev' },
};

const variant = process.env.APP_VARIANT || 'dev';
if (!VARIANTS[variant]) {
  throw new Error(`Unknown APP_VARIANT "${variant}" -- use parent, staff or admin`);
}
const v = VARIANTS[variant];

module.exports = ({ config }) => ({
  ...config,
  name: v.name,
  scheme: v.scheme,
  android: { ...config.android, package: v.package },
  ios: { ...config.ios, bundleIdentifier: v.package },
  extra: { ...config.extra, appVariant: variant },
});
