import { Colors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import React from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, G, Rect } from "react-native-svg";

/**
 * Schematische Produktansicht für den Hero der Startseite: ein Fenster mit
 * der Auftragsliste des Chefs und davor ein Telefon mit der Fahreransicht.
 *
 * Bewusst als Zeichnung und nicht als Screenshot: Sie bleibt auf jedem
 * Bildschirm scharf, zeigt keine echten Kundendaten und veraltet nicht,
 * sobald sich an der Oberfläche etwas ändert.
 */

const WIDTH = 520;
const HEIGHT = 400;

/**
 * Die Zeichnung liegt auf dem Seitenhintergrund und muss in beiden Modi
 * sichtbar bleiben: im Dark Mode helle Flächen auf Dunkel, im Light Mode
 * dunkle Konturen auf Weiß.
 */
function paletteFor(scheme: "light" | "dark") {
  if (scheme === "dark") {
    return {
      shell: Colors.ui.charcoal,
      surface: "rgba(255,255,255,0.06)",
      surfaceStrong: "rgba(255,255,255,0.10)",
      line: "rgba(255,255,255,0.16)",
      textStrong: "rgba(255,255,255,0.55)",
      textWeak: "rgba(255,255,255,0.28)",
      onFill: "rgba(255,255,255,0.75)",
      accent: Colors.ui.darkModeRed,
    };
  }
  return {
    shell: "#FFFFFF",
    surface: "rgba(0,0,0,0.03)",
    surfaceStrong: "rgba(0,0,0,0.06)",
    line: "rgba(0,0,0,0.14)",
    textStrong: "rgba(0,0,0,0.45)",
    textWeak: "rgba(0,0,0,0.20)",
    onFill: "rgba(255,255,255,0.85)",
    accent: Colors.ui.primary,
  };
}

type Palette = ReturnType<typeof paletteFor>;

/** Eine Auftragszeile im Fenster: roter Balken, zwei Textzeilen, Status-Pille */
function OrderRow({ y, status, p }: { y: number; status: string; p: Palette }) {
  return (
    <G>
      <Rect x={24} y={y} width={244} height={56} rx={10} fill={p.surfaceStrong} />
      <Rect x={24} y={y} width={4} height={56} rx={2} fill={Colors.ui.primary} />
      <Rect x={40} y={y + 16} width={116} height={8} rx={4} fill={p.textStrong} />
      <Rect x={40} y={y + 32} width={84} height={6} rx={3} fill={p.textWeak} />
      <Rect x={196} y={y + 18} width={56} height={16} rx={8} fill={status} />
    </G>
  );
}

export function HeroPreview({ style }: { style?: StyleProp<ViewStyle> }) {
  const { scheme } = useAppTheme();
  const p = paletteFor(scheme);

  return (
    <View style={[{ width: "100%", aspectRatio: WIDTH / HEIGHT }, style]}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        {/* Fenster mit der Auftragsliste */}
        <Rect x={8} y={24} width={424} height={296} rx={16} fill={p.surface} stroke={p.line} />
        <Rect x={8} y={24} width={424} height={40} rx={16} fill={p.surface} />
        <Circle cx={32} cy={44} r={4} fill={p.textWeak} />
        <Circle cx={48} cy={44} r={4} fill={p.textWeak} />
        <Circle cx={64} cy={44} r={4} fill={p.textWeak} />
        <Rect x={8} y={64} width={424} height={1} fill={p.line} />

        {/* Überschrift der Liste */}
        <Rect x={24} y={84} width={96} height={10} rx={5} fill={p.textStrong} />
        <Rect x={212} y={80} width={56} height={18} rx={9} fill={Colors.ui.primary} />

        {/* Aufträge mit den drei Status: offen, unterwegs, erledigt */}
        <OrderRow y={112} status={Colors.status.offen} p={p} />
        <OrderRow y={180} status={Colors.status.unterwegs} p={p} />
        <OrderRow y={248} status={Colors.status.erledigt} p={p} />

        {/* Seitenspalte mit Kennzahlen */}
        <Rect x={292} y={84} width={120} height={64} rx={10} fill={p.surfaceStrong} />
        <Rect x={308} y={104} width={36} height={14} rx={4} fill={p.textStrong} />
        <Rect x={308} y={126} width={60} height={6} rx={3} fill={p.textWeak} />
        <Rect x={292} y={160} width={120} height={64} rx={10} fill={p.surfaceStrong} />
        <Rect x={308} y={180} width={28} height={14} rx={4} fill={p.textStrong} />
        <Rect x={308} y={202} width={68} height={6} rx={3} fill={p.textWeak} />

        {/* Telefon mit der Fahreransicht, überlappt das Fenster */}
        <G>
          <Rect x={332} y={150} width={172} height={240} rx={26} fill={p.shell} stroke={p.line} />
          <Rect x={342} y={160} width={152} height={220} rx={18} fill={p.surface} />
          {/* Kopfzeile der App */}
          <Rect x={342} y={160} width={152} height={44} rx={18} fill={Colors.ui.primary} />
          <Rect x={342} y={186} width={152} height={18} fill={Colors.ui.primary} />
          <Rect x={356} y={174} width={72} height={8} rx={4} fill={p.onFill} />
          {/* Auftragskarten des Fahrers */}
          <Rect x={356} y={218} width={124} height={62} rx={10} fill={p.surfaceStrong} />
          <Rect x={356} y={218} width={3} height={62} rx={2} fill={p.accent} />
          <Rect x={368} y={232} width={56} height={7} rx={3} fill={p.textStrong} />
          <Rect x={368} y={246} width={88} height={6} rx={3} fill={p.textWeak} />
          <Rect x={368} y={260} width={70} height={6} rx={3} fill={p.textWeak} />
          <Rect x={356} y={292} width={124} height={62} rx={10} fill={p.surfaceStrong} />
          <Rect x={356} y={292} width={3} height={62} rx={2} fill={Colors.status.erledigt} />
          <Rect x={368} y={306} width={56} height={7} rx={3} fill={p.textStrong} />
          <Rect x={368} y={320} width={88} height={6} rx={3} fill={p.textWeak} />
          <Rect x={368} y={334} width={62} height={6} rx={3} fill={p.textWeak} />
        </G>
      </Svg>
    </View>
  );
}
