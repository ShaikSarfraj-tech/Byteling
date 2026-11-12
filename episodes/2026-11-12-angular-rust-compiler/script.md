# TypeScript 7 broke Angular's compiler — so Angular is rewriting part of it in Rust

News short (~54s). Voice: Kokoro `af_heart`. No music; voice + subtle non-musical SFX only.

**[0.2s] Hook**  
TypeScript seven just broke Angular's compiler. So Angular is rewriting part of it, in Rust.

**[6.3s] Why: TypeScript 7 (Go) ships without the transformer API**  
Here's why. TypeScript seven is the native rewrite, in Go. Much faster. But it shipped without the transformer API.

**[14.1s] What ngc did**  
And Angular's compiler, ngc, plugged straight into that API, to turn your decorators and templates into JavaScript.

**[22.2s] ngp: Rust front end on Oxc**  
So the team built ngp, the Angular preprocessor. A Rust front end, built on Oxc, scans your files in parallel, finds every component, and resolves its metadata.

**[33.7s] Hand-off to tsgo / esbuild / Rolldown**  
Then it hands off. Type checking and bundling go to tools like tsgo, esbuild, or Rolldown.

**[39.5s] Benchmarks**  
Early community benchmarks show builds up to three times faster.

**[43.6s] Status: beta**  
But it's still in beta. For production, stay on ngc for now.

**[47.8s] Takeaway**  
The lesson? Your framework is only as fast as the tools underneath it. And those tools are going native.

## Fact check (researched 2026-11-12)
- The Angular team introduced **ngp** (Angular Preprocessor), now in beta: a hybrid compiler whose analysis stage is rewritten in **Rust using Oxc**; the Rust front end analyses files in parallel to discover Angular declarations and resolve metadata.
- Reason: **TypeScript 7** (the native Go port) does not support the Transformer API integration that the existing **ngc** compiler relied on.
- ngp hands type-checking and emit/bundling to tools such as **tsgo, esbuild or Rolldown**.
- Performance: early community numbers only — a benchmark repo reports 1.3–3.6× faster than ngc; a digest citing InfoQ reports cold builds 2–3× faster. The video says "up to three times faster".
- Status: beta. Production builds should stay on ngc for now; adoption is expected in a minor release of Angular 22.
- The on-screen file grid, component count and bar lengths are illustrative.

## Sources
- https://www.infoq.com/news/2026/11/angular-compiler-rust-typescript/
- https://x.com/angular/status/2104602033919521003
- https://blog.ninja-squad.com/2026/10/27/how-much-faster-is-the-new-angular-compiler/
- https://github.com/push-based/ng-hybrid-preprocessor-bench
- https://dev.to/magnus_ferm/dev-news-digest-11-nov-2026-1200-1a92

Read through search-result summaries only (the sites are blocked from the build sandbox); re-check the InfoQ article before publishing.
