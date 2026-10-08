export type AnatomySystemKey =
  | 'skin'
  | 'musculoskeletal'
  | 'nervous'
  | 'cardiovascular'
  | 'respiratory'
  | 'digestive'
  | 'urinary'
  | 'reproductive'
  | 'lymphatic';

export type AnatomySystemType = 'body' | 'system';

export type AnatomyBodyModelKey = 'male' | 'female';

export interface AnatomyStructure {
  id: string;
  structureKey: string;
  name: string;
  objectName: string;
  systemKey: AnatomySystemKey;
  bodyModel: AnatomyBodyModelKey;
  ontologyId: string | null;
  lineage: string[];
}

export interface AnatomySelection {
  structureKey: string;
  name: string;
  objectName: string;
  systemKey: AnatomySystemKey;
  bodyModel: AnatomyBodyModelKey;
  ontologyId: string | null;
}

export type SelectedStructure = AnatomySelection;

export interface AnatomySearchResult {
  structureKey: string;
  bodyModel: AnatomyBodyModelKey;
  systemKey: AnatomySystemKey;
  name: string;
  objectName: string;
  ontologyId: string | null;
}

export interface AnatomySearchOptions {
  bodyModel?: AnatomyBodyModelKey | 'all';
  systemKey?: AnatomySystemKey | 'all';
  limit?: number;
}

export type AnatomyInformationSourceCategory =
  'Human Reference Atlas' | 'NIH' | 'FMA' | 'Uberon' | 'authoritative anatomy reference';

export interface AnatomyInformationProvenance {
  source: AnatomyInformationSourceCategory | string;
  sourceUrl: string;
  lastVerified: string;
  license?: string;
}

export interface AnatomyInformation extends AnatomyInformationProvenance {
  structureKey: string;
  bodyModel: AnatomyBodyModelKey;
  systemKey: AnatomySystemKey;
  ontologyId: string | null;
  canonicalName: string;
  description: string;
  function: string;
  relatedStructures?: readonly AnatomyRelatedStructure[];
}

export type AnatomyRelationKind = 'part_of' | 'related_to';

export interface AnatomyRelatedStructure {
  structureKey: string;
  relation: AnatomyRelationKind;
}

export interface AnatomyQuizQuestion {
  id: string;
  canonicalName: string;
  bodyModel: AnatomyBodyModelKey;
  systemKey: AnatomySystemKey;
  ontologyId: string | null;
  structureKey: string;
  question: string;
  choices: string[];
  correctIndex: number;
}

export type UserRole = 'STUDENT' | 'TEACHER' | 'ADMIN';

export interface ApiErrorBody {
  code?: string;
  message?: string;
  details?: string[];
  requestId?: string;
}

export interface AuthUserContract {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
  createdAt: string;
}

export interface SessionBodyContract {
  user: AuthUserContract;
  accessToken: string;
  refreshToken: string;
}

export type QuizStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface BankQuestionContract {
  id: string;
  prompt: string;
  options: string[];
  position: number;
  correctIndex?: number;
}

export interface BankQuizContract {
  id: string;
  title: string;
  description: string | null;
  bodyModel: string | null;
  status: QuizStatus;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  questionCount: number;
  questions?: BankQuestionContract[];
}

export interface BankAttemptResultContract {
  attemptId: string;
  quizId: string;
  score: number;
  total: number;
  correct: number;
  incorrect: number;
  percentage: number;
  completedAt: string;
  results: Array<{ questionId: string; selected: number | null; correct: boolean }>;
}

export interface BankAttemptRowContract {
  attemptId: string;
  userId: string;
  score: number;
  total: number;
  percentage: number;
  completedAt: string;
}

export interface BankQuizStatsContract {
  quizId: string;
  attempts: number;
  avgScore: number;
  avgPercentage: number;
  totalQuestions: number;
  perQuestion: Array<{
    questionId: string;
    position: number;
    attempts: number;
    correct: number;
    rate: number;
  }>;
}

export interface AuditLogContract {
  id: string;
  actorId: string;
  actorRole: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface AdminUserDetailContract {
  user: {
    id: string;
    email: string | null;
    name: string | null;
    role: string;
    createdAt: string;
  };
  deactivatedAt: string | null;
  stats: { memberships: number; quizAttempts: number; cohortsCreated: number };
}
