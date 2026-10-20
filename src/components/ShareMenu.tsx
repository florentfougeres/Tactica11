// The "Partager" button of every pitch view (Compo, Phase arrêtée, Séquence):
// same place, same look, only the items change with the view.
import PopMenu from "./PopMenu";

export interface ShareItem {
  label: string;
  ext: string;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  keepOpen?: boolean; // e.g. "Copier le lien" shows its confirmation in place
}

export default function ShareMenu({ items }: { items: ShareItem[] }) {
  return (
    <PopMenu button="Partager" title="Partager" className="btn btn--primary share-btn" align="right">
      {items.map((it) => (
        <button
          key={it.label}
          type="button"
          role="menuitem"
          className="seq-menu__item share-menu__item"
          disabled={it.disabled}
          title={it.title}
          data-keep={it.keepOpen ? "" : undefined}
          onClick={it.onClick}
        >
          <span>{it.label}</span>
          <span className="share-menu__ext">{it.ext}</span>
        </button>
      ))}
    </PopMenu>
  );
}
