// Invented placeholder data for the dev-only #/mock pages. Nothing here is real; covers are
// generated as gradient data URIs by stubs.ts, so no image is ever requested from the network.
import { VIEW_IN_LIBRARY_TAG } from "@tagapp/utils";
import type { ContentServerType, CType, GroupsDB } from "@tagapp/utils/types";

export type Scenario =
  | "normal"
  | "stress"
  | "empty"
  | "noresults"
  | "loading"
  | "error";

export type GalleryEntry = {
  name: string;
  type: "video" | "img";
  cover?: string;
  createdAt: number;
  modifiedAt: number;
  tags?: string[];
};
export type AudioEntry = { name: string; cover?: string };
export type TxtData = {
  Texts: string[];
  Media: { name: string; type: "video" | "img" }[];
};

export type MockDb = {
  contents: Record<string, ContentServerType>;
  groups: GroupsDB;
  galleries: Record<string, GalleryEntry[]>;
  audios: Record<string, AudioEntry[]>;
  texts: Record<string, TxtData>;
  /** `<chapter file>` per item id -> markdown */
  chapters: Record<string, Record<string, string>>;
  /** Item ids whose video/cover files are "missing" (cover request fails). */
  noCover: Set<string>;
};

const BASE = 1_735_000_000; // fixed, so the data looks the same on every load
const DAY = 86_400;

/** Item ids the mock item pages open, per scenario. */
export const SAMPLE_ID = {
  normal: {
    img: "gen_imgSunrise1",
    video: "gen_vidPasta01",
    gallery: "gen_galHiking1",
    audio: "gen_audAmbient",
    txt: "gen_txtSourdgh",
  },
  stress: {
    img: "gen_title_stress_image_0123456789abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnopqrstuvwxyz",
    video:
      "gen_title_stress_video_0123456789abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnopqrstuvwxyz",
    gallery:
      "gen_title_stress_gallery_0123456789abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnopqrstuvwxyz",
    audio:
      "gen_title_stress_audio_0123456789abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnopqrstuvwxyz",
    txt: "gen_title_stress_text_0123456789abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnopqrstuvwxyz",
  },
} as const;

/** Cover shapes keyed by item id; anything not listed gets one from a hash of its URL. */
export const RATIO_BY_ID: Record<string, number> = {
  gen_imgSunrise1: 16 / 9,
  gen_vidPasta01: 16 / 9,
  gen_galHiking1: 4 / 3,
  gen_audAmbient: 1,
  gen_txtSourdgh: 3 / 4,
};

const NOTES = `Invented sample notes.

- First point, with **bold** text
- Second point with a [link](https://example.com)

> A short quote to check how block quotes look.`;

const LONG_NOTES = `${NOTES}

## A heading inside the notes

${"Plenty of text to make the notes long enough to wrap over many lines in a narrow column. ".repeat(6)}

\`\`\`
const aVeryLongCodeLineWithoutAnySpacesToTestHorizontalOverflow = "${"x".repeat(80)}";
\`\`\`

| Column A | Column B |
| --- | --- |
| one | two |

https://example.com/${"a-very-long-unbroken-url-segment-".repeat(4)}`;

type Seed = {
  id: string;
  title: string;
  type: CType;
  tags: string[];
  cover?: string;
  notes?: string;
};

const T = {
  video: ["Type:Video", "Site:YouTube", "Language:English", "Quality:1080p"],
  img: ["Type:Image", "Site:Gallery_Site", "Quality:4K"],
};

const NORMAL: Seed[] = [
  {
    id: "gen_vidPasta01",
    title: "Homemade pasta in 20 minutes",
    type: "video",
    tags: [
      ...T.video,
      "Topic:Cooking",
      "Series:Weeknight_Dinners",
      "meta:caption",
    ],
    notes: NOTES,
  },
  {
    id: "gen_imgSunrise1",
    title: "Sunrise over the harbour",
    type: "img",
    tags: [...T.img, "Topic:Travel", "Topic:Photography", "favourite"],
    notes: NOTES,
  },
  {
    id: "gen_galHiking1",
    title: "Weekend hiking trip",
    type: "gallery",
    tags: [
      "Type:Gallery",
      "Topic:Travel",
      "Topic:Outdoors",
      "view:autoplay",
      "view:grid-3",
      "view:sort-newest",
    ],
    cover: "photo_003.jpg",
    notes: NOTES,
  },
  {
    id: "gen_audAmbient",
    title: "Ambient focus mix",
    type: "audio",
    tags: ["Type:Audio", "Topic:Music", "Language:Instrumental"],
    cover: "cover.Track 01 - Morning light.jpg",
    notes: NOTES,
  },
  {
    id: "gen_txtSourdgh",
    title: "A beginner's guide to sourdough",
    type: "txt",
    tags: ["Type:Text", "Topic:Cooking", "Language:English"],
    cover: "figure-1.png",
    notes: NOTES,
  },
  {
    id: "gen_vidBirds001",
    title: "Field guide to local birds",
    type: "video",
    tags: [...T.video, "Topic:Nature", "Topic:Science", "meta:caption"],
  },
  {
    id: "gen_imgGarden01",
    title: "Tomato seedlings, week three",
    type: "img",
    tags: [...T.img, "Topic:Gardening"],
  },
  {
    id: "gen_vidWalkTour",
    title: "City walking tour: old town",
    type: "video",
    tags: ["Type:Video", "Site:Vimeo", "Topic:Travel", "Quality:4K"],
  },
  {
    id: "gen_audPodcast1",
    title: "Weekly science podcast, episode 12",
    type: "audio",
    tags: ["Type:Audio", "Topic:Science", "Language:English"],
  },
  {
    id: "gen_txtNotes001",
    title: "Notes on learning Spanish",
    type: "txt",
    tags: ["Type:Text", "Language:Spanish", "Topic:Languages"],
  },
  {
    id: "gen_galMarket01",
    title: "Saturday market",
    type: "gallery",
    tags: ["Type:Gallery", "Topic:Travel", "Topic:Food"],
    cover: "photo_001.jpg",
  },
  {
    id: "gen_vidKnots001",
    title: "Six useful knots",
    type: "video",
    tags: [...T.video, "Topic:Outdoors"],
  },
  {
    id: "gen_imgBridge01",
    title: "Old stone bridge",
    type: "img",
    tags: ["Type:Image", "Topic:Photography"],
  },
  {
    id: "gen_audRain0001",
    title: "Rain on a tin roof",
    type: "audio",
    tags: ["Type:Audio", "Topic:Ambience"],
  },
  {
    id: "gen_vidNoCover1",
    title: "Clip with no cover file",
    type: "video",
    tags: ["Type:Video", "Site:YouTube"],
  },
  {
    id: "gen_imgNoTags01",
    title: "Untagged photo",
    type: "img",
    tags: [],
  },
];

const LONG_TITLES = [
  "A remarkably long title that keeps going well past the width of a card, with several clauses, a colon: and some more words to push it onto many lines",
  "Averyveryveryveryveryveryveryveryverylongtitlewithnospacesatalltotestwordbreakingincardsandheaders_0123456789",
  "Tutorial part 12 — everything you need to know about setting up the whole thing from scratch (2024 edition, updated)",
];

const PARENTS = [
  "Topic",
  "Site",
  "Creator",
  "Series",
  "Language",
  "Quality",
  "Mood",
  "Place",
];

const manyTags = (n: number) =>
  Array.from(
    { length: n },
    (_, i) =>
      `${PARENTS[i % PARENTS.length]}:Sample_value_${String(i + 1).padStart(2, "0")}`,
  );

const TYPES: CType[] = ["img", "video", "gallery", "audio", "txt"];

function stressSeeds(): Seed[] {
  const out: Seed[] = TYPES.map((type) => ({
    id: SAMPLE_ID.stress[type],
    title: LONG_TITLES[TYPES.indexOf(type) % LONG_TITLES.length] as string,
    type,
    tags: manyTags(46),
    cover:
      type === "gallery"
        ? "photo_003.jpg"
        : type === "audio"
          ? "cover.Track 01 - Morning light.jpg"
          : type === "txt"
            ? "figure-1.png"
            : undefined,
    notes: LONG_NOTES,
  }));
  for (let i = 0; i < 40; i++) {
    const type = TYPES[i % TYPES.length] as CType;
    out.push({
      id:
        i % 7 === 0
          ? `gen_title_${"u".repeat(48)}${i}`
          : `gen_stress${String(i).padStart(4, "0")}`,
      title:
        i % 5 === 0
          ? (LONG_TITLES[i % LONG_TITLES.length] as string)
          : `Sample item ${i + 1}: ${["Short", "A somewhat longer title for the card", "Medium length title"][i % 3]}`,
      type,
      tags: i % 6 === 0 ? [] : manyTags(2 + ((i * 7) % 30)),
      cover:
        type === "gallery"
          ? "photo_001.jpg"
          : type === "audio"
            ? "cover.Track 01 - Morning light.jpg"
            : type === "txt"
              ? "figure-1.png"
              : undefined,
    });
  }
  return out;
}

const toItem = (s: Seed, i: number): ContentServerType => ({
  id: s.id,
  title: s.title,
  type: s.type,
  tags: s.tags,
  cover: s.cover,
  extraData: s.notes ?? "",
  added: BASE - i * DAY * 1.7,
  lastUpdated: BASE - i * DAY,
});

const pad = (n: number, w = 3) => String(n).padStart(w, "0");

function galleryEntries(count: number, longNames: boolean): GalleryEntry[] {
  return Array.from({ length: count }, (_, i) => {
    const isVideo = i % 6 === 5;
    const base =
      longNames && i % 4 === 0
        ? `${isVideo ? "clip" : "photo"}_${pad(i + 1)}_a_really_long_file_name_${"x".repeat(60)}`
        : `${isVideo ? "clip" : "photo"}_${pad(i + 1)}`;
    return {
      name: `${base}.${isVideo ? "mp4" : "jpg"}`,
      type: isVideo ? "video" : "img",
      cover: isVideo && i % 12 === 5 ? `cover.${base}.jpg` : undefined,
      createdAt: BASE - (count - i) * 3600,
      modifiedAt: BASE - (count - i) * 1800,
      tags:
        i % 3 === 0
          ? ["Place:Harbour", "Mood:Calm", "favourite"]
          : i % 10 === 1
            ? manyTags(18)
            : i % 3 === 1
              ? ["Place:Market", "Mood:Busy"]
              : [],
    };
  });
}

function audioEntries(count: number): AudioEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    name:
      i % 9 === 4
        ? `Track ${pad(i + 1, 2)} - A very long track name that goes on and on ${"and-on-".repeat(8)}.mp3`
        : `Track ${pad(i + 1, 2)} - ${["Morning light", "Slow river", "Quiet hours", "Paper boats"][i % 4]}.mp3`,
    cover: i % 3 === 0 ? `cover.Track ${pad(i + 1, 2)}.jpg` : undefined,
  }));
}

const chapterNames = (n: number) =>
  Array.from({ length: n }, (_, i) => `Chapter ${i + 1}.md`);

function chapterText(name: string, long: boolean) {
  const para =
    "Invented sample prose that exists only to show how long lines wrap in the reader. ";
  return `# ${name.replace(/\.md$/, "")}

${para.repeat(long ? 8 : 3)}

## A subheading

- A list item
- Another list item with \`inline code\`

> A quote, to check block quote styling.

| Ingredient | Amount |
| --- | --- |
| Flour | 500 g |
| Water | 350 ml |

![Figure one](https://<SERVER_URL>media/Texts/figure-1.png)

${para.repeat(long ? 14 : 4)}
`;
}

export function buildDb(scenario: Scenario): MockDb {
  const db: MockDb = {
    contents: {},
    groups: {},
    galleries: {},
    audios: {},
    texts: {},
    chapters: {},
    noCover: new Set(["gen_vidNoCover1"]),
  };
  if (scenario === "empty") return db;

  const seeds = scenario === "stress" ? [...NORMAL, ...stressSeeds()] : NORMAL;
  seeds.forEach((s, i) => {
    db.contents[s.id] = toItem(s, i);
    const stress =
      s.id.startsWith("gen_title_") || s.id.startsWith("gen_stress");
    if (s.type === "gallery")
      db.galleries[s.id] = galleryEntries(
        s.id === SAMPLE_ID.stress.gallery ? 150 : stress ? 12 : 14,
        stress,
      );
    if (s.type === "audio")
      db.audios[s.id] = audioEntries(s.id === SAMPLE_ID.stress.audio ? 40 : 6);
    if (s.type === "txt") {
      const count = s.id === SAMPLE_ID.stress.txt ? 24 : 4;
      const texts = chapterNames(count);
      db.texts[s.id] = {
        Texts: texts,
        Media: [
          { name: "figure-1.png", type: "img" },
          { name: "figure-2.png", type: "img" },
          { name: "figure-3.png", type: "img" },
        ],
      };
      db.chapters[s.id] = Object.fromEntries(
        texts.map((t) => [t, chapterText(t, s.id === SAMPLE_ID.stress.txt)]),
      );
    }
  });
  addGroups(db, scenario);
  return db;
}

type GroupSeed = {
  id: string;
  title: string;
  tags: string[];
  cover?: string;
  extraData?: string;
  children: string[];
};

/**
 * Groups over the items above (invented). `gen_galMarket01` sits in two groups, one child opts in
 * to the main library with `view:in-library`, `grp_mockEmpty01` has no children (so no library card)
 * and `gen_imgNoTags01` points at a group id without a record (it stays visible).
 */
function addGroups(db: MockDb, scenario: Scenario) {
  const seeds: GroupSeed[] = [
    {
      id: "grp_mockTravel1",
      title: "Travel and outdoors",
      tags: ["Topic:Travel"],
      extraData: "Invented group description.",
      children: [
        "gen_imgSunrise1",
        "gen_galHiking1",
        "gen_galMarket01",
        "gen_imgBridge01",
      ],
    },
    {
      id: "grp_mockCooking1",
      title: "Kitchen and garden",
      tags: ["Topic:Cooking", "Series:Weeknight_Dinners"],
      cover: "/media/Images/.covers/cover.kitchen-and-garden",
      children: ["gen_vidPasta01", "gen_imgGarden01", "gen_galMarket01"],
    },
    { id: "grp_mockEmpty01", title: "Empty group", tags: [], children: [] },
  ];
  if (scenario === "stress")
    seeds.push({
      id: `grp_${"s".repeat(60)}`,
      title: `${"A very long group title that has to wrap. ".repeat(4)}`,
      tags: manyTags(40),
      children: Object.keys(db.contents)
        .filter((id) => id.startsWith("gen_stress"))
        .slice(0, 12),
    });
  const now = BASE;
  seeds.forEach((g, i) => {
    db.groups[g.id] = {
      id: g.id,
      title: g.title,
      extraData: g.extraData ?? "",
      tags: g.tags,
      cover: g.cover,
      added: now - i * DAY * 3,
      lastUpdated: now - i * DAY,
    };
    for (const id of g.children) {
      const c = db.contents[id];
      if (c) c.groups = [...(c.groups ?? []), g.id];
    }
  });
  const optIn = db.contents.gen_imgBridge01;
  if (optIn) optIn.tags = [...optIn.tags, VIEW_IN_LIBRARY_TAG];
  const ghost = db.contents.gen_imgNoTags01;
  if (ghost) ghost.groups = ["grp_mockGhost01"];
}

/** Tag -> number of items and groups using it, like DB/tags.json. */
export function countTags(db: MockDb): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const t of [
    ...Object.values(db.contents).flatMap((c) => c.tags),
    ...Object.values(db.groups).flatMap((g) => g.tags),
  ])
    counts[t] = (counts[t] ?? 0) + 1;
  return counts;
}

/** What `getSyncData` returns per pending item: the item plus its disk name and extensions. */
export type MockSyncItem = ContentServerType & { name: string; ext: string[] };

export function buildSync(scenario: Scenario): MockSyncItem[] {
  if (scenario === "empty") return [];
  const stress = scenario === "stress";
  const seeds: Seed[] = [
    {
      id: "gen_syncPhoto01",
      title: "Generated item with no metadata",
      type: "img",
      tags: [],
      notes: "Generated Data",
    },
    {
      id: "queue_vid_0001",
      title: "Downloaded clip with a caption",
      type: "video",
      tags: [...T.video, "meta:caption"],
    },
    {
      id: "queue_gal_0002",
      title: "Downloaded gallery",
      type: "gallery",
      tags: ["Type:Gallery", "Topic:Travel"],
    },
    {
      id: "queue_aud_0003",
      title: "Downloaded album",
      type: "audio",
      tags: ["Type:Audio", "Topic:Music"],
    },
    {
      id: "queue_txt_0004",
      title: "Downloaded story",
      type: "txt",
      tags: ["Type:Text", "Topic:Fiction"],
    },
    ...(stress
      ? Array.from({ length: 30 }, (_, i): Seed => {
          const type = TYPES[i % TYPES.length] as CType;
          return {
            id: `gen_syncStress${String(i).padStart(3, "0")}`,
            title:
              i % 4 === 0
                ? (LONG_TITLES[i % LONG_TITLES.length] as string)
                : `Pending item ${i + 1}`,
            type,
            tags: i % 5 === 0 ? [] : manyTags(2 + ((i * 7) % 30)),
          };
        })
      : []),
  ];
  return seeds.map((s, i) => {
    const name = `${s.title}.${s.id}`;
    return {
      ...toItem(s, i),
      name,
      ext:
        s.type === "img"
          ? ["webp", "png"]
          : s.type === "video"
            ? ["jpg", "mp4", "vtt"]
            : [],
    };
  });
}

/** One entry of the `downloads.watch` snapshot (`DownloadTask` of the server). */
export type MockTask = {
  id: string;
  title: string;
  scraper: string;
  url: string;
  cover?: string;
  type?: CType;
  status:
    | "queued"
    | "downloading"
    | "importing"
    | "completed"
    | "failed"
    | "cancelled";
  percent: number;
  speed: string;
  eta: string;
  error?: string;
  queuedAt: number;
  startedAt?: number;
  finishedAt?: number;
  added?: number;
};

/**
 * The initial download list: the first library items as completed history (with covers), a run in
 * progress (one downloading item, frozen: only "Cancel" moves it), one failure and queued items.
 */
export function buildDownloads(scenario: Scenario, db: MockDb) {
  if (scenario === "empty") return { running: false, tasks: [] as MockTask[] };
  const now = Math.floor(Date.now() / 1000);
  const scrapers = ["Example Videos", "Sample Gallery", "direct"];
  const task = (i: number, rest: Partial<MockTask>): MockTask => ({
    id: `queue_dl_${pad(i + 1)}`,
    title:
      scenario === "stress" && i % 4 === 0
        ? (LONG_TITLES[i % LONG_TITLES.length] as string)
        : `Queued download ${i + 1}`,
    scraper: scrapers[i % scrapers.length] as string,
    url: `https://example.invalid/item/${i + 1}`,
    // /media/ covers become gradients; the CSP blocks example.invalid, so those show the placeholder
    cover:
      i % 5 === 3
        ? undefined
        : i % 5 === 4
          ? `https://example.invalid/cover/${i + 1}.jpg`
          : `/media/Downloads/.covers/cover.dl-${i + 1}`,
    status: "queued",
    percent: 0,
    speed: "",
    eta: "--:--",
    queuedAt: now - 7200 + i * 60,
    ...rest,
  });
  const count = scenario === "stress" ? 24 : 5;
  const open = Array.from({ length: count }, (_, i) =>
    task(
      i,
      i === 0
        ? {
            status: "downloading",
            percent: 40,
            speed: "1.4MiB/s",
            eta: "00:03",
            startedAt: now - 60,
          }
        : i === 2
          ? {
              status: "cancelled",
              percent: 20,
              startedAt: now - 500,
              finishedAt: now - 450,
            }
          : i === 1
            ? {
                status: "failed",
                percent: 60,
                error:
                  `Mock failure: id queue_dl_002 is already in the library, and the files stay in Download/done/queue_dl_002. ${"More detail. ".repeat(scenario === "stress" ? 6 : 0)}`.trim(),
                startedAt: now - 3000,
                finishedAt: now - 2900,
              }
            : {},
    ),
  );
  const done: MockTask[] = Object.values(db.contents)
    .slice(0, scenario === "stress" ? 12 : 3)
    .map((c, i) => ({
      id: c.id,
      title: c.title,
      scraper: scrapers[i % scrapers.length] as string,
      url: `https://example.invalid/done/${i + 1}`,
      cover: `/media/Downloads/.covers/cover.done-${i + 1}`,
      type: c.type,
      status: "completed",
      percent: 100,
      speed: "",
      eta: "--:--",
      queuedAt: now - 90000 - i * 3600,
      startedAt: now - 89900 - i * 3600,
      finishedAt: now - 89800 - i * 3600,
      added: c.added,
    }));
  return { running: true, tasks: [...open, ...done] };
}

/** What `downloads.getErrorLog` returns: `[title]: message` plus a stack per failure, like the server. */
export function buildErrorLog(scenario: Scenario) {
  if (scenario === "empty") return "";
  const entry = (i: number) =>
    `[Queued download ${i}]: Mock failure: yt-dlp exited with code 1\n    at downloadItem (mock/download.ts:${10 + i}:5)\n    at async runItem (mock/runner.ts:${20 + i}:9)\n`;
  return Array.from({ length: scenario === "stress" ? 400 : 3 }, (_, i) =>
    entry(i + 1),
  ).join("");
}
