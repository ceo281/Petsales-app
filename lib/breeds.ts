/**
 * Rough Australian asking-price ranges (AUD) for puppies/kittens from
 * registered breeders, 2024-2026. These are deliberately broad and are only
 * used to flag prices that are implausibly LOW — the classic scam lure.
 * Review and update these with real PetSales market data.
 */
export const BREED_PRICES: { names: string[]; low: number; high: number }[] = [
  { names: ["french bulldog", "frenchie"], low: 3500, high: 9000 },
  { names: ["british bulldog", "english bulldog"], low: 3500, high: 8000 },
  { names: ["cavoodle", "cavapoo"], low: 3000, high: 7000 },
  { names: ["groodle", "goldendoodle"], low: 3000, high: 7000 },
  { names: ["labradoodle"], low: 2500, high: 6000 },
  { names: ["moodle", "maltipoo", "maltipom", "spoodle", "cockapoo"], low: 2500, high: 6000 },
  { names: ["golden retriever"], low: 2500, high: 6000 },
  { names: ["labrador"], low: 1500, high: 5000 },
  { names: ["cavalier king charles", "cavalier"], low: 2500, high: 6000 },
  { names: ["pomeranian"], low: 2000, high: 6000 },
  { names: ["dachshund", "sausage dog", "miniature dachshund"], low: 2500, high: 7000 },
  { names: ["border collie"], low: 1200, high: 3500 },
  { names: ["german shepherd"], low: 1500, high: 4500 },
  { names: ["rottweiler"], low: 1500, high: 4500 },
  { names: ["staffordshire bull terrier", "staffy", "staffie"], low: 1000, high: 3500 },
  { names: ["american bully", "xl bully"], low: 2000, high: 8000 },
  { names: ["pug"], low: 2000, high: 5000 },
  { names: ["shih tzu"], low: 1500, high: 4500 },
  { names: ["maltese"], low: 1500, high: 4500 },
  { names: ["chihuahua"], low: 1500, high: 5000 },
  { names: ["toy poodle", "miniature poodle", "poodle"], low: 2500, high: 6000 },
  { names: ["siberian husky", "husky"], low: 1500, high: 4000 },
  { names: ["samoyed"], low: 3000, high: 7000 },
  { names: ["corgi"], low: 3000, high: 7000 },
  { names: ["australian shepherd", "aussie shepherd"], low: 2000, high: 5000 },
  { names: ["border terrier", "jack russell"], low: 1000, high: 3500 },
  { names: ["ragdoll"], low: 1200, high: 3500 },
  { names: ["british shorthair"], low: 1500, high: 4000 },
  { names: ["maine coon"], low: 1500, high: 4500 },
  { names: ["sphynx", "sphinx cat"], low: 2500, high: 5500 },
  { names: ["bengal"], low: 1500, high: 4000 },
  { names: ["scottish fold"], low: 1500, high: 4000 },
];

export function findBreed(text: string) {
  const t = text.toLowerCase();
  for (const b of BREED_PRICES) {
    for (const n of b.names) if (t.includes(n)) return { name: n, ...b };
  }
  return undefined;
}
