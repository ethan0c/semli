import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import { Dimensions, Platform, ScrollView, StyleSheet, TextInput, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Toast } from "@/components/Overlay";
import type { StreamedItem } from "@/lib/api";
import { firstOf, readyLine } from "@/lib/milestones";

import { Composer } from "@/components/Composer";
import { Chip, PickerPill, Radio } from "@/components/Controls";
import { InlinePicker } from "@/components/Native";
import { ResumeReview } from "@/components/ResumeReview";
import { RecentShots } from "@/components/RecentShots";
import { File } from "expo-file-system";
import { Press } from "@/components/Press";
import { GlassCircle } from "@/components/Glass";
import { Icon } from "@/components/Icon";
import { PaywallBackdrop } from "@/components/PhotoPaywall";
import { PlanPicker } from "@/components/PlanPicker";
import { Reading } from "@/components/Reading";
import { Button } from "@/components/Sheet";
import { T } from "@/components/Text";
import { profile as setProfile, track } from "@/lib/analytics";
import { requestExtraction } from "@/lib/api";
import { requestImport } from "@/lib/import-auth";
import { IMPORT_MESSAGES } from "@dayli/schema";
import { InputError, extractionContext, inputFromFile, pickImageInput, pickPdfInput } from "@/lib/capture-input";
import { QrCode } from "@/components/QrCode";
import { devStep } from "@/lib/dev";
import { ACCOUNT_REQUIRED } from "@/lib/web";
import { accountOf, useSession } from "@/lib/supabase";
import { feedback } from "@/lib/feedback";
import { reportError } from "@/lib/errors";
import { enter, exit, layout, springs } from "@/lib/motion";
import { requestNotifications, syncReminders } from "@/lib/notifications";
import { usePlusAccess } from "@/lib/plus-access";
import { purchaseErrorMessage } from "@/lib/revenuecat";
import { syncCanvas } from "@/lib/canvas-sync";
import { normalizeFeedUrl, CANVAS_MESSAGES, FEED_PLACEHOLDER, FEED_STEPS, feedName, type FeedSystem } from "@/lib/canvas";
import { useCourseList, useItemList, useStore, type DeadlineSource, type Pending, type Plate } from "@/store";
import { sampleWeek } from "@/store/sample";
import { motion, palettes } from "@dayli/tokens";
import { formatTime, localParts, monthDay, relativeDay, termSummary, weekOf, weekdayLong } from "@dayli/core";

import { SCREEN_GUTTER, corner, radius, textStyle, useTheme, size, iconSize, space } from '@/theme';

/**
 * Ask less, build their week, then ask (docs/conversion.md, decided Oct 21, 2026): two tap
 * questions that each change something, their own import (or a real sample), the facts of their
 * term, a reminder they choose, then the paywall. No slideshows, no fake loaders, account later.
 */
const STEPS = ["plate", "deadlines", "own", "canvas", "result", "remind", "plus", "term", "phone"] as const;
type Step = (typeof STEPS)[number];
/**
 * The web starts with the import itself (docs/web.md): a laptop is where the syllabi are, and
 * people there finish "bring in your data" steps far more often than questions. Reminders ring on
 * the iPhone, so the web ends by handing off to it instead of asking when to remind.
 */
const WEB = Platform.OS === "web";
/** Read once: onboarding is short, and a window crossing 768 midway keeps the layout it started with. */
const WIDE = WEB && Dimensions.get("window").width >= 768;
const FIRST: Step = WEB ? "term" : "plate";
/** The progress bar: Canvas connect takes the own-import slot, so both paths fill the same bars. */
const BARS: Step[] = WEB ? ["term", "result", "phone", "plus"] : ["plate", "deadlines", "own", "result", "remind", "plus"];

type Picked = { input: Parameters<typeof requestExtraction>[1]["input"]; source: string } | null;

const PLATES: { id: Plate; label: string; hint: string }[] = [
  { id: "classes", label: "Classes", hint: "Lectures, labs, exams and due dates" },
  { id: "job", label: "Work", hint: "Shifts and changing work schedules" },
  { id: "clubs", label: "Clubs and activities", hint: "Practice, rehearsals and meetings" },
];

const SOURCES: { id: DeadlineSource; label: string; hint: string }[] = [
  { id: "canvas", label: "Canvas or Brightspace", hint: "Works with eLC too. Import once for free, then keep dates in sync with Plus." },
  { id: "syllabus", label: "A syllabus PDF", hint: "Import exams and due dates, then review them." },
  { id: "screenshots", label: "Screenshots and messages", hint: "Work schedules, group chats or printed schedules." },
  { id: "nowhere", label: "I’ll add them myself", hint: "Type what’s coming up, or try a sample week." },
];

export default function OnboardingScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const applyPlan = useStore((s) => s.applyPlan);
  const showToast = useStore((s) => s.showToast);
  const importDone = useStore((s) => s.settings.onboardingImportDone);

  // `?step=plus` opens a specific step; useful when previewing copy and layout.
  const params = useLocalSearchParams<{ step?: string }>();
  const requested = (STEPS as readonly string[]).includes(params.step ?? "") ? (params.step as Step) : FIRST;
  // A read waiting in review when Semli was closed: start at the import step with it on top, not
  // at the first question, where reaching the import again meant reading (and paying for) it twice.
  const [step, setStep] = useState<Step>(() => (!params.step && useStore.getState().pending ? (WEB ? "term" : "own") : requested));
  // Reset when the link changes (derived state, no effect).
  const [lastRequested, setLastRequested] = useState(requested);
  if (lastRequested !== requested) {
    setLastRequested(requested);
    setStep(requested);
  }

  // Development: `dev-step.txt` in Documents opens a step directly (see lib/dev.ts).
  useEffect(() => {
    void devStep().then((v) => {
      if (v === "welcome") router.replace("/auth");
      else if (v && (STEPS as readonly string[]).includes(v)) setStep(v as Step);
    });
  }, []);

  const [plate, setPlate] = useState<Plate[]>(settings.plate);
  const [source, setSource] = useState<DeadlineSource | null>(settings.deadlineSource);
  const [usedSample, setUsedSample] = useState(false);
  const job = plate.includes("job");

  const [history, setHistory] = useState<Step[]>([]);
  const go = (next: Step, answers: Record<string, string | number | boolean> = {}) => {
    feedback("tap");
    track("onboarding_step", { step: next, ...answers });
    setHistory((h) => [...h, step]);
    setStep(next);
  };
  // The first question goes back to the welcome screen, which replaced itself with onboarding.
  // On the web a signed-in account has no welcome to go back to: it would only ask to sign in again.
  const signedIn = useSession((s) => !!accountOf(s.session));
  const canGoBack = history.length > 0 || (step === FIRST && !(ACCOUNT_REQUIRED && signedIn));
  const back = () => {
    const previous = history[history.length - 1];
    track("onboarding_back", { from: step });
    if (!previous) {
      if (step !== FIRST || (ACCOUNT_REQUIRED && signedIn)) return;
      feedback("tap");
      router.replace("/auth");
      return;
    }
    feedback("tap");
    setHistory((h) => h.slice(0, -1));
    setStep(previous);
  };

  // The review sheet flips this when the first import is confirmed; carry on to the term at a glance.
  const [queue, setQueue] = useState<Pending[]>([]);
  const [seenImportDone, setSeenImportDone] = useState(importDone);
  if (importDone !== seenImportDone) {
    setSeenImportDone(importDone);
    if (importDone && queue.length) {
      // The next of several dropped files: its review opens once this one is saved.
      const [next, ...rest] = queue;
      setQueue(rest);
      setSettings({ onboardingImportDone: false });
      useStore.getState().setPending(next!);
      setTimeout(() => router.push("/review"), 0);
    } else if (importDone && (step === "own" || step === "canvas" || step === "term")) {
      setHistory((h) => [...h, step]);
      setStep("result");
    }
  }

  /** The web's first step hands over everything it read; the first review opens now, the rest after it. */
  const reviewAll = (read: Pending[]) => {
    const [first, ...rest] = read;
    if (!first) return;
    setQueue(rest);
    useStore.getState().setPending(first);
    router.push("/review");
  };

  const answerPlate = () => {
    const student = plate.includes("classes") || plate.includes("clubs");
    setSettings({ plate, isStudent: student });
    // A job only: the first import is their shifts, so there's nothing to ask about deadlines.
    if (!student) {
      setSource("screenshots");
      setSettings({ deadlineSource: "screenshots" });
      go("own", { plate: plate.join(","), source: "screenshots" });
    } else go("deadlines", { plate: plate.join(",") });
  };

  const answerSource = (id: DeadlineSource) => {
    setSource(id);
    setSettings({ deadlineSource: id, ...(id === "canvas" ? { lms: "canvas" as const } : {}) });
    go(id === "canvas" ? "canvas" : "own", { source: id });
  };

  /** "Try a sample": a real, labelled sample week as one undoable change, removed by the first real import. */
  const loadSample = () => {
    // Already loaded (Back, then the sample again, or Replay the intro): show the same week. A
    // second copy reused the sample's course ids, and Remove only took the newer one away.
    const { settings: s, batches } = useStore.getState();
    if (s.sampleBatchId && batches.some((b) => b.id === s.sampleBatchId && !b.undone)) {
      setUsedSample(true);
      go("result", { sample: true });
      return;
    }
    const today = localParts(new Date()).date;
    const student = useStore.getState().settings.isStudent;
    const week = sampleWeek(today, { student, preview: true });
    const create = week.items.map(({ id: _id, createdAt: _at, batchId: _batch, sourceId: _source, ...rest }) => rest);
    const batchId = applyPlan({ create, update: [], remove: [], skipped: 0 }, "Sample week", { source: "Sample week", courses: week.courses });
    setSettings({ sampleBatchId: batchId });
    setUsedSample(true);
    track("import_succeeded", { kind: "sample", items: create.length, where: "onboarding" });
    go("result", { sample: true });
  };

  const finish = () => {
    // A job opens on the day by the hour, where shifts and overlaps read best; otherwise the list.
    const todayView = job ? "hours" : "list";
    setSettings({ onboarded: true, seeded: true, onboardingImportDone: false, todayView });
    track("onboarding_completed", { plate: plate.join(","), source: source ?? "none", sample: usedSample });
    setProfile({ plate: plate.join(","), deadline_source: source ?? null, lms: settings.lms ?? null, today_view: todayView, today_view_source: "plate" });
    feedback("success");
    // The sample may have been replaced by a real import since it was loaded; say what is there now.
    const sampleLeft = !!useStore.getState().settings.sampleBatchId;
    showToast(readyLine(sampleLeft, firstOf(useStore.getState().settings.name)));
    router.replace("/");
  };

  const progress = BARS.indexOf(step === "canvas" || step === "own" ? (WEB ? "term" : "own") : step);
  // Only the paywall is a dark showcase now; every other step is the plain paper canvas.
  const showcase = step === "plus";
  const bg = showcase ? palettes.dark.canvas : c.canvas;
  const barOn = showcase ? palettes.dark.inkPrimary : c.inkPrimary;
  const barOff = showcase ? "rgba(245,244,240,0.3)" : c.line;

  if (params.step === "welcome") return <Redirect href="/auth" />;

  return (
    <View style={[styles.root, { backgroundColor: bg, paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 24) }]}>
      {step === "plus" ? <PaywallBackdrop /> : null}
      <View style={styles.header}>
        {canGoBack ? (
          <Animated.View entering={enter.fade} exiting={exit.fade}>
            <Press accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} scale={motion.press.iconScale} onPress={back} style={styles.back}>
              <GlassCircle size={36} plain><Icon name="chevronLeft" size={iconSize.nav} color={barOn} /></GlassCircle>
            </Press>
          </Animated.View>
        ) : null}
        <View style={styles.progress}>
          {BARS.map((s, i) => (
            <Segment key={s} on={i <= progress} fill={barOn} track={barOff} />
          ))}
        </View>
      </View>

      <Animated.View key={step} entering={enter.fromRight} style={{ flex: 1 }}>
      {step === "plate" && (
        <ScrollView contentContainerStyle={styles.page}>
          <View style={styles.titleBlock}>
            <T token="displaySm" accessibilityRole="header">What do you need to plan?</T>
            <T token="callout" color={c.inkSecondary}>Choose all that apply.</T>
          </View>
          <View accessibilityRole="list">
            {PLATES.map((p) => (
              <Choice key={p.id} label={p.label} hint={p.hint} multi on={plate.includes(p.id)}
                onPress={() => setPlate((ps) => (ps.includes(p.id) ? ps.filter((x) => x !== p.id) : [...ps, p.id]))} />
            ))}
          </View>
          <View style={styles.footer}>
            <Button label="Next" disabled={plate.length === 0} onPress={answerPlate} />
          </View>
        </ScrollView>
      )}
      {step === "deadlines" && (
        <OneTapStep title="Where do you keep your deadlines?" subtitle="Choose one to start with.">
          {SOURCES.map((s) => (
            <Choice key={s.id} label={s.label} hint={s.hint} on={source === s.id} onPress={() => answerSource(s.id)} />
          ))}
        </OneTapStep>
      )}
      {step === "canvas" && <CanvasStep onConnected={() => go("result")} onInstead={() => go("own", { source: "canvas-instead" })} />}
      {step === "own" && <OwnStep source={source ?? "nowhere"} job={job} onSample={loadSample} />}
      {/* Reminders ring on the iPhone, so the web skips the question of when. */}
      {step === "term" && <TermStep plate={plate} onPlate={(next) => { setPlate(next); setSettings({ plate: next, isStudent: next.includes("classes") || next.includes("clubs") || next.length === 0 }); }}
        onReview={reviewAll} onCanvas={() => go("canvas", { source: "canvas" })} onType={() => go("own", { source: "typed" })} onSample={loadSample} />}
      {step === "result" && <ResultStep sample={!!settings.sampleBatchId} onNext={() => go(WEB ? "phone" : "remind")} />}
      {step === "phone" && <PhoneStep onDone={(scanned) => go("plus", { scanned })} />}
      {step === "remind" && <RemindStep onDone={() => go("plus")} />}
      {step === "plus" && <PlusStep onFinish={finish} />}
      </Animated.View>
      {/* Says a sign-up worked ("Welcome to Semli… signed up with you@…") on the first step after it. */}
      <Toast offset={120} />
    </View>
  );
}

/** One bar of the position indicator: fills from the left on a spring, drains the same way. */
function Segment({ on, fill, track }: { on: boolean; fill: string; track: string }) {
  const p = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    p.value = withSpring(on ? 1 : 0, springs.gentle);
  }, [on, p]);
  const style = useAnimatedStyle(() => ({ transform: [{ scaleX: Math.max(0.001, p.value) }] }));
  return (
    <View style={[styles.bar, { backgroundColor: track, overflow: "hidden" }]}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: fill, transformOrigin: "left" }, style]} />
    </View>
  );
}

/* ---------- One question per screen ---------- */

function OneTapStep({ title, subtitle, children, gap = 24 }: { title: string; subtitle: string; children: React.ReactNode; gap?: number }) {
  const { c } = useTheme();
  return (
    <ScrollView contentContainerStyle={[styles.page, { gap }]}>
      <View style={styles.titleBlock}>
        <T token="displaySm" accessibilityRole="header">{title}</T>
        <T token="callout" color={c.inkSecondary}>{subtitle}</T>
      </View>
      <View>{children}</View>
    </ScrollView>
  );
}

/** A choice row. One-tap rows advance (chevron); `multi` rows toggle an ink checkbox. */
function Choice({ label, hint, on, multi, onPress }: { label: string; hint?: string; on: boolean; multi?: boolean; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Press
      haptic="select"
      scale={1}
      accessibilityRole={multi ? "checkbox" : "button"}
      accessibilityState={multi ? { checked: on } : undefined}
      accessibilityLabel={!multi && on ? `${label}, selected` : label}
      onPress={onPress}
      style={[styles.choice, { minHeight: hint ? 68 : 56, borderBottomColor: c.line }]}
    >
      <View style={{ flex: 1, gap: space.hair }}>
        <T token="body">{label}</T>
        {hint ? <T token="caption" color={c.inkSecondary}>{hint}</T> : null}
      </View>
      {multi ? (
        <View style={[styles.box, on ? { backgroundColor: c.inkPrimary, borderColor: c.inkPrimary } : { borderColor: c.controlOutline }]}>
          {on ? <Icon name="tick" size={14} color={c.onPrimary} strokeWidth={2.5} /> : null}
        </View>
      ) : <Icon name="chevronRight" size={iconSize.disclosure} color={c.disclosureInk} />}
    </Press>
  );
}

/* ---------- Their own import, starting where their deadlines live ---------- */

const OWN_COPY: Record<DeadlineSource, { title: string; sub: string; primary?: "pdf" | "image"; sample: string }> = {
  canvas: { title: "Add your syllabus.", sub: "You can also use a screenshot or message. Review the dates before adding them.", primary: "pdf", sample: "Try a sample week instead" },
  syllabus: { title: "Add your syllabus.", sub: "Semli finds exams and due dates. You review them before adding them.", primary: "pdf", sample: "No syllabus handy? Try a sample week" },
  screenshots: { title: "Add a screenshot or photo.", sub: "Choose a work schedule, a message with dates or a printed schedule.", primary: "image", sample: "Try a sample week instead" },
  nowhere: { title: "What’s coming up?", sub: "Type or paste a few plans. Include the days and times you know.", sample: "Try a sample week instead" },
};

/** What "a sample week" is, said where the button is: the label alone read as a mystery. */
const SAMPLE_HINT = "A made-up syllabus and work schedule. Removed when you add your own.";

function OwnStep({ source, job, onSample }: { source: DeadlineSource; job: boolean; onSample: () => void }) {
  const { c } = useTheme();
  const copy = OWN_COPY[source];
  const { requireImportAccess, requirePlus } = usePlusAccess();
  const importing = useRef(false);
  const apiUrl = useStore((s) => s.settings.apiUrl);
  const setPending = useStore((s) => s.setPending);
  const recordImport = useStore((s) => s.recordImport);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [found, setFound] = useState<StreamedItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function run(input: NonNullable<Picked>["input"], source: string) {
    if (importing.current) return;
    importing.current = true;
    setError(null);
    setBusy(source);
    track("import_started", { kind: input.kind, where: "onboarding" });
    try {
      try {
        if (!(await requireImportAccess({ onError: setError }))) return;
      } catch (failure) {
        setError(purchaseErrorMessage(failure));
        return;
      }
      const req = { input, context: extractionContext(input) };
      // Rows appear on the reading screen as they're read: a new student's first import shouldn't feel like a wait.
      const hooks = { onItem: (item: StreamedItem) => setFound((rows) => [...rows, item]), onReset: () => setFound([]) };
      let res = await requestImport(apiUrl, req, hooks);
      if (!res.ok && res.error === IMPORT_MESSAGES.quota && (await requirePlus("quota", { onError: setError }))) res = await requestImport(apiUrl, req, hooks);
      if (!res.ok) {
        track("import_failed", { kind: input.kind, where: "onboarding" });
        setError(res.error);
        return;
      }
      if (res.extraction.items.length === 0) {
        setError("We couldn’t find any plans to add. Include a day or time and try again, or try a sample week.");
        return;
      }
      feedback("ready");
      recordImport();
      track("import_succeeded", { kind: input.kind, items: res.extraction.items.length, type: res.extraction.detected_type, where: "onboarding" });
      setPending({ extraction: res.extraction, source, ...(Platform.OS === "web" ? { input } : {}) });
      router.push("/review");
    } catch (failure) {
      reportError("onboarding.import", failure);
      track("import_failed", { kind: input.kind, where: "onboarding" });
      setError("We couldn’t read that. Try again, or try a sample week.");
    } finally {
      importing.current = false;
      setBusy(null);
      setFound([]);
    }
  }

  const pick = async (fn: () => Promise<Picked>) => {
    setError(null);
    try {
      const picked = await fn();
      if (picked) await run(picked.input, picked.source);
    } catch (e) {
      reportError("onboarding.pick_file", e);
      setError(e instanceof InputError ? e.message : "Semli couldn't open that. Try another file, or type it instead.");
    }
  };

  async function openShot(uri: string) {
    if (!uri) return pick(() => pickImageInput(false));
    setError(null);
    try {
      const data = await new File(uri).base64();
      const lower = uri.toLowerCase();
      const mediaType = lower.endsWith(".png") ? "image/png" : lower.endsWith(".webp") ? "image/webp" : "image/jpeg";
      await run({ kind: "image", mediaType, data }, "Screenshot");
    } catch (failure) {
      reportError("onboarding.open_screenshot", failure);
      setError("We couldn't open that screenshot. Try choosing it from your photos instead.");
    }
  }

  return (
    <ScrollView contentContainerStyle={[styles.page, { gap: space.lg }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={styles.titleBlock}>
        <T token="displaySm" accessibilityRole="header">{copy.title}</T>
        <T token="callout" color={c.inkSecondary}>{job && source !== "screenshots" ? `${copy.sub} You can add work shifts later.` : copy.sub}</T>
      </View>
      <ResumeReview />
      {!busy && copy.primary ? (
        <Button label={copy.primary === "pdf" ? "Choose a syllabus PDF" : "Choose a photo or screenshot"}
          onPress={() => void pick(copy.primary === "pdf" ? pickPdfInput : () => pickImageInput(false))} />
      ) : null}
      {busy ? (
        <Reading source={busy === "Message" ? "your message" : busy} chart={/\.pdf$/i.test(busy) ? "term" : "week"} found={found} />
      ) : (
        <Composer
          value={text}
          placeholder={job ? "Working Friday 4–10 pm, team meeting Monday at noon…" : "Biology exam next Friday, essay due Monday at 5 pm…"}
          onChangeText={setText}
          canSend={text.trim().length > 0}
          onPickImage={() => void pick(() => pickImageInput(false))}
          onCamera={Platform.OS === "web" ? undefined : () => void pick(() => pickImageInput(true))}
          onPickPdf={() => void pick(pickPdfInput)}
          onSend={() => void run({ kind: "text", text: text.trim() }, "Message")}
        />
      )}
      {error ? (
        <View style={styles.status}>
          <Icon name="alert" size={16} color={c.conflict} />
          <T token="subhead" color={c.conflict} style={{ flex: 1 }}>
            {error}
          </T>
        </View>
      ) : null}
      {!busy ? <RecentShots onPick={(uri) => void openShot(uri)} /> : null}
      <View style={[styles.footer, { alignItems: "center" }]}>
        <Press haptic="select" accessibilityRole="button" accessibilityHint={SAMPLE_HINT} disabled={!!busy} onPress={onSample} style={{ minHeight: size.target, justifyContent: "center", alignItems: "center", gap: space.hair }}>
          <T token="subhead" color={c.inkSecondary}>{copy.sample}</T>
          <T token="caption" color={c.inkTertiary} style={{ textAlign: "center" }}>{SAMPLE_HINT}</T>
        </Press>
      </View>
    </ScrollView>
  );
}

/* ---------- The web: bring in your term ---------- */

const PLATE_CHIPS: { id: Plate; label: string }[] = [
  { id: "classes", label: "Classes" },
  { id: "job", label: "A job" },
  { id: "clubs", label: "Clubs and practice" },
];

type Read = { name: string; state: "reading" | "read" | "failed"; dates?: number; message?: string; pending?: Pending };

/**
 * The web's first step: every syllabus and screenshot at once (dropped, chosen or pasted), read in
 * the background, then reviewed one after another. Chips stand in for "What do you need to plan?".
 */
function TermStep({ plate, onPlate, onReview, onCanvas, onType, onSample }: {
  plate: Plate[]; onPlate: (next: Plate[]) => void; onReview: (read: Pending[]) => void; onCanvas: () => void; onType: () => void; onSample: () => void;
}) {
  const { c } = useTheme();
  const { requireImportAccess } = usePlusAccess();
  const apiUrl = useStore((s) => s.settings.apiUrl);
  const recordImport = useStore((s) => s.recordImport);
  const [files, setFiles] = useState<Read[]>([]);
  const [over, setOver] = useState(false);
  const zone = useRef<ComponentRef<typeof View>>(null);

  // The browser's files (not expo-file-system's File, which this screen also uses).
  const add = async (list: ArrayLike<Blob & { name?: string }>) => {
    for (const file of Array.from(list)) {
      const name = file.name || "Screenshot";
      setFiles((fs) => [...fs, { name, state: "reading" }]);
      const update = (patch: Partial<Read>) => setFiles((fs) => fs.map((f) => (f.name === name && f.state === "reading" ? { ...f, ...patch } : f)));
      try {
        const picked = await inputFromFile(file);
        if (!picked) { update({ state: "failed", message: "Semli reads PDFs and images" }); continue; }
        if (!(await requireImportAccess())) { update({ state: "failed", message: "No imports left" }); continue; }
        const res = await requestImport(apiUrl, { input: picked.input, context: extractionContext() });
        if (!res.ok || !res.extraction.items.length) { update({ state: "failed", message: res.ok ? "No dates found" : res.error }); continue; }
        recordImport();
        track("import_succeeded", { kind: picked.input.kind, items: res.extraction.items.length, type: res.extraction.detected_type, where: "onboarding-web" });
        update({ state: "read", dates: res.extraction.items.length, pending: { extraction: res.extraction, source: picked.source, input: picked.input } });
      } catch (failure) {
        reportError("onboarding.term_import", failure);
        update({ state: "failed", message: "Couldn’t read this one" });
      }
    }
  };

  // Drop and paste on the page, and a click on the zone opens the file chooser (the web only).
  useEffect(() => {
    if (!WEB) return;
    const el = zone.current as unknown as HTMLElement | null;
    const has = (e: DragEvent) => !!e.dataTransfer && [...e.dataTransfer.types].includes("Files");
    const onOver = (e: DragEvent) => { if (has(e)) { e.preventDefault(); setOver(true); } };
    const onLeave = () => setOver(false);
    const onDrop = (e: DragEvent) => { if (!has(e)) return; e.preventDefault(); setOver(false); if (e.dataTransfer?.files.length) void add(e.dataTransfer.files); };
    const onPaste = (e: ClipboardEvent) => { if (e.clipboardData?.files.length) { e.preventDefault(); void add(e.clipboardData.files); } };
    window.addEventListener("dragover", onOver);
    window.addEventListener("drop", onDrop);
    el?.addEventListener("dragleave", onLeave);
    window.addEventListener("paste", onPaste);
    return () => { window.removeEventListener("dragover", onOver); window.removeEventListener("drop", onDrop); el?.removeEventListener("dragleave", onLeave); window.removeEventListener("paste", onPaste); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const choose = () => {
    const input = Object.assign(document.createElement("input"), { type: "file", multiple: true, accept: "application/pdf,image/png,image/jpeg,image/webp,image/gif" });
    input.onchange = () => { if (input.files?.length) void add(input.files); };
    input.click();
  };

  const read = files.filter((f) => f.state === "read" && f.pending);
  const dates = read.reduce((n, f) => n + (f.dates ?? 0), 0);
  const reading = files.some((f) => f.state === "reading");

  return (
    <ScrollView contentContainerStyle={[styles.page, { gap: space.md }]} keyboardShouldPersistTaps="handled">
      <View style={styles.titleBlock}>
        <T token="displaySm" accessibilityRole="header">Bring in your term</T>
        <T token="callout" color={c.inkSecondary}>Drop every syllabus at once. Semli reads the classes, exams and due dates, and you check them before anything is saved.</T>
      </View>
      <ResumeReview />
      <View style={styles.chips} accessibilityRole="list">
        {PLATE_CHIPS.map((p) => {
          const on = plate.includes(p.id);
          return (
            <Press key={p.id} accessibilityRole="checkbox" accessibilityState={{ checked: on }} haptic="select" scale={1}
              onPress={() => onPlate(on ? plate.filter((x) => x !== p.id) : [...plate, p.id])}
              style={[styles.chip, { backgroundColor: on ? c.controlFill : c.row }]}>
              <T token="subhead" color={on ? c.controlInk : c.inkPrimary}>{on ? `${p.label} ✓` : p.label}</T>
            </Press>
          );
        })}
      </View>
      <View ref={zone}>
        <Press accessibilityRole="button" accessibilityLabel="Choose syllabi, screenshots or a schedule" scale={1} onPress={choose}
          style={[styles.drop, { borderColor: over ? c.inkPrimary : c.controlOutline, backgroundColor: c.surface }]}>
          <Icon name="file" size={26} color={c.inkPrimary} />
          <T token="headline">Drop syllabi, screenshots or a schedule here</T>
          <T token="caption" color={c.inkSecondary}>PDF, PNG or JPG · or click to choose files · or paste with ⌘V</T>
        </Press>
      </View>
      {files.length ? (
        <View style={{ gap: space.xs }}>
          {files.map((f, i) => (
            <View key={`${f.name}-${i}`} style={[styles.file, { borderColor: c.line, backgroundColor: c.surface }]}>
              <T token="subhead" numberOfLines={1} style={{ flex: 1 }}>{f.name}</T>
              <StatusLabel f={f} />
            </View>
          ))}
        </View>
      ) : null}
      <View style={styles.links}>
        <Press haptic="select" accessibilityRole="button" onPress={onCanvas} scale={1}><T token="subhead" color={c.accentInk}>Connect your class calendar instead</T></Press>
        <Press haptic="select" accessibilityRole="button" onPress={onType} scale={1}><T token="subhead" color={c.accentInk}>Type it instead</T></Press>
      </View>
      <View style={[styles.footer, styles.footerRow]}>
        <Press haptic="select" accessibilityRole="button" onPress={onSample} scale={1} style={{ minHeight: size.target, justifyContent: "center" }}>
          <T token="subhead" color={c.inkSecondary}>Try a sample week</T>
          <T token="caption" color={c.inkTertiary}>{SAMPLE_HINT}</T>
        </Press>
        <Button label={reading && !read.length ? "Reading…" : read.length ? `Review ${dates} ${dates === 1 ? "date" : "dates"}` : "Review"} disabled={!read.length}
          onPress={() => onReview(read.map((f) => f.pending!))} />
      </View>
    </ScrollView>
  );
}

function StatusLabel({ f }: { f: Read }) {
  const { c } = useTheme();
  if (f.state === "reading") return <T token="caption" color={c.inkSecondary}>Reading…</T>;
  if (f.state === "failed") return <T token="caption" color={c.conflict}>{f.message}</T>;
  return <T token="caption" color={c.added}>{`Read · ${f.dates} ${f.dates === 1 ? "date" : "dates"}`}</T>;
}

/* ---------- The web: get it on your phone ---------- */

/** Reminders and ringing alarms live on the iPhone; the web hands off with a code to scan. */
function PhoneStep({ onDone }: { onDone: (scanned: boolean) => void }) {
  const { c } = useTheme();
  return (
    <ScrollView contentContainerStyle={[styles.page, { gap: space.lg }]}>
      <View style={styles.titleBlock}>
        <T token="displaySm" accessibilityRole="header">Reminders ring on your iPhone</T>
        <T token="callout" color={c.inkSecondary}>Scan with your iPhone camera to get Semli. Sign in with the same account and your term is already there.</T>
      </View>
      <View style={styles.phone}>
        <QrCode text="https://www.semli.app/get?r=web-onboarding" ink={c.inkPrimary} paper={c.surface} />
        <View style={{ flex: 1, gap: space.snug }}>
          <T token="headline">Semli for iPhone</T>
          <T token="callout" color={c.inkSecondary}>Free · reminders the evening before each deadline, ringing alarms, the Today widget</T>
        </View>
      </View>
      <View style={[styles.footer, styles.footerRow]}>
        <Press haptic="select" accessibilityRole="button" onPress={() => onDone(false)} scale={1} style={{ minHeight: size.target, justifyContent: "center" }}>
          <T token="subhead" color={c.inkSecondary}>Not now</T>
        </Press>
        <Button label="I’ve got it" onPress={() => onDone(true)} />
      </View>
    </ScrollView>
  );
}

/* ---------- Canvas: the feed link is their first real import ---------- */

function CanvasStep({ onConnected, onInstead }: { onConnected: () => void; onInstead: () => void }) {
  const { c } = useTheme();
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<number | null>(null);
  const { requirePlus } = usePlusAccess();
  // UGA runs Brightspace as eLC; the steps to its link differ from Canvas's.
  const [system, setSystem] = useState<FeedSystem>("canvas");
  const enteredFeed = normalizeFeedUrl(link);
  const name = enteredFeed ? feedName(enteredFeed) : system === "canvas" ? "Canvas" : "Brightspace";

  const connect = async () => {
    const url = normalizeFeedUrl(link);
    if (!url) {
      feedback("error");
      setError(CANVAS_MESSAGES.link);
      return;
    }
    setError(null);
    // The first sync is free once, as in Settings; replaying the intro doesn't hand out another.
    if (useStore.getState().settings.canvas.lastSyncedAt && !(await requirePlus("canvas", { onError: setError }))) return;
    setBusy(true);
    const res = await syncCanvas(url);
    setBusy(false);
    if (!res.ok) {
      feedback("error");
      setError(res.error);
      track("onboarding_step", { step: "canvas-failed" });
      return;
    }
    feedback("success");
    track("onboarding_step", { step: "canvas-connected", items: res.total });
    setAdded(res.total);
  };

  if (added !== null) {
    return (
      <View style={styles.page}>
        <Animated.View entering={enter.rise} style={styles.titleBlock}>
          <T token="callout" color={c.inkSecondary}>{`From ${name}`}</T>
          <T token="displayXl" tabular>{`${added} ${added === 1 ? "item" : "items"}`}</T>
          <T token="callout" color={c.inkSecondary}>
            {added > 0 ? `Your ${name} dates are in your plan. With Plus, Semli checks for updates when you open the app.` : `Your ${name} calendar is connected, but there are no dates to add yet. With Plus, Semli checks for updates when you open the app.`}
          </T>
        </Animated.View>
        <View style={styles.footer}>
          <Button label="Next" onPress={onConnected} />
        </View>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.page, { gap: space.lg }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={styles.titleBlock}>
        <T token="displaySm" accessibilityRole="header">Connect your class calendar.</T>
        <T token="callout" color={c.inkSecondary}>Add due dates from Canvas or Brightspace, including eLC. Semli reads your calendar without changing it.</T>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
        <Chip label="Canvas" on={system === "canvas"} onPress={() => { setSystem("canvas"); setError(null); }} />
        <Chip label="Brightspace (eLC)" on={system === "brightspace"} onPress={() => { setSystem("brightspace"); setError(null); }} />
      </View>
      <View>
        {FEED_STEPS[system].map((line, i) => (
          <View key={line} style={[styles.choice, { minHeight: 52, borderBottomColor: c.line }]}>
            <T token="headline" tabular style={{ width: 18 }}>{String(i + 1)}</T>
            <T token="body" style={{ flex: 1 }}>{line}</T>
          </View>
        ))}
      </View>
      <TextInput
        value={link}
        onChangeText={(v) => { setLink(v); setError(null); }}
        placeholder={FEED_PLACEHOLDER[system]}
        placeholderTextColor={c.inkTertiary}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        editable={!busy}
        style={[styles.input, textStyle("body", c.inkPrimary), { backgroundColor: c.row }]}
      />
      {error ? (
        <Animated.View entering={enter.drop} exiting={exit.fade} accessibilityRole="alert" style={styles.status}>
          <Icon name="alert" size={16} color={c.conflict} />
          <T token="subhead" color={c.conflict} style={{ flex: 1 }}>{error}</T>
        </Animated.View>
      ) : null}
      <View style={[styles.footer, { alignItems: "center" }]}>
        <Button label={busy ? `Reading ${name}…` : `Connect ${name}`} disabled={busy || !link.trim()} onPress={() => void connect()} />
        <Press haptic="select" accessibilityRole="button" disabled={busy} onPress={onInstead} style={{ minHeight: size.target, justifyContent: "center" }}>
          <T token="subhead" color={c.inkSecondary}>Add another way</T>
        </Press>
      </View>
    </ScrollView>
  );
}

/* ---------- Their term, from what they just added ---------- */

function ResultStep({ sample, onNext }: { sample: boolean; onNext: () => void }) {
  const { c } = useTheme();
  const items = useItemList();
  const courses = useCourseList();
  const sampleBatch = useStore((st) => st.settings.sampleBatchId);
  // The sample's two sources, named as they arrive, so "sample week" means something on screen.
  const sources = useMemo(() => {
    if (!sample || !sampleBatch) return [];
    const mine = items.filter((it) => it.batchId === sampleBatch);
    const codes = courses.filter((k) => mine.some((it) => it.courseId === k.id)).map((k) => k.code ?? k.title).filter(Boolean);
    const employers = [...new Set(mine.map((it) => it.employer).filter((e): e is string => !!e))];
    const shifts = mine.filter((it) => it.category === "work").length;
    return [
      codes.length ? { icon: "file" as const, title: "A sample syllabus", sub: `${codes.join(", ")} · ${mine.filter((it) => it.category === "school").length} classes and due dates` } : null,
      employers.length ? { icon: "work" as const, title: "A sample work schedule", sub: `${employers.join(", ")} · ${shifts} ${shifts === 1 ? "shift" : "shifts"}` } : null,
    ].filter((r): r is { icon: "file" | "work"; title: string; sub: string } => r !== null);
  }, [sample, sampleBatch, items, courses]);
  const today = localParts(new Date()).date;
  const s = useMemo(() => termSummary(items, today), [items, today]);
  useEffect(() => {
    track("result_shown", { deadlines: s.deadlines, exams: s.exams, clash: !!s.clash });
    // Once, for what was imported when the screen opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const rows = [
    s.first ? { label: "Next due", value: `${s.first.title} · ${relativeDay(today, s.first.date)}` } : null,
    s.busiestWeek && s.busiestWeek.count > 1 ? { label: "Busiest week", value: `${monthDay(s.busiestWeek.start)} · ${s.busiestWeek.count} due` } : null,
    s.exams ? { label: "Exams", value: String(s.exams) } : null,
    s.clash ? { label: "Work overlap", value: `${weekdayLong(s.clash.date)} · ${s.clash.work}` } : null,
  ].filter((r): r is { label: string; value: string } => r !== null);
  return (
    <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
      <View style={styles.titleBlock}>
        <T token="displaySm" accessibilityRole="header">{sample ? "Sample week" : "Your deadlines"}</T>
      </View>
      {sources.length ? (
        <View>
          {sources.map((r, i) => (
            <Animated.View key={r.title} layout={layout} entering={enter.staggered(i)} style={[styles.fact, { borderBottomColor: c.line, justifyContent: "flex-start", gap: space.sm }]}>
              <Icon name={r.icon} size={20} color={c.inkPrimary} />
              <View style={{ flex: 1, gap: space.hair }}>
                <T token="body">{r.title}</T>
                <T token="caption" color={c.inkSecondary} numberOfLines={1}>{r.sub}</T>
              </View>
            </Animated.View>
          ))}
        </View>
      ) : null}
      <View style={{ gap: space.hair }}>
        <T token="displayXl" tabular>{String(s.deadlines)}</T>
        <T token="callout" color={c.inkSecondary}>
          {s.deadlines === 0 ? "No upcoming deadlines in this plan." : `${s.deadlines === 1 ? "deadline" : "deadlines"}${s.lastDate ? ` through ${monthDay(s.lastDate)}` : ""}`}
        </T>
      </View>
      <View>
        {rows.map((r, i) => (
          <Animated.View key={r.label} layout={layout} entering={enter.staggered(i + sources.length)} style={[styles.fact, { borderBottomColor: c.line }]}>
            <T token="body" color={c.inkSecondary}>{r.label}</T>
            <T token="body" numberOfLines={1} style={{ flexShrink: 1, textAlign: "right" }}>{r.value}</T>
          </Animated.View>
        ))}
      </View>
      <View style={styles.footer}>
        <Button label="Continue" onPress={onNext} />
      </View>
    </ScrollView>
  );
}

/* ---------- A reminder they choose: our question first, the system prompt only on yes ---------- */

const REMIND = [
  { id: "evening", label: "The night before", time: "20:00" },
  { id: "morning", label: "The morning it’s due", time: "08:00" },
] as const;
type RemindId = (typeof REMIND)[number]["id"];

/** The one deadline reminder they chose, at their time; the other is off. The morning one shares the summary's time. */
function remindPatch(choice: RemindId, time: string) {
  return choice === "evening"
    ? { dayBefore: true, dayBeforeAt: time, morning: false }
    : { morning: true, morningAt: time, briefingAt: time, dayBefore: false };
}

function RemindStep({ onDone }: { onDone: () => void }) {
  const { c } = useTheme();
  const items = useItemList();
  const setSettings = useStore((s) => s.setSettings);
  const [choice, setChoice] = useState<RemindId>("evening");
  const [times, setTimes] = useState<Record<RemindId, string>>({ evening: REMIND[0].time, morning: REMIND[1].time });
  const [picking, setPicking] = useState<RemindId | null>(null);
  const [asking, setAsking] = useState(false);
  const today = localParts(new Date()).date;
  const first = useMemo(() => termSummary(items, today).first, [items, today]);
  const yes = async () => {
    setAsking(true);
    setSettings({ remindersAsked: true });
    const granted = await requestNotifications().catch(() => false);
    track("remind_choice", { time: choice, at: times[choice], granted });
    if (granted) {
      setSettings({ reminders: { ...useStore.getState().settings.reminders, enabled: true, briefing: true, ...remindPatch(choice, times[choice]) } });
      await syncReminders().catch(() => {});
    }
    setAsking(false);
    onDone();
  };
  const notNow = () => {
    setSettings({ remindersAsked: true });
    track("remind_choice", { time: "none", granted: false });
    onDone();
  };
  return (
    <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
      <View style={styles.titleBlock}>
        <T token="displaySm" accessibilityRole="header">When would you like a reminder?</T>
        <T token="callout" color={c.inkSecondary}>
          {first ? `Next due: ${first.title}, ${relativeDay(today, first.date).toLowerCase()}. ` : "One reminder before each deadline. "}A summary of your day comes each morning too. Change any of it in You → Reminders.
        </T>
      </View>
      <View accessibilityRole="radiogroup">
        {REMIND.map((r) => (
          <View key={r.id} style={[styles.remindRow, { borderBottomColor: c.line }]}>
            <Press haptic="select" scale={1} accessibilityRole="radio" accessibilityState={{ selected: choice === r.id }} onPress={() => setChoice(r.id)}
              style={[styles.remindChoice, { minHeight: size.row }]}>
              <T token="body" style={{ flex: 1 }}>{r.label}</T>
              {/* The time is theirs to set here: one tap opens the wheel under the row. */}
              <PickerPill label={formatTime(times[r.id])} open={picking === r.id} accessibilityLabel={`${r.label}, at ${formatTime(times[r.id])}`}
                onPress={() => { setChoice(r.id); setPicking((open) => (open === r.id ? null : r.id)); }} />
              <Radio on={choice === r.id} />
            </Press>
            {picking === r.id ? (
              <Animated.View entering={enter.fade} exiting={exit.fade} layout={layout} style={styles.remindPicker}>
                <InlinePicker mode="time" date={null} time={times[r.id]} onChange={(time) => setTimes((t) => ({ ...t, [r.id]: time }))} />
              </Animated.View>
            ) : null}
          </View>
        ))}
      </View>
      <View style={[styles.footer, { alignItems: "center" }]}>
        <Button label={asking ? "Setting up reminders…" : "Remind me"} disabled={asking} onPress={() => void yes()} />
        <Press haptic="select" accessibilityRole="button" disabled={asking} onPress={notNow} style={{ minHeight: size.target, justifyContent: "center" }}>
          <T token="subhead" color={c.inkSecondary}>Not now</T>
        </Press>
      </View>
    </ScrollView>
  );
}

/* ---------- Plus, after the value moment, in their own words ---------- */

function PlusStep({ onFinish }: { onFinish: () => void }) {
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const items = useItemList();
  const courses = useCourseList();
  const canvas = useStore((s) => !!s.settings.canvas.feedUrl);
  const headline = useMemo(() => {
    const week = weekOf(localParts(new Date()).date);
    const shifts = items.filter((i) => i.category === "work" && i.kind === "event" && week.includes(i.date)).length;
    const classes = courses.length;
    const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
    if (canvas) return "Keep your class calendar in sync with Plus.";
    if (classes && shifts) return `Import class and work schedules without limits.`;
    if (classes) return `Unlimited imports for your ${n(classes, "class", "classes")}.`;
    if (shifts) return `Compare changes to your ${n(shifts, "shift", "shifts")} this week.`;
    return undefined;
  }, [items, courses, canvas]);
  useEffect(() => {
    track("paywall_shown", { reason: "onboarding", personalized: !!headline });
    // Once per visit to the step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const continueFree = () => {
    track("paywall_continue_free", { reason: "onboarding" });
    onFinish();
  };
  return (
    <ScrollView ref={scroll} contentContainerStyle={[styles.page, { paddingTop: 150 }]} showsVerticalScrollIndicator={false}>
      <PlanPicker palette={palettes.dark} headline={headline} onContinueFree={continueFree} onComplete={onFinish} onWelcome={() => scroll.current?.scrollTo({ y: 0, animated: false })} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: SCREEN_GUTTER },
  header: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingBottom: space.xl, minHeight: 36 },
  back: { marginLeft: -space.xs, alignItems: "center", justifyContent: "center" },
  progress: { flex: 1, flexDirection: "row", gap: 5 },
  bar: { flex: 1, height: 3, borderRadius: 2 },
  page: { flexGrow: 1, gap: space.xl },
  titleBlock: { gap: space.snug },
  // On a wide web window the actions follow the content at the right, as desktop forms do.
  footer: WIDE ? { paddingTop: space.xl, gap: space.xs, alignSelf: "stretch", alignItems: "flex-end" } : { marginTop: "auto", paddingTop: space.xl, gap: space.xs, alignSelf: "stretch" },
  choice: { flexDirection: "row", alignItems: "center", gap: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  remindRow: { borderBottomWidth: StyleSheet.hairlineWidth },
  remindChoice: { flexDirection: "row", alignItems: "center", gap: space.sm },
  remindPicker: { paddingBottom: space.sm },
  box: { width: 22, height: 22, ...corner(radius.mark), borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  fact: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md, minHeight: 52, borderBottomWidth: StyleSheet.hairlineWidth },
  input: { height: size.control, borderRadius: radius.pill, paddingHorizontal: space.lg },
  status: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: space.xxs },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  chip: { minHeight: 36, paddingHorizontal: space.sm, borderRadius: 999, justifyContent: "center" },
  drop: { borderWidth: 1.5, borderStyle: "dashed", ...corner(radius.field), paddingVertical: space.xxl, paddingHorizontal: space.lg, alignItems: "center", gap: space.snug },
  file: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: size.target, paddingHorizontal: space.sm, ...corner(radius.small), borderWidth: StyleSheet.hairlineWidth },
  links: { flexDirection: "row", flexWrap: "wrap", gap: space.lg },
  footerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  phone: { flexDirection: "row", alignItems: "center", gap: space.xl },
});
