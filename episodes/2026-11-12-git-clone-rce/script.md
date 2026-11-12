# One git clone could run a hacker's code

News short (~55s). Voice: Kokoro `af_heart`. No music; voice + subtle non-musical SFX only.

**[0.2s] Hook**  
One git clone could run a hacker's code on your machine.

**[3.2s] The news**  
This week, Git patched six vulnerabilities. The worst is rated high severity.

**[8.0s] How Git normally protects .git**  
Here's the trick. Before Git writes a file, it checks the path, so nothing can overwrite its own .git data.

**[14.5s] The flaw: integer truncation**  
But the attacker uses an extremely long path. Its length gets truncated. So it passes the check under its full name, then gets written under a shorter one: .git

**[24.5s] Submodule .git file becomes a symlink**  
Inside a submodule, that file becomes a symlink, pointing at a folder of malicious hooks.

**[30.2s] Attacker code runs**  
When Git uses that folder, the attacker's code runs. On your laptop, or your CI runner.

**[35.7s] Only with --recurse-submodules**  
It only triggers with --recurse-submodules, which pipelines and coding agents use all the time.

**[41.3s] The fix**  
The fix: update to Git 2.56.1, or a patched backport.

**[45.9s] Workaround**  
Can't update yet? Clone without submodules first, and inspect .gitmodules

**[51.2s] Takeaway**  
A repo is code from a stranger. Treat it that way.

## Fact check (researched 2026-11-12)
- The Git project published security releases on **10 November 2026** fixing **six** vulnerabilities; the fixed release is **Git 2.56.1**, with backports 2.55.1, 2.54.1, 2.53.1, 2.52.1, 2.51.3 and 2.50.2.
- **CVE-2026-111760** (High, CVSS 8.0): an integer truncation in the index code lets an extremely long path pass Git's path check under its full name and then be written under a shorter one, which can be `.git`. A submodule's `.git` file can be replaced with a symlink to a directory holding malicious hooks/config, so attacker code runs during `git clone --recurse-submodules`.
- Mitigation if you cannot update: avoid recursive clones of untrusted repositories; clone without `--recurse-submodules` and inspect `.gitmodules` first. Update CI runners and tools that bundle Git.
- The path label, repo URL and `.gitmodules` contents shown on screen are illustrative, not taken from a real exploit.

## Sources
- https://github.blog/open-source/git/git-security-vulnerabilities-announced-7/
- https://www.helpnetsecurity.com/2026/11/11/git-project-security-updates/
- https://thehackernews.com/2026/11/git-patches-flaw-that-lets-malicious.html
- https://www.upwind.io/blog/threat-post/cve-2026-111760-git-recursive-clone-integer-truncation-enables-submodule-gitfile-symlink-rce
- https://byteiota.com/git-2-56-1-patches-six-flaws-patch-now/

I could only read these through search-result summaries (the sites themselves are blocked from the build sandbox), so re-check the primary GitHub post before publishing.
