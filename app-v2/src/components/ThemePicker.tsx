import { ESTILOS, ESTILO_LABEL, MODOS, MODO_LABEL, type Prefs } from '../theme/theme';

interface Props { prefs: Prefs; onChange: (patch: Partial<Prefs>) => void }

// Selector de estilo y modo del espacio de trabajo. Cada muestra se pinta con su propio tema
// (data-style en la muestra) para que se vea el estilo antes de elegirlo.
export function ThemePicker({ prefs, onChange }: Props) {
  return (
    <div className="picker">
      <div className="picker-group" role="radiogroup" aria-label="Estilo">
        {ESTILOS.map((e) => (
          <button key={e} role="radio" aria-checked={prefs.estilo === e} className="swatch"
            data-style={e} data-mode="light" onClick={() => onChange({ estilo: e })}>
            <span className="swatch-dot" aria-hidden="true" />
            <span className="swatch-name">{ESTILO_LABEL[e]}</span>
          </button>
        ))}
      </div>
      <div className="seg" role="radiogroup" aria-label="Modo">
        {MODOS.map((m) => (
          <button key={m} role="radio" aria-checked={prefs.modo === m} onClick={() => onChange({ modo: m })}>
            {MODO_LABEL[m]}
          </button>
        ))}
      </div>
    </div>
  );
}
