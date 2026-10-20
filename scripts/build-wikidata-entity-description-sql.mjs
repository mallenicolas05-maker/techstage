import { writeFileSync } from "node:fs";

const rows = JSON.parse(Buffer.from(process.argv[2], "base64url").toString("utf8"));

const typeWords = {
  company: /company|corporation|business|enterprise|firm|manufacturer|software|platform|organization|laboratory|university|school|service|retailer|bank|studio|developer|application|tool|website|technology|automaker|network|editor|model|database/i,
  speaker: /person|executive|entrepreneur|engineer|scientist|researcher|investor|founder|businessman|businesswoman|computer scientist|designer|author|academic|chief executive|technologist|educator|journalist|manager|lawyer|activist|philanthropist|director|presenter|podcaster/i,
  event: /conference|event|summit|convention|festival|podcast|show|exhibition|trade fair|symposium|series|keynote/i,
};

const sentence = (name, description) => {
  const clean = String(description ?? "").replace(/\s+/g, " ").replace(/[.]+$/, "").trim();
  if (!clean) return null;
  return `${name} is ${clean}.`;
};

const pageAliases = {
  Affirm: "Affirm_Holdings",
  Arm: "Arm_Holdings",
  Asana: "Asana,_Inc.",
  Chime: "Chime_Financial",
  Elastic: "Elastic_NV",
  HP: "HP_Inc.",
  Mistral: "Mistral_AI",
  Okta: "Okta,_Inc.",
  Oracle: "Oracle_Corporation",
  Perplexity: "Perplexity_AI",
  Plaid: "Plaid_Inc.",
  Ramp: "Ramp_(financial_technology_company)",
  Rippling: "Rippling_(company)",
  Siemens: "Siemens",
  "National Academy of Sciences": "National_Academy_of_Sciences",
  Runway: "Runway_(company)",
  Samsara: "Samsara_Inc.",
  Snap: "Snap_Inc.",
  Snowflake: "Snowflake_Inc.",
  Stanford: "Stanford_University",
  "Stanford Graduate Business School": "Stanford_Graduate_School_of_Business",
  "TED Conferences": "TED_(conference)",
  Toast: "Toast,_Inc.",
  "Vast Space": "Vast_(company)",
  Wiz: "Wiz_(company)",
  Workday: "Workday,_Inc.",
  "Black Hat USA": "Black_Hat_Briefings",
  "GITEX Global": "GITEX",
  "Cisco Live": "Cisco_Live",
  "Meta Connect": "Meta_Connect",
  "RSA Conference": "RSA_Conference",
  "Lesbians Who Tech Summit": "Lesbians_Who_Tech",
  "Oracle CloudWorld": "Oracle_OpenWorld",
  "Pichai Sundararajan": "Sundar_Pichai",
  "Christian Klein": "Christian_Klein_(businessman)",
  "Brad Smith": "Brad_Smith_(American_lawyer)",
  "Kevin Scott": "Kevin_Scott_(computer_scientist)",
  "Lisa Jackson": "Lisa_P._Jackson",
  "Brian Armstrong": "Brian_Armstrong_(businessman)",
  "Evan Williams": "Evan_Williams_(Internet_entrepreneur)",
  "Jim Farley": "Jim_Farley_(businessman)",
  "Nico Rosberg": "Nico_Rosberg",
  "Peter Beck": "Peter_Beck_(rocket_engineer)",
  "Tim Sweeney": "Tim_Sweeney_(game_developer)",
  "Tobi Lütke": "Tobias_Lütke",
};

const sqlString = (value) => `'${String(value).replaceAll("'", "''")}'`;
const results = [];
for (const row of rows) {
  const pageTitle = pageAliases[row.name] ?? row.name.replaceAll(" ", "_");
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`;
  let response;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    response = await fetch(url, { headers: { "user-agent": "TechStage/1.0 factual entity description repair" } });
    if (response.status !== 429) break;
    await new Promise((resolve) => setTimeout(resolve, 10000));
  }
  if (!response.ok) continue;
  const payload = await response.json();
  const sourceTitle = String(payload.title ?? "");
  const requestedTitle = row.name.toLowerCase();
  const normalizedTitle = sourceTitle.toLowerCase();
  const sameTitle = Boolean(pageAliases[row.name]) || normalizedTitle === requestedTitle || normalizedTitle.startsWith(`${requestedTitle} `) || requestedTitle.startsWith(`${normalizedTitle} `);
  const supportedType = typeWords[row.entity_type].test(String(payload.description ?? ""));
  const description = sameTitle && supportedType ? sentence(row.name, payload.description) : null;
  if (description) results.push({ ...row, description, evidence: payload.content_urls?.desktop?.page });
  await new Promise((resolve) => setTimeout(resolve, 1000));
}

const statements = results.map((row) => {
  if (row.entity_type === "speaker") {
    return `update public.speakers set biography=${sqlString(row.description)}, headline=coalesce(nullif(trim(headline),''),${sqlString(row.description.replace(new RegExp(`^${row.name.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")} is `), "").replace(/\.$/, ""))}) where id=${sqlString(row.id)}::uuid and status='published' and nullif(trim(biography),'') is null;`;
  }
  const table = row.entity_type === "company" ? "companies" : "events";
  return `update public.${table} set description=${sqlString(row.description)} where id=${sqlString(row.id)}::uuid and status='published' and nullif(trim(description),'') is null;`;
});
const matchedIds = new Set(results.map((row) => row.id));
const output = { matched: results.length, unmatched: rows.length - results.length, unmatchedRows: rows.filter((row) => !matchedIds.has(row.id)), evidence: results.map(({ id, evidence }) => ({ id, evidence })), sql: statements.join("\n") };
if (process.argv[3]) {
  writeFileSync(process.argv[3], `${output.sql}\n`);
  writeFileSync(`${process.argv[3]}.evidence.json`, JSON.stringify({ evidence: output.evidence, unmatchedRows: output.unmatchedRows }, null, 2));
  process.stdout.write(JSON.stringify({ matched: output.matched, unmatched: output.unmatched }));
} else {
  process.stdout.write(JSON.stringify(output));
}
