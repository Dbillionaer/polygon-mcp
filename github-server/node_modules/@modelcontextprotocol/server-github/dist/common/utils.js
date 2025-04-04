import { createGitHubError } from "./errors.js";
async function parseResponseBody(response) {
    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
        return response.json();
    }
    return response.text();
}
export function buildUrl(baseUrl, params) {
    const url = new URL(baseUrl);
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
            url.searchParams.append(key, value.toString());
        }
    });
    return url.toString();
}
export async function githubRequest(url, options = {}) {
    const headers = {
        "Accept": "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        ...options.headers,
    };
    if (process.env.GITHUB_PERSONAL_ACCESS_TOKEN) {
        headers["Authorization"] = `Bearer ${process.env.GITHUB_PERSONAL_ACCESS_TOKEN}`;
    }
    const response = await fetch(url, {
        method: options.method || "GET",
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const responseBody = await parseResponseBody(response);
    if (!response.ok) {
        throw createGitHubError(response.status, responseBody);
    }
    return responseBody;
}
export function validateBranchName(branch) {
    const sanitized = branch.trim();
    if (!sanitized) {
        throw new Error("Branch name cannot be empty");
    }
    if (sanitized.includes("..")) {
        throw new Error("Branch name cannot contain '..'");
    }
    if (/[\s~^:?*[\\\]]/.test(sanitized)) {
        throw new Error("Branch name contains invalid characters");
    }
    if (sanitized.startsWith("/") || sanitized.endsWith("/")) {
        throw new Error("Branch name cannot start or end with '/'");
    }
    if (sanitized.endsWith(".lock")) {
        throw new Error("Branch name cannot end with '.lock'");
    }
    return sanitized;
}
export function validateRepositoryName(name) {
    const sanitized = name.trim().toLowerCase();
    if (!sanitized) {
        throw new Error("Repository name cannot be empty");
    }
    if (!/^[a-z0-9_.-]+$/.test(sanitized)) {
        throw new Error("Repository name can only contain lowercase letters, numbers, hyphens, periods, and underscores");
    }
    if (sanitized.startsWith(".") || sanitized.endsWith(".")) {
        throw new Error("Repository name cannot start or end with a period");
    }
    return sanitized;
}
export function validateOwnerName(owner) {
    const sanitized = owner.trim().toLowerCase();
    if (!sanitized) {
        throw new Error("Owner name cannot be empty");
    }
    if (!/^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,38}$/.test(sanitized)) {
        throw new Error("Owner name must start with a letter or number and can contain up to 39 characters");
    }
    return sanitized;
}
export async function checkBranchExists(owner, repo, branch) {
    try {
        await githubRequest(`https://api.github.com/repos/${owner}/${repo}/branches/${branch}`);
        return true;
    }
    catch (error) {
        if (error && typeof error === "object" && "status" in error && error.status === 404) {
            return false;
        }
        throw error;
    }
}
export async function checkUserExists(username) {
    try {
        await githubRequest(`https://api.github.com/users/${username}`);
        return true;
    }
    catch (error) {
        if (error && typeof error === "object" && "status" in error && error.status === 404) {
            return false;
        }
        throw error;
    }
}
