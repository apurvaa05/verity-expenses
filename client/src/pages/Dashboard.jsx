import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { fmtDateTime, money } from '../utils';

const CARDS = {
  EMPLOYEE: [
    ['Total vouchers', 'total'], ['Draft vouchers', 'drafts'], ['Awaiting review', 'pending'],
    ['Approved vouchers', 'approved'], ['Rejected vouchers', 'rejected'], ['Amount submitted', 'total_claimed', true],
  ],
  DIRECTOR: [
    ['Awaiting your review', 'pending_count'], ['Approved today', 'approved_today'],
    ['Rejected today', 'rejected_today'], ['Amount in queue', 'pending_amount', true],
  ],
  ACCOUNTS: [
    ['Voucher records', 'total'], ['Awaiting review', 'pending'], ['Approved vouchers', 'approved'],
    ['Rejected vouchers', 'rejected'], ['Approved value', 'approved_amount', true],
  ],
};
const RECENT_TITLE = { EMPLOYEE: 'Your recent activity', DIRECTOR: 'Latest voucher activity', ACCOUNTS: 'Recently approved vouchers' };
const INTRO = {
  EMPLOYEE: 'Create a claim and follow its progress from submission through approval.',
  DIRECTOR: 'Review submitted claims and keep the approval queue moving.',
  ACCOUNTS: 'View voucher records and keep track of approved expense amounts.',
};

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/dashboard').then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="center-note">Preparing your workspace…</p>;

  return (
    <>
      <div className="page-head">
        <div>
          <p className="muted small" style={{ margin: '0 0 .3rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.09em' }}>Your workspace</p>
          <h2>Welcome back, {user.name.split(' ')[0]}.</h2>
          <p className="muted" style={{ marginBottom: 0 }}>{INTRO[user.role]}</p>
        </div>
        {user.role === 'EMPLOYEE' && <Link className="btn btn-primary" to="/vouchers/new">＋ Create voucher</Link>}
        {user.role === 'DIRECTOR' && <Link className="btn btn-primary" to="/pending">Review queue</Link>}
      </div>

      <div className="stats">
        {CARDS[user.role].map(([label, key, isMoney]) => (
          <div className="stat card" key={key}>
            <span className="stat-label">{label}</span>
            <strong>{isMoney ? money(data.stats[key]) : data.stats[key]}</strong>
          </div>
        ))}
      </div>

      <section className="card">
        <div className="page-head">
          <div>
            <h3>{RECENT_TITLE[user.role]}</h3>
            <p className="muted small" style={{ margin: 0 }}>A quick view of the latest changes in your voucher workspace.</p>
          </div>
          <Link to="/vouchers">Open voucher register →</Link>
        </div>
        {data.recent.length === 0 ? (
          <p className="muted">No activity yet. New voucher updates will appear here.</p>
        ) : (
          <ul className="activity">
            {data.recent.map((r, i) => (
              <li key={i}>
                <div>
                  <Link to={`/vouchers/${r.voucherId}`}>{r.voucherNumber}</Link> — {r.title}
                  <div className="muted small">{r.label}{r.by ? ` · ${r.by}` : ''} · {fmtDateTime(r.at)}</div>
                </div>
                <strong>{money(r.amount)}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
