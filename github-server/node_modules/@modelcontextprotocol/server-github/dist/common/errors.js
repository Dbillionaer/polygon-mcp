export class GitHubError extends Error {
    status;
    response;
    constructor(message, status, response) {
        super(message);
        this.status = status;
        this.response = response;
        this.name = "GitHubError";
    }
}
export class GitHubValidationError extends GitHubError {
    constructor(message, status, response) {
        super(message, status, response);
        this.name = "GitHubValidationError";
    }
}
export class GitHubResourceNotFoundError extends GitHubError {
    constructor(resource) {
        super(`Resource not found: ${resource}`, 404, { message: `${resource} not found` });
        this.name = "GitHubResourceNotFoundError";
    }
}
export class GitHubAuthenticationError extends GitHubError {
    constructor(message = "Authentication failed") {
        super(message, 401, { message });
        this.name = "GitHubAuthenticationError";
    }
}
export class GitHubPermissionError extends GitHubError {
    constructor(message = "Insufficient permissions") {
        super(message, 403, { message });
        this.name = "GitHubPermissionError";
    }
}
export class GitHubRateLimitError extends GitHubError {
    resetAt;
    constructor(message = "Rate limit exceeded", resetAt) {
        super(message, 429, { message, reset_at: resetAt.toISOString() });
        this.resetAt = resetAt;
        this.name = "GitHubRateLimitError";
    }
}
export class GitHubConflictError extends GitHubError {
    constructor(message) {
        super(message, 409, { message });
        this.name = "GitHubConflictError";
    }
}
export function isGitHubError(error) {
    return error instanceof GitHubError;
}
export function createGitHubError(status, response) {
    switch (status) {
        case 401:
            return new GitHubAuthenticationError(response?.message);
        case 403:
            return new GitHubPermissionError(response?.message);
        case 404:
            return new GitHubResourceNotFoundError(response?.message || "Resource");
        case 409:
            return new GitHubConflictError(response?.message || "Conflict occurred");
        case 422:
            return new GitHubValidationError(response?.message || "Validation failed", status, response);
        case 429:
            return new GitHubRateLimitError(response?.message, new Date(response?.reset_at || Date.now() + 60000));
        default:
            return new GitHubError(response?.message || "GitHub API error", status, response);
    }
}
