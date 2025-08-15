import ResultsPageClient from "./ResultsPageClient";

export default function ResultsPage({ searchParams }) {
  return (
    <ResultsPageClient
      query={searchParams.location || ""}
      radiusMiles={searchParams.radius || "10"}
    />
  );
}
