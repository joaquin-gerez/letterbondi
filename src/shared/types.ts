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

export interface SessionUser extends PublicUser {
  email: string;
}

export interface TripLog {
  id: string;
  line: Pick<TransportLine, 'id' | 'slug' | 'name' | 'shortName' | 'color' | 'textColor' | 'city' | 'province'>;
  user: PublicUser;
  rating: number;
  reviewText: string | null;
  traveledAt: string;
  createdAt: string;
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
  traveledAt: string;
}

export interface AuthInput {
  username?: string;
  email: string;
  password: string;
}

export interface ProfileResponse {
  user: PublicUser;
  trips: TripLog[];
}
