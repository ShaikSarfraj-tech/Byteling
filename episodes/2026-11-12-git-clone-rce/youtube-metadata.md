# YouTube upload metadata — Git clone RCE (news short)

**File:** `episodes/2026-11-12-git-clone-rce/video.mp4` (Shorts, 55s, 9:16)

## Title (62 chars)
One git clone Could Run a Hacker's Code — Update Git Now #shorts

## Description
Git just patched six vulnerabilities (Nov 10, 2026). The worst one, CVE-2026-111760, lets a malicious repository run code on your machine during `git clone --recurse-submodules`.

In 55 seconds:
• How Git normally protects its own .git data
• The integer truncation trick: an extremely long path passes the check, then gets written as ".git"
• How a submodule's .git file becomes a symlink to malicious hooks
• Who is exposed: laptops, CI runners, coding agents
• The fix: Git 2.56.1 (or a patched backport: 2.55.1, 2.54.1, 2.53.1, 2.52.1, 2.51.3, 2.50.2)
• Can't update yet? Clone without submodules and inspect .gitmodules first

Check your version: git --version

Follow for daily software engineering and security news, explained visually.

#git #cybersecurity #programming #devops #softwareengineering #github #coding #security #cve #developer #technews #shorts

## Tags
git, git vulnerability, git security update, git 2.56.1, CVE-2026-111760, git clone exploit, recurse submodules, git submodule, remote code execution, rce, cybersecurity news, developer news, tech news, software engineering, devops, ci cd security, supply chain security, github, programming, coding, update git, git hooks, security patch, infosec, tech shorts

## Settings
- Category: Science & Technology (28)
- Language: English · Made for kids: No · Altered/synthetic content: Yes (AI voice)
- Captions: upload `captions.srt`
- Pinned comment: "Run `git --version` — are you on 2.56.1 or a patched backport yet?"
