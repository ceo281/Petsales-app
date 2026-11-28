import Checker, { type Keys } from "./components/Checker";

// Read at request time so the page's check count always matches what the server can run.
export const dynamic = "force-dynamic";

export default function Page() {
  const keys: Keys = {
    vision: Boolean(process.env.GOOGLE_VISION_API_KEY),
    brave: Boolean(process.env.BRAVE_SEARCH_API_KEY),
    abr: Boolean(process.env.ABR_GUID),
  };
  return <Checker keys={keys} />;
}
