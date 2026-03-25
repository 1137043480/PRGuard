export interface CheckResult {
    name: string;
    passed: boolean;
    message: string;
    severity: 'error' | 'warning' | 'info';
    category: CheckCategory;
    score: number;
}
export type CheckCategory = 'title' | 'description' | 'commits' | 'branch' | 'files' | 'contributor' | 'slop-pattern' | 'style' | 'ai-analysis';
export interface PRData {
    number: number;
    title: string;
    body: string | null;
    author: string;
    authorCreatedAt: string;
    authorAssociation: string;
    isDraft: boolean;
    labels: string[];
    sourceBranch: string;
    targetBranch: string;
    commits: CommitData[];
    files: FileData[];
    additions: number;
    deletions: number;
    changedFiles: number;
}
export interface CommitData {
    sha: string;
    message: string;
    author: string;
    email: string;
}
export interface FileData {
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    patch?: string;
}
export interface ReviewReport {
    qualityScore: number;
    passed: boolean;
    totalChecks: number;
    failedChecks: number;
    results: CheckResult[];
    aiAnalysis?: AIAnalysisResult;
    summary: string;
}
export interface AIAnalysisResult {
    overallAssessment: string;
    slopIndicators: string[];
    codeQualityNotes: string[];
    conventionViolations: string[];
    suggestions: string[];
    confidence: number;
}
//# sourceMappingURL=types.d.ts.map