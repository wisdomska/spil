import {
  AirplaneTiltIcon,
  BedIcon,
  BeerBottleIcon,
  BriefcaseIcon,
  CardsIcon,
  ChampagneIcon,
  ChatCircleDotsIcon,
  FireIcon,
  GameControllerIcon,
  GraduationCapIcon,
  HeartIcon,
  HouseIcon,
  KeyIcon,
  ListChecksIcon,
  MaskHappyIcon,
  MoonStarsIcon,
  MusicNotesIcon,
  SparkleIcon,
  StudentIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";

/**
 * Pack glyphs (Phosphor placeholders inside sticker discs, see open item 2). Admins pick from this
 * list, so every pack icon resolves to a real component and the bundle only carries these.
 */
export const PACK_ICONS: Record<string, Icon> = {
  cards: CardsIcon,
  student: StudentIcon,
  "graduation-cap": GraduationCapIcon,
  briefcase: BriefcaseIcon,
  "chat-circle-dots": ChatCircleDotsIcon,
  "airplane-tilt": AirplaneTiltIcon,
  "moon-stars": MoonStarsIcon,
  bed: BedIcon,
  key: KeyIcon,
  fire: FireIcon,
  "list-checks": ListChecksIcon,
  "beer-bottle": BeerBottleIcon,
  champagne: ChampagneIcon,
  heart: HeartIcon,
  house: HouseIcon,
  "game-controller": GameControllerIcon,
  "mask-happy": MaskHappyIcon,
  "music-notes": MusicNotesIcon,
  sparkle: SparkleIcon,
};

export function PackGlyph({ icon, size = 24 }: { icon: string; size?: number }) {
  const Glyph = PACK_ICONS[icon] ?? CardsIcon;
  return <Glyph size={size} aria-hidden />;
}
