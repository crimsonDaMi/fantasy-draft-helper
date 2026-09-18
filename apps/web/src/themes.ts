export interface ThemeDefinition {
  id: string;
  name: string;
  team: string;
  division: string;
  description: string;
  base: string;
  accent: string;
}

export const THEMES: ThemeDefinition[] = [
  // AFC East
  {
    id: "blizzard",
    name: "Blizzard",
    team: "Buffalo Bills",
    division: "AFC East",
    description: "Buffalo's famous winter storms",
    base: "#00338D",
    accent: "#C60C30",
  },
  {
    id: "lagoon",
    name: "Lagoon",
    team: "Miami Dolphins",
    division: "AFC East",
    description: "Warm coastal waters",
    base: "#005778",
    accent: "#FC4C02",
  },
  {
    id: "beacon",
    name: "Beacon",
    team: "New England Patriots",
    division: "AFC East",
    description: 'Boston, "city upon a hill"',
    base: "#002244",
    accent: "#C60C30",
  },
  {
    id: "runway",
    name: "Runway",
    team: "New York Jets",
    division: "AFC East",
    description: "Aviation, the open sky",
    base: "#125740",
    accent: "#FFFFFF",
  },

  // AFC North
  {
    id: "nevermore",
    name: "Nevermore",
    team: "Baltimore Ravens",
    division: "AFC North",
    description: "Poe's Baltimore",
    base: "#241773",
    accent: "#9E7C0C",
  },
  {
    id: "ember",
    name: "Ember",
    team: "Cincinnati Bengals",
    division: "AFC North",
    description: "Stripes and fire",
    base: "#101010",
    accent: "#FB4F14",
  },
  {
    id: "rust",
    name: "Rust",
    team: "Cleveland Browns",
    division: "AFC North",
    description: "Rust Belt heritage",
    base: "#311D00",
    accent: "#FF3C00",
  },
  {
    id: "steel",
    name: "Steel",
    team: "Pittsburgh Steelers",
    division: "AFC North",
    description: "Coal, iron, and steel",
    base: "#101820",
    accent: "#FFB612",
  },

  // AFC South
  {
    id: "lonestar",
    name: "Lonestar",
    team: "Houston Texans",
    division: "AFC South",
    description: "The Texas state flag",
    base: "#03202F",
    accent: "#A71930",
  },
  {
    id: "brickyard",
    name: "Brickyard",
    team: "Indianapolis Colts",
    division: "AFC South",
    description: "The Indianapolis Motor Speedway",
    base: "#002C5F",
    accent: "#A2AAAD",
  },
  {
    id: "everglade",
    name: "Everglade",
    team: "Jacksonville Jaguars",
    division: "AFC South",
    description: "Florida's wetlands",
    base: "#006778",
    accent: "#D7A22A",
  },
  {
    id: "colossus",
    name: "Colossus",
    team: "Tennessee Titans",
    division: "AFC South",
    description: "Ancient titans",
    base: "#0C2340",
    accent: "#C8102E",
  },

  // AFC West
  {
    id: "summit",
    name: "Summit",
    team: "Denver Broncos",
    division: "AFC West",
    description: "The Mile High City",
    base: "#002244",
    accent: "#FB4F14",
  },
  {
    id: "prairie",
    name: "Prairie",
    team: "Kansas City Chiefs",
    division: "AFC West",
    description:
      "The Great Plains (background derived — the Chiefs' official palette has no dark swatch)",
    base: "#3D0A12",
    accent: "#FFB81C",
  },
  {
    id: "renegade",
    name: "Renegade",
    team: "Las Vegas Raiders",
    division: "AFC West",
    description: "Outlaw spirit",
    base: "#000000",
    accent: "#A5ACAF",
  },
  {
    id: "voltage",
    name: "Voltage",
    team: "Los Angeles Chargers",
    division: "AFC West",
    description: "A bolt of lightning (background derived from Powder Blue)",
    base: "#001F33",
    accent: "#FFC20E",
  },

  // NFC East
  {
    id: "trinity",
    name: "Trinity",
    team: "Dallas Cowboys",
    division: "NFC East",
    description: "The river through Dallas",
    base: "#041E42",
    accent: "#869397",
  },
  {
    id: "empire",
    name: "Empire",
    team: "New York Giants",
    division: "NFC East",
    description: 'New York, "The Empire State"',
    base: "#0B2265",
    accent: "#A71930",
  },
  {
    id: "independence",
    name: "Independence",
    team: "Philadelphia Eagles",
    division: "NFC East",
    description: "Birthplace of American independence",
    base: "#004C54",
    accent: "#A5ACAF",
  },
  {
    id: "capitol",
    name: "Capitol",
    team: "Washington Commanders",
    division: "NFC East",
    description: "The nation's capital",
    base: "#5A1414",
    accent: "#FFB612",
  },

  // NFC North
  {
    id: "tundra",
    name: "Tundra",
    team: "Green Bay Packers",
    division: "NFC North",
    description: "Lambeau Field's Frozen Tundra",
    base: "#203731",
    accent: "#FFB612",
  },
  {
    id: "windy",
    name: "Windy",
    team: "Chicago Bears",
    division: "NFC North",
    description: "The Windy City",
    base: "#0B162A",
    accent: "#C83803",
  },
  {
    id: "motor",
    name: "Motor",
    team: "Detroit Lions",
    division: "NFC North",
    description: "The Motor City (background derived from Honolulu Blue)",
    base: "#052F44",
    accent: "#B0B7BC",
  },
  {
    id: "fjord",
    name: "Fjord",
    team: "Minnesota Vikings",
    division: "NFC North",
    description: "Minnesota's Scandinavian heritage",
    base: "#4F2683",
    accent: "#FFC62F",
  },

  // NFC South
  {
    id: "peachtree",
    name: "Peachtree",
    team: "Atlanta Falcons",
    division: "NFC South",
    description:
      "Atlanta's namesake street (background derived from Falcons Red)",
    base: "#2A0812",
    accent: "#A5ACAF",
  },
  {
    id: "piedmont",
    name: "Piedmont",
    team: "Carolina Panthers",
    division: "NFC South",
    description: "The Carolina Piedmont region",
    base: "#101820",
    accent: "#0085CA",
  },
  {
    id: "bayou",
    name: "Bayou",
    team: "New Orleans Saints",
    division: "NFC South",
    description: "Louisiana wetlands",
    base: "#101820",
    accent: "#D3BC8D",
  },
  {
    id: "corsair",
    name: "Corsair",
    team: "Tampa Bay Buccaneers",
    division: "NFC South",
    description: "A pirate ship",
    base: "#34302B",
    accent: "#FF7900",
  },

  // NFC West
  {
    id: "canyon",
    name: "Canyon",
    team: "Arizona Cardinals",
    division: "NFC West",
    description: "Arizona's desert canyons",
    base: "#97233F",
    accent: "#FFB612",
  },
  {
    id: "horizon",
    name: "Horizon",
    team: "Los Angeles Rams",
    division: "NFC West",
    description: "The Pacific coastline at sunset",
    base: "#003594",
    accent: "#FFA300",
  },
  {
    id: "prospector",
    name: "Prospector",
    team: "San Francisco 49ers",
    division: "NFC West",
    description: "The 1849 California Gold Rush",
    base: "#AA0000",
    accent: "#B3995D",
  },
  {
    id: "sound",
    name: "Sound",
    team: "Seattle Seahawks",
    division: "NFC West",
    description: "The Puget Sound",
    base: "#002244",
    accent: "#69BE28",
  },
];

export const DEFAULT_THEME_ID = "tundra";

export function findTheme(id: string): ThemeDefinition {
  return (
    THEMES.find((theme) => theme.id === id) ??
    THEMES.find((theme) => theme.id === DEFAULT_THEME_ID)!
  );
}
