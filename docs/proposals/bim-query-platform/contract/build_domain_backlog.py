"""Build an inspectable hierarchical domain-design backlog, not C# record definitions.

The CSV owns candidate content; policy JSON owns the rubric and bounded shortlist.
Derived value bands are ordinal review aids, not measured ROI or correctness claims.
"""
import argparse
import csv
import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent
COLUMNS = 'id,name,domain_id,group,form,role_ids,workflow_ids,question,decision,grain,minimum_fields,relationships,tags,separate_because,merge_or_defer,impact,repeat_use,scope_cost,evidence_basis,rationale'.split(',')
FORMS = {'record','view','facet','capability'}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def read_json(name):
    return json.loads((ROOT/name).read_text(encoding='utf-8'))


def read_csv(name):
    with (ROOT/name).open(encoding='utf-8-sig',newline='') as stream:
        return list(csv.DictReader(stream))


def split(value):
    return [v.strip() for v in value.split(';') if v.strip()]


def load():
    with (ROOT/'domain-candidates.csv').open(encoding='utf-8-sig',newline='') as stream:
        reader=csv.DictReader(stream)
        require(reader.fieldnames==COLUMNS,'Candidate CSV columns differ from the authoring contract')
        candidates=list(reader)
    return candidates,read_json('domain-review-policy.json'),read_csv('domains.csv'),read_json('workflows.json')


def validate(candidates,policy,domains,workflows):
    ids=[r['id'] for r in candidates]
    require(len(ids)==len(set(ids)),'Duplicate candidate ID')
    domain_ids={d['id'] for d in domains}
    role_ids={r['id'] for r in workflows['roles']}
    workflow_ids={w['id'] for w in workflows['workflows']}
    detailed_ids={w['id'] for w in workflows['workflows'] if w['maturity']=='detailed'}
    for row in candidates:
        require(set(row)==set(COLUMNS) and all(isinstance(v,str) and v.strip() for v in row.values()),'Candidate fields must be present and nonempty')
        require(row['domain_id'] in domain_ids,'Unknown candidate domain')
        require(re.fullmatch(r'[a-z][a-z0-9_]*',row['id']),'Invalid candidate ID')
        for field in ['role_ids','workflow_ids','minimum_fields','relationships','tags']:
            values=split(row[field])
            require(values and len(values)==len(set(values)),f'{field} must be a nonempty unique list')
        require(row['form'] in FORMS,'Unknown candidate form')
        require(set(split(row['role_ids']))<=role_ids,'Unknown candidate role')
        require(set(split(row['workflow_ids']))<=workflow_ids,'Unknown candidate workflow')
        require(row['impact'] in policy['rubric']['impact'],'Unknown impact rating')
        require(row['repeat_use'] in policy['rubric']['repeatUse'],'Unknown repetition rating')
        require(row['scope_cost'] in policy['rubric']['scopeCost'],'Unknown scope cost')
        require(row['evidence_basis'] in policy['rubric']['evidenceBasis'],'Unknown evidence basis')
        if row['evidence_basis']=='workflow_scenario':
            require(bool(set(split(row['workflow_ids'])) & detailed_ids),'Scenario-grounded item needs a detailed workflow link')
        require(len(split(row['minimum_fields']))>=2,'Candidate needs a field or input sketch')
    require({r['domain_id'] for r in candidates}==domain_ids,'At least one candidate must represent each domain; this does not require activation')
    rules=[(r['impact'],r['repeatUse']) for r in policy['valueRules']]
    require(policy['version']==workflows['contractVersion'],'Backlog/workflow version mismatch')
    require(len(rules)==len(set(rules)),'Duplicate priority rule')
    expected={(i,f) for i in policy['rubric']['impact'] for f in policy['rubric']['repeatUse']}
    require(set(rules)==expected,'Priority rules must cover each impact/repetition pair')
    require(all(r['value'] in {'high','medium','low'} for r in policy['valueRules']),'Invalid value band')
    active=policy['activeDesign']
    require(isinstance(policy['activeDesignLimit'],int) and 1<=policy['activeDesignLimit']<=12,'Review limit must remain bounded')
    require(len(active)<=policy['activeDesignLimit'],'Active design budget exceeded')
    require(len({a['id'] for a in active})==len(active),'Duplicate active candidate')
    for entry in active:
        require(entry['id'] in ids and entry['whyNow'].strip() and entry['acceptanceQuestion'].strip(),'Invalid active design selection')
    current_tables={t['id'] for t in read_json('model.catalog.json')['tables']}
    fits=policy['existingContractReview']
    require(len(fits)==len({f['id'] for f in fits}),'Duplicate existing-contract review')
    for fit in fits:
        require(fit['id'] in ids and fit['incrementalGain'].strip(),'Invalid existing-contract review')
        require(fit['approach'] in {'proposed_new','extend','reuse_view'},'Invalid existing-contract approach')
        require(fit['tables'] and set(fit['tables'])<=current_tables,'Unknown existing table')
    scenarios={s['id']:s for s in read_json('examples/scenarios.json')['scenarios']}
    supported=policy['scenarioSupport']
    require(len(supported)==len({(s['id'],s['scenarioId']) for s in supported}),'Duplicate scenario support')
    for support in supported:
        require(support['id'] in ids and support['scenarioId'] in scenarios,'Unknown scenario support')
        row=next(r for r in candidates if r['id']==support['id'])
        require(row['evidence_basis']=='workflow_scenario','Brainstorm cannot claim scenario support')
        require(scenarios[support['scenarioId']]['workflowId'] in split(row['workflow_ids']),'Scenario/workflow mismatch')
        require(support['supports'].strip() and support['doesNotEstablish'].strip(),'Scenario support needs explicit limits')
    require({s['id'] for s in supported}=={r['id'] for r in candidates if r['evidence_basis']=='workflow_scenario'},'Every scenario-grounded item needs exact support')
    return True


def build(candidates,policy,domains,workflows):
    validate(candidates,policy,domains,workflows)
    bands={(r['impact'],r['repeatUse']):r['value'] for r in policy['valueRules']}
    active={a['id']:a for a in policy['activeDesign']}
    fits={f['id']:f for f in policy['existingContractReview']}
    result={'$schema':'./domain-models.schema.json','version':policy['version'],'status':'design-backlog',
        'purpose':'Candidate domain models driven by user decisions. This hierarchy is navigation, not inheritance or a list of approved C# records.',
        'authoringSources':['domain-candidates.csv','domain-review-policy.json','domains.csv','workflows.json','model.catalog.json','examples/scenarios.json'],
        'ratingBasis':policy['ratingBasis'],'activeDesignLimit':policy['activeDesignLimit'],'domains':[]}
    for domain in domains:
        out={'id':domain['id'],'name':domain['name'],'meaning':domain['meaning'],'groups':[]}
        groups={}
        for row in candidates:
            if row['domain_id']!=domain['id']:
                continue
            if row['group'] not in groups:
                group={'name':row['group'],'models':[]}
                groups[row['group']]=group
                out['groups'].append(group)
            value=bands[row['impact'],row['repeat_use']]
            fit=fits.get(row['id'],{'approach':'unassessed','tables':[],'incrementalGain':'Existing-contract fit still needs explicit review; '+row['separate_because']})
            action='design_now' if row['id'] in active else 'reuse_existing' if fit['approach']=='reuse_view' else 'park' if value=='low' else 'extend_existing' if fit['approach']=='extend' else 'validate_next'
            priority={'value':value,'impact':row['impact'],'repeatUse':row['repeat_use'],'scopeCost':row['scope_cost'],
                'evidenceBasis':row['evidence_basis'],'rationale':row['rationale'],'nextAction':action}
            if row['id'] in active:
                priority['whyNow']=active[row['id']]['whyNow']
                priority['acceptanceQuestion']=active[row['id']]['acceptanceQuestion']
            groups[row['group']]['models'].append({'id':row['id'],'name':row['name'],'form':row['form'],
                'roles':split(row['role_ids']),'workflows':split(row['workflow_ids']),'tags':split(row['tags']),
                'question':row['question'],'decision':row['decision'],'grain':row['grain'],
                'proposedFields':split(row['minimum_fields']),'relationships':split(row['relationships']),
                'separateBecause':row['separate_because'],'mergeOrDefer':row['merge_or_defer'],
                'existingContract':{k:fit[k] for k in ['approach','tables','incrementalGain']},
                'scenarioSupport':[{k:s[k] for k in ['scenarioId','supports','doesNotEstablish']} for s in policy['scenarioSupport'] if s['id']==row['id']],
                'priority':priority})
        result['domains'].append(out)
    return result


def models(document):
    return [m for d in document['domains'] for g in d['groups'] for m in g['models']]


def markdown(document):
    all_models=models(document)
    counts=Counter(m['priority']['value'] for m in all_models)
    lines=['# Domain model review queue','',
        'Generated from the candidate CSV and review policy. Edit those inputs, then run `python build_domain_backlog.py`.',
        '',f'{len(all_models)} proposals across {len(document["domains"])} domains: '+', '.join(f'{counts[v]} {v}' for v in ['high','medium','low'])+' incremental-value hypotheses.',
        '','Value concerns additions to the current contract, not the importance of a profession. Scope cost and evidence remain separate. No usage-frequency study or source-feasibility validation is claimed.',
        '','## Bounded active design wave','',
        '| Proposal | Form / approach | Value / cost | Evidence | Decision to work through | Why now |','|---|---|---|---|---|---|']
    def cell(value): return str(value).replace('|','/').replace('\n',' ')
    for m in all_models:
        p=m['priority']
        if p['nextAction']=='design_now':
            lines.append('| '+' | '.join(cell(x) for x in [m['name'],m['form']+' / '+m['existingContract']['approach'],p['value']+' / '+p['scopeCost'],p['evidenceBasis'],p['acceptanceQuestion'],p['whyNow']])+' |')
    lines+=['','Design-now means define and challenge a small semantic slice. It does not approve implementation or source availability.',
        '','## All proposals by domain','']
    for d in document['domains']:
        lines+=['### '+d['name'],'',d['meaning']+'.','',
                '| Proposal | Form | Value | Evidence | Next action | User question |','|---|---|---|---|---|---|']
        for group in d['groups']:
            for m in group['models']:
                lines.append('| '+' | '.join(cell(x) for x in [m['name'],m['form'],m['priority']['value'],m['priority']['evidenceBasis'],m['priority']['nextAction'],m['question']])+' |')
        lines.append('')
    lines+=['## How to challenge the queue','',
        'Review the question and decision first. Challenge the impact/repetition assumption, the minimum field set, and whether this needs a record, facet, view or query capability. An infrequent high-consequence case deserves explicit discussion even when the default band is medium.',
        '', 'The full hierarchical JSON includes role/workflow links, tags, grain, proposed fields, relationships, rationale and merge/defer alternatives. See [domain-models.json](domain-models.json) and [DOMAIN-DESIGN.md](DOMAIN-DESIGN.md).','']
    return '\n'.join(lines)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check',action='store_true')
    args=parser.parse_args()
    document=build(*load())
    outputs={'domain-models.json':json.dumps(document,indent=2,ensure_ascii=False)+'\n','DOMAIN-QUEUE.md':markdown(document)}
    for filename,value in outputs.items():
        path=ROOT/filename
        if args.check:
            require(path.exists() and path.read_text(encoding='utf-8')==value,f'{filename} is stale')
        else:
            path.write_text(value,encoding='utf-8',newline='\n')
    print(f'Valid domain backlog: {len(models(document))} proposals, {len(document["domains"])} domains, '+str(sum(m['priority']['nextAction']=='design_now' for m in models(document)))+' active design items.')


if __name__=='__main__':
    main()
