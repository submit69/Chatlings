# winget

Manifests for `winget install submit69.Chatlings`, in the same folder layout as
[microsoft/winget-pkgs](https://github.com/microsoft/winget-pkgs).

- Check: `winget validate --manifest packaging/winget/manifests/s/submit69/Chatlings/0.1.1`
- First submission: `node packaging/winget/submit-pr.mjs 0.1.1` forks winget-pkgs to
  your GitHub account and opens the pull request. Then comment
  `@microsoft-github-policy-service agree` on it once (Microsoft CLA).
- Later versions: once 0.1.1 is merged, add a classic GitHub token with
  `public_repo` scope as the `WINGET_TOKEN` secret; the `winget` job in
  `.github/workflows/release.yml` then opens the update PR on every release.
