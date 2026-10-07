export type QuestionType = "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "SHORT_ANSWER" | "FILL_IN_BANK";

export interface ExamOption {
  id: string;
  label: string;
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

export interface ExamPaper {
  attemptId: string;
  startedAt: string;
  durationMinutes: number;
  examTitle?: string;
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
