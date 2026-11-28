import Checker, { type Keys } from "./components/Checker";
import { getCheckCount } from "../lib/counter";

// Read at request time so the check count and the running total are always current.
export const dynamic = "force-dynamic";

export default async function Page() {
  const keys: Keys = {
    vision: Boolean(process.env.GOOGLE_VISION_API_KEY || process.env.SERPER_API_KEY),
    serper: Boolean(process.env.SERPER_API_KEY),
    abr: Boolean(process.env.ABR_GUID),
  };
  const total = await getCheckCount();
  return <Checker keys={keys} initialTotal={total} />;
}
