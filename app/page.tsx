import { ProjectSelector } from "@/components/home/ProjectSelector";
import { projects } from "@/data/projects";

export default function Home() {
  return <ProjectSelector projects={projects} />;
}
