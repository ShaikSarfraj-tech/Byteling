# Why Outlook and Teams went down worldwide

News explainer short (~53s). Voice: Kokoro `am_michael`. No music; voice + subtle non-musical SFX only.

**[0.2s] Hook**  
Outlook and Teams just went down around the world. And Microsoft says it was not an attack.

**[6.2s] The news**  
On November twelfth, Microsoft 365 started failing in more than seventy countries.

**[12.6s] Microsoft's early explanation**  
The early explanation? Not a traffic spike. Failed server health checks.

**[17.3s] How load-balancer health checks work**  
Here's what that means. A load balancer keeps asking every server: are you alive? If one stops answering, it gets pulled out of rotation.

**[26.7s] When many servers fail checks at once**  
That's perfect when one server dies. But when many servers fail their checks at once, they all get pulled.

**[33.3s] Overload**  
Now the same traffic lands on far fewer machines. They overload, slow down, and start failing too.

**[40.3s] Cascading failure**  
Engineers call that a cascading failure.

**[43.0s] Status**  
Microsoft says the final root cause is still being investigated.

**[47.6s] Takeaway**  
The lesson? Health checks decide who gets traffic. Design them to fail carefully.

## Fact check (researched 2026-11-13)
Reported facts:
- A Microsoft 365 outage began on **12 November 2026** (Exchange Online incident **EX1550543**, from 16:17 UTC; dependent services tracked as MO1550821) and was still causing intermittent issues on 13 November.
- Affected services included Outlook / Exchange Online, Teams, SharePoint Online, Microsoft 365 Copilot and Defender XDR; reports came from **at least 74 countries**.
- Microsoft first cited "elevated load", then said the load was not from more traffic but from a large number of servers being unexpectedly unavailable, and that **failed server health checks** were at the root of it.
- Microsoft said it was **not aware of malicious activity**, and that a **post-incident report** will follow; the **final root cause is not confirmed**.

What is explanation, not reporting:
- Sentences 4–7 describe the general, well-known failure mode (health-check ejection → fewer servers → overload → cascading failure). The video does **not** claim to know Microsoft's internal sequence of events.
- The 12-server wall, the "servers in rotation" counter and the "load per server" percentages are an illustration (same traffic ÷ servers left), not Microsoft data.

## Sources
- https://www.cnn.com/2026/11/12/business/live-news/microsoft-global-outage-intl-hnk
- https://abcnews.com/US/outlook-down-microsoft-outage-reported-mail/story?id=138088203
- https://www.aljazeera.com/news/2026/11/12/microsoft-outage-hits-tens-of-thousands-of-users
- https://www.securityweek.com/microsoft-365-outage-disrupts-outlook-exchange-online-and-teams/
- https://windowsforum.com/news/exchange-online-outage-failed-health-checks-and-how-to-track-ex1550543.452127/

Read through search-result summaries only (news sites are blocked from the build sandbox). This is a developing story: re-check the latest Microsoft update before publishing.
