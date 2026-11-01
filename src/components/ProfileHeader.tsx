import type { GitHubUser } from '../types/github';
import { getYear } from '../utils/formatDate';
import { pluralize } from '../utils/pluralize';
import { toSafeHttpUrl } from '../utils/url';

export interface ProfileHeaderProps {
  /** Profile returned by `GET /users/{username}`. */
  user: GitHubUser;
}

export function ProfileHeader({ user }: ProfileHeaderProps) {
  const displayName = user.name?.trim() || user.login;
  const profileUrl = toSafeHttpUrl(user.html_url);
  const avatarUrl = toSafeHttpUrl(user.avatar_url);

  return (
    <section className="profile" aria-labelledby="profile-name">
      {avatarUrl && (
        <img
          className="profile__avatar"
          src={avatarUrl}
          alt={`Avatar of ${displayName}`}
          width={96}
          height={96}
          decoding="async"
        />
      )}
      <div className="profile__body">
        <h2 id="profile-name" className="profile__name">
          {displayName}
        </h2>
        {profileUrl ? (
          <a className="profile__login" href={profileUrl} target="_blank" rel="noopener noreferrer">
            @{user.login}
            <span className="visually-hidden"> on GitHub (opens in a new tab)</span>
          </a>
        ) : (
          <span className="profile__login">@{user.login}</span>
        )}
        {user.bio && <p className="profile__bio">{user.bio}</p>}
        <p className="profile__stats">
          {pluralize(user.public_repos, 'public repo')} · joined {getYear(user.created_at)}
        </p>
      </div>
    </section>
  );
}

