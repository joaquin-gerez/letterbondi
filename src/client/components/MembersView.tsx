import type { MemberSummary } from '../../shared/types';

interface MembersViewProps {
  members: MemberSummary[];
  loading: boolean;
  onOpenProfile: (username: string) => void;
}

export function MembersView({ members, loading, onOpenProfile }: MembersViewProps) {
  return (
    <section className="members-view" aria-labelledby="members-title">
      <header className="section-heading members-heading">
        <div><h1 id="members-title">Miembros</h1></div>
        <p>Pasajeros ordenados por actividad.</p>
      </header>
      {loading ? <p className="empty-state">Cargando miembros…</p> : members.length ? (
        <ul className="member-list">
          {members.map((member) => (
            <li key={member.id}>
              <button type="button" onClick={() => onOpenProfile(member.username)}>
                <span className="member-avatar" aria-hidden="true">{member.username.slice(0, 1).toLocaleUpperCase('es')}</span>
                <span className="member-copy"><strong>@{member.username}</strong><small>{member.reviewCount === 1 ? '1 reseña' : `${member.reviewCount} reseñas`}</small></span>
                <span className="member-followers"><strong>{member.followerCount}</strong><small>{member.followerCount === 1 ? 'seguidor' : 'seguidores'}</small></span>
              </button>
            </li>
          ))}
        </ul>
      ) : <p className="empty-state prominent">Todavía no hay miembros registrados.</p>}
    </section>
  );
}
