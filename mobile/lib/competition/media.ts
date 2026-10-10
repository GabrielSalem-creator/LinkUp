import type { TeamMedia } from './types.ts';

export type MediaLevel =
  | 'match_override'
  | 'team_competition_venue'
  | 'team_competition'
  | 'team_venue'
  | 'team_default'
  | 'team_colors';

export interface ResolvedTeamMedia {
  level: MediaLevel;
  imageUrl?: string;
  /** Candidate list in precedence order so a UI can fall back on load failure. */
  chain: { level: MediaLevel; imageUrl?: string }[];
}

export interface MediaContext {
  teamId: string;
  competitionId?: string;
  venueId?: string;
  matchOverrideUrl?: string;
}

/**
 * Resolution order (product requirement):
 * 1 match override; 2 team+competition+venue; 3 team+competition; 4 team+venue; 5 team default; 6 team colours + logo
 */
export function resolveTeamMedia(media: TeamMedia[], ctx: MediaContext): ResolvedTeamMedia {
  const mine = media.filter((m) => m.team_id === ctx.teamId).sort((a, b) => a.sort - b.sort);
  const pick = (pred: (m: TeamMedia) => boolean) => mine.find(pred)?.image_url;
  const chain: { level: MediaLevel; imageUrl?: string }[] = [];
  const push = (level: MediaLevel, url?: string) => {
    if (url) chain.push({ level, imageUrl: url });
  };
  push('match_override', ctx.matchOverrideUrl);
  if (ctx.competitionId && ctx.venueId) {
    push(
      'team_competition_venue',
      pick(
        (m) =>
          m.kind === 'competition_venue' && m.competition_id === ctx.competitionId && m.venue_id === ctx.venueId,
      ),
    );
  }
  if (ctx.competitionId) {
    push('team_competition', pick((m) => m.kind === 'competition' && m.competition_id === ctx.competitionId));
  }
  if (ctx.venueId) {
    push('team_venue', pick((m) => m.kind === 'venue' && m.venue_id === ctx.venueId));
  }
  push('team_default', pick((m) => m.kind === 'default'));
  chain.push({ level: 'team_colors' });
  const first = chain[0];
  return { level: first.level, imageUrl: first.imageUrl, chain };
}
