import { useState, useEffect } from "react";

const Badge = ({ children, bg, fg }) => (
  <span style={{ display: "inline-flex", padding: "3px 8px", borderRadius: 5, fontSize: 10, fontWeight: 600, background: bg || "#1a2535", color: fg || "#6a7a8a", whiteSpace: "nowrap" }}>{children}</span>
);

const StatusDot = ({ status }) => {
  const colors = { active: "#10b981", thinking: "#f59e0b", idle: "#4a5a6a", alert: "#e85c5c" };
  return <div style={{ width: 8, height: 8, borderRadius: "50%", background: colors[status] || "#4a5a6a", boxShadow: `0 0 6px ${colors[status]}`, animation: status === "thinking" ? "pulse 1.5s infinite" : status === "active" ? "pulse 2s infinite" : "none" }} />;
};

// ─── AGENT DECISION LOG ─────────────────────────────────
const AGENT_DECISIONS = [
  {
    ts: "14:45:02",
    type: "auto_fix",
    severity: "medium",
    title: "Form endpoint changed — auto re-crawled",
    detail: "arise.solar/get-quote returned 404 on submission attempt. OpsAgent triggered immediate re-crawl of arise.solar. New endpoint discovered: /api/v2/quote-request. Action entity updated. Form submissions restored.",
    action_taken: "Re-crawled domain, updated action entity, tested new endpoint (200 OK, 340ms)",
    category: "action_health",
    automated: true,
  },
  {
    ts: "14:32:18",
    type: "optimisation",
    severity: "low",
    title: "Reclassified 12 pages from Playwright to HTTP",
    detail: "Analysis of last 500 crawls shows 12 pages currently routed to Playwright have identical content when fetched via HTTP. These pages use minimal JS that doesn't affect content extraction. Switching saves ~29s per re-crawl cycle.",
    action_taken: "Updated smart router rules for 12 URLs. Next crawl will use HTTP. Estimated saving: 29s per cycle.",
    category: "performance",
    automated: true,
  },
  {
    ts: "14:15:44",
    type: "accuracy_alert",
    severity: "high",
    title: "Contact recall dropped below 80% threshold",
    detail: "Rolling 7-day contact recall is 78.5%, below the 80% target. Root cause analysis: 23 staff pages use image-based layouts where names are in JPG/PNG images, not HTML text. The text extractor finds no content, so no contacts are extracted.",
    action_taken: "Flagged for human review. Suggested fix: enable OCR pipeline for pages classified as staff_directory where text extraction yields <2 contacts. Estimated impact: +6% recall.",
    category: "ai_accuracy",
    automated: false,
    requires_approval: true,
  },
  {
    ts: "13:58:21",
    type: "auto_fix",
    severity: "medium",
    title: "Duplicate organisation entities merged",
    detail: "Detected 3 pairs of duplicate organisation entities: 'Regen Power' vs 'Regen Power Pty Ltd', 'Infinite Energy' vs 'Infinite Energy Australia', 'Solar City' vs 'SolarCity Australia'. String similarity >0.85 + same domain + same address.",
    action_taken: "Merged duplicate pairs, kept the more complete entity, updated all relationships to point to surviving entity. 3 duplicate entities archived.",
    category: "data_quality",
    automated: true,
  },
  {
    ts: "13:41:07",
    type: "scheduling",
    severity: "low",
    title: "Adjusted crawl frequency for 5 domains",
    detail: "Content change analysis over 14 days: regenpower.com changes weekly (was set to monthly → now weekly). energy.gov.au hasn't changed in 14 days (was weekly → now monthly). 3 installer sites updated pricing this week (bumped to weekly).",
    action_taken: "Updated crawl_frequency in domain_profiles: 2 domains to weekly, 3 domains to monthly. Queue reprioritised.",
    category: "scheduling",
    automated: true,
  },
  {
    ts: "13:22:55",
    type: "discovery",
    severity: "info",
    title: "New installer domain discovered via backlinks",
    detail: "While crawling solarquotes.com.au/installers/perth, found 4 installer domains not in our index: perthenergysolutions.com.au, greenlightsolar.com.au, sunpowerwa.com.au, ecoelectricalperth.com.au. All appear to be active solar installers in Perth.",
    action_taken: "Added 4 new domains to crawl queue with priority 3 (seed). Deep crawl scheduled for each. Estimated 80-120 new entities.",
    category: "index_growth",
    automated: true,
  },
  {
    ts: "12:58:33",
    type: "security",
    severity: "medium",
    title: "Rate limiting detected on infiniteenergy.com.au",
    detail: "Last 3 crawl attempts returned 429 Too Many Requests. Current delay: 1000ms between requests. Their server appears to have tightened rate limits.",
    action_taken: "Increased per-domain delay from 1000ms to 3000ms. Reduced concurrent connections from 3 to 1. Added to 'gentle crawl' list.",
    category: "crawl_health",
    automated: true,
  },
  {
    ts: "12:34:11",
    type: "accuracy_improvement",
    severity: "info",
    title: "Prompt optimisation — product extraction improved",
    detail: "A/B test of revised product extraction prompt on 50 sample pages. New prompt extracts finance options 34% more often and correctly identifies tiered pricing 28% more often. F1 for product entities: 86.4% → 91.2%.",
    action_taken: "Promoted new prompt to production. Old prompt archived. Queued re-interpretation of 847 product pages with new prompt.",
    category: "ai_accuracy",
    automated: true,
  },
  {
    ts: "12:15:44",
    type: "auto_fix",
    severity: "low",
    title: "Stale entities cleaned up",
    detail: "Found 23 entities linked to pages that returned 404 on last crawl. These businesses may have closed or restructured their websites.",
    action_taken: "Marked 23 entities as stale (not deleted). Will attempt re-crawl of parent domains in 7 days. If still 404, entities will be archived.",
    category: "data_quality",
    automated: true,
  },
];

// ─── AGENT CAPABILITIES ─────────────────────────────────
const CAPABILITIES = [
  {
    name: "Crawl Health Monitor",
    icon: "🕷",
    color: "#10b981",
    description: "Watches crawl success rates per domain. When failures spike, automatically adjusts strategy — increases delays for rate-limited sites, switches from HTTP to Playwright for pages returning empty content, retries with different user agents.",
    triggers: ["Crawl failure rate > 5% on any domain", "3 consecutive failures on same URL", "New 429/403 status codes detected", "Crawl queue depth > 1000"],
    actions: ["Adjust per-domain delay", "Switch fetch method", "Retry with different strategy", "Alert human if unresolvable"],
    autonomous: true,
  },
  {
    name: "AI Accuracy Guardian",
    icon: "🧠",
    color: "#8b5cf6",
    description: "Continuously evaluates extraction accuracy by sampling entities and comparing against Claude API (ground truth). Detects accuracy degradation per category and triggers re-evaluation or prompt adjustments.",
    triggers: ["Any category F1 drops below 80%", "Classification confusion rate > 10%", "Escalation rate increases by 50%+", "New page type pattern not matching any classifier"],
    actions: ["Run accuracy evaluation on affected category", "A/B test prompt variations", "Queue re-interpretation of low-confidence pages", "Flag for human review if accuracy can't self-heal"],
    autonomous: "partial",
  },
  {
    name: "Action Reliability Engine",
    icon: "⚡",
    color: "#f59e0b",
    description: "Monitors form submission success rates. When an endpoint starts failing, immediately re-crawls the page to check for changes. Updates action maps in real-time to prevent failed submissions.",
    triggers: ["Form submission returns non-2xx status", "Success rate drops below 90% for any domain", "Endpoint URL returns 404/500", "Field validation errors on submission"],
    actions: ["Immediate re-crawl of affected page", "Update action entity with new endpoint/fields", "Test submission with sample data", "Temporarily disable unreliable actions"],
    autonomous: true,
  },
  {
    name: "Data Quality Controller",
    icon: "✓",
    color: "#06b6d4",
    description: "Detects and resolves data quality issues: duplicate entities, stale data, inconsistent relationships, missing fields. Maintains index integrity continuously.",
    triggers: ["Duplicate entities detected (name + domain similarity > 0.85)", "Entity linked to 404 page", "Price/contact changed on re-crawl", "Orphaned relationships"],
    actions: ["Merge duplicate entities", "Mark stale entities", "Update changed fields", "Queue re-crawl for verification", "Clean orphaned relationships"],
    autonomous: true,
  },
  {
    name: "Smart Scheduler",
    icon: "📅",
    color: "#ec4899",
    description: "Learns optimal crawl frequency per domain based on actual change patterns. Prioritises domains and pages that matter most — those with high query volume, rich actions, or frequent changes.",
    triggers: ["Content change detected on re-crawl", "No change detected for 3 consecutive crawls", "High query volume on a domain with stale data", "New domain discovered via link analysis"],
    actions: ["Adjust crawl frequency per domain", "Reprioritise crawl queue", "Discover new URLs from link analysis", "Pre-emptively crawl before predicted changes"],
    autonomous: true,
  },
  {
    name: "Performance Optimiser",
    icon: "🚀",
    color: "#e8edf3",
    description: "Analyses crawl and inference performance to find optimisation opportunities. Identifies pages using Playwright unnecessarily, caches repeated patterns, and tunes model parameters for speed.",
    triggers: ["Average crawl time exceeds 3s", "Playwright used for page with no JS-dependent content", "Same prompt pattern repeating across similar pages", "Cache miss rate above 30%"],
    actions: ["Reclassify pages to HTTP where possible", "Cache entity patterns for known CMS templates", "Batch similar pages for inference efficiency", "Pre-warm cache for predicted queries"],
    autonomous: true,
  },
  {
    name: "Index Growth Planner",
    icon: "📈",
    color: "#f97316",
    description: "Identifies gaps in the index and plans expansion. Analyses which queries return too few results, discovers new domains from crawled links, and suggests new verticals to index.",
    triggers: ["Search query returns < 5 results", "New domain discovered in crawled links", "User requests crawl of un-indexed URL", "Category has < 100 entities"],
    actions: ["Queue discovered domains for seed crawl", "Analyse query patterns for gaps", "Suggest new verticals based on demand", "Prioritise domains that would fill entity gaps"],
    autonomous: true,
  },
];

// ─── AGENT STATUS ───────────────────────────────────────
const AGENT_STATUS = {
  status: "active",
  uptime: "14d 7h 23m",
  decisionsToday: 34,
  autoActionsToday: 28,
  pendingApproval: 2,
  lastDecision: "2 minutes ago",
  model: "Claude Sonnet (via API — meta-decisions only)",
  decisionCostToday: "$0.42",
  rules: 47,
  watchers: 7,
};

const PENDING_APPROVALS = [
  {
    id: "approval_001",
    title: "Enable OCR pipeline for staff directory pages",
    detail: "Contact recall is 78.5% — below 80% threshold. Root cause: 23 staff pages have names in images. Enabling OCR would add ~200ms per affected page but could increase recall to ~84%. Estimated monthly cost increase: $2-3 (additional compute for OCR on ~50 pages/month).",
    impact: "+6% contact recall, +$3/mo cost",
    risk: "Low — OCR is additive, doesn't affect existing pipeline",
    recommendation: "Approve — high accuracy improvement for minimal cost",
    category: "ai_accuracy",
  },
  {
    id: "approval_002",
    title: "Add 4 newly discovered installer domains to index",
    detail: "Found perthenergysolutions.com.au, greenlightsolar.com.au, sunpowerwa.com.au, ecoelectricalperth.com.au via backlink analysis. All appear to be active solar installers in Perth. Deep crawl would add ~80-120 entities and improve category coverage.",
    impact: "+4 domains, ~100 new entities, better coverage for 'solar installers perth' queries",
    risk: "None — standard seed crawl",
    recommendation: "Approve — fills coverage gaps",
    category: "index_growth",
  },
];

export default function OpsAgent() {
  const [view, setView] = useState("decisions");
  const [expandedDecision, setExpandedDecision] = useState(null);
  const [expandedCap, setExpandedCap] = useState(null);
  const [pulseCount, setPulseCount] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setPulseCount(c => c + 1), 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ background: "#080c14", color: "#c0c8d4", minHeight: "100vh", fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ borderBottom: "1px solid #1a2535", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            background: "radial-gradient(circle, #10b981 0%, #10b98140 60%, transparent 70%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            animation: "pulse 2s infinite"
          }}>
            <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#10b981", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 8, fontWeight: 800, color: "#080c14" }}>AI</span>
            </div>
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: "#e8edf3" }}>WebDex OpsAgent</span>
              <Badge bg="#10b98120" fg="#10b981">Active</Badge>
            </div>
            <div style={{ fontSize: 10, color: "#4a5a6a" }}>Autonomous operations manager · {AGENT_STATUS.decisionsToday} decisions today · {AGENT_STATUS.pendingApproval} pending approval</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: "#4a5a6a" }}>Decision cost today</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#f59e0b", fontFamily: "'JetBrains Mono', monospace" }}>{AGENT_STATUS.decisionCostToday}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: "#4a5a6a" }}>Uptime</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#10b981", fontFamily: "'JetBrains Mono', monospace" }}>{AGENT_STATUS.uptime}</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div style={{ padding: "10px 24px 0", display: "flex", gap: 4 }}>
        {[
          { key: "decisions", label: "Decision Log", count: AGENT_DECISIONS.length },
          { key: "capabilities", label: "Agent Capabilities", count: CAPABILITIES.length },
          { key: "approvals", label: "Pending Approvals", count: PENDING_APPROVALS.length },
          { key: "config", label: "Agent Config" },
        ].map(t => (
          <button key={t.key} onClick={() => setView(t.key)} style={{
            padding: "8px 18px", borderRadius: "8px 8px 0 0", border: "none", cursor: "pointer",
            fontFamily: "inherit", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 6,
            background: view === t.key ? "#0d1520" : "transparent",
            color: view === t.key ? "#e8edf3" : "#4a5a6a",
            borderBottom: view === t.key ? "2px solid #10b981" : "2px solid transparent"
          }}>
            {t.label}
            {t.count !== undefined && (
              <span style={{
                padding: "1px 6px", borderRadius: 8, fontSize: 9, fontWeight: 700,
                background: t.key === "approvals" && t.count > 0 ? "#f59e0b30" : "#1a2535",
                color: t.key === "approvals" && t.count > 0 ? "#f59e0b" : "#4a5a6a"
              }}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      <div style={{ padding: "0 24px 24px" }}>
        <div style={{ background: "#0d1520", borderRadius: "0 0 12px 12px", border: "1px solid #1a2535", borderTop: "none", padding: 20 }}>

          {/* ─── DECISION LOG ────────────────── */}
          {view === "decisions" && (
            <div>
              <div style={{ fontSize: 12, color: "#6a7a8a", marginBottom: 16, lineHeight: 1.6 }}>
                Every decision the OpsAgent makes — automated or requiring approval — is logged with full reasoning. This is your audit trail and the data that makes the agent smarter over time.
              </div>

              {AGENT_DECISIONS.map((d, i) => {
                const typeColors = { auto_fix: "#10b981", optimisation: "#06b6d4", accuracy_alert: "#e85c5c", scheduling: "#ec4899", discovery: "#f97316", security: "#f59e0b", accuracy_improvement: "#8b5cf6" };
                const isExpanded = expandedDecision === i;

                return (
                  <div key={i} style={{
                    background: "#0a0d14", borderRadius: 10,
                    border: `1px solid ${d.requires_approval ? "#f59e0b30" : "#1a2535"}`,
                    marginBottom: 6, overflow: "hidden", cursor: "pointer"
                  }} onClick={() => setExpandedDecision(isExpanded ? null : i)}>
                    <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 4, height: 36, borderRadius: 2, background: typeColors[d.type] || "#4a5a6a", flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "#e8edf3" }}>{d.title}</span>
                          {d.automated && <Badge bg="#10b98115" fg="#10b981">Auto</Badge>}
                          {d.requires_approval && <Badge bg="#f59e0b20" fg="#f59e0b">Needs Approval</Badge>}
                        </div>
                        <div style={{ fontSize: 11, color: "#5a6a7a" }}>{d.category.replace(/_/g, " ")} · {d.ts}</div>
                      </div>
                      <Badge bg={(typeColors[d.type] || "#4a5a6a") + "15"} fg={typeColors[d.type] || "#4a5a6a"}>
                        {d.severity}
                      </Badge>
                      <span style={{ fontSize: 12, color: "#3a4a5a" }}>{isExpanded ? "▾" : "▸"}</span>
                    </div>

                    {isExpanded && (
                      <div style={{ padding: "0 16px 16px 32px", borderTop: "1px solid #1a2535" }}>
                        <div style={{ marginTop: 12, fontSize: 12, color: "#8a9ab0", lineHeight: 1.7, marginBottom: 10 }}>
                          <span style={{ color: "#6a7a8a", fontWeight: 600 }}>Analysis: </span>{d.detail}
                        </div>
                        <div style={{ padding: "10px 14px", background: "#10b98108", borderRadius: 6, border: "1px solid #10b98115", fontSize: 12, lineHeight: 1.6 }}>
                          <span style={{ color: "#10b981", fontWeight: 600 }}>Action taken: </span>
                          <span style={{ color: "#8a9ab0" }}>{d.action_taken}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ─── CAPABILITIES ────────────────── */}
          {view === "capabilities" && (
            <div>
              <div style={{ fontSize: 12, color: "#6a7a8a", marginBottom: 16, lineHeight: 1.6 }}>
                The OpsAgent runs 7 autonomous modules, each watching a different aspect of the pipeline. Most actions are taken automatically — only high-impact or irreversible changes require human approval.
              </div>

              {CAPABILITIES.map((cap, i) => {
                const isExpanded = expandedCap === i;
                return (
                  <div key={i} style={{
                    background: "#0a0d14", borderRadius: 10, border: `1px solid ${isExpanded ? cap.color + "30" : "#1a2535"}`,
                    marginBottom: 8, overflow: "hidden", cursor: "pointer"
                  }} onClick={() => setExpandedCap(isExpanded ? null : i)}>
                    <div style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: 14 }}>
                      <span style={{ fontSize: 24 }}>{cap.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#e8edf3" }}>{cap.name}</div>
                        <div style={{ fontSize: 11, color: "#5a6a7a", marginTop: 2 }}>{cap.description.slice(0, 100)}...</div>
                      </div>
                      <Badge bg={cap.autonomous === true ? "#10b98115" : cap.autonomous === "partial" ? "#f59e0b15" : "#e85c5c15"}
                             fg={cap.autonomous === true ? "#10b981" : cap.autonomous === "partial" ? "#f59e0b" : "#e85c5c"}>
                        {cap.autonomous === true ? "Fully Autonomous" : cap.autonomous === "partial" ? "Semi-Autonomous" : "Human Required"}
                      </Badge>
                      <span style={{ fontSize: 12, color: "#3a4a5a" }}>{isExpanded ? "▾" : "▸"}</span>
                    </div>

                    {isExpanded && (
                      <div style={{ padding: "0 18px 18px", borderTop: "1px solid #1a2535" }}>
                        <div style={{ fontSize: 12, color: "#8a9ab0", lineHeight: 1.7, margin: "14px 0" }}>{cap.description}</div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                          <div>
                            <div style={{ fontSize: 10, color: "#e85c5c", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6, fontWeight: 600 }}>Triggers (when does it activate?)</div>
                            {cap.triggers.map((t, j) => (
                              <div key={j} style={{ fontSize: 11, color: "#6a7a8a", padding: "4px 8px", borderLeft: `2px solid ${cap.color}30`, marginBottom: 3, lineHeight: 1.4 }}>{t}</div>
                            ))}
                          </div>
                          <div>
                            <div style={{ fontSize: 10, color: "#10b981", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6, fontWeight: 600 }}>Actions (what does it do?)</div>
                            {cap.actions.map((a, j) => (
                              <div key={j} style={{ fontSize: 11, color: "#6a7a8a", padding: "4px 8px", borderLeft: "2px solid #10b98130", marginBottom: 3, lineHeight: 1.4 }}>{a}</div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ─── PENDING APPROVALS ────────────── */}
          {view === "approvals" && (
            <div>
              {PENDING_APPROVALS.length === 0 ? (
                <div style={{ textAlign: "center", padding: 40, color: "#4a5a6a" }}>No pending approvals. The OpsAgent is handling everything autonomously.</div>
              ) : (
                PENDING_APPROVALS.map((a, i) => (
                  <div key={i} style={{ background: "#0a0d14", borderRadius: 12, border: "1px solid #f59e0b20", padding: 20, marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <Badge bg="#f59e0b20" fg="#f59e0b">Needs Your Approval</Badge>
                      <Badge bg="#1a2535" fg="#6a7a8a">{a.category.replace(/_/g, " ")}</Badge>
                    </div>

                    <div style={{ fontSize: 16, fontWeight: 700, color: "#e8edf3", marginBottom: 8 }}>{a.title}</div>
                    <div style={{ fontSize: 12, color: "#8a9ab0", lineHeight: 1.7, marginBottom: 14 }}>{a.detail}</div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
                      <div style={{ padding: "10px 12px", background: "#10b98108", borderRadius: 6, border: "1px solid #10b98115" }}>
                        <div style={{ fontSize: 9, color: "#10b981", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 3, fontWeight: 600 }}>Expected Impact</div>
                        <div style={{ fontSize: 12, color: "#c0c8d4" }}>{a.impact}</div>
                      </div>
                      <div style={{ padding: "10px 12px", background: "#f59e0b08", borderRadius: 6, border: "1px solid #f59e0b15" }}>
                        <div style={{ fontSize: 9, color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 3, fontWeight: 600 }}>Risk Assessment</div>
                        <div style={{ fontSize: 12, color: "#c0c8d4" }}>{a.risk}</div>
                      </div>
                      <div style={{ padding: "10px 12px", background: "#8b5cf608", borderRadius: 6, border: "1px solid #8b5cf615" }}>
                        <div style={{ fontSize: 9, color: "#8b5cf6", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 3, fontWeight: 600 }}>Agent Recommendation</div>
                        <div style={{ fontSize: 12, color: "#c0c8d4" }}>{a.recommendation}</div>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 10 }}>
                      <button style={{ padding: "10px 28px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, background: "#10b981", color: "#080c14" }}>
                        Approve
                      </button>
                      <button style={{ padding: "10px 28px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600, background: "#1a2535", color: "#8a9ab0" }}>
                        Reject
                      </button>
                      <button style={{ padding: "10px 28px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600, background: "#1a2535", color: "#8a9ab0" }}>
                        Modify & Approve
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ─── AGENT CONFIG ────────────────── */}
          {view === "config" && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {/* Autonomy levels */}
                <div style={{ background: "#0a0d14", borderRadius: 12, border: "1px solid #1a2535", padding: 18 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#e8edf3", marginBottom: 14 }}>Autonomy Levels</div>
                  <div style={{ fontSize: 11, color: "#5a6a7a", marginBottom: 12, lineHeight: 1.5 }}>What can the agent do without asking you?</div>

                  {[
                    { action: "Re-crawl failed pages", level: "auto", color: "#10b981" },
                    { action: "Adjust crawl frequencies", level: "auto", color: "#10b981" },
                    { action: "Merge duplicate entities", level: "auto", color: "#10b981" },
                    { action: "Update changed endpoints", level: "auto", color: "#10b981" },
                    { action: "Reclassify fetch methods", level: "auto", color: "#10b981" },
                    { action: "Add discovered domains", level: "approval", color: "#f59e0b" },
                    { action: "Enable new extraction features (OCR)", level: "approval", color: "#f59e0b" },
                    { action: "Promote new prompts to production", level: "approval", color: "#f59e0b" },
                    { action: "Delete entities permanently", level: "never", color: "#e85c5c" },
                    { action: "Change API pricing/limits", level: "never", color: "#e85c5c" },
                    { action: "Modify database schema", level: "never", color: "#e85c5c" },
                  ].map((item, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", borderRadius: 4, marginBottom: 2, background: i % 2 === 0 ? "#111c2e" : "transparent" }}>
                      <span style={{ fontSize: 12, color: "#c0c8d4" }}>{item.action}</span>
                      <Badge bg={item.color + "15"} fg={item.color}>
                        {item.level === "auto" ? "Autonomous" : item.level === "approval" ? "Needs Approval" : "Never Autonomous"}
                      </Badge>
                    </div>
                  ))}
                </div>

                {/* Thresholds */}
                <div style={{ background: "#0a0d14", borderRadius: 12, border: "1px solid #1a2535", padding: 18 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#e8edf3", marginBottom: 14 }}>Alert Thresholds</div>
                  <div style={{ fontSize: 11, color: "#5a6a7a", marginBottom: 12, lineHeight: 1.5 }}>When these thresholds are crossed, the agent activates.</div>

                  {[
                    { metric: "Classification accuracy", threshold: "< 88%", current: "91.2%", ok: true },
                    { metric: "Entity extraction F1", threshold: "< 80%", current: "84.7%", ok: true },
                    { metric: "Contact recall", threshold: "< 80%", current: "78.5%", ok: false },
                    { metric: "Form success rate", threshold: "< 90%", current: "93.6%", ok: true },
                    { metric: "Crawl error rate", threshold: "> 5%", current: "0.3%", ok: true },
                    { metric: "Escalation rate", threshold: "> 10%", current: "4.2%", ok: true },
                    { metric: "Cache hit rate", threshold: "< 70%", current: "87%", ok: true },
                    { metric: "Query latency P95", threshold: "> 500ms", current: "89ms", ok: true },
                    { metric: "Queue depth", threshold: "> 5000", current: "342", ok: true },
                  ].map((t, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 4, marginBottom: 2, background: !t.ok ? "#e85c5c08" : i % 2 === 0 ? "#111c2e" : "transparent", border: !t.ok ? "1px solid #e85c5c15" : "1px solid transparent" }}>
                      <StatusDot status={t.ok ? "active" : "alert"} />
                      <span style={{ fontSize: 12, color: "#c0c8d4", flex: 1 }}>{t.metric}</span>
                      <span style={{ fontSize: 11, color: "#4a5a6a", width: 60 }}>Alert: {t.threshold}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: t.ok ? "#10b981" : "#e85c5c", width: 50, textAlign: "right", fontFamily: "'JetBrains Mono', monospace" }}>{t.current}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* How the agent works */}
              <div style={{ marginTop: 16, padding: 20, background: "linear-gradient(135deg, #10b98108, #8b5cf608)", borderRadius: 12, border: "1px solid #10b98115" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#10b981", marginBottom: 8 }}>How the OpsAgent works</div>
                <div style={{ fontSize: 12, color: "#8a9ab0", lineHeight: 1.8 }}>
                  The OpsAgent runs as a background process that polls pipeline metrics every 60 seconds. Most decisions use rule-based logic (thresholds and patterns) — fast, predictable, and free. For complex decisions like prompt optimisation or root cause analysis, it makes a single Claude Sonnet API call with the relevant context. Today's 34 decisions cost $0.42 in API calls — about $0.012 per decision. The agent pays for itself many times over by preventing failed crawls, maintaining accuracy, and keeping the index healthy without human intervention.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
      `}</style>
    </div>
  );
}
