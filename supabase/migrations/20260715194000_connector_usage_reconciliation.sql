begin;

insert into public.provider_usage(provider,period,operation,request_count,credits,estimated_usd,actual_usd,model,response_status,usage_detail,connector)
select 'grok-x',to_char(now(),'YYYY-MM'),'x-video-source-pilot',1,0,0.05,0.05,'grok-4.3',200,
       jsonb_build_object('xSearchCalls',1,'videoUnderstanding',true,'reconciledFrom','budget-ledger','rawResponseRetained',false),'api'
where not exists(select 1 from public.provider_usage where provider='grok-x' and operation='x-video-source-pilot');

insert into public.provider_usage(provider,period,operation,request_count,credits,estimated_usd,actual_usd,response_status,usage_detail,connector)
select 'tavily',to_char(now(),'YYYY-MM'),'weekly-source-gap-search',3,3,0,0,200,
       jsonb_build_object('reconciledFrom','weekly-discovery-run','resultContentRetained',false),'api'
where not exists(select 1 from public.provider_usage where provider='tavily' and operation='weekly-source-gap-search');

insert into public.provider_usage(provider,period,operation,request_count,credits,estimated_usd,actual_usd,response_status,usage_detail,connector)
select 'parallel',to_char(now(),'YYYY-MM'),'implementation-source-verification',0,0,0,0,200,
       jsonb_build_object('sessionCount',1,'requestCountAvailable',false,'connectorScope','Codex implementation task'),'plugin'
where not exists(select 1 from public.provider_usage where provider='parallel' and operation='implementation-source-verification');

insert into public.provider_usage(provider,period,operation,request_count,credits,estimated_usd,actual_usd,response_status,usage_detail,connector)
select 'resend',to_char(now(),'YYYY-MM'),'domain-template-broadcast-readiness',3,0,0,0,200,
       jsonb_build_object('domains',0,'templates',0,'broadcasts',0,'sendCalls',0),'plugin'
where not exists(select 1 from public.provider_usage where provider='resend' and operation='domain-template-broadcast-readiness');

insert into public.provider_usage(provider,period,operation,request_count,input_tokens,output_tokens,estimated_usd,actual_usd,model,response_status,usage_detail,connector)
select 'gemini-stage-notes',to_char(now(),'YYYY-MM'),'four-panel-synthesis',count(*)::integer,0,0,
       coalesce(sum(estimated_usd),0),coalesce(sum(actual_usd),0),'gemini-3.1-flash-lite',200,
       jsonb_build_object('reconciledFrom','digest-runs','usageTokensAvailable',false),'api'
from public.digest_runs
where status='needs_review'
  and not exists(select 1 from public.provider_usage where provider='gemini-stage-notes' and operation='four-panel-synthesis')
having count(*)>0;

commit;
