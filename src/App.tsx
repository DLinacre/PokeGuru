import { lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ErrorBoundary from "./components/UI/ErrorBoundary";
import Layout from "./components/Layout/Layout";
import HomePage from "./pages/HomePage";

/**
 * PokeGuru — a fast, open Pokémon TCG database.
 *
 * The homepage ships in the entry chunk so the first paint is immediate;
 * every other route is split into its own lazily loaded chunk (Suspense
 * fallbacks live in Layout so the shell never flashes).
 */
const SearchPage = lazy(() => import("./pages/SearchPage"));
const CardDetailPage = lazy(() => import("./pages/CardDetailPage"));
const SetsPage = lazy(() => import("./pages/SetsPage"));
const SetDetailPage = lazy(() => import("./pages/SetDetailPage"));
const ScannerPage = lazy(() => import("./pages/ScannerPage"));
const PacksPage = lazy(() => import("./pages/PacksPage"));
const PackOpenPage = lazy(() => import("./pages/PackOpenPage"));
const SimCollectionPage = lazy(() => import("./pages/SimCollectionPage"));
const PackHistoryPage = lazy(() => import("./pages/PackHistoryPage"));
const WikiPage = lazy(() => import("./pages/WikiPage"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const CollectionPage = lazy(() => import("./pages/CollectionPage"));
const Top100Page = lazy(() => import("./pages/Top100Page"));
const FlyerPage = lazy(() => import("./pages/FlyerPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));

/**
 * Base path derived from Vite's `base`: "/" on Vercel, "/PokeGuru/" on the
 * GitHub Pages build. React Router wants no trailing slash.
 */
function routerBasename(): string | undefined {
  const base = import.meta.env.BASE_URL;
  if (!base || base === "/") return undefined;
  return base.replace(/\/$/, "");
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter basename={routerBasename()}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="search" element={<SearchPage />} />
            <Route path="card/:id" element={<CardDetailPage />} />
            <Route path="sets" element={<SetsPage />} />
            <Route path="set/:id" element={<SetDetailPage />} />
            <Route path="wiki" element={<WikiPage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="collection" element={<CollectionPage />} />
            <Route path="scanner" element={<ScannerPage />} />
            <Route path="packs" element={<PacksPage />} />
            <Route path="packs/collection" element={<SimCollectionPage />} />
            <Route path="packs/history" element={<PackHistoryPage />} />
            <Route path="packs/:setId" element={<PackOpenPage />} />
            <Route path="top-100" element={<Top100Page />} />
            <Route path="flyer" element={<FlyerPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
