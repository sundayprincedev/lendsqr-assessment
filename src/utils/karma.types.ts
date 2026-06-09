export interface KarmaLookupData {
  karma_identity: string;
  amount_in_contention?: string;
  reason?: string | null;
  default_date?: string;
  karma_type?: {
    karma: string;
  };
  karma_identity_type?: {
    identity_type: string;
  };
  reporting_entity?: {
    name: string;
    email: string;
  };
}

export interface KarmaApiResponse {
  status: string;
  message: string;
  data?: KarmaLookupData;
  meta?: {
    cost: number;
    balance: number;
  };
}

export interface KarmaCheckResult {
  identity: string;
  isBlacklisted: boolean;
}
