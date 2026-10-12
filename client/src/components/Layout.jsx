import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { ROLE_LABEL } from '../utils';

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const links = [{ to: '/', label: 'Overview', end: true }];
  if (user.role === 'EMPLOYEE') {
    links.push({ to: '/vouchers', label: 'My vouchers', end: true }, { to: '/vouchers/new', label: 'New voucher' });
  } else {
    if (user.role === 'DIRECTOR') links.push({ to: '/pending', label: 'Approval queue' });
    links.push({ to: '/vouchers', label: 'Voucher register', end: true });
  }
  links.push({ to: '/profile', label: 'Signature profile' });

  return (
    <>
      <header className="topbar no-print">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">V</span>
          <span className="brand-copy">Verity<span>Expenses</span><small>Voucher workspace</small></span>
        </div>
        <nav aria-label="Main navigation">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end}>{l.label}</NavLink>
          ))}
        </nav>
        <div className="user">
          <span>{user.name}<small>{ROLE_LABEL[user.role]}</small></span>
          <button className="btn btn-ghost" onClick={() => { logout(); nav('/login'); }}>Sign out</button>
        </div>
      </header>
      <main className="page"><Outlet /></main>
    </>
  );
}
