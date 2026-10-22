import { getRequestConfig } from "next-intl/server";
import messages from "@/messages/en.json";

// English only for v1 (spec section 3). No locale routing; every request uses "en".
export default getRequestConfig(async () => ({
  locale: "en",
  messages,
  timeZone: "Africa/Accra",
}));
