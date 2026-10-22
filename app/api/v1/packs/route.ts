import { route } from "@/lib/api/handler";
import { livePacks } from "@/lib/api/packs";

export const GET = route(async () => livePacks());
