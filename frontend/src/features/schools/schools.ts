export type School = {
  slug: string;
  name: string;
  theName: string;
  short: string;
  city: string;
  lms: "Brightspace" | "Canvas";
  host: string;
  feedSteps: string[];
};

const CANVAS_STEPS = [
  "Log in to Canvas and click Calendar in the left-hand menu.",
  "Click Calendar Feed at the bottom of the right-hand sidebar.",
  "Copy the link that appears. It is private to you, so don't share it.",
];

const BRIGHTSPACE_STEPS = [
  "Log in to Brightspace and open the Calendar from the navigation bar.",
  "Open Settings (the gear) and tick Enable Calendar Feeds, then save.",
  "Click Subscribe, choose All Calendars and Tasks, and copy the link it gives you.",
];

export const SCHOOLS: School[] = [
  {
    slug: "uvic",
    name: "University of Victoria",
    theName: "the University of Victoria",
    short: "UVic",
    city: "Victoria",
    lms: "Brightspace",
    host: "bright.uvic.ca",
    feedSteps: BRIGHTSPACE_STEPS,
  },
  {
    slug: "sfu",
    name: "Simon Fraser University",
    theName: "Simon Fraser University",
    short: "SFU",
    city: "Burnaby",
    lms: "Canvas",
    host: "canvas.sfu.ca",
    feedSteps: CANVAS_STEPS,
  },
  {
    slug: "ubc",
    name: "University of British Columbia",
    theName: "the University of British Columbia",
    short: "UBC",
    city: "Vancouver",
    lms: "Canvas",
    host: "canvas.ubc.ca",
    feedSteps: CANVAS_STEPS,
  },
];

export function schoolBySlug(slug: string): School | undefined {
  return SCHOOLS.find((s) => s.slug === slug);
}
