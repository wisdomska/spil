import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FixtureScreen } from "./FixtureScreen";

export const metadata = { title: "Fixture", robots: { index: false } };

async function Screen({ params }: { params: Promise<{ screen: string }> }) {
  const { screen } = await params;
  return <FixtureScreen screen={screen} />;
}

/** Dev and staging only: every room screen and state rendered from design fixtures. */
export default function Page({ params }: PageProps<"/dev/screens/[screen]">) {
  if (process.env.APP_ENV === "production") notFound();
  return (
    <Suspense>
      <Screen params={params} />
    </Suspense>
  );
}
