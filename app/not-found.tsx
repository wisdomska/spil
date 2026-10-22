import { SiteHeader } from "@/components/site/SiteHeader";
import { ErrorScreen } from "@/components/site/ErrorScreen";

export default function NotFound() {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <SiteHeader back="/" />
      <ErrorScreen variant="notFoundPage" />
    </div>
  );
}
