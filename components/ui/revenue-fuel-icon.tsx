import Svg, { Circle, G, Line, Path, Polygon, Polyline, Rect } from 'react-native-svg';

// Unten rechts: kleiner Stapel (2 Münzen), Dollar-Münze, hoher Stapel (4).
const COIN_HEIGHT = 1.7;
const COINS: [x: number, y: number, width: number][] = [
  [11.4, 19.6, 3.6], [11.4, 21.3, 3.6],
  [19.9, 16.2, 3.5], [19.9, 17.9, 3.5], [19.9, 19.6, 3.5], [19.9, 21.3, 3.5],
];

/**
 * Tab-Symbol der Umsatz-Tankliste des Chefs, nach der Vorlage: oben links
 * die Zapfsäule (Tankliste), diagonal getrennt, unten rechts Münzstapel mit
 * Dollar-Münze und steigendem Pfeil (Umsatzliste). Weder SF Symbols noch
 * Material Icons haben so eines, deshalb als eigene SVG — sieht auf iOS,
 * Android und im Web gleich aus.
 *
 * Auf 24×24 vereinfacht, damit es in der Tab-Leiste bei 28 px lesbar bleibt.
 * Die Farbe kommt wie bei den anderen Tabs aus der Tab-Leiste.
 */
export function RevenueFuelIcon({ size = 28, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* Zapfsäule: Gehäuse mit ausgespartem Fenster, Sockel */}
      <G fill={color}>
        <Path
          fillRule="evenodd"
          d="M2.5 1.5H6.5A1 1 0 0 1 7.5 2.5V10H1.5V2.5A1 1 0 0 1 2.5 1.5ZM2.7 2.8V5.3H6.3V2.8Z"
        />
        <Rect x={1} y={10} width={7} height={1.3} />
      </G>

      <G
        fill="none"
        stroke={color}
        strokeWidth={1}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Schlauch mit Zapfpistole */}
        <Path d="M7.5 6.2H8.3C8.8 6.2 9 6.5 9 7V9.3C9 9.9 9.4 10.2 9.8 10.2C10.3 10.2 10.6 9.9 10.6 9.3V4.6L8.6 2.4" />

        {/* Trennlinie */}
        <Line x1={1.2} y1={22.8} x2={22.8} y2={1.2} strokeWidth={1.1} />

        {/* Münzstapel */}
        {COINS.map(([x, y, width]) => (
          <Rect
            key={`${x}-${y}`}
            x={x}
            y={y}
            width={width}
            height={COIN_HEIGHT}
            rx={COIN_HEIGHT / 2}
          />
        ))}

        {/* Dollar-Münze */}
        <Circle cx={17.5} cy={20.6} r={2.2} />
        <Path
          strokeWidth={0.8}
          d="M18.38 19.79C18.23 19.5 17.94 19.35 17.5 19.35C16.99 19.35 16.62 19.65 16.62 20.01C16.62 20.82 18.38 20.38 18.38 21.19C18.38 21.55 18.01 21.85 17.5 21.85C17.06 21.85 16.69 21.7 16.55 21.41M17.5 18.84V19.35M17.5 21.85V22.36"
        />

        {/* Steigender Pfeil mit Knick */}
        <Polyline points="12.5,15.5 15.5,12.5 17,14 21,10" strokeWidth={1.1} />
        <Polygon points="22.9,8.1 22.05,10.93 20.07,8.95" fill={color} />
      </G>
    </Svg>
  );
}
