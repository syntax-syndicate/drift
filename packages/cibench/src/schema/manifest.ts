/**
 * CIBench Manifest Schema
 * 
 * Defines the structure of a benchmark codebase's metadata.
 */

export interface CIBenchManifest {
  /** Schema version */
  version: '1.0.0';
  
  /** Unique identifier for this test codebase */
  id: string;
  
  /** Human-readable name */
  name: string;
  
  /** Description of what this codebase tests */
  description: string;
  
  /** Primary language */
  language: BenchmarkLanguage;
  
  /** Additional languages (for polyglot codebases) */
  additionalLanguages?: BenchmarkLanguage[];
  
  /** Framework(s) used */
  frameworks: string[];
  
  /** Codebase size category */
  size: 'small' | 'medium' | 'large' | 'monorepo';
  
  /** Approximate file count */
  fileCount: number;
  
  /** Approximate lines of code */
  linesOfCode: number;
  
  /** What aspects this codebase is designed to test */
  testsFocus: BenchmarkCategory[];
  
  /** Difficulty level */
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  
  /** Source of the codebase */
  source: {
    type: 'synthetic' | 'real-oss' | 'hand-crafted';
    /** If real-oss, the original repo */
    originalRepo?: string;
    /** License */
    license: string;
  };
  
  /** Ground truth annotation metadata */
  annotations: {
    /** Who annotated */
    annotatedBy: string;
    /** When */
    annotatedAt: string;
    /** Annotation quality (self-assessed) */
    quality: 'draft' | 'reviewed' | 'verified';
    /** Notes about annotation process */
    notes?: string;
  };
}

export type BenchmarkLanguage = 
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'go'
  | 'java'
  | 'rust'
  | 'csharp'
  | 'php'
  | 'cpp';

export type BenchmarkCategory =
  | 'pattern-recognition'
  | 'call-graph'
  | 'impact-analysis'
  | 'data-flow'
  | 'convention-inference'
  | 'agentic-grounding';
