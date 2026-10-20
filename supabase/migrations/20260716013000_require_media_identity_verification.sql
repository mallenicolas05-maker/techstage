alter table public.media_sources
  add column if not exists identity_verified_at timestamptz,
  add column if not exists identity_verification_method text;

-- Titles and channels below were read back from YouTube's official oEmbed
-- endpoint. They are source metadata, not generated labels.
with verified(external_id, actual_title, actual_channel) as (values
  ('_E821In6oKo','6 out of 5 ⭐️ | WWDC25 | Apple','Apple Developer'),
  ('brQH2CCxbSE','A Conversation with Sundar Pichai and Marc Benioff | Dreamforce 2025','Salesforce'),
  ('ZY43aTWp-qI','AMD Advancing AI 2025 Keynote | OpenAI CEO Sam Altman conversation with AMD CEO Lisa Su','Techusiness'),
  ('Gce2DhADtK4','Dreamforce Main Keynote 2025','Salesforce'),
  ('D8LIIvQVGS4','Introducing NVIDIA Nemotron 3 Ultra: An Open 550B Model for Long-Running Agents','NVIDIA Developer'),
  ('k106jU3Awbk','Get ready for WWDC26','Apple Developer'),
  ('DFyJgOAap2c','Sundar Pichai gives Stanford’s 2026 Commencement address','Stanford'),
  ('5MWT_doo68k','OpenAI’s Sam Altman Talks ChatGPT, AI Agents and Superintelligence — Live at TED2025','TED'),
  ('YqYpYN4yClg','Microsoft AI Tour Madrid - Keynote - Satya Nadella','MicrosoftES'),
  ('nDgXHT7wV04','Microsoft 50th Anniversary | Satya Nadella Open','Microsoft'),
  ('gF12Xn3C-0c','A conversation with Mark Zuckerberg','Stripe'),
  ('_c69YRv6EPI','Qualcomm''s Computex Keynote: Everything Revealed in 20 Minutes','CNET'),
  ('-6r7PJ4qDPo','Microsoft AI Tour Amsterdam | ''AI is like a superpower - It''s for everyone''','MicrosoftNL'),
  ('NnVW9epLlTM','The Day After AGI | World Economic Forum Annual Meeting 2026','World Economic Forum'),
  ('VEXuQo1VOBc','Satya Nadella Keynote: Leading in the New Age of AI | New Delhi','Microsoft India'),
  ('ZpUKNYcgM-E','Sam Altman on Building the Future of AI','OpenAI'),
  ('hS1YqcewH0c','OpenAI DevDay 2025: Opening Keynote with Sam Altman','OpenAI'),
  ('Fr2-P5rgkOQ','Snapdragon Summit 2025 CEO Keynote | AI, Edge Computing & The “Ecosystem of You”','Snapdragon'),
  ('ONIexChUpuw','Stripe Sessions 2025 | Opening keynote: The future of commerce','Stripe'),
  ('YzGYdfxSP-Y','AMD and our partners are bringing AI everywhere, to everyone','AMD'),
  ('wLb9g_8r-mE','A conversation with Jony Ive','Stripe'),
  ('9C20esBUf-Q','Beyond the keynote with Sundar Pichai','Google for Developers'),
  ('hyXqcsWOONo','Use Google Meet speech translation to connect in near real-time across languages','Google Workspace')
)
update public.media_sources m
set title=v.actual_title, channel_name=v.actual_channel, updated_at=now()
from verified v where m.external_id=v.external_id;

with rejected(slug) as (values
  ('apple-wwdc-2025-keynote'),
  ('apple-wwdc-2026-keynote'),
  ('google-io-2025-from-research-to-reality'),
  ('nvidia-gtc-taipei-computex-2026-keynote'),
  ('qualcomm-computex-2025-keynote'),
  ('sam-altman-amd-advancing-ai-2025')
)
update public.appearances a
set status='review', public_ready_at=null, published_at=null, updated_at=now()
from rejected r where a.slug=r.slug;

with rejected(slug) as (values
  ('apple-wwdc-2025-keynote'),
  ('apple-wwdc-2026-keynote'),
  ('google-io-2025-from-research-to-reality'),
  ('nvidia-gtc-taipei-computex-2026-keynote'),
  ('qualcomm-computex-2025-keynote'),
  ('sam-altman-amd-advancing-ai-2025')
)
update public.ingestion_candidates c
set status='needs-review', current_stage='editorial-review',
    blocker_code='identity-channel-mismatch',
    blocker_reason='The YouTube title, official channel, or expected duration did not match the intended appearance during visual source verification.',
    requested_action='Replace this source with the exact official recording, then rerun analysis before publication.',
    updated_at=now()
from public.appearances a join rejected r on r.slug=a.slug
where c.resulting_appearance_id=a.id and c.status not in ('archived','rejected');

-- Mark only the audited, semantically matching media as verified.
update public.media_sources m
set identity_verified_at=now(), identity_verification_method='youtube-oembed-title-channel-audit', updated_at=now()
from public.appearances a
where a.canonical_source_id=m.id and a.status='published' and a.public_ready_at is not null;

create or replace function internal.appearance_is_public_ready(appearance_uuid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(
    select 1 from public.appearances a join public.media_sources m on m.id=a.canonical_source_id
    where a.id=appearance_uuid and a.status='published' and a.rights_status='embed-allowed'
      and m.canonical=true and m.embed_allowed=true and m.rights_status='embed-allowed'
      and m.identity_verified_at is not null
      and m.embed_url ~ '^https://www[.]youtube-nocookie[.]com/embed/[A-Za-z0-9_-]{11}'
      and exists(select 1 from public.analysis_artifacts aa where aa.appearance_id=a.id)
      and exists(select 1 from public.chapters c where c.appearance_id=a.id)
      and exists(select 1 from public.highlights h where h.appearance_id=a.id)
      and exists(select 1 from public.appearance_speakers s where s.appearance_id=a.id)
      and exists(select 1 from public.appearance_companies co where co.appearance_id=a.id)
      and exists(select 1 from public.appearance_topics t where t.appearance_id=a.id)
  );
$$;

update public.appearances a
set public_ready_at=case when internal.appearance_is_public_ready(a.id) then coalesce(a.public_ready_at,now()) else null end,
    updated_at=now();
