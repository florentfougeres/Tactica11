import { useEffect, useState } from "react";

interface Props {
  onClose: () => void;
}

interface Step {
  icon: string;
  title: string;
  body: string;
}

// Walkthrough of the features that already ship, shown once on first launch and
// reopenable from the “?” button in the top bar.
const STEPS: Step[] = [
  {
    icon: "⬡",
    title: "Bienvenue sur Tactica11",
    body: "Construisez vos compos et mises en place tactiques de football, directement dans le navigateur — rien à installer, tout reste sur votre appareil.",
  },
  {
    icon: "📋",
    title: "Formations prêtes à l'emploi",
    body: "Choisissez un système (4-3-3, 4-2-3-1, 3-5-2…) dans la barre du haut. Les onze joueurs se replacent au ressort à chaque changement.",
  },
  {
    icon: "🔀",
    title: "Phases de jeu",
    body: "Basculez entre base, attaque et défense : chaque emplacement garde ses propres positions. Le slider Déf ↔ Att anime la transition.",
  },
  {
    icon: "👥",
    title: "Effectif & placement",
    body: "Glissez vos joueurs depuis le vivier vers le terrain, ou déplacez-les librement en attaque et en défense. Titulaires, remplaçants et numéros de maillot inclus.",
  },
  {
    icon: "🎯",
    title: "Zones d'influence",
    body: "Affichez la zone de couverture d'un joueur ou de toute l'équipe, avec des presets de rôles ajustables à la main.",
  },
  {
    icon: "✏️",
    title: "Calque de dessin",
    body: "Annotez chaque phase : flèches de course, passes en pointillés, tracés à main levée et zones colorées.",
  },
  {
    icon: "🟦",
    title: "Adversaires",
    body: "Placez les onze disques adverses en attaque et en défense, avec un sélecteur de couleur, pour illustrer le bloc d'en face.",
  },
  {
    icon: "🖥️",
    title: "Présentation & partage",
    body: "Passez en plein écran pour le vestiaire, puis partagez par lien, exportez en image PNG ou en fichier .json. Vos compos sont sauvegardées localement.",
  },
];

export default function Onboarding({ onClose }: Props) {
  const [i, setI] = useState(0);
  const last = i === STEPS.length - 1;
  const step = STEPS[i];

  const next = () => (last ? onClose() : setI((n) => n + 1));
  const prev = () => setI((n) => Math.max(0, n - 1));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  return (
    <div className="modal-backdrop" onPointerDown={onClose}>
      <div
        className="modal glass onboard"
        role="dialog"
        aria-modal="true"
        aria-label="Présentation de Tactica11"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button className="modal__close" onClick={onClose} aria-label="Fermer">
          ✕
        </button>

        <div className="onboard__hero" aria-hidden="true">
          {step.icon}
        </div>
        <div className="onboard__body">
          <h2 className="onboard__title">{step.title}</h2>
          <p className="onboard__text">{step.body}</p>
        </div>

        <div className="onboard__dots" role="tablist" aria-label="Étapes">
          {STEPS.map((s, n) => (
            <button
              key={s.title}
              role="tab"
              aria-selected={n === i}
              aria-label={`Étape ${n + 1} : ${s.title}`}
              className={`onboard__dot ${n === i ? "is-active" : ""}`}
              onClick={() => setI(n)}
            />
          ))}
        </div>

        <div className="onboard__nav">
          {i > 0 ? (
            <button className="btn" onClick={prev}>
              Précédent
            </button>
          ) : (
            <button className="btn onboard__skip" onClick={onClose}>
              Passer
            </button>
          )}
          <span className="onboard__count">
            {i + 1} / {STEPS.length}
          </span>
          <button className="btn btn--primary" onClick={next}>
            {last ? "Commencer" : "Suivant"}
          </button>
        </div>
      </div>
    </div>
  );
}
