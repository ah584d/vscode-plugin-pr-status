export interface PR {
  title: string;
  url: string;
  status: string;
  repo: string;
}

export interface PRStatus {
  dot: string;
  text: string;
  count: {
    success: number;
    failure: number;
    pending: number;
  };
}

export interface CheckResult {
  dot: string;
  statusText: string;
}

// Git Extension Types
export interface GitRemote {
  name: string;
  fetchUrl?: string;
  pushUrl?: string;
  isReadOnly: boolean;
}

export interface GitRepositoryState {
  remotes: GitRemote[];
}

export interface GitRepository {
  state: GitRepositoryState;
}

// GitHub API Types
export interface GitHubCheckRun {
  id: number;
  status: string;
  conclusion: string | null;
  name: string;
  app?: { slug?: string };
}

export interface GitHubPullRequest {
  number: number;
  title: string;
  html_url: string;
  repository_url: string;
}

export interface GitHubPRHead {
  sha: string;
  ref: string;
}

export interface GitHubPRData {
  number: number;
  title: string;
  html_url: string;
  head: GitHubPRHead;
}

export interface PRCounts {
  success: number;
  failure: number;
  pending: number;
}

export interface ProcessedPRResult {
  prData: GitHubPRData;
  owner: string;
  repo: string;
  dot: string;
  statusText: string;
  repoPrefix: string;
}

// Octokit type - using a simplified interface for type safety
export interface OctokitInstance {
  rest: {
    users: {
      getAuthenticated(): Promise<{ data: { login: string } }>;
    };
    search: {
      issuesAndPullRequests(params: {
        q: string;
        per_page: number;
      }): Promise<{ data: { items: GitHubPullRequest[] } }>;
    };
    pulls: {
      get(params: {
        owner: string;
        repo: string;
        pull_number: number;
      }): Promise<{ data: GitHubPRData }>;
    };
    checks: {
      listForRef(params: {
        owner: string;
        repo: string;
        ref: string;
      }): Promise<{ data: { check_runs: GitHubCheckRun[] } }>;
    };
    repos: {
      getCombinedStatusForRef(params: {
        owner: string;
        repo: string;
        ref: string;
      }): Promise<{ data: { state: string } }>;
    };
  };
}
