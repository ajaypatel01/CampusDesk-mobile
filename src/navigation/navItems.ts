// Mirrors frontend/src/components/Sidebar.jsx in the web app exactly — same routes,
// same deny/only role rules — so the two clients stay in sync as a single source of truth
// to update when the web sidebar changes.
//
// A teacher's access is intentionally narrow: results for their own class,
// homework and settings (web also has My Salary, not built on mobile yet).
// Every other item denies 'teacher', matching the web and the backend's
// BlockRoles("teacher") checks.
export type NavItem = {
  href: string;
  label: string;
  icon: string; // Ionicons name
  deny?: string[];
  only?: string[];
  status?: 'live' | 'planned'; // 'planned' = not yet implemented on mobile, shown disabled
};

export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: 'grid-outline', deny: ['parent', 'teacher'], status: 'live' },
  { href: '/my-ward', label: 'My Ward', icon: 'people-outline', only: ['parent'], status: 'live' },
  { href: '/students', label: 'Students', icon: 'school-outline', deny: ['parent', 'teacher'], status: 'live' },
  { href: '/admissions', label: 'Admissions', icon: 'clipboard-outline', deny: ['parent', 'teacher'], status: 'live' },
  { href: '/fees', label: 'Fees', icon: 'cash-outline', deny: ['parent', 'teacher'], status: 'live' },
  { href: '/teachers', label: 'Teachers', icon: 'person-outline', deny: ['registrar', 'parent', 'teacher'], status: 'live' },
  { href: '/staff', label: 'Staff', icon: 'briefcase-outline', deny: ['registrar', 'parent', 'teacher'], status: 'live' },
  { href: '/ledger', label: 'Fee Ledger', icon: 'book-outline', deny: ['parent', 'teacher'], status: 'live' },
  { href: '/fee-report', label: 'Fee Report', icon: 'pie-chart-outline', deny: ['registrar', 'parent', 'teacher'], status: 'live' },
  { href: '/tc-records', label: 'TC Records', icon: 'document-text-outline', deny: ['parent', 'teacher'], status: 'live' },
  { href: '/vouchers', label: 'Vouchers', icon: 'receipt-outline', deny: ['parent', 'teacher'], status: 'live' },
  { href: '/documents', label: 'Documents', icon: 'folder-outline', deny: ['registrar', 'parent', 'teacher'], status: 'live' },
  { href: '/broadcasts', label: 'Broadcasts', icon: 'megaphone-outline', deny: ['registrar', 'parent', 'teacher'], status: 'live' },
  { href: '/results', label: 'Results', icon: 'bar-chart-outline', deny: ['parent'], status: 'live' },
  { href: '/homework', label: 'Homework', icon: 'book-outline', deny: ['parent'], status: 'live' },
  { href: '/gallery', label: 'Class Gallery', icon: 'images-outline', status: 'live' },
  { href: '/transport', label: 'Transport', icon: 'bus-outline', deny: ['parent', 'teacher'], status: 'live' },
  { href: '/rte', label: 'RTE', icon: 'shield-checkmark-outline', deny: ['parent', 'teacher'], status: 'live' },
  { href: '/books', label: 'Books', icon: 'library-outline', deny: ['registrar', 'parent', 'teacher'], status: 'live' },
  { href: '/id-cards', label: 'ID Cards', icon: 'card-outline', deny: ['registrar', 'parent', 'teacher'], status: 'live' },
  { href: '/payroll', label: 'Payroll', icon: 'wallet-outline', only: ['super_admin'], status: 'live' },
  { href: '/settings', label: 'Settings', icon: 'settings-outline', status: 'live' },
];

function allowed(item: NavItem, role: string | undefined) {
  return !item.deny?.includes(role || '') && (!item.only || item.only.includes(role || ''));
}

export function visibleNavItems(role: string | undefined): NavItem[] {
  return NAV_ITEMS.filter(item => allowed(item, role));
}

/**
 * Whether a role may open a path (including nested ones like /students/123).
 * The home route '/' always passes -- it redirects each role to its own start
 * screen itself.
 */
export function canOpenPath(pathname: string, role: string | undefined): boolean {
  if (pathname === '/') return true;
  const item = NAV_ITEMS.find(i => i.href !== '/' && (pathname === i.href || pathname.startsWith(i.href + '/')));
  return !item || allowed(item, role);
}
