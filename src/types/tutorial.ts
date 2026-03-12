export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right' | 'center';

export type TutorialAction =
  | { type: 'navigate'; to: string }
  | { type: 'click'; selector: string }
  | { type: 'highlight'; selector: string }
  | { type: 'wait'; ms: number };

export type TutorialStep = {
  id: string;
  title: string;
  content: string;
  target: string | null;
  position: TooltipPosition;
  route: string;
  beforeAction?: TutorialAction;
  waitForElement?: string;
  padding?: number;
  chapter: string;
  chapterIndex: number;
  allowInteraction: boolean;
  advanceOnInteraction?: boolean;
};
