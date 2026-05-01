let _OctokitClass = null;

async function getOctokit(token) {
  if (!_OctokitClass) {
    const { Octokit } = await import('@octokit/rest');
    _OctokitClass = Octokit;
  }
  return new _OctokitClass({ auth: token });
}

function splitRepo(fullName) {
  const [owner, repo] = fullName.split('/');
  return { owner, repo };
}

async function fetchFileContent(fullName, filePath, token) {
  const { owner, repo } = splitRepo(fullName);
  const octokit = await getOctokit(token);
  const { data } = await octokit.repos.getContent({ owner, repo, path: filePath });
  if (Array.isArray(data)) throw new Error(`${filePath} is a directory, not a file`);
  return Buffer.from(data.content, 'base64').toString('utf8');
}

async function fetchMultipleFiles(fullName, filePaths, token) {
  const results = {};
  await Promise.allSettled(
    filePaths.map(async (filePath) => {
      try {
        results[filePath] = await fetchFileContent(fullName, filePath, token);
      } catch (err) {
        results[filePath] = null;
      }
    }),
  );
  return results;
}

async function createBranch(fullName, baseBranch, newBranch, token) {
  const { owner, repo } = splitRepo(fullName);
  const octokit = await getOctokit(token);
  const { data: ref } = await octokit.git.getRef({ owner, repo, ref: `heads/${baseBranch}` });
  await octokit.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${newBranch}`,
    sha: ref.object.sha,
  });
  return newBranch;
}

async function commitFileChange(fullName, branch, filePath, content, message, token) {
  const { owner, repo } = splitRepo(fullName);
  const octokit = await getOctokit(token);
  let sha;
  try {
    const { data } = await octokit.repos.getContent({ owner, repo, path: filePath, ref: branch });
    if (!Array.isArray(data)) sha = data.sha;
  } catch (_) {}

  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: filePath,
    message,
    content: Buffer.from(content).toString('base64'),
    branch,
    ...(sha ? { sha } : {}),
  });
}

async function createPullRequest(fullName, { title, body, head, base }, token) {
  const { owner, repo } = splitRepo(fullName);
  const octokit = await getOctokit(token);
  const { data } = await octokit.pulls.create({
    owner,
    repo,
    title,
    body,
    head,
    base,
    draft: true,
  });
  return { url: data.html_url, number: data.number, node_id: data.node_id };
}

module.exports = {
  fetchFileContent,
  fetchMultipleFiles,
  createBranch,
  commitFileChange,
  createPullRequest,
};
