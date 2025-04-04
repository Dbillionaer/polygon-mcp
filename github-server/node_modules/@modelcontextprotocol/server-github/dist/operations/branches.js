import { z } from "zod";
import { githubRequest } from "../common/utils.js";
import { GitHubReferenceSchema } from "../common/types.js";
// Schema definitions
export const CreateBranchOptionsSchema = z.object({
    ref: z.string(),
    sha: z.string(),
});
export const CreateBranchSchema = z.object({
    owner: z.string().describe("Repository owner (username or organization)"),
    repo: z.string().describe("Repository name"),
    branch: z.string().describe("Name for the new branch"),
    from_branch: z.string().optional().describe("Optional: source branch to create from (defaults to the repository's default branch)"),
});
// Function implementations
export async function getDefaultBranchSHA(owner, repo) {
    try {
        const response = await githubRequest(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/main`);
        const data = GitHubReferenceSchema.parse(response);
        return data.object.sha;
    }
    catch (error) {
        const masterResponse = await githubRequest(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/master`);
        if (!masterResponse) {
            throw new Error("Could not find default branch (tried 'main' and 'master')");
        }
        const data = GitHubReferenceSchema.parse(masterResponse);
        return data.object.sha;
    }
}
export async function createBranch(owner, repo, options) {
    const fullRef = `refs/heads/${options.ref}`;
    const response = await githubRequest(`https://api.github.com/repos/${owner}/${repo}/git/refs`, {
        method: "POST",
        body: {
            ref: fullRef,
            sha: options.sha,
        },
    });
    return GitHubReferenceSchema.parse(response);
}
export async function getBranchSHA(owner, repo, branch) {
    const response = await githubRequest(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`);
    const data = GitHubReferenceSchema.parse(response);
    return data.object.sha;
}
export async function createBranchFromRef(owner, repo, newBranch, fromBranch) {
    let sha;
    if (fromBranch) {
        sha = await getBranchSHA(owner, repo, fromBranch);
    }
    else {
        sha = await getDefaultBranchSHA(owner, repo);
    }
    return createBranch(owner, repo, {
        ref: newBranch,
        sha,
    });
}
export async function updateBranch(owner, repo, branch, sha) {
    const response = await githubRequest(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
        method: "PATCH",
        body: {
            sha,
            force: true,
        },
    });
    return GitHubReferenceSchema.parse(response);
}
