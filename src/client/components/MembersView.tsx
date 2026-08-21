import { useState } from 'react';
import type { MemberSummary } from '../../shared/types';

interface MembersViewProps {
  members: MemberSummary[];
  loading: boolean;
  onOpenProfile: (username: string) => void;
}

export function MembersView({ members, loading, onOpenProfile }: MembersViewProps) {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
  const filteredMembers = normalizedQuery
    ? members.filter((member) => member.username.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').includes(normalizedQuery))
    : members;

  return (
    <section className="members-view" aria-labelledby="members-title">
      <header className="section-heading members-heading">
        <div><h1 id="members-title">Miembros</h1></div>
        <p>Pasajeros ordenados por actividad.</p>
      </header>
      {!loading && members.length > 0 && (
        <div className="member-search">
          <label className="sr-only" htmlFor="member-search">Buscar por usuario</label>
          <input id="member-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por usuario" />
          <p role="status" aria-live="polite">
            {normalizedQuery
              ? `${filteredMembers.length} de ${members.length} miembros`
              : `${members.length} ${members.length === 1 ? 'miembro' : 'miembros'}`}
          </p>
        </div>
      )}
      {loading ? <p className="empty-state">Cargando miembros…</p> : filteredMembers.length ? (
        <ul className="member-list">
          {filteredMembers.map((member) => (
            <li key={member.id}>
              <button type="button" onClick={() => onOpenProfile(member.username)}>
                <span className="member-avatar" aria-hidden="true">{member.username.slice(0, 1).toLocaleUpperCase('es')}</span>
                <span className="member-copy"><strong>@{member.username}</strong><small>{member.reviewCount === 1 ? '1 reseña' : `${member.reviewCount} reseñas`}</small></span>
                <span className="member-followers"><strong>{member.followerCount}</strong><small>{member.followerCount === 1 ? 'seguidor' : 'seguidores'}</small></span>
              </button>
            </li>
          ))}
        </ul>
      ) : <p className="empty-state prominent">{members.length ? `No encontramos miembros para “${query.trim()}”.` : 'Todavía no hay miembros registrados.'}</p>}
    </section>
  );
}
