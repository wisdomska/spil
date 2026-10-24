import { notFound } from "next/navigation";
import { IntlScope } from "@/components/site/IntlScope";
import { KitchenSink } from "./KitchenSink";

export const metadata = { title: "Kitchen sink", robots: { index: false } };

export default function Page() {
  if (process.env.APP_ENV === "production") notFound();
  return (
    <IntlScope scope="all">
      <KitchenSink />
    </IntlScope>
  );
}
