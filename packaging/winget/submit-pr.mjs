// Opens a PR on microsoft/winget-pkgs adding the manifests in
// packaging/winget/manifests/s/submit69/Chatlings/<version>.
//   node packaging/winget/submit-pr.mjs 0.1.1
// Uses your GitHub login from Git Credential Manager (or GH_TOKEN). It forks
// microsoft/winget-pkgs to your account, pushes a branch and opens the PR.
// After that, comment "@microsoft-github-policy-service agree" on the PR once
// to sign Microsoft's CLA.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const token = process.env.GH_TOKEN || execSync('git credential fill', { input: 'protocol=https\nhost=github.com\n\n' }).toString().match(/^password=(.*)$/m)[1];
const H = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'chatlings-release' };
const gh = async (method, url, body) => {
  const r = await fetch('https://api.github.com' + url, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  let j;
  try { j = JSON.parse(t); } catch { j = t; }
  return { status: r.status, j };
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const me = (await gh('GET', '/user')).j.login;
console.log('user', me);
const VERSION = process.argv[2] || JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url))).version;
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'manifests/s/submit69/Chatlings', VERSION);
if (!fs.existsSync(dir)) throw new Error('no manifests for ' + VERSION + ' in ' + dir);
const repoPath = `manifests/s/submit69/Chatlings/${VERSION}`;
const branch = `submit69.Chatlings-${VERSION}`;

// existing PRs?
const open = await gh('GET', `/search/issues?q=${encodeURIComponent('repo:microsoft/winget-pkgs is:pr submit69.Chatlings')}`);
if (open.j.total_count) {
  console.log('existing PRs:', open.j.items.map((i) => `${i.state} ${i.html_url}`));
}

let fork = await gh('GET', `/repos/${me}/winget-pkgs`);
if (fork.status === 404) {
  console.log('forking…');
  await gh('POST', '/repos/microsoft/winget-pkgs/forks', { default_branch_only: true });
  for (let i = 0; i < 60; i++) {
    await sleep(5000);
    fork = await gh('GET', `/repos/${me}/winget-pkgs`);
    if (fork.status === 200) break;
  }
}
console.log('fork', fork.status, fork.j.full_name);

const base = (await gh('GET', '/repos/microsoft/winget-pkgs/git/ref/heads/master')).j.object.sha;
let ref;
for (let i = 0; i < 30; i++) {
  ref = await gh('POST', `/repos/${me}/winget-pkgs/git/refs`, { ref: `refs/heads/${branch}`, sha: base });
  if (ref.status === 201 || ref.status === 422) break;
  await sleep(5000);
}
console.log('branch', ref.status, ref.status === 422 ? ref.j.message : '');

for (const f of fs.readdirSync(dir)) {
  const p = `${repoPath}/${f}`;
  const existing = await gh('GET', `/repos/${me}/winget-pkgs/contents/${p}?ref=${branch}`);
  const r = await gh('PUT', `/repos/${me}/winget-pkgs/contents/${p}`, {
    message: `New package: submit69.Chatlings version ${VERSION}`,
    content: Buffer.from(fs.readFileSync(path.join(dir, f))).toString('base64'),
    branch,
    sha: existing.status === 200 ? existing.j.sha : undefined,
  });
  console.log('file', f, r.status);
}

const body = `Adds [Chatlings](https://github.com/submit69/Chatlings) ${VERSION}: floating chat heads for Zalo, Messenger, WhatsApp, Telegram, Discord and other web chats, with several accounts at once. MIT licensed, per-user NSIS installer (electron-builder) published on GitHub Releases.

- [ ] Have you signed the [Contributor License Agreement](https://cla.opensource.microsoft.com/microsoft/winget-pkgs)?
- [x] Is there a linked Issue? No, new package.
- [x] Have you checked that there aren't other open [pull requests](https://github.com/microsoft/winget-pkgs/pulls) for the same manifest update/change?
- [x] This PR only modifies one (1) manifest
- [x] Have you [validated](https://github.com/microsoft/winget-pkgs/blob/master/doc/Authoring.md#validation) your manifest locally with \`winget validate --manifest <path>\`?
- [ ] Have you tested your manifest locally with \`winget install --manifest <path>\`? (Not through winget itself: the installer's silent install \`/S\` and silent uninstall were tested on Windows 11.)
- [x] Does your manifest conform to the [1.9 schema](https://github.com/microsoft/winget-pkgs/tree/master/doc/manifest/schema/1.9.0)?
`;
const pr = await gh('POST', '/repos/microsoft/winget-pkgs/pulls', {
  title: `New package: submit69.Chatlings version ${VERSION}`,
  head: `${me}:${branch}`,
  base: 'master',
  body,
});
console.log('PR', pr.status, pr.j.html_url || JSON.stringify(pr.j).slice(0, 400));
