"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CardProject } from "@/types/project";
import { ProjectPanel } from "./ProjectPanel";

type ProjectSelectorProps = {
  projects: CardProject[];
};

export function ProjectSelector({ projects }: ProjectSelectorProps) {
  const router = useRouter();
  const navigationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [enteringId, setEnteringId] = useState<string | null>(null);

  useEffect(() => {
    projects.forEach((project) => router.prefetch(project.href));

    return () => {
      if (navigationTimer.current) {
        clearTimeout(navigationTimer.current);
      }
    };
  }, [projects, router]);

  const handleOpen = (project: CardProject) => {
    if (enteringId) return;

    setActiveId(project.id);
    setEnteringId(project.id);

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    navigationTimer.current = setTimeout(
      () => router.push(project.href),
      reducedMotion ? 40 : 920,
    );
  };

  const transitioning = enteringId !== null;

  return (
    <main
      className={`project-selector ${transitioning ? "is-transitioning" : ""}`}
    >
      <div className="project-selector__brand" aria-hidden="true">
        <span>G.M.</span>
        <span>Card Projects</span>
      </div>

      <section className="project-selector__panels" aria-label="Sélection du projet">
        {projects.map((project, index) => {
          const entering = enteringId === project.id;
          const exiting = transitioning && enteringId !== project.id;

          return (
            <ProjectPanel
              key={project.id}
              project={project}
              index={index}
              active={activeId === project.id || entering}
              muted={!transitioning && activeId !== null && activeId !== project.id}
              entering={entering}
              exiting={exiting}
              onActivate={() => {
                if (!transitioning) setActiveId(project.id);
              }}
              onDeactivate={() => {
                if (!transitioning) setActiveId(null);
              }}
              onOpen={() => handleOpen(project)}
            />
          );
        })}
      </section>

      <div className="project-selector__footer" aria-hidden="true">
        <span>{String(projects.length).padStart(2, "0")} projects</span>
        <span>Personal card game archive</span>
      </div>
    </main>
  );
}
