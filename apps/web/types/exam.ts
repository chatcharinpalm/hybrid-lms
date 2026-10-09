export type QuestionType = "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "SHORT_ANSWER" | "FILL_IN_BANK";

export interface ExamOption {
  id: string;
  label: string;
  /** Answer-bank code as printed on the paper ("W", "A01", "Code 07"); null on choice questions. */
  code?: string | null;
}

export interface ExamQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  points: number;
  options: ExamOption[];
}

export interface ExamSecurityConfig {
  requireFullscreen: boolean;
  blockClipboard: boolean;
  blockContextMenu: boolean;
  maxViolations: number;
}

export interface SavedAnswer {
  selectedOptionIds?: string[];
  textAnswer?: string;
}

export interface ExamPaper {
  attemptId: string;
  startedAt: string;
  durationMinutes: number;
  /** Server-computed whole-exam time remaining; null on exams timed per question. */
  secondsLeft: number | null;
  examTitle?: string;
  examDescription?: string | null;
  /** seatNumber: place on the room's ก–ฮ class list (same as the sign-in sheet). */
  student: { fullName: string; studentCode: string | null; section: string | null; seatNumber: number | null };
  /** Answers already saved on the server, by question id. */
  answers: Record<string, SavedAnswer>;
  currentQuestionIndex?: number;
  /** Per-question limit; null when the exam has none. */
  timePerQuestionSeconds?: number | null;
  /** Server-computed time remaining on the current question. */
  questionSecondsLeft?: number | null;
  security: ExamSecurityConfig;
  questions: ExamQuestion[];
}

export type ViolationType =
  | "TAB_HIDDEN"
  | "WINDOW_BLUR"
  | "FULLSCREEN_EXIT"
  | "COPY_ATTEMPT"
  | "PASTE_ATTEMPT"
  | "CUT_ATTEMPT"
  | "CONTEXT_MENU_ATTEMPT"
  | "DEVTOOLS_SHORTCUT"
  | "PRINT_SCREEN"
  | "MULTIPLE_DISPLAYS_DETECTED";
