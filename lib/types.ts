export type Listing = {
  url?: string;
  title: string;
  description: string;
  /** All visible page text, when available (bookmarklet / paste). */
  rawText: string;
  price?: number;
  priceText?: string;
  location?: string;
  sellerName?: string;
  images: string[]; // http(s) URLs or data: URLs
};

export type Extracted = {
  phones: string[];
  emails: string[];
  urls: string[];
  abns: string[];
  state?: "VIC" | "NSW" | "QLD" | "SA" | "WA" | "TAS" | "NT" | "ACT";
  breed?: string;
  businessName?: string;
};

export type Signal = {
  /** Negative = more risky, positive = reassuring. */
  points: number;
  label: string;
  detail?: string;
  links?: { title: string; url: string }[];
};

export type CheckResult = {
  id: string;
  name: string;
  /** "na" = not applicable to this ad (e.g. no website to check); excluded from confidence. */
  status: "ran" | "skipped" | "error" | "na";
  note?: string;
  signals: Signal[];
};

export type Report = {
  score: number;
  band: "high-risk" | "caution" | "lower-risk";
  confidence: number; // 0-1: share of checks that actually ran
  listing: Omit<Listing, "rawText" | "images"> & { imageCount: number };
  extracted: Extracted;
  checks: CheckResult[];
  manualLinks: { title: string; url: string }[];
};
