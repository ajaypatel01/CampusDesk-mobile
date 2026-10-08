// Three apps from one codebase, picked with APP_VARIANT at build time:
//   APP_VARIANT=parent  -> "CampusDesk"        (parents)
//   APP_VARIANT=staff   -> "CampusDesk Staff"  (teachers, registrars, school admins)
//   APP_VARIANT=admin   -> "CampusDesk Admin"  (owner / super admin)
// Without it (e.g. `expo start` in Expo Go) every role is allowed, for development.
// app.json is the shared base; this only overrides what differs per app.
const VARIANTS = {
  // Each app has its own icon colour (assets/icons/logo.svg is the shared mark).
  parent: { name: 'CampusDesk', package: 'com.campusdesk.parent', scheme: 'campusdesk-parent', color: '#2a78d6' },
  staff: { name: 'CampusDesk Staff', package: 'com.campusdesk.staff', scheme: 'campusdesk-staff', color: '#1f8a5b' },
  admin: { name: 'CampusDesk Admin', package: 'com.campusdesk.admin', scheme: 'campusdesk-admin', color: '#334155' },
  dev: { name: 'CampusDesk (dev)', package: 'com.campusdesk.dev', scheme: 'campusdesk-dev', color: '#2a78d6' },
};

const variant = process.env.APP_VARIANT || 'dev';
if (!VARIANTS[variant]) {
  throw new Error(`Unknown APP_VARIANT "${variant}" -- use parent, staff or admin`);
}
const v = VARIANTS[variant];
const iconVariant = variant === 'dev' ? 'parent' : variant;

module.exports = ({ config }) => ({
  ...config,
  name: v.name,
  scheme: v.scheme,
  icon: `./assets/icons/icon-${iconVariant}.png`,
  android: {
    ...config.android,
    package: v.package,
    adaptiveIcon: { ...config.android.adaptiveIcon, backgroundColor: v.color },
  },
  ios: { ...config.ios, bundleIdentifier: v.package },
  extra: { ...config.extra, appVariant: variant },
});
