import React from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, shadow, space } from "../lib/theme";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export function Screen({ children, scroll = true, padded = true, style }: { children: React.ReactNode; scroll?: boolean; padded?: boolean; style?: ViewStyle }) {
  const inner = <View style={[padded && styles.padded, style]}>{children}</View>;
  return (
    <SafeAreaView style={styles.screen} edges={["left", "right", "bottom"]}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Row({ children, style, gap = space.sm }: { children: React.ReactNode; style?: ViewStyle; gap?: number }) {
  return <View style={[{ flexDirection: "row", alignItems: "center", gap }, style]}>{children}</View>;
}

export function Spacer({ h = space.md }: { h?: number }) {
  return <View style={{ height: h }} />;
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

export function Title({ children }: { children: React.ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}
export function Subtitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.subtitle}>{children}</Text>;
}
export function Label({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}
export function Muted({ children, style }: { children: React.ReactNode; style?: object }) {
  return <Text style={[styles.muted, style]}>{children}</Text>;
}
export function Money({ value, tone = "neutral", size = 16 }: { value: number; tone?: "neutral" | "income" | "expense"; size?: number }) {
  const color = tone === "income" ? colors.income : tone === "expense" ? colors.expense : colors.text;
  const formatted = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
  return <Text style={{ fontSize: size, fontWeight: "600", color, fontVariant: ["tabular-nums"] }}>{formatted}</Text>;
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

export function Button({
  title,
  variant = "primary",
  loading,
  icon,
  style,
  disabled,
  ...rest
}: PressableProps & { title: string; variant?: ButtonVariant; loading?: boolean; icon?: IconName; style?: ViewStyle }) {
  const bg = variant === "primary" ? colors.primary : variant === "danger" ? colors.danger : variant === "secondary" ? colors.card : "transparent";
  const fg = variant === "primary" || variant === "danger" ? colors.primaryText : variant === "secondary" ? colors.text : colors.primary;
  const border = variant === "secondary" ? colors.border : "transparent";
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      style={({ pressed }) => [styles.button, { backgroundColor: bg, borderColor: border, opacity: pressed || disabled ? 0.7 : 1 }, style]}
      {...rest}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
      <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

export function TextField({ label, error, style, ...rest }: TextInputProps & { label?: string; error?: string | null }) {
  return (
    <View style={{ gap: 6 }}>
      {label ? <Label>{label}</Label> : null}
      <TextInput placeholderTextColor={colors.muted} style={[styles.input, error ? { borderColor: colors.danger } : null, style]} {...rest} />
      {error ? <Text style={{ color: colors.danger, fontSize: 12 }}>{error}</Text> : null}
    </View>
  );
}

export function Chip({ label, selected, onPress, onRemove }: { label: string; selected?: boolean; onPress?: () => void; onRemove?: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && { backgroundColor: colors.primary }]}>
      <Text style={[styles.chipText, selected && { color: colors.primaryText }]}>{label}</Text>
      {onRemove ? (
        <Pressable onPress={onRemove} hitSlop={8}>
          <Ionicons name="close-circle" size={16} color={selected ? colors.primaryText : colors.chipText} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

export function ChipGroup<T extends string>({ options, value, onChange, labels }: { options: readonly T[]; value: T | null; onChange: (v: T) => void; labels?: Partial<Record<T, string>> }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
      {options.map((o) => (
        <Chip key={o} label={labels?.[o] ?? o} selected={value === o} onPress={() => onChange(o)} />
      ))}
    </View>
  );
}

/** A simple cross-platform picker: tap to open a modal list. */
export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  placeholder = "Select…",
  renderLabel,
  allowCustom,
}: {
  label?: string;
  value: T | null;
  options: readonly T[];
  onChange: (v: T) => void;
  placeholder?: string;
  renderLabel?: (v: T) => string;
  /** Show a text field in the modal so users can type a new value. */
  allowCustom?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [custom, setCustom] = React.useState("");
  return (
    <View style={{ gap: 6 }}>
      {label ? <Label>{label}</Label> : null}
      <Pressable onPress={() => setOpen(true)} style={[styles.input, { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}>
        <Text style={{ color: value ? colors.text : colors.muted, fontSize: 16 }}>{value ? (renderLabel?.(value) ?? value) : placeholder}</Text>
        <Ionicons name="chevron-down" size={18} color={colors.muted} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            {label ? <Text style={[styles.label, { marginBottom: space.sm }]}>{label}</Text> : null}
            <ScrollView style={{ maxHeight: 360 }}>
              {options.map((o) => (
                <Pressable
                  key={o}
                  onPress={() => {
                    onChange(o);
                    setOpen(false);
                  }}
                  style={[styles.option, value === o && { backgroundColor: colors.chip }]}
                >
                  <Text style={{ fontSize: 16, color: colors.text }}>{renderLabel?.(o) ?? o}</Text>
                  {value === o ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
                </Pressable>
              ))}
            </ScrollView>
            {allowCustom ? (
              <Row style={{ marginTop: space.sm }}>
                <TextInput value={custom} onChangeText={setCustom} placeholder="Type a new value" placeholderTextColor={colors.muted} style={[styles.input, { flex: 1 }]} />
                <Button
                  title="Add"
                  variant="secondary"
                  onPress={() => {
                    if (custom.trim()) {
                      onChange(custom.trim() as T);
                      setCustom("");
                      setOpen(false);
                    }
                  }}
                />
              </Row>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

export function ErrorBanner({ message, onRetry, actionTitle, onAction }: { message: string | null | undefined; onRetry?: () => void; actionTitle?: string; onAction?: () => void }) {
  if (!message) return null;
  return (
    <View style={styles.errorBanner}>
      <Ionicons name="alert-circle" size={18} color={colors.danger} />
      <Text style={{ color: colors.danger, flex: 1 }}>{message}</Text>
      {onRetry ? <Button title="Retry" variant="ghost" onPress={onRetry} /> : null}
      {onAction && actionTitle ? <Button title={actionTitle} variant="ghost" onPress={onAction} /> : null}
    </View>
  );
}

export function WarningList({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <View style={styles.warningBox}>
      {items.map((w, i) => (
        <Row key={i} style={{ alignItems: "flex-start" }}>
          <Ionicons name="warning" size={16} color={colors.warning} />
          <Text style={{ color: "#92400E", flex: 1 }}>{w}</Text>
        </Row>
      ))}
    </View>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: IconName; title: string; body?: string; action?: React.ReactNode }) {
  return (
    <View style={{ alignItems: "center", padding: space.xxl, gap: space.sm }}>
      <Ionicons name={icon} size={40} color={colors.muted} />
      <Text style={{ fontSize: 18, fontWeight: "600", color: colors.text, textAlign: "center" }}>{title}</Text>
      {body ? <Muted style={{ textAlign: "center" }}>{body}</Muted> : null}
      {action ? <View style={{ marginTop: space.sm }}>{action}</View> : null}
    </View>
  );
}

export function Loading({ label }: { label?: string }) {
  return (
    <View style={{ padding: space.xxl, alignItems: "center", gap: space.sm }}>
      <ActivityIndicator color={colors.primary} />
      {label ? <Muted>{label}</Muted> : null}
    </View>
  );
}

export function ListItem({ title, subtitle, right, onPress, icon }: { title: string; subtitle?: string; right?: React.ReactNode; onPress?: () => void; icon?: IconName }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.listItem, pressed && onPress ? { opacity: 0.7 } : null]}>
      {icon ? <Ionicons name={icon} size={22} color={colors.muted} style={{ marginRight: space.md }} /> : null}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: "500", color: colors.text }} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </Pressable>
  );
}

export function Badge({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "success" | "warning" }) {
  const bg = tone === "success" ? "#ECFDF5" : tone === "warning" ? "#FFFBEB" : colors.chip;
  const fg = tone === "success" ? colors.success : tone === "warning" ? colors.warning : colors.chipText;
  return (
    <View style={{ backgroundColor: bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
      <Text style={{ color: fg, fontSize: 12, fontWeight: "600" }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { flexGrow: 1 },
  padded: { padding: space.lg, gap: space.md },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: space.lg, gap: space.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, ...(shadow as object) },
  title: { fontSize: 26, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: 17, fontWeight: "600", color: colors.text },
  label: { fontSize: 13, fontWeight: "600", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.4 },
  muted: { color: colors.muted, fontSize: 14 },
  button: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, paddingHorizontal: 16, borderRadius: radius.md, borderWidth: 1 },
  buttonText: { fontSize: 16, fontWeight: "600" },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: colors.text },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.chip },
  chipText: { color: colors.chipText, fontWeight: "600", fontSize: 14 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: space.lg, paddingBottom: space.xxl },
  option: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14, paddingHorizontal: space.sm, borderRadius: radius.sm },
  errorBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FEF2F2", borderRadius: radius.md, padding: space.md, borderWidth: 1, borderColor: "#FECACA", flexWrap: "wrap" },
  warningBox: { backgroundColor: "#FFFBEB", borderRadius: radius.md, padding: space.md, gap: 6, borderWidth: 1, borderColor: "#FDE68A" },
  listItem: { flexDirection: "row", alignItems: "center", backgroundColor: colors.card, padding: space.lg, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
});
