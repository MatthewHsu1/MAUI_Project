import { createFileRoute } from "@tanstack/react-router";
import { BondsPage } from "../features/bonds";

export const Route = createFileRoute("/bonds")({
  component: BondsPage,
});
