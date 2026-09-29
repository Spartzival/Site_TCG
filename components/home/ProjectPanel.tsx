"use client";

import Link from "next/link";
import type { CSSProperties, MouseEvent } from "react";
import type { CardProject } from "@/types/project";

type ProjectPanelProps = {
  project: CardProject;
  active: boolean;
  muted: boolean;
  entering: boolean;
  exiting: boolean;
  index: number;
  onActivate: () => void;
  onDeactivate: () => void;
  onOpen: () => void;
};

export function ProjectPanel({
  project,
  active,
  muted,
  entering,
  exiting,
  index,
  onActivate,
  onDeactivate,
  onOpen,
}: ProjectPanelProps) {
  const style = {
    "--accent-primary": project.accent.primary,
    "--accent-secondary": project.accent.secondary,
    "--accent-glow": project.accent.glow,
  } as CSSProperties;

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();
    onOpen();
  };

  return (
    <article
      className={`project-panel ${active ? "is-active" : ""} ${muted ? "is-muted" : ""} ${entering ? "is-entering" : ""} ${exiting ? "is-exiting" : ""}`}
      style={style}
      data-theme={project.theme}
      onMouseEnter={onActivate}
      onMouseLeave={onDeactivate}
      onFocus={onActivate}
      onBlur={onDeactivate}
    >
      <div className="project-panel__art" aria-hidden="true">
        <div className="project-panel__aurora" />

        <div className="project-panel__scene">
          <div className="project-panel__scene-one" />
          <div className="project-panel__scene-two" />
          <div className="project-panel__scene-three" />
        </div>

        <div className="project-panel__grid" />
        <div className="project-panel__vignette" />
      </div>

      <Link
        href={project.href}
        className="project-panel__link"
        aria-label={`Ouvrir ${project.name}`}
        onClick={handleClick}
      >
        <div className="project-panel__topline">
          <span>{project.eyebrow}</span>
          {project.status && (
            <span className="project-panel__status">{project.status}</span>
          )}
        </div>

        <div className="project-panel__content">
          <p className="project-panel__index">
            {String(index + 1).padStart(2, "0")}
          </p>

          <h2>{project.name}</h2>

          <p className="project-panel__description">{project.description}</p>

          <div className="project-panel__meta" aria-label="Sections principales">
            {project.meta.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>

        <div className="project-panel__cta">
          <span>Enter project</span>
          <span className="project-panel__arrow" aria-hidden="true">
            ↗
          </span>
        </div>
      </Link>

      <div className="project-panel__transition-title" aria-hidden="true">
        <span>{project.eyebrow}</span>
        <strong>{project.name}</strong>
      </div>
    </article>
  );
}
