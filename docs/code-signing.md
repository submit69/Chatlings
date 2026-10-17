# Code signing

Windows SmartScreen warns about unsigned installers ("Windows protected your PC"). Chatlings applies for free code signing for open-source projects from the [SignPath Foundation](https://signpath.org). Until that is approved, releases are unsigned.

## Code signing policy

> Copy this section into the README once SignPath has approved the project.

Free code signing provided by [SignPath.io](https://signpath.io), certificate by [SignPath Foundation](https://signpath.org).

- **Committers and reviewers:** the repository owner [submit69](https://github.com/submit69); outside contributions are reviewed by the owner before they are merged.
- **Approvers:** [submit69](https://github.com/submit69). Every signing request is approved manually.
- **What is signed:** only files built by GitHub Actions from this repository's source, by `.github/workflows/release.yml`, for tags `v*`. Nothing is signed from a developer's machine.
- **Privacy:** this program does not transfer any information to other networked systems unless specifically requested by the user or the person installing or operating it. It connects only to the chat services the user adds and to this repository's GitHub Releases to check for updates. See [PRIVACY.md](../PRIVACY.md).

## How it is wired

The release workflow switches to signing by itself when the `SIGNPATH_API_TOKEN` secret exists:

1. build the app files (`electron-builder --dir`) and send them to SignPath (artifact configuration `app`, see `.signpath/artifact-configurations/app.xml`);
2. build the installer and the portable exe from the signed files (`--prepackaged`);
3. send both to SignPath (artifact configuration `installers`);
4. rebuild `latest.yml` and the `.blockmap` from the signed installer (`scripts/update-latest-yml.mjs`), otherwise auto-update would reject the file because its hash changed;
5. upload everything to the GitHub release.

## Setup checklist (once)

1. Apply at <https://signpath.org/apply> with the repository URL. Requirements: OSI license (MIT ✓), public source, releases built on CI (✓), a code signing policy (the section above).
2. When approved, in SignPath:
   - create project slug `chatlings` linked to this GitHub repository;
   - create a signing policy with slug `release-signing` (the Foundation certificate, manual approval);
   - add two artifact configurations with slugs `app` and `installers`, pasting the XML files from `.signpath/artifact-configurations/`;
   - add a CI user, give it submitter rights on the policy, copy its API token.
3. In GitHub → Settings → Secrets and variables → Actions:
   - secret `SIGNPATH_API_TOKEN` = the CI user's token;
   - variable `SIGNPATH_ORGANIZATION_ID` = your SignPath organization id.
4. Copy the policy section above into the README, release a new version.
