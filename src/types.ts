export interface Listing {
  ownerName: string | null;
  title: string | null;
  medium: string | null;
  genres: string[];
  deadline: string | null;
  deadlineTs: number | null;
  minImages: number | null;
  maxImages: number | null;
  exclusivity: boolean | null;
  ownerInstagram: string | null;
  ownerInstagramFollowerCount: number | null;
  ownerType: string | null;
  ownerCity: string | null;
  url: string;
  sourceGenre: string | null;
  sourceSection: string | null;
  scrapedAt: string;
}

export interface ScrapeOutput {
  generatedAt: string;
  source: string;
  listingCount: number;
  listings: Listing[];
}
