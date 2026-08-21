export type TransportMode = 'colectivo' | 'tren' | 'subte' | 'trolebus';

export interface TransportLine {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  mode: TransportMode;
  operator: string | null;
  color: string;
  textColor: string;
  origin: string | null;
  destination: string | null;
  city: string;
  province: string;
  sourceName: string;
  sourceUrl: string;
  sourceUpdatedAt: string | null;
  averageRating: number | null;
  logCount: number;
}

export interface PublicUser {
  id: string;
  username: string;
}

export interface MemberSummary extends PublicUser {
  reviewCount: number;
  followerCount: number;
  followingCount: number;
}

export interface SessionUser extends PublicUser {
  email: string | null;
}

export interface ReviewAuthor {
  id: string;
  username: string;
  kind: 'registered' | 'anonymous';
  color: string | null;
}

export interface TripLog {
  id: string;
  line: Pick<TransportLine, 'id' | 'slug' | 'name' | 'shortName' | 'color' | 'textColor' | 'city' | 'province'>;
  user: ReviewAuthor;
  rating: number;
  reviewText: string | null;
  liked: boolean;
  tags: string[];
  traveledAt: string;
  createdAt: string;
}

export interface RealtimeTripEvent {
  type: 'trip.created';
  trip: TripLog;
}

export interface PlatformStats {
  lineCount: number;
  logCount: number;
  userCount: number;
  provinceCount: number;
}

export interface CreateTripInput {
  lineId: string;
  rating: number;
  reviewText?: string;
  liked?: boolean;
  tags?: string[];
  traveledAt: string;
}

export interface AuthInput {
  username: string;
  password: string;
}

export interface ProfileResponse {
  user: PublicUser;
  trips: TripLog[];
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
}
